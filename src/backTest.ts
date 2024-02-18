import { getAccount, getCandles, getMarkets } from './api/upbit';
import { getMALine } from './service/maLine';
import { getRsi } from './service/rsi';

const test = async () => {
  // const market = await getMarkets();

  const candles = await getCandles({ market: 'KRW-BTT', count: 200 });
  candles.shift();
  const prevCandles = [...candles];
  prevCandles.shift();
  const [curr20MA, curr60MA, curr200MA] = getMALine(candles);
  const [prev20MA, prev60MA, prev200MA] = getMALine(prevCandles);
  const rsi = getRsi(candles);
  // const test = getMALine(candles);

  console.log(curr20MA, curr60MA, curr200MA);
  console.log(prev20MA, prev60MA, prev200MA);
  console.log(rsi);
  console.log(prev20MA < prev60MA);
};

test();
