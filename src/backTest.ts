import { getAccount, getCandles, getMarkets } from './api/upbit';
import { Account, Candle } from './interface/upbit';
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
    await sleep(100)
    result = [...candles,...result]
  }

  console.log(result[0])
  return result
}

(async () => {
  const account : Account[] = []
  await getRangeCandles(365 * 24 ,0, "KRW-BTC")
})()