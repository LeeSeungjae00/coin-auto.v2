import { WebClient } from '@slack/web-api';

const web = new WebClient(process.env.SLACK_BOT_TOKEN_KEY);

export function slackSend(msg: string) {
  web.chat.postMessage({
    channel: '#coin',
    text: msg,
  });
}
