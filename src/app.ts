import { CronJob } from 'cron';
import dotenv from 'dotenv';
import logger from './loaders/logger';
import { getAccount, getCandles, getDayCandles, getMarkets } from './api/upbit';
import { sleep } from './utils/sleep';
import { CoinNavigator } from './interface/upbit';
import { strategy } from './service/coinStrategy';
import { slackSend } from './utils/slack';
import { buy } from './service/buy';
import { sell } from './service/sell';

dotenv.config();

const mainCron = new CronJob(
  '59 * * * *',
  () => {
    try {
      main();
    } catch (e) {
      logger.error(e);
    }
  },
  null,
  true
);

export const blockedCoin = ['KRW-PDA'];

const main = async () => {
  try {
    const account = await getAccount();
    const market: CoinNavigator[] = (await getMarkets())
      .filter((coin) => coin.market.includes('KRW-'))
      .filter((coin) => !blockedCoin.includes(coin.market))
      .map((val) => ({ ...val, status: 'hold' }));

    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - 1);

    await slackSend('=====시 작=====');
    for (const coin of market) {
      const date = new Date();
      const candles = await getCandles({
        count: 200,
        market: coin.market,
        to: date.toISOString(),
      });
      await sleep(100);
      const dayCandles = await getDayCandles({
        count: 200,
        market: coin.market,
        to: dayDate.toISOString(),
      });

      logger.info(
        `매수 시점 ${candles[0].candle_date_time_kst} | ${dayCandles[0].candle_date_time_kst}`
      );
      await strategy(account, coin, candles, dayCandles);
      await sleep(100);
    }

    await sell(market, account);
    await buy(market, account);

    const buyStr = market
      .filter((val) => val.status === 'buy')
      .reduce((prev, curr) => {
        return (prev += `${curr.korean_name} | ${curr.english_name} | 구매 \n`);
      }, '');

    const sellStr = market
      .filter((val) => val.status === 'sell')
      .reduce((prev, curr) => {
        return (prev += `${curr.korean_name} | ${curr.english_name} | 판매 \n`);
      }, '');

    await slackSend(`구매 목록 \n${buyStr}`);
    await slackSend(`판매 목록 \n${sellStr}`);

    await slackSend('=====종 료=====');
  } catch (error) {
    logger.error(error);
  }
};
