import { getAccount, getCandles, getMarkets } from './api/upbit';
import { Account, Candle, CoinNavigator } from './interface/upbit';
import { strategy } from './service/coinStrategy';
import { getMALine } from './service/maLine';
import { getRsi } from './service/rsi';
import { slackSend } from './utils/slack';
import { sleep } from './utils/sleep';

// 17520 2년

const getRangeCandles = async (from : number,to : number, market : string) => {
  const date = new Date()
  date.setHours(date.getHours() - from)
  let result : Candle[] = []

  for(let i = to; i < from; i+=200){
    const candles = await getCandles({market, count : 200, to : date.toISOString()})
    date.setHours(date.getHours() + 200)
    await sleep(100)
    result = [...candles,...result]
  }

  console.log(result[0])
  return result
}

(async () => {
  const account : Account[] = []
  const totalCandles = await getRangeCandles(365 * 24 ,0, "KRW-BTC")
  let market : CoinNavigator =  {english_name : "BTC", korean_name : '비트코인', market : "KRW-BTC", status :'hold'}

  while(totalCandles.length > 200){
    const analyzedCandles = totalCandles.slice(totalCandles.length - 201, totalCandles.length - 1)
    totalCandles.pop()
    strategy(account,market,analyzedCandles )
    if(market.status === 'buy'){
      console.log(market, analyzedCandles[0])
    }
  }
})()