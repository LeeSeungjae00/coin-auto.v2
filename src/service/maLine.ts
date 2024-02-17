import { Candle } from '../interface/upbit';

export const getMALine = (candles: Candle[]) => {
  const tempCandles = [...candles];
  if (tempCandles.length < 199) throw 'MA line is must over 200';

  const MA20 = (
    tempCandles.splice(0, 20).reduce((prev, curr) => {
      return (prev += curr.trade_price);
    }, 0) / 20
  ).toFixed(2);
  const MA60 = (
    tempCandles.splice(0, 60).reduce((prev, curr) => {
      return (prev += curr.trade_price);
    }, 0) / 60
  ).toFixed(2);

  const MA200 = (
    tempCandles.splice(0, 199).reduce((prev, curr) => {
      return (prev += curr.trade_price);
    }, 0) / 199
  ).toFixed(2);

  return [MA20, MA60, MA200].map((_) => Number(_));
};
