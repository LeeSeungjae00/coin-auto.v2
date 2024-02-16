import { CronJob } from 'cron';
import dotenv from 'dotenv';
import logger from './loaders/logger';

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
