import { Account, Candle, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { getMALine } from './maLine';
import { getRsi } from './rsi';

export const strategy = async (
  account: Account[],
  coin: CoinNavigator,
  candles: Candle[]
) => {
  try {
    coin.status = 'hold';
    //사는 조건
    if (
      !account
        .map((coin) => coin.currency)
        .includes(coin.market.split('-')[1]) &&
      buyCondition(candles)
    ) {
      coin.status = 'buy';
    }

    //판매 조건
    if (
      account
        .map((coin) => coin.currency)
        .includes(coin.market.split('-')[1]) &&
      sellCondition(candles)
    ) {
      coin.status = 'sell';
    }
  } catch (error) {
    console.log(error);
  }
};

const buyCondition = (candles: Candle[]) => {
  const tradePrices = candles.map((val) => val.trade_price);

  const [ma20, ma60] = getMALine(candles);
  const standardDeviation = Math.sqrt(
    tradePrices.slice(0, 20).reduce((prev, curr) => {
      return (prev += Math.pow(ma20 - curr, 2));
    }, 0) / 20
  );

  const expectedBuyPrice = ma20 + standardDeviation * 4;
  const expectedMa20 =
    tradePrices.slice(0, 19).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedBuyPrice) / 20;
  const expectedMa60 =
    tradePrices.slice(0, 59).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedBuyPrice) / 60;

  return !(ma20 > ma60) && expectedMa20 > expectedMa60 && ma20 < expectedMa20;
};

const sellCondition = (candles: Candle[]) => {
  const tradePrices = candles.map((val) => val.trade_price);
  const [ma20] = getMALine(candles);
  const standardDeviation = Math.sqrt(
    tradePrices.slice(0, 20).reduce((prev, curr) => {
      return (prev += Math.pow(ma20 - curr, 2));
    }, 0) / 20
  );

  const bolingerUpper = ma20 + standardDeviation * 2;
  const bolingerLower = ma20 - standardDeviation * 2;
  const expectedMa20 =
    tradePrices.slice(0, 19).reduce((prev, curr) => {
      return (prev += curr);
    }, bolingerUpper) / 20;
  const expectedMa60 =
    tradePrices.slice(0, 59).reduce((prev, curr) => {
      return (prev += curr);
    }, bolingerUpper) / 60;

  return (
    tradePrices[0] > Math.max(ma20 * 1.08, bolingerUpper) ||
    tradePrices[0] < Math.min(ma20 * 0.92, bolingerLower) ||
    !(expectedMa20 > expectedMa60)
  );
};
