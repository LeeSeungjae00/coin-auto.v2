import { Candle } from '../interface/upbit';

export const getRsi = (candles: Candle[]) => {
  if (candles.length < 14) throw 'rsi have to 14 candels';

  const tempCandles = [...candles].slice(0, 15);

  let Au = 0;
  let Ad = 0;

  for (let i = 0; i < tempCandles.length - 1; i++) {
    const val = tempCandles[i].trade_price - tempCandles[i + 1].trade_price;
    if (val < 0) {
      Ad += val;
    } else {
      Au += val;
    }
  }

  let RS = Au / (Ad * -1);

  // RSI 계산
  let RSI = 100 - 100 / (1 + RS);

  return RSI;
};
