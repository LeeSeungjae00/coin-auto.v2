import { get } from 'http';
import { getMarkets } from '../api/upbit';
import { Account, Candle, CoinNavigator } from '../interface/upbit';
import logger from '../loaders/logger';
import { getMALine } from './maLine';
import { getRsi } from './rsi';

const shortValue = 20;
const longValue = 50;

export const getScore = (candles: Candle[]) => {
  const tempCandles = [...candles];
  const nowTradePrice = candles[0].trade_price;
  const maxPrice = tempCandles.sort(
    (a, b) => b.candle_acc_trade_volume - a.candle_acc_trade_volume
  )[0].trade_price;

  return (nowTradePrice - maxPrice) / maxPrice;
};

export const getDayScore = (candles: Candle[]) => {
  return (
    (candles[0].opening_price - candles[0].trade_price) /
    candles[0].opening_price
  );
};

export const strategy = async (
  account: Account[],
  coin: CoinNavigator,
  candles: Candle[],
  dayCandles: Candle[]
) => {
  try {
    coin.status = 'hold';
    coin.score = getScore(candles) + getDayScore(dayCandles);

    //사는 조건
    if (buyCondition(candles, dayCandles)) {
      if (
        !account
          .map((coin) => coin.currency)
          .includes(coin.market.split('-')[1])
      )
        coin.status = 'buy';
    } else {
      if (
        account
          .map((coin) => coin.currency)
          .includes(coin.market.split('-')[1]) &&
        sellCondition(candles)
      ) {
        coin.status = 'sell';
      }
    }
  } catch (error) {
    // console.log(coin.market, candles.length, error);
  }
};

const buyCondition = (candles: Candle[], dayCandles: Candle[]) => {
  const tradePrices = candles.map((val) => val.trade_price);

  const maShort = getMALine(candles, shortValue);
  const maLong = getMALine(candles, longValue);

  const standardDeviation = Math.sqrt(
    tradePrices.slice(0, 20).reduce((prev, curr) => {
      return (prev += Math.pow(maShort - curr, 2));
    }, 0) / 20
  );

  const expectedBuyPrice = maShort + standardDeviation * 4.5;
  const expectedMaShort =
    tradePrices.slice(0, shortValue - 1).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedBuyPrice) / shortValue;
  const expectedMaLong =
    tradePrices.slice(0, longValue - 1).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedBuyPrice) / longValue;

  let deadCrossCount = 0;
  const tempCandles = [...candles];
  for (let i = 1; i < 3; i++) {
    const maS = getMALine(tempCandles.slice(i, shortValue + i), shortValue);
    const maL = getMALine(tempCandles.slice(i, longValue + i), longValue);
    const preMaS = getMALine(
      tempCandles.slice(i + 1, shortValue + i + 1),
      shortValue
    );
    const preMaL = getMALine(
      tempCandles.slice(i + 1, shortValue + i + 1),
      shortValue
    );

    if (maS < maL && preMaS > preMaL) {
      deadCrossCount++;
    }
  }

  const hourCandle = candles.filter((_, i) => i % 4 === 0);
  const hourMaShort = getMALine(hourCandle, 40);
  const hourMaLong = getMALine(hourCandle, 50);

  const dayMaShort = getMALine(dayCandles, 5);
  const dayMaLong = getMALine(dayCandles, 10);

  const upperTail = candles[0].high_price - candles[0].trade_price;
  const lowerTail = candles[0].trade_price - candles[0].low_price;
  const preBody = candles[1].trade_price - candles[1].opening_price;
  const currentBody = candles[0].trade_price - candles[0].opening_price;

  const squeezeCount = dayCandles
    .map((val) => val.trade_price)
    .splice(0, 20)
    .filter(
      (val) =>
        val < maShort + standardDeviation && val > maShort - standardDeviation
    ).length;

  return (
    maShort < maLong &&
    expectedMaShort > expectedMaLong &&
    hourMaShort > hourMaLong &&
    deadCrossCount < 1 &&
    dayMaShort > dayMaLong &&
    upperTail <= lowerTail &&
    preBody <= currentBody &&
    squeezeCount < 15
  );
};

const sellCondition = (candles: Candle[]) => {
  const tradePrices = candles.map((val) => val.trade_price);
  const maShort = getMALine(candles, shortValue);
  const standardDeviation = Math.sqrt(
    tradePrices.slice(0, shortValue).reduce((prev, curr) => {
      return (prev += Math.pow(maShort - curr, 2));
    }, 0) / shortValue
  );

  const expectedPrice = maShort + standardDeviation * 10;

  const expectedMaShort =
    tradePrices.slice(0, shortValue - 1).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedPrice) / shortValue;
  const expectedMaLong =
    tradePrices.slice(0, longValue - 1).reduce((prev, curr) => {
      return (prev += curr);
    }, expectedPrice) / longValue;

  const bolingerUpper = maShort + standardDeviation * 2;
  const bolingerLower = maShort - standardDeviation * 2;

  const maxVolume = Math.max(
    ...candles.map((val) => val.candle_acc_trade_volume)
  );

  let weekCandles = 0;
  for (let i = 0; i < 10; i++) {
    const maS =
      tradePrices.slice(i, shortValue + i).reduce((prev, curr) => {
        return (prev += curr);
      }, 0) / shortValue;

    if (maS >= maShort) {
      weekCandles++;
    }
  }

  return (
    candles[0].candle_acc_trade_volume === maxVolume ||
    tradePrices[0] > Math.max(maShort * 1.08, bolingerUpper) ||
    tradePrices[0] < Math.min(maShort * 0.92, bolingerLower) ||
    expectedMaShort < expectedMaLong ||
    weekCandles > 9
  );
};
