import { WebClient } from '@slack/web-api';
import logger from '../loaders/logger';

const web = new WebClient(process.env.SLACK_BOT_TOKEN_KEY);

export async function slackSend(msg: string) {
  logger.debug(msg)
  await web.chat.postMessage({
    channel: '#coin',
    text: msg,
  });
}
