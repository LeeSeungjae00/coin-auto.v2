export interface Account {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  avg_buy_price_modified: boolean;
  unit_currency: string;
}

export interface Market {
  market: string;
  korean_name: string;
  english_name: string;
}

export interface Candle {
  market: string;
  candle_date_time_utc: Date;
  candle_date_time_kst: Date;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  timestamp: number;
  candle_acc_trade_price: number;
  candle_acc_trade_volume: number;
  prev_closing_price: number;
  change_price: number;
  change_rate: number;
}

export interface CoinNavigator extends Market {
  status: 'buy' | 'sell' | 'hold';
}
