-- TradingView Service Database Schema
-- Add these tables to your existing interest_rates_db database

-- Real-time price data (intraday)
CREATE TABLE IF NOT EXISTS tradingview_prices (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50),
    price NUMERIC(12, 6),
    open NUMERIC(12, 6),
    high NUMERIC(12, 6),
    low NUMERIC(12, 6),
    volume BIGINT,
    timeframe VARCHAR(10) NOT NULL,  -- '1', '5', '15', '60', 'D'
    source VARCHAR(50) DEFAULT 'TRADINGVIEW',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, symbol, timeframe)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tv_prices_symbol_time 
    ON tradingview_prices(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tv_prices_timeframe 
    ON tradingview_prices(timeframe, timestamp DESC);

-- Technical indicators
CREATE TABLE IF NOT EXISTS tradingview_indicators (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    indicator_name VARCHAR(100) NOT NULL,  -- 'RSI', 'MACD', 'MA', etc.
    indicator_value NUMERIC(12, 6),
    parameters JSONB,  -- Store all indicator outputs
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, symbol, indicator_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tv_indicators_symbol_name 
    ON tradingview_indicators(symbol, indicator_name, timestamp DESC);

-- Symbol metadata
CREATE TABLE IF NOT EXISTS tradingview_symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    exchange VARCHAR(50),
    type VARCHAR(50),  -- 'futures', 'bonds', 'forex', 'stocks'
    tradingview_symbol VARCHAR(100),  -- Full TradingView symbol format
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- View: Latest prices for all symbols
CREATE OR REPLACE VIEW v_tradingview_latest_prices AS
SELECT DISTINCT ON (symbol, timeframe)
    symbol,
    timeframe,
    timestamp,
    price,
    open,
    high,
    low,
    volume,
    exchange
FROM tradingview_prices
ORDER BY symbol, timeframe, timestamp DESC;

-- View: Latest indicators
CREATE OR REPLACE VIEW v_tradingview_latest_indicators AS
SELECT DISTINCT ON (symbol, indicator_name)
    symbol,
    indicator_name,
    timestamp,
    indicator_value,
    parameters
FROM tradingview_indicators
ORDER BY symbol, indicator_name, timestamp DESC;

-- View: Price changes (5-min bars)
CREATE OR REPLACE VIEW v_tradingview_price_changes AS
WITH latest AS (
    SELECT DISTINCT ON (symbol)
        symbol,
        price as current_price,
        timestamp as current_time
    FROM tradingview_prices
    WHERE timeframe = '5'
    ORDER BY symbol, timestamp DESC
),
previous AS (
    SELECT DISTINCT ON (p.symbol)
        p.symbol,
        p.price as previous_price,
        p.timestamp as previous_time
    FROM tradingview_prices p
    INNER JOIN latest l ON p.symbol = l.symbol
    WHERE p.timeframe = '5'
      AND p.timestamp < l.current_time
    ORDER BY p.symbol, p.timestamp DESC
)
SELECT 
    l.symbol,
    l.current_price,
    p.previous_price,
    (l.current_price - p.previous_price) as price_change,
    ROUND(((l.current_price - p.previous_price) / p.previous_price * 100)::numeric, 2) as pct_change,
    l.current_time,
    p.previous_time
FROM latest l
LEFT JOIN previous p ON l.symbol = p.symbol;

-- Comments
COMMENT ON TABLE tradingview_prices IS 'Real-time and intraday price data from TradingView';
COMMENT ON TABLE tradingview_indicators IS 'Technical indicator values (RSI, MACD, etc.)';
COMMENT ON TABLE tradingview_symbols IS 'Symbol metadata and descriptions';

