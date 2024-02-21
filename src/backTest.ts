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
    await sleep(500)
    result = [...candles,...result]
  }

  console.log(result[0])
  return result
}

(async () => {
  const NAME = "BTC" 
  let CAPITAL = 500000
  let AMOUNT = 400000
  const windLoss :( "win" | "lose")[] = []
  const account : Account[] = []
  const totalCandles = await getRangeCandles(365 * 24 ,0, `KRW-${NAME}`)
  let market : CoinNavigator =  {english_name : NAME, korean_name : '비트코인', market : "KRW-BTC", status :'hold'}


  console.log(totalCandles[totalCandles.length - 1])

  while(totalCandles.length > 200){
    const analyzedCandles = totalCandles.slice(totalCandles.length - 201, totalCandles.length - 1)
    totalCandles.pop()
    strategy(account,market,analyzedCandles)
    if(market.status === 'buy'){
      console.log("매수",analyzedCandles[0].candle_date_time_kst)
      CAPITAL -= AMOUNT * 1.00005
      account.push({
        avg_buy_price: analyzedCandles[0].trade_price.toString(),
        currency: NAME,
        balance: (AMOUNT / analyzedCandles[0].trade_price).toString(),
        locked: '0',
        avg_buy_price_modified: false,
        unit_currency: 'KRW'
      })
    }

    if(market.status === 'sell'){
      const sellCoin = account.pop()
      if(sellCoin?.balance){
        const profit = Number(sellCoin.balance) * analyzedCandles[0].trade_price
        console.log("매도 가격: ",(profit - profit * 0.0005))
        CAPITAL += (profit - profit * 0.0005)
        if(AMOUNT <= profit){
          windLoss.push("win")
        }else{
          windLoss.push('lose')
        }
        
      }
    }
  }

  const rate = (windLoss.filter(val => val === 'win').length / windLoss.length * 100).toFixed(0)
  console.log(rate)
  console.log(CAPITAL)
})()