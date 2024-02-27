import { Candle } from '../interface/upbit';

export const getRsi = (candles: Candle[]) => {
  if (candles.length < 14) throw 'rsi have to 14 candels';

  const tempCandles = [...candles].slice(0, 15);

  let Au = 0;
  let Ad = 0;

  for (let i = tempCandles.length - 2; i > 0; i--) {
    const val = tempCandles[i].trade_price - tempCandles[i + 1].trade_price;
    if (val < 0) {
      Ad += val;
    } else {
      Au += val;
    }
  }
  return Math.round((Au / (Au + Math.abs(Ad))) * 100);
};
