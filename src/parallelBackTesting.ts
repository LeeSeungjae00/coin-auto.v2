import { Transform } from 'node:stream';
import { getAccount, getCandles, getMarkets } from './api/upbit';
import { Account, Candle, CoinNavigator } from './interface/upbit';
import { strategy } from './service/coinStrategy';
import { slackSend } from './utils/slack';
import { sleep } from './utils/sleep';
import { Console } from 'node:console';
import { PrismaClient } from '@prisma/client';
import { getRsi } from './service/rsi';
import { getMALine } from './service/maLine';

const prisma = new PrismaClient();

class CoinAnalyzer {
  private TOTAL = 7000000;
  private CAPITAL = 7000000;
  private windLoss: ('win' | 'lose')[] = [];
  private startDate = new Date('2023-02-26T08:00:00');
  private endDate = new Date('2024-02-27T09:00:00');
  private dateMap: { [key: string]: number } = {};
  private tradeCount = 0;
  private coinCandles: { [key: string]: Candle[] } = {};

  async main() {
    const markets = (await getMarkets())
      .filter((market) => market.market.includes('KRW-'))
      .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

    console.log(markets.length, '개의 코인을 분석합니다.');

    for (const market of markets) {
      this.coinCandles[market.market] = await this.getDBCandles(market.market);
    }

    this.backtest();

    console.log(this.TOTAL);
  }

  private async getDBCandles(market: string) {
    const candles = await prisma.candle.findMany({
      orderBy: [
        {
          candle_date_time_kst: 'desc',
        },
      ],
      where: {
        market: market,
        candle_date_time_kst: {
          gte: this.startDate,
          lte: this.endDate,
        },
      },
    });

    return candles;
  }

  private async getRangeCandles(from: Date, to: Date, market: string) {
    let result: Candle[] = [];

    while (to >= from) {
      const candles = await getCandles({
        market,
        count: 200,
        to: to.toISOString(),
      });
      to.setHours(to.getHours() - 200);
      await sleep(300);
      result = [...result, ...candles];
    }

    return result;
  }

  private async backtest() {
    const account: Account[] = [];
    let result = this.CAPITAL;
    while (this.endDate >= this.startDate) {
      Object.keys(this.coinCandles).forEach(async (market) => {
        const findIndex = this.coinCandles[market].findIndex(
          (val) =>
            val.candle_date_time_kst.getTime() === this.startDate.getTime()
        );

        if (findIndex === -1) return;
        if (findIndex - 200 < 0) return;

        const candles = this.coinCandles[market].slice(
          findIndex - 200,
          findIndex
        );

        if (candles.length < 200) return;

        const coinNavigator: CoinNavigator = {
          market: market,
          korean_name: market,
          english_name: market,
          status: 'hold',
        };
        strategy(account, coinNavigator, candles);

        if (coinNavigator.status === 'sell') {
          console.log(
            `매도 | ${candles[0].candle_date_time_kst.toISOString()} | ${candles[0].trade_price}`
          );
          const coin = account.find(
            (val) => val.currency === market.split('-')[1]
          );
          account.splice(
            account.findIndex((val) => val.currency === market.split('-')[1]),
            1
          );

          if (coin)
            this.TOTAL += Number(coin.balance) * Number(candles[0].trade_price);
        }
        if (coinNavigator.status === 'buy') {
          if (account.length > 84) return;
          console.log(
            `매수 | ${candles[0].candle_date_time_kst.toISOString()} | ${candles[0].trade_price}`
          );
          const balance = (
            ((this.TOTAL / (85 - account.length)) * 0.99995) /
            candles[0].trade_price
          ).toString();
          this.TOTAL -= this.TOTAL / (85 - account.length);

          console.log(
            this.TOTAL,
            balance,
            account.length,
            account.reduce(
              (prev, curr) =>
                prev + Number(curr.balance) * Number(curr.avg_buy_price),
              0
            )
          );

          account.push({
            currency: market.split('-')[1],
            balance: balance,
            locked: '0',
            avg_buy_price: candles[0].trade_price.toString(),
            avg_buy_price_modified: false,
            unit_currency: 'KRW',
          });
        }
      });
      this.startDate.setHours(this.startDate.getHours() + 1);
    }

    console.log(
      account.reduce(
        (prev, curr) =>
          prev + Number(curr.balance) * Number(curr.avg_buy_price),
        0
      )
    );
    return result;
  }

  private ts = new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk);
    },
  });
  private stdout = new Console({ stdout: this.ts });

  private getTable(data: { [key: string]: any }) {
    this.stdout.table(data);
    return (this.ts.read() || '').toString();
  }
}

const coinAnalyzer = new CoinAnalyzer();
coinAnalyzer.main();
