import { getCandles, getMarkets } from './api/upbit';
import { Account, Candle, CoinNavigator } from './interface/upbit';
import { strategy } from './service/coinStrategy';
import { sleep } from './utils/sleep';

let initMoney = 500000;
let CAPITAL = initMoney;
let AMOUNT = 10000;
const windLoss: ('win' | 'lose')[] = [];

const main = async () => {
  const markets = (await getMarkets())
    .filter((market) => market.market.includes('KRW-'))
    .map((val) => ({ ...val, status: 'hold' }) as CoinNavigator);

  console.log(markets.length, '개의 코인을 분석합니다.');

  for (const market of markets) {
    const from = new Date('2022-02-20T00:00:00');
    const to = new Date('2024-02-20T00:00:00');
    await backtest(market, from, to);
  }

  const rate = (
    (windLoss.filter((val) => val === 'win').length / windLoss.length) *
    100
  ).toFixed(0);
  console.table({
    승률: rate,
    잔고: CAPITAL,
    손익: (((CAPITAL - initMoney) / initMoney) * 100).toFixed(2),
  });
};

const getRangeCandles = async (from: Date, to: Date, market: string) => {
  let result: Candle[] = [];

  while (to >= from) {
    const candles = await getCandles({
      market,
      count: 200,
      to: to.toISOString(),
    });
    to.setHours(to.getHours() - 200);
    await sleep(300);
    result = [...result, ...candles];
  }

  return result;
};

const backtest = async (market: CoinNavigator, from: Date, to: Date) => {
  const account: Account[] = [];
  const totalCandles = await getRangeCandles(from, to, market.market);
  while (totalCandles.length > 200) {
    const analyzedCandles = totalCandles.slice(
      totalCandles.length - 201,
      totalCandles.length - 1
    );
    totalCandles.pop();
    strategy(account, market, analyzedCandles);
    if (market.status === 'buy') {
      console.log(
        `매수 | ${analyzedCandles[0].candle_date_time_kst} | ${analyzedCandles[0].trade_price}`
      );
      CAPITAL -= AMOUNT * 1.00005;
      account.push({
        avg_buy_price: analyzedCandles[0].trade_price.toString(),
        currency: market.market.split('-')[1],
        balance: (AMOUNT / analyzedCandles[0].trade_price).toString(),
        locked: '0',
        avg_buy_price_modified: false,
        unit_currency: 'KRW',
      });
    }

    if (market.status === 'sell') {
      const sellCoin = account.pop();
      if (sellCoin?.balance) {
        const profit =
          Number(sellCoin.balance) * analyzedCandles[0].trade_price * 0.9995;
        console.log(
          `매도 | ${analyzedCandles[0].candle_date_time_kst} | ${analyzedCandles[0].trade_price} | ${profit} | ${(((profit - AMOUNT) / AMOUNT) * 100).toFixed(2)}%`
        );
        CAPITAL += profit;
        if (AMOUNT <= profit) {
          windLoss.push('win');
        } else {
          windLoss.push('lose');
        }
      }
    }
  }

  const temp = account.pop();
  if (temp) {
    CAPITAL += totalCandles[0].trade_price * Number(temp.balance);
  }
};

main();
