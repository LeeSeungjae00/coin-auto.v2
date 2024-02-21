import { Account, Candle, CoinNavigator, Market } from '../interface/upbit';
import logger from '../loaders/logger';
import { getMALine } from './maLine';
import { getRsi } from './rsi';

export const strategy = async (
  account: Account[],
  coin: CoinNavigator,
  candles: Candle[]
) => {
  const prevCandles = [...candles];
  prevCandles.shift();
  const [curr20MA, curr60MA, curr200MA] = getMALine(candles);
  const [prev20MA, prev60MA, prev200MA] = getMALine(prevCandles);
  const rsi = getRsi(candles);

  coin.status = 'hold'
  //사는 조건
  if (
    !account.map((coin) => coin.currency).includes(coin.market.split('-')[1]) &&
    prev20MA < prev60MA &&
    prev60MA > prev200MA &&
    curr20MA > curr60MA &&
    rsi < 95 &&
    curr60MA * 1.05 > candles[0].trade_price &&
    candles[0].trade_price > curr60MA

  ) {
    coin.status = 'buy';
    logger.info(`${coin.korean_name}가 구매조건에 적합`);
  }

  //판매 조건
  if (
    account.map((coin) => coin.currency).includes(coin.market.split('-')[1]) &&
    (curr20MA < curr60MA || rsi > 95)
  ) {
    coin.status = 'sell';
    logger.info(`${coin.korean_name}가 판매조건에 적합`);
  }

};
