import { postBuyCoin } from '../api/upbit';
import { Account, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { sleep } from '../utils/sleep';

const MAX_BUY_COUNT = 80;

export const buy = async (market: CoinNavigator[], account: Account[]) => {
  const KRW = account.find((val) => val.currency === 'KRW');

  const remain =
    MAX_BUY_COUNT -
    account.filter((val) => !['SOLO', 'XCORE', 'KRW'].includes(val.currency))
      .length;

  const price = Math.round(Number(KRW?.balance) / remain);

  for (const coin of market.filter((val) => val.status === 'buy')) {
    await postBuyCoin(coin.market, price.toString());
    logger.info(`${coin.market} | ${coin.korean_name} | 10000원 매수 완료`);
    await sleep(100);
  }
};
