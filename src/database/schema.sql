-- Interest Rates Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Treasury Rates Table
-- Daily Treasury yield curve rates
CREATE TABLE IF NOT EXISTS treasury_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    maturity VARCHAR(10) NOT NULL,  -- e.g., '1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'
    rate DECIMAL(10, 6),  -- Interest rate as percentage (e.g., 4.5 for 4.5%)
    source VARCHAR(50) NOT NULL,  -- 'FRED', 'TREASURY', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, maturity, source)
);

CREATE INDEX idx_treasury_rates_date ON treasury_rates(date);
CREATE INDEX idx_treasury_rates_maturity ON treasury_rates(maturity);
CREATE INDEX idx_treasury_rates_date_maturity ON treasury_rates(date, maturity);

-- Federal Reserve and Policy Rates
-- Daily policy rates (Fed Funds, SOFR, etc.)
CREATE TABLE IF NOT EXISTS fed_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    rate_type VARCHAR(50) NOT NULL,  -- 'FED_FUNDS', 'SOFR', 'EFFR', etc.
    rate DECIMAL(10, 6),
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, rate_type, source)
);

CREATE INDEX idx_fed_rates_date ON fed_rates(date);
CREATE INDEX idx_fed_rates_type ON fed_rates(rate_type);
CREATE INDEX idx_fed_rates_date_type ON fed_rates(date, rate_type);

-- Futures Prices
-- Settlement prices for interest rate futures contracts
CREATE TABLE IF NOT EXISTS futures_prices (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    contract_symbol VARCHAR(20) NOT NULL,  -- e.g., 'ZN', 'ZB', 'GE', 'SR3'
    contract_month VARCHAR(10) NOT NULL,  -- e.g., 'H24', 'M24', 'U24', 'Z24'
    expiration_date DATE,
    settlement_price DECIMAL(12, 6),
    prior_settlement DECIMAL(12, 6),
    change DECIMAL(12, 6),
    high DECIMAL(12, 6),
    low DECIMAL(12, 6),
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, contract_symbol, contract_month, source)
);

CREATE INDEX idx_futures_prices_date ON futures_prices(date);
CREATE INDEX idx_futures_prices_symbol ON futures_prices(contract_symbol);
CREATE INDEX idx_futures_prices_date_symbol ON futures_prices(date, contract_symbol);
CREATE INDEX idx_futures_prices_expiration ON futures_prices(expiration_date);

-- Futures Volume and Open Interest
CREATE TABLE IF NOT EXISTS futures_volume (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    contract_symbol VARCHAR(20) NOT NULL,
    contract_month VARCHAR(10) NOT NULL,
    volume BIGINT,
    open_interest BIGINT,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, contract_symbol, contract_month, source)
);

CREATE INDEX idx_futures_volume_date ON futures_volume(date);
CREATE INDEX idx_futures_volume_symbol ON futures_volume(contract_symbol);
CREATE INDEX idx_futures_volume_date_symbol ON futures_volume(date, contract_symbol);

-- CFTC Commitments of Traders (COT) Data
CREATE TABLE IF NOT EXISTS cftc_cot (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    contract_name VARCHAR(100) NOT NULL,
    cftc_contract_code VARCHAR(20),
    
    -- Open Interest
    open_interest_all BIGINT,
    
    -- Non-Commercial (Speculative) Positions
    noncomm_positions_long BIGINT,
    noncomm_positions_short BIGINT,
    noncomm_positions_spreading BIGINT,
    
    -- Commercial (Hedger) Positions
    comm_positions_long BIGINT,
    comm_positions_short BIGINT,
    
    -- Total Reportable Positions
    total_reportable_long BIGINT,
    total_reportable_short BIGINT,
    
    -- Non-Reportable Positions
    nonreportable_positions_long BIGINT,
    nonreportable_positions_short BIGINT,
    
    -- Changes from previous week
    change_noncomm_long BIGINT,
    change_noncomm_short BIGINT,
    
    -- Percentages
    pct_noncomm_long DECIMAL(6, 2),
    pct_noncomm_short DECIMAL(6, 2),
    
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_date, contract_name, source)
);

CREATE INDEX idx_cftc_cot_date ON cftc_cot(report_date);
CREATE INDEX idx_cftc_cot_contract ON cftc_cot(contract_name);
CREATE INDEX idx_cftc_cot_date_contract ON cftc_cot(report_date, contract_name);

