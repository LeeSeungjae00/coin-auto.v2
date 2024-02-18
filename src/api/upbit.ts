import { query } from 'winston';
import { Account, Candle, Market } from '../interface/upbit';
import logger from '../loaders/logger';
import { makePostToken, makeToken } from '../service/upbitToken';
import {
  GET_ACCOUNT,
  GET_CANDLE_LIST,
  GET_COIN_LIST,
  POST_OERDER_COIN,
} from './routes';
import upbitAPIClient from './upbitClient';
import { AxiosRequestConfig } from 'axios';

export const getAccount = (): Promise<Account[]> => {
  const config = {
    headers: { Authorization: `Bearer ${makeToken()}` },
  };

  return upbitAPIClient
    .get(GET_ACCOUNT, config)
    .then((res) => res.data)
    .catch((e) => logger.error(e));
};

export const getMarkets = (): Promise<Market[]> => {
  return upbitAPIClient
    .get(GET_COIN_LIST)
    .then((res) => res.data)
    .catch((e) => logger.error(e));
};

export const getCandles = (params: {
  market: string;
  count: number;
  to?: string;
}): Promise<Candle[]> => {
  const config = {
    params,
  };

  return upbitAPIClient.get(GET_CANDLE_LIST, config).then((res) => {
    return res.data;
  });
};

export async function postBuyCoin(market: string, price: string) {
  const data = {
    market,
    side: 'bid',
    price,
    ord_type: 'price',
  };
  const config: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${makePostToken(data)}` },
  };
  const res = await upbitAPIClient.post(POST_OERDER_COIN, data, config);
  return res.data;
}

export async function postSellCoin(market: string, volume: string) {
  const data = {
    market,
    side: 'ask',
    volume,
    ord_type: 'market',
  };
  const config: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${makePostToken(data)}` },
  };
  const res = await upbitAPIClient.post(POST_OERDER_COIN, data, config);
  return res.data;
}
