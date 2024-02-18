import { postSellCoin } from '../api/upbit';
import { Account, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { slackSend } from '../utils/slack';

export const sell = (market: CoinNavigator[], account: Account[]) => {
  market
    .filter((coin) => coin.status === 'sell')
    .forEach((coin) => {
      const volume =
        account.find((val) => val.currency === coin.market.split('-')[1])
          ?.balance || '0';
      postSellCoin(coin.market, volume);
      logger.info(
        `${coin.market} | ${coin.korean_name} | ${volume}원 매도 완료`
      );
      slackSend(`${coin.market} | ${coin.korean_name} | ${volume}원 매도 완료`);
    });
};
