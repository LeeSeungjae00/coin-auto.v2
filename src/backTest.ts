import { Transform } from 'node:stream';
import { getAccount, getCandles, getDayCandles, getMarkets } from './api/upbit';
import { Account, Candle, CoinNavigator } from './interface/upbit';
import { strategy } from './service/coinStrategy';
import { slackSend } from './utils/slack';
import { sleep } from './utils/sleep';
import { Console } from 'node:console';
import { candle, candle_candle_unit, PrismaClient } from '@prisma/client';
import { getRsi } from './service/rsi';
import { getMALine } from './service/maLine';

const prisma = new PrismaClient();

class CoinAnalyzer {
  private TOTAL = 7000000;
  private CAPITAL = 7000000;
  private windLoss: ('win' | 'lose')[] = [];
  private startDate = new Date('2022-07-18T08:00:00');
  private endDate = new Date('2024-07-18T12:00:00');
  private dateMap: { [key: string]: number } = {};
  private tradeCount = 0;
  private coinCandles: { [key: string]: Candle[] } = {};
  private coinDayCandles: { [key: string]: Candle[] } = {};
  private account: Account[] = [];

  async main() {
    let markets = (await getMarkets())
      .filter((market) => market.market.includes('KRW-'))
      .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

    // markets = markets.filter((market, index) => index < 20);

    console.log(markets.length, '개의 코인을 분석합니다.');

    for (const [index, market] of markets.entries()) {
      this.coinCandles[market.market] = await this.getDBCandles(
        market.market,
        'M60',
        this.startDate,
        this.endDate
      );
      this.coinDayCandles[market.market] = await this.getDBCandles(
        market.market,
        'DAY',
        this.startDate,
        this.endDate
      );

      console.log(`${markets.length}개 중 ${index + 1}`);
      console.log(market);
    }

    this.backtest();

    console.log(
      '잔고',
      this.account.reduce((prev, curr) => {
        prev += parseFloat(curr.balance) * parseFloat(curr.avg_buy_price);
        return prev;
      }, 0)
    );
    console.log('현금', this.TOTAL);
  }

  private async getDBCandles(
    market: string,
    unit: candle_candle_unit,
    from: Date,
    to: Date
  ) {
    const candles = await prisma.candle.findMany({
      orderBy: [
        {
          candle_date_time_kst: 'desc',
        },
      ],
      where: {
        market: market,
        candle_unit: unit,
        candle_date_time_kst: {
          gte: from,
          lte: to,
        },
      },
    });

    return candles;
  }

  private async getRangeCandles(
    from: Date,
    to: Date,
    market: string,
    unit: number = 60
  ) {
    let result: Candle[] = [];

    while (to >= from) {
      const candles = await getCandles(
        {
          market,
          count: 200,
          to: to.toISOString(),
        },
        unit
      );
      to.setHours(to.getHours() - 200);
      await sleep(300);
      result = [...result, ...candles];
    }

    return result;
  }

  private async getRangeDayCandles(from: Date, to: Date, market: string) {
    let result: Candle[] = [];

    while (to >= from) {
      const candles = await getDayCandles({
        market,
        count: 200,
        to: to.toISOString(),
      });

      to.setDate(to.getDate() - 200);
      await sleep(300);
      result = [...result, ...candles];
    }

    return result;
  }

  private async backtest() {
    const account: Account[] = this.account;
    let result = this.CAPITAL;
    while (this.endDate >= this.startDate) {
      const coinNavigators: CoinNavigator[] = [];
      const nowPrice: { [key: string]: number } = {};
      Object.keys(this.coinCandles).forEach(async (market) => {
        const findIndex = this.coinCandles[market].findIndex(
          (val) =>
            val.candle_date_time_kst.getTime() === this.startDate.getTime()
        );

        const candles = this.coinCandles[market].slice(
          findIndex,
          findIndex + 200
        );

        const dayIndex = this.coinDayCandles[market].findIndex((val) => {
          return (
            val.candle_date_time_kst.getDate() === this.startDate.getDate() &&
            val.candle_date_time_kst.getMonth() === this.startDate.getMonth() &&
            val.candle_date_time_kst.getFullYear() ===
              this.startDate.getFullYear()
          );
        });
        const dayCandles = this.coinDayCandles[market].slice(
          dayIndex,
          dayIndex + 200
        );

        if (findIndex === -1) return;
        if (findIndex - 200 < 0) return;
        if (dayIndex === -1) return;
        // if (dayIndex - 200 < 0) return;
        if (candles.length < 200) return;

        const coinNavigator: CoinNavigator = {
          market: market,
          korean_name: market,
          english_name: market,
          status: 'hold',
        };
        nowPrice[market] = candles[0].trade_price;
        strategy(account, coinNavigator, candles, dayCandles);
        coinNavigators.push(coinNavigator);
      });

      coinNavigators.sort((a, b) => {
        if (a.score && b.score) {
          return b.score - a.score;
        } else if (a.score) {
          return -1;
        } else if (b.score) {
          return 1;
        } else {
          return 0;
        }
      });

      coinNavigators.forEach((coin) => {
        if (coin.status === 'sell') {
          const price = nowPrice[coin.market];
          const findIndex = account.findIndex(
            (val) => val.currency === coin.market.split('-')[1]
          );
          if (findIndex === -1) return;

          const count = parseFloat(account[findIndex].balance);
          account.splice(findIndex, 1);
          this.TOTAL += count * price;
          console.log(this.startDate, '| sell', coin.market, count, price);
          console.log(
            'total',
            this.TOTAL,
            account.reduce((prev, curr) => {
              prev +=
                parseFloat(curr.balance) * nowPrice[`KRW-${curr.currency}`];
              return prev;
            }, 0)
          );
        }
      });

      coinNavigators.slice(0, 8).forEach((coin) => {
        if (coin.status === 'buy') {
          if (account.length >= 8) return;

          const price = nowPrice[coin.market];
          const count = (this.TOTAL * 0.9995) / (8 - account.length) / price;
          this.TOTAL -= count * price + 0.0005 * count * price;

          account.push({
            currency: coin.market.split('-')[1],
            balance: count.toString(),
            locked: '',
            avg_buy_price: price.toString(),
            avg_buy_price_modified: false,
            unit_currency: 'KRW',
          });
          console.log(this.startDate, '| buy', coin.market, count, price);
        }
      });

      this.startDate.setHours(this.startDate.getHours() + 1);
    }
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

  async pushData() {
    const markets = (await getMarkets())
      .filter((market) => market.market.includes('KRW-'))
      .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

    for (const market of markets) {
      const startDate = new Date(this.startDate);
      const endDate = new Date(this.endDate);
      const data = await this.getRangeDayCandles(
        startDate,
        endDate,
        market.market
      );

      await prisma.candle.createMany({
        data: data.map((val) => ({
          market: market.market,
          candle_date_time_kst: new Date(val.candle_date_time_kst),
          trade_price: val.trade_price,
          candle_unit: 'DAY',
          candle_acc_trade_volume: val.candle_acc_trade_volume,
          candle_acc_trade_price: val?.candle_acc_trade_price || 0,
          high_price: val.high_price,
          low_price: val.low_price,
          opening_price: val.opening_price,
        })),
        skipDuplicates: true,
      });

      console.log(data);
    }
  }
}

const coinAnalyzer = new CoinAnalyzer();
// coinAnalyzer.pushData();
coinAnalyzer.main();
