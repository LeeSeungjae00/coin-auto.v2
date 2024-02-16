import { CronJob } from 'cron';
import dotenv from 'dotenv';
import logger from './loaders/logger';
import { getAccount, getCandles, getMarkets } from './api/upbit';
import { getMALine } from './util/maLine';

dotenv.config();

// const renewAdbScheduler = new CronJob(
//   '* * * * * *',
//   () => {
//     try {
//     } catch (e) {
//       logger.error(e);
//     }
//   },
//   null,
//   true
// );
(async () => {
  const data = await getAccount();
  const market = await getMarkets();
  const btc = await getCandles({ count: 200, market: market[0].market });

  console.log(getMALine(btc));
})();
