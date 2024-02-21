import { getAccount, getCandles, getMarkets } from './api/upbit';
import { Candle } from './interface/upbit';
import { getMALine } from './service/maLine';
import { getRsi } from './service/rsi';
import { slackSend } from './utils/slack';
import { sleep } from './utils/sleep';

// 17520 2년

const getRangeCandles = async (range : number, market : string) => {
  const date = new Date()
  date.setHours(date.getHours() - range)
  let result : Candle[] = []

  for(let i = 0; i < range; i+=200){
    const candles = await getCandles({market, count : 200, to : date.toISOString()})
    await sleep(100)
    result = [...candles,...result]
  }

  console.log(result[0])
  return result
}

(async () => {
  // await getRangeCandles(365 * 24 , "KRW-BTC")
  await slackSend("test1")
  await slackSend("test2")
})()