/**
 * API Service for communicating with FastAPI backend
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface TreasuryRate {
  date: string;
  maturity: string;
  rate: number;
  source: string;
}

export interface FedRate {
  date: string;
  rate_type: string;
  rate: number;
  source: string;
}

export interface COTData {
  report_date: string;
  contract_name: string;
  open_interest_all: number;
  noncomm_positions_long: number;
  noncomm_positions_short: number;
  comm_positions_long: number;
  comm_positions_short: number;
  pct_noncomm_long: number;
  pct_noncomm_short: number;
}

export interface YieldCurvePoint {
  maturity: string;
  rate: number;
  maturity_years: number;
  source: string;
}

export interface Spread {
  date: string;
  rate_10y: number;
  rate_2y: number;
  rate_3m: number;
  spread_10y2y: number;
  spread_10y3m: number;
}

export interface FuturesPriceData {
  date: string;
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  change: number;
}

export interface FuturesSymbol {
  symbol: string;
  record_count: number;
  earliest_date: string;
  latest_date: string;
}

export interface ForwardCurvePoint {
  date: string;
  symbol: string;
  contract_month: string;
  expiration_date: string;
  price: number;
  high: number;
  low: number;
  open: number;
  change: number;
}

export interface AvailableDate {
  date: string;
  num_contracts: number;
}

export interface DataSummary {
  treasury_rates: any;
  fed_rates: any;
  cftc_cot: any;
  futures_prices: any;
}

export interface SOFRTermRate {
  date: string;
  maturity: string;  // '30D', '90D', '180D'
  rate: number;
  source: string;
}

export interface SOFRForwardPoint {
  date: string;
  contract_symbol: string;
  contract_month: string;
  expiration_date: string;
  settlement_price: number;
  implied_rate: number;
  years_to_expiry: number;
}

// TradingView Real-Time Data Types
export interface TradingViewPrice {
  symbol: string;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number | null;
  low: number | null;
  close: number;
  volume: number;
}

export interface TradingViewSubscription {
  id: string;
  symbol: string;
  timeframe: string;
  description: string;
  currency: string;
  exchange: string;
  type: string;
  loaded: boolean;
}

// Treasury API calls
export const getTreasuryRates = async (
  startDate?: string,
  endDate?: string,
  maturity?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (maturity) params.append('maturity', maturity);

  const response = await api.get(`/api/treasury/rates?${params}`);
  return response.data;
};

export const getYieldCurve = async (date?: string) => {
  const params = date ? `?curve_date=${date}` : '';
  const response = await api.get(`/api/treasury/yield-curve${params}`);
  return response.data;
};

export const getTreasurySpreads = async (
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await api.get(`/api/treasury/spreads?${params}`);
  return response.data;
};

// Fed Rates API calls
export const getFedRates = async (
  startDate?: string,
  endDate?: string,
  rateType?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (rateType) params.append('rate_type', rateType);

  const response = await api.get(`/api/fed/rates?${params}`);
  return response.data;
};

// CFTC COT API calls
export const getCOTData = async (
  startDate?: string,
  endDate?: string,
  contractName?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (contractName) params.append('contract_name', contractName);

  const response = await api.get(`/api/cftc/cot?${params}`);
  return response.data;
};

export const getCOTContracts = async () => {
  const response = await api.get('/api/cftc/contracts');
  return response.data;
};

// Futures API calls
export const getFuturesPrices = async (
  startDate?: string,
  endDate?: string,
  symbol?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (symbol) params.append('symbol', symbol);

  const response = await api.get(`/api/futures/prices?${params}`);
  return response.data;
};

export const getFuturesSymbols = async () => {
  const response = await api.get('/api/futures/symbols');
  return response.data;
};

export const getForwardCurve = async (symbol: string, curveDate?: string) => {
  const params = curveDate ? `&curve_date=${curveDate}` : '';
  const response = await api.get(`/api/futures/forward-curve?symbol=${symbol}${params}`);
  return response.data;
};

export const getAvailableCurveDates = async (symbol: string) => {
  const response = await api.get(`/api/futures/available-dates?symbol=${symbol}`);
  return response.data;
};

// SOFR API calls
export const getSOFRTermRates = async (
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await api.get(`/api/sofr/term-rates?${params}`);
  return response.data;
};

export const getSOFRFuturesPrices = async (
  startDate?: string,
  endDate?: string,
  symbol?: string
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (symbol) params.append('symbol', symbol);

  const response = await api.get(`/api/sofr/futures-prices?${params}`);
  return response.data;
};

export const getSOFRForwardCurve = async (
  curveDate?: string,
  symbol: string = 'SR3'
) => {
  const params = new URLSearchParams();
  params.append('symbol', symbol);
  if (curveDate) params.append('curve_date', curveDate);

  const response = await api.get(`/api/sofr/forward-curve?${params}`);
  return response.data;
};

export const getSOFRForwardRates = async (
  startDate?: string,
  endDate?: string,
  tenor: string = '3m6m'
) => {
  const params = new URLSearchParams();
  params.append('tenor', tenor);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await api.get(`/api/sofr/forward-rates?${params}`);
  return response.data;
};

// Stats API calls
export const getDataSummary = async () => {
  const response = await api.get('/api/stats/summary');
  return response.data;
};

// TradingView Real-Time Data API calls
export const getTradingViewSubscriptions = async () => {
  const response = await api.get('/api/tradingview/subscriptions');
  return response.data;
};

export const getTradingViewPrice = async (subscriptionId: string) => {
  const response = await api.get(`/api/tradingview/price/${subscriptionId}`);
  return response.data;
};

export const getTradingViewLatestPrices = async () => {
  const response = await api.get('/api/tradingview/latest-prices');
  return response.data;
};

export const getTradingViewHistorical = async (
  symbol: string,
  timeframe: string = '5',
  limit: number = 100
) => {
  const params = new URLSearchParams();
  params.append('timeframe', timeframe);
  params.append('limit', limit.toString());
  
  const response = await api.get(`/api/tradingview/historical/${symbol}?${params}`);
  return response.data;
};

export const subscribeTradingViewSymbol = async (
  symbol: string,
  timeframe: string = '5',
  indicators: string[] = []
) => {
  const response = await api.post('/api/tradingview/subscribe', {
    symbol,
    timeframe,
    indicators,
  });
  return response.data;
};

export const getTradingViewYieldCurve = async (date?: string) => {
  const params = date ? `?curve_date=${date}` : '';
  const response = await api.get(`/api/tradingview/yield-curve${params}`);
  return response.data;
};

export const getTradingViewYieldHistory = async (
  maturity: string = '10Y',
  startDate?: string,
  endDate?: string,
  limit: number = 365
) => {
  const params = new URLSearchParams();
  params.append('maturity', maturity);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('limit', limit.toString());
  
  const response = await api.get(`/api/tradingview/yield-history?${params}`);
  return response.data;
};

export const getTradingViewYieldSurface = async (
  startDate?: string,
  endDate?: string,
  days: number = 90
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('days', days.toString());
  
  const response = await api.get(`/api/tradingview/yield-surface?${params}`);
  return response.data;
};

export default api;

