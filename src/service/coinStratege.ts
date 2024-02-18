import { Account, Candle, CoinNavigator, Market } from '../interface/upbit';
import logger from '../loaders/logger';
import { slackSend } from '../utils/slack';
import { getMALine } from './maLine';
import { getRsi } from './rsi';

export const stratege = async (
  account: Account[],
  coin: CoinNavigator,
  candles: Candle[]
) => {
  const prevCandles = [...candles];
  prevCandles.shift();
  const [curr20MA, curr60MA, curr200MA] = getMALine(candles);
  const [prev20MA, prev60MA, prev200MA] = getMALine(prevCandles);
  const rsi = getRsi(candles);

  //사는 조건
  if (
    !account.map((coin) => coin.currency).includes(coin.market.split('-')[1]) &&
    prev20MA < prev60MA &&
    prev60MA > prev200MA &&
    curr20MA > curr60MA &&
    curr60MA > curr200MA &&
    rsi < 90
  ) {
    coin.status = 'buy';
    logger.info(`${coin.korean_name}가 구매조건에 적합`);
    await slackSend(`${coin.korean_name}가 구매조건에 적합 \n
                RSI : ${rsi} \n
                MA20 : ${curr20MA} \n
                MA60 : ${curr60MA} \n
                MA200 : ${curr200MA} \n`);
  }

  //판매 조건
  if (
    account.map((coin) => coin.currency).includes(coin.market.split('-')[1]) &&
    (curr20MA < curr60MA || rsi > 90)
  ) {
    coin.status = 'sell';
    logger.info(`${coin.korean_name}가 판매조건에 적합`);
    await slackSend(`${coin.korean_name}가 판매조건에 적합`);
  }
};
