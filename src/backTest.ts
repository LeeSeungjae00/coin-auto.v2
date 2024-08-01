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
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost', // Redis 서버 주소
  port: 6379, // Redis 서버 포트
});

const filename = 'data.csv';
const filePath = path.join(__dirname, filename);

function findClosestDateTimeIndex(dates: Date[], targetDateTime: Date): number {
  // targetDateTime을 Date 객체로 변환
  const target: Date = targetDateTime;

  // 초기값 설정
  let closestDateTime: Date | null = null;
  let closestDiff: number = Infinity;
  let closestIndex: number = -1;

  // 날짜 배열 순회
  for (const [index, dateTimeStr] of dates.entries()) {
    const dateTime: Date = dateTimeStr;

    // targetDateTime보다 작은 날짜만 고려
    if (dateTime <= target) {
      const diff: number = target.getTime() - dateTime.getTime();

      // 가장 작은 차이를 가지는 날짜 찾기
      if (diff < closestDiff) {
        closestDiff = diff;
        closestDateTime = dateTime;
        closestIndex = index;
      }
    }
  }

  return closestIndex;
}

const prisma = new PrismaClient();

class CoinAnalyzer {
  private TOTAL = 10000000;
  private CAPITAL = 10000000;
  private windLoss: ('win' | 'lose')[] = [];
  private startDate = new Date('2022-07-18T08:00:00');
  private endDate = new Date('2024-07-18T12:00:00');
  private dateMap: { [key: string]: number } = {};
  private tradeCount = 0;
  private coinCandles: { [key: string]: Candle[] } = {};
  private coinDayCandles: { [key: string]: Candle[] } = {};
  private account: Account[] = [];
  private winCount = 0;
  private loseCount = 0;

  async main() {
    let markets = (await getMarkets())
      .filter((market) => market.market.includes('KRW'))
      .filter((market) => market.market !== 'KRW-BTT')
      .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

    // markets = markets.filter((market, index) => index % 2 === 0);

    console.log(markets.length, '개의 코인을 분석합니다.');

    for (const [index, market] of markets.entries()) {
      this.coinCandles[market.market] = await this.getCandlesFromRedis(
        market.market,
        'M60'
      );
      this.coinDayCandles[market.market] = await this.getLimitCandlesFromRedis(
        market.market,
        'DAY'
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
    console.log('승률', this.winCount / (this.winCount + this.loseCount));
  }

  private async getDBLimitCandles(
    market: string,
    unit: candle_candle_unit,
    limit: number
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
      },
      take: limit,
    });

    return candles;
  }

  async saveCandlesToRedis(
    market: string,
    unit: candle_candle_unit,
    candles: Candle[]
  ) {
    const key = `candles:${market}:${unit}`;
    await redis.set(key, JSON.stringify(candles));
  }

  async getCandlesFromRedis(
    market: string,
    unit: candle_candle_unit
  ): Promise<Candle[]> {
    const key = `candles:${market}:${unit}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data).map((val: any) => ({
        ...val,
        candle_date_time_kst: new Date(val.candle_date_time_kst),
      })) as Candle[];
    } else {
      const candles = await this.getDBCandles(
        market,
        unit,
        this.startDate,
        this.endDate
      );
      await this.saveCandlesToRedis(market, unit, candles);
      return candles;
    }
  }

  async getLimitCandlesFromRedis(
    market: string,
    unit: candle_candle_unit
  ): Promise<Candle[]> {
    const key = `candles:${market}:${unit}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data).map((val: any) => ({
        ...val,
        candle_date_time_kst: new Date(val.candle_date_time_kst),
      })) as Candle[];
    } else {
      const candles = await this.getDBLimitCandles(market, unit, 800);
      await this.saveCandlesToRedis(market, unit, candles);
      return candles;
    }
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
    const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    writeStream.write('날짜,금액\n');
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

        const dayIndex = findClosestDateTimeIndex(
          this.coinDayCandles[market].map((val) => val.candle_date_time_kst),
          this.startDate
        );

        const dayCandles = this.coinDayCandles[market].slice(
          dayIndex + 2,
          dayIndex + 200 + 2
        );

        if (findIndex === -1) return;
        nowPrice[market] = candles[0].trade_price;
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
          if (
            nowPrice[`KRW-${account[findIndex].currency}`] >
            parseFloat(account[findIndex].avg_buy_price)
          ) {
            this.winCount++;
            console.log(
              this.startDate,
              '| sell',
              coin.market,
              count,
              price,
              'win'
            );
          } else {
            this.loseCount++;
            console.log(
              this.startDate,
              '| sell',
              coin.market,
              count,
              price,
              'lose'
            );
          }
          account.splice(findIndex, 1);
          this.TOTAL += count * price - 0.0005 * count * price;
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

      coinNavigators.slice(0, 15).forEach((coin) => {
        if (coin.status === 'buy') {
          if (account.length >= 4) return;

          const price = nowPrice[coin.market];
          const count = (this.TOTAL * 0.9995) / (4 - account.length) / price;
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

      const total = account.reduce((prev, curr) => {
        prev +=
          parseFloat(curr.balance) *
          (nowPrice[`KRW-${curr.currency}`] || parseFloat(curr.avg_buy_price));
        return prev;
      }, this.TOTAL);
      console.log(
        `날짜: ${this.startDate} | 총 자산: ${total} | 수익률 ${((total / this.CAPITAL) * 100).toFixed(2)}%`
      );
      writeStream.write(
        `${this.startDate.toISOString()},${
          this.TOTAL +
          account.reduce((prev, curr) => {
            if (nowPrice[`KRW-${curr.currency}`] === undefined)
              console.log(curr.currency, this.startDate);
            prev +=
              parseFloat(curr.balance) *
              (nowPrice[`KRW-${curr.currency}`] ||
                parseFloat(curr.avg_buy_price));
            return prev;
          }, 0)
        }\n`
      );
      console.table(account);
      this.startDate.setHours(this.startDate.getHours() + 1);
    }
    writeStream.end();
    writeStream.on('finish', () => {
      console.log('All rows appended to file');
    });
    writeStream.on('error', (err) => {
      console.error('Error writing to file', err);
    });
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
