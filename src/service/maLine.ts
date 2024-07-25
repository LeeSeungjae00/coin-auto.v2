import { Candle } from '../interface/upbit';

export const getMALine = (candles: Candle[], unit: number) => {
  const tempCandles = [...candles];
  if (tempCandles.length < unit) {
    throw `MA line is must over ${unit} candles`;
  }

  const MA =
    tempCandles.slice(0, unit).reduce((prev, curr) => {
      return (prev += curr.trade_price);
    }, 0) / unit;

  return MA;
};