-- Economic Indicators
CREATE TABLE IF NOT EXISTS economic_indicators (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    indicator_name VARCHAR(100) NOT NULL,
    indicator_code VARCHAR(50) NOT NULL,
    value DECIMAL(20, 6),
    unit VARCHAR(50),  -- 'percentage', 'index', 'billions', etc.
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, indicator_code, source)
);

CREATE INDEX idx_economic_indicators_date ON economic_indicators(date);
CREATE INDEX idx_economic_indicators_code ON economic_indicators(indicator_code);
CREATE INDEX idx_economic_indicators_date_code ON economic_indicators(date, indicator_code);

-- Data Collection Log
-- Track data collection runs and status
CREATE TABLE IF NOT EXISTS data_collection_log (
    id SERIAL PRIMARY KEY,
    collection_date TIMESTAMP NOT NULL,
    source VARCHAR(50) NOT NULL,
    data_type VARCHAR(50) NOT NULL,  -- 'treasury_rates', 'futures', 'cot', etc.
    status VARCHAR(20) NOT NULL,  -- 'SUCCESS', 'PARTIAL', 'FAILED'
    records_collected INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_log_date ON data_collection_log(collection_date);
CREATE INDEX idx_collection_log_source ON data_collection_log(source);
CREATE INDEX idx_collection_log_status ON data_collection_log(status);

-- Views for common queries

-- Latest Treasury Yield Curve
CREATE OR REPLACE VIEW v_latest_treasury_curve AS
SELECT 
    date,
    maturity,
    rate,
    source
FROM treasury_rates
WHERE date = (SELECT MAX(date) FROM treasury_rates)
ORDER BY 
    CASE maturity
        WHEN '1M' THEN 1
        WHEN '3M' THEN 2
        WHEN '6M' THEN 3
        WHEN '1Y' THEN 4
        WHEN '2Y' THEN 5
        WHEN '5Y' THEN 6
        WHEN '7Y' THEN 7
        WHEN '10Y' THEN 8
        WHEN '20Y' THEN 9
        WHEN '30Y' THEN 10
    END;

-- Latest Policy Rates
CREATE OR REPLACE VIEW v_latest_policy_rates AS
SELECT 
    date,
    rate_type,
    rate,
    source
FROM fed_rates
WHERE date = (SELECT MAX(date) FROM fed_rates)
ORDER BY rate_type;

-- Yield Curve Spreads
CREATE OR REPLACE VIEW v_yield_spreads AS
SELECT 
    t10.date,
    t10.rate - t2.rate as spread_10y_2y,
    t10.rate - t3m.rate as spread_10y_3m,
    t30.rate - t5.rate as spread_30y_5y,
    t2.rate - t3m.rate as spread_2y_3m
FROM 
    (SELECT date, rate FROM treasury_rates WHERE maturity = '10Y') t10
    LEFT JOIN (SELECT date, rate FROM treasury_rates WHERE maturity = '2Y') t2 ON t10.date = t2.date
    LEFT JOIN (SELECT date, rate FROM treasury_rates WHERE maturity = '3M') t3m ON t10.date = t3m.date
    LEFT JOIN (SELECT date, rate FROM treasury_rates WHERE maturity = '30Y') t30 ON t10.date = t30.date
    LEFT JOIN (SELECT date, rate FROM treasury_rates WHERE maturity = '5Y') t5 ON t10.date = t5.date
ORDER BY t10.date DESC;

-- Data Quality Summary
CREATE OR REPLACE VIEW v_data_quality_summary AS
SELECT 
    'Treasury Rates' as data_type,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT date) as days_covered
FROM treasury_rates
UNION ALL
SELECT 
    'Fed Rates' as data_type,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT date) as days_covered
FROM fed_rates
UNION ALL
SELECT 
    'Futures Prices' as data_type,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT date) as days_covered
FROM futures_prices
UNION ALL
SELECT 
    'CFTC COT' as data_type,
    COUNT(*) as total_records,
    MIN(report_date) as earliest_date,
    MAX(report_date) as latest_date,
    COUNT(DISTINCT report_date) as days_covered
FROM cftc_cot
UNION ALL
SELECT 
    'Economic Indicators' as data_type,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT date) as days_covered
FROM economic_indicators;

