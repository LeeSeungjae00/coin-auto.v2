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
  private TOTAL = 0;
  private CAPITAL = 10000;
  private windLoss: ('win' | 'lose')[] = [];
  private startDate = new Date('2024-02-26T08:00:00');
  private endDate = new Date('2024-02-27T09:00:00');
  private dateMap: { [key: string]: number } = {};
  private tradeCount = 0;

  async main() {
    const markets = (await getMarkets())
      .filter((market) => market.market.includes('KRW-'))
      .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

    console.log(markets.length, '개의 코인을 분석합니다.');

    for (const market of markets) {
      const from = new Date(this.startDate);
      const to = new Date(this.endDate);
      this.TOTAL += await this.backtest(market, from, to);
    }

    const rate = (
      (this.windLoss.filter((val) => val === 'win').length /
        this.windLoss.length) *
      100
    ).toFixed(0);
    const result = {
      승률: `${rate}%`,
      잔고: this.TOTAL,
      손익:
        ((this.TOTAL / (markets.length * this.CAPITAL)) * 100).toFixed(2) + '%',
    };

    console.table(result);
    console.table({
      최대구매: Object.keys(this.dateMap)
        .map((val) => ({ date: val, count: this.dateMap[val] }))
        .sort((a, b) => b.count - a.count)[0],
      매도횟수: this.tradeCount,
    });
    const str = this.getTable(result);
    slackSend(str, '#backtest');
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

  private async backtest(market: CoinNavigator, from: Date, to: Date) {
    const account: Account[] = [];
    let result = this.CAPITAL;
    // const totalCandles = await this.getRangeCandles(from, to, market.market);
    const totalCandles = await this.getDBCandles(market.market);
    while (totalCandles.length >= 200) {
      const analyzedCandles = totalCandles.slice(
        totalCandles.length - 200,
        totalCandles.length
      );
      totalCandles.pop();
      // this.testStrategy(account, market, analyzedCandles);
      strategy(account, market, analyzedCandles);

      if (market.status === 'buy') {
        console.log(
          `매수 | ${analyzedCandles[0].candle_date_time_kst.toISOString()} | ${analyzedCandles[0].trade_price}`
        );
        this.dateMap[analyzedCandles[0].candle_date_time_kst.toISOString()]
          ? ++this.dateMap[
              analyzedCandles[0].candle_date_time_kst.toISOString()
            ]
          : (this.dateMap[
              analyzedCandles[0].candle_date_time_kst.toISOString()
            ] = 1);

        const balance = (
          (result * 0.99995) /
          analyzedCandles[0].trade_price
        ).toString();
        result = 0;

        account.push({
          avg_buy_price: analyzedCandles[0].trade_price.toString(),
          currency: market.market.split('-')[1],
          balance: balance,
          locked: '0',
          avg_buy_price_modified: false,
          unit_currency: 'KRW',
        });
      }

      if (market.status === 'sell') {
        const sellCoin = account.pop();
        if (sellCoin?.balance) {
          this.tradeCount++;
          const profit =
            Number(sellCoin.balance) * analyzedCandles[0].trade_price * 0.9995;
          console.log(
            `매도 | ${analyzedCandles[0].candle_date_time_kst.toISOString()} | ${analyzedCandles[0].trade_price} | ${profit} | ${(((analyzedCandles[0].trade_price - Number(sellCoin.avg_buy_price)) / Number(sellCoin.avg_buy_price)) * 100).toFixed(2)}%`
          );
          result += profit;
          if (analyzedCandles[0].trade_price > Number(sellCoin.avg_buy_price)) {
            this.windLoss.push('win');
          } else {
            this.windLoss.push('lose');
          }
        }
      }
    }

    const temp = account.pop();
    if (temp) {
      result = totalCandles[0].trade_price * Number(temp.balance);
    }

    console.log(
      `${market.korean_name} | ${(((result - this.CAPITAL) / this.CAPITAL) * 100).toFixed(2)}% | ${result}`
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
