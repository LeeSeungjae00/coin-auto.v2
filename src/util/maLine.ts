import { Candle } from '../interface/upbit';

export const getMALine = (candles: Candle[], count = 60) => {
  if (candles.length < count) throw 'ma line is must over 60';

  const total = candles.splice(0, count).reduce((prev, curr) => {
    return (prev += curr.trade_price);
  }, 0);

  return (total / count).toFixed(2);
};
