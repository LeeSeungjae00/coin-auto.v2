import { WebClient } from '@slack/web-api';
import logger from '../loaders/logger';

const web = new WebClient(process.env.SLACK_BOT_TOKEN_KEY);

export async function slackSend(msg: string, channel = '#coin') {
  await web.chat.postMessage({
    channel,
    text: msg,
  });
}
