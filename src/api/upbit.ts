import { query } from 'winston';
import { Account, Candle, Market } from '../interface/upbit';
import logger from '../loaders/logger';
import { makeToken } from '../service/upbitToken';
import { GET_ACCOUNT, GET_CANDLE_LIST, GET_COIN_LIST } from './routes';
import upbitAPIClient from './upbitClient';

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
