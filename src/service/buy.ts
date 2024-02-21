import { postBuyCoin } from '../api/upbit';
import { CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { sleep } from '../utils/sleep';

export const buy = async (market: CoinNavigator[]) => {
  for (const coin of market.filter((val) => val.status === 'buy')) {
    await postBuyCoin(coin.market, '10000');
    logger.info(`${coin.market} | ${coin.korean_name} | 10000원 매수 완료`);
    await sleep(100);
  }
};
