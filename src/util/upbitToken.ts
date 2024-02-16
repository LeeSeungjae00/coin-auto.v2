import { v4 } from 'uuid';
import { sign } from 'jsonwebtoken';
import crypto from 'crypto';
import { encode } from 'querystring';
import * as dotenv from 'dotenv';
dotenv.config();

export const server_url: string | undefined =
  process.env.UPBIT_OPEN_API_SERVER_URL;
const access_key: string | undefined = process.env.UPBIT_ACCESS_KEY;
const secret_key: string | undefined = process.env.UPBIT_SECRET_KEY;

export function makeToken() {
  const payload: object = {
    access_key,
    nonce: v4(),
  };
  const token: string = sign(payload, secret_key as string);

  return token;
}

export function makePostToken(body: any) {
  const query = encode(body);
  const hash = crypto.createHash('sha512');
  const queryHash = hash.update(query, 'utf-8').digest('hex');

  const payload = {
    access_key: access_key,
    nonce: v4(),
    query_hash: queryHash,
    query_hash_alg: 'SHA512',
  };

  const token = sign(payload, secret_key as string);

  return token;
}
