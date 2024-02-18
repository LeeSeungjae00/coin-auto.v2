import { postBuyCoin } from '../api/upbit';
import { CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { slackSend } from '../utils/slack';

export const buy = (market: CoinNavigator[]) => {
  market
    .filter((coin) => coin.status === 'buy')
    .forEach((coin) => {
      postBuyCoin(coin.market, '10000');
      logger.info(`${coin.market} | ${coin.korean_name} | 10000원 매수 완료`);
      slackSend(`${coin.market} | ${coin.korean_name} | 10000원 매수 완료`);
    });
};
