import { postSellCoin } from '../api/upbit';
import { Account, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { slackSend } from '../utils/slack';
import { sleep } from '../utils/sleep';

export const sell = async (market: CoinNavigator[], account: Account[]) => {
  for (const coin of market.filter((coin) => coin.status === 'sell')) {
    const volume =
      account.find((val) => val.currency === coin.market.split('-')[1])
        ?.balance || '0';
    await postSellCoin(coin.market, volume);
    logger.info(`${coin.market} | ${coin.korean_name} | ${volume}원 매도 완료`);
    sleep(100);
  }
};
