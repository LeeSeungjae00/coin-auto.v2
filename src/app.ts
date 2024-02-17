import { CronJob } from 'cron';
import dotenv from 'dotenv';
import logger from './loaders/logger';
import { getAccount, getCandles, getMarkets } from './api/upbit';
import { getMALine } from './service/maLine';
import { sleep } from './utils/sleep';
import { CoinNavigator } from './interface/upbit';
import { getRsi } from './service/rsi';

dotenv.config();

const renewAdbScheduler = new CronJob(
  '1 * * * *',
  () => {
    try {
      console.log('test');
    } catch (e) {
      logger.error(e);
    }
  },
  null,
  true
);

const main = async () => {
  const account = await getAccount();
  const market = (await getMarkets())
    .filter((coin) => coin.market.includes('KRW-'))
    .map((val) => ({ ...val, status: 'hold' }));

  for (const coin of market) {
    const candles = await getCandles({ count: 200, market: coin.market });
    const prevCandles = [...candles];
    prevCandles.shift();
    const [curr20MA, curr60MA, curr200MA] = getMALine(candles);
    const [prev20MA, prev60MA, prev200MA] = getMALine(prevCandles);
    const rsi = getRsi(candles);

    console.log(coin.market);
    console.log(curr20MA, curr60MA, curr200MA);
    console.log(prev20MA, prev60MA, prev200MA);
    console.log(rsi);

    //사는 조건
    if (
      // !account
      //   .map((coin) => coin.currency)
      //   .includes(coin.market.split('-')[1]) &&
      prev20MA < prev60MA &&
      prev60MA > prev200MA &&
      curr20MA > curr60MA &&
      curr60MA > curr200MA &&
      rsi < 90
    ) {
      coin.status = 'buy';
      logger.info(`${coin.korean_name}가 구매조건에 적합`);
    }

    //판매 조건
    if (
      account
        .map((coin) => coin.currency)
        .includes(coin.market.split('-')[1]) &&
      (curr20MA < curr60MA || rsi > 90)
    ) {
      coin.status = 'sell';
      logger.info(`${coin.korean_name}가 판매조건에 적합`);
    }
    await sleep(100);
  }
};

main();
