import { postBuyCoin } from '../api/upbit';
import { Account, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { sleep } from '../utils/sleep';

const MAX_BUY_COUNT = 3;
const MAX_RANK_COUNT = 25;

export const buy = async (market: CoinNavigator[], account: Account[]) => {
  const totalcapital = account.reduce((prev, curr) => {
    if (curr.currency === 'KRW') return (prev += Number(curr.balance));
    return (prev += Number(curr.balance) * Number(curr.avg_buy_price));
  }, 0);
  const price = totalcapital / MAX_BUY_COUNT;

  for (const coin of market
    .sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      return scoreB - scoreA;
    })
    .splice(0, MAX_RANK_COUNT)
    .filter((val) => val.status === 'buy')) {
    await postBuyCoin(coin.market, price.toString());
    logger.info(`${coin.market} | ${coin.korean_name} | ${price}원 매수 완료`);
    await sleep(100);
  }
};
