import { CronJob } from 'cron';
import dotenv from 'dotenv';
import logger from './loaders/logger';
import { getAccount, getCandles, getMarkets } from './api/upbit';
import { sleep } from './utils/sleep';
import { CoinNavigator } from './interface/upbit';
import { stratege } from './service/coinStratege';
import { slackSend } from './utils/slack';
import { buy } from './service/buy';
import { sell } from './service/sell';

dotenv.config();

const mainCron = new CronJob(
  '1 * * * *',
  async () => {
    try {
      await main();
    } catch (e) {
      logger.error(e);
    }
  },
  null,
  true
);

const main = async () => {
  const account = await getAccount();
  const market: CoinNavigator[] = (await getMarkets())
    .filter((coin) => coin.market.includes('KRW-'))
    .map((val) => ({ ...val, status: 'hold' }));

  slackSend('=====분 석 시 작=====');
  for (const coin of market) {
    const candles = await getCandles({ count: 200, market: coin.market });
    stratege(account, coin, candles);
    await sleep(100);
  }
  slackSend('=====분 석 종 료=====');

  slackSend('=====판 매 시 작=====');
  sell(market, account);
  slackSend('=====판 매 종 료=====');
  slackSend('=====구 매 시 작=====');
  buy(market);
  slackSend('=====구 매 종 료=====');
};
