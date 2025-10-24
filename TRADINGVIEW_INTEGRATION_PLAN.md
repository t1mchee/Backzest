# TradingView Integration Plan for Backzest

## Overview

This document outlines how to integrate the TradingView API into the Backzest interest rates data infrastructure to add real-time market data, technical indicators, and intraday price data.

## Value Proposition

### What TradingView Adds to Backzest:

1. **Real-Time Data**: Live price updates for futures, bonds, and rates instruments
2. **Intraday Data**: Minute-level granularity (currently only end-of-day)
3. **Technical Indicators**: RSI, MACD, moving averages, volume profiles, etc.
4. **Broader Coverage**: Access to 1000s of symbols across all exchanges
5. **No API Rate Limits**: Unlike FRED (120 calls/min) - unlimited via websockets
6. **Live Dashboard**: Real-time charts and alerts for rate movements

## Architecture Integration

```
Backzest Current Architecture:
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│            (Charts, Dashboard, Data Tables)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼──────────────────────────────────────┐
│              FastAPI Backend (Python)                        │
│           (REST endpoints for all data)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 PostgreSQL Database                          │
│         (Treasury, Fed Rates, CFTC, Futures)                │
└──────────────────────▲──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                Data Collectors (Python)                      │
│     FRED │ Treasury │ CFTC │ CME │ Futures (yfinance)      │
└─────────────────────────────────────────────────────────────┘

NEW: TradingView Integration Layer:
┌─────────────────────────────────────────────────────────────┐
│         Node.js TradingView Service (Separate Process)      │
│           - WebSocket connection to TradingView             │
│           - Real-time price streaming                        │
│           - Technical indicator calculations                 │
│           - REST API for historical data                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
                       ▼
         ┌─────────────────────────┐
         │   FastAPI Backend       │
         │   (New endpoints)       │
         │   - /api/tradingview/*  │
         └─────────────────────────┘
```

## Implementation Plan

### Phase 1: TradingView Data Collector (Node.js Service)

**Location**: `/Users/Tim/Backzest/services/tradingview/`

**Why Node.js?**: 
- TradingView API is JavaScript-based
- Better for websocket management
- Can run alongside Python backend

**Components**:
1. WebSocket client for real-time data
2. Historical data fetcher
3. Indicator calculator
4. REST API for Python backend to query
5. Redis cache for real-time prices (optional)

### Phase 2: Database Schema Extension

**New Tables**:
```sql
-- Real-time futures prices (intraday)
tradingview_prices (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50),
    price NUMERIC(12, 6),
    volume BIGINT,
    timeframe VARCHAR(10),  -- '1', '5', '15', '60', 'D'
    source VARCHAR(50) DEFAULT 'TRADINGVIEW'
)

-- Technical indicators
tradingview_indicators (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    indicator_name VARCHAR(100),  -- 'RSI', 'MACD', 'MA'
    indicator_value NUMERIC(12, 6),
    parameters JSONB  -- Store indicator settings
)

-- Symbol metadata
tradingview_symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE,
    description TEXT,
    exchange VARCHAR(50),
    type VARCHAR(50),  -- 'futures', 'bonds', 'forex'
    tradingview_symbol VARCHAR(100),  -- 'BINANCE:BTCUSDT'
    last_updated TIMESTAMPTZ
)
```

### Phase 3: Python Backend Integration

**New FastAPI Endpoints**:
```python
# /Users/Tim/Backzest/backend/main.py additions

@app.get("/api/tradingview/realtime/{symbol}")
async def get_realtime_price(symbol: str)
    """Get current real-time price from TradingView"""

@app.get("/api/tradingview/historical/{symbol}")
async def get_historical_intraday(symbol: str, timeframe: str, days: int)
    """Get historical intraday data"""

@app.get("/api/tradingview/indicators/{symbol}")
async def get_indicator_values(symbol: str, indicator: str)
    """Get technical indicator values"""

@app.websocket("/ws/tradingview/{symbol}")
async def websocket_price_stream(symbol: str)
    """WebSocket for real-time price streaming to frontend"""
```

### Phase 4: Frontend React Integration

**New Components**:
- `<TradingViewChart />` - Real-time candlestick charts
- `<LivePriceWidget />` - Live price ticker
- `<IndicatorPanel />` - Technical analysis dashboard
- `<AlertsManager />` - Price alerts

## Detailed Implementation

### Step 1: Create TradingView Service

**File**: `/Users/Tim/Backzest/services/tradingview/package.json`
```json
{
  "name": "backzest-tradingview-service",
  "version": "1.0.0",
  "dependencies": {
    "@mathieuc/tradingview": "^3.5.2",
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "axios": "^1.5.0"
  }
}
```

### Step 2: Main TradingView Collector

**File**: `/Users/Tim/Backzest/services/tradingview/collector.js`

Key Functions:
- `subscribeToSymbol(symbol, timeframe)` - Start collecting data
- `unsubscribeFromSymbol(symbol)` - Stop collection
- `getHistoricalData(symbol, from, to, timeframe)` - Fetch historical
- `addIndicator(symbol, indicator, params)` - Add technical indicator

### Step 3: Database Connector

**File**: `/Users/Tim/Backzest/services/tradingview/database.js`

- Connect to PostgreSQL
- Insert real-time prices
- Store indicator values
- Query historical data

### Step 4: REST API Server

**File**: `/Users/Tim/Backzest/services/tradingview/server.js`

Endpoints for Python backend to call:
- `GET /symbols` - List available symbols
- `POST /subscribe` - Start collecting a symbol
- `GET /price/:symbol` - Get latest price
- `GET /historical/:symbol` - Get historical data
- `GET /indicators/:symbol/:indicator` - Get indicator values

## Use Cases

### 1. Real-Time Treasury Futures Monitoring

Monitor ZN (10Y T-Note) futures in real-time alongside FRED data:
```javascript
// Subscribe to 10Y T-Note futures
tradingview.subscribe('CBOT:ZN1!', {
  timeframe: '5',  // 5-minute bars
  indicators: ['RSI', 'MACD']
});
```

Display on dashboard:
- Live price updates
- Volume profile
- RSI indicator for momentum
- Alert when RSI > 70 or < 30

### 2. Intraday Rate Movement Analysis

Track how futures react to Fed announcements:
```javascript
// Get 1-minute data for the last 24 hours
const data = await tradingview.getHistoricalIntraday(
  'CBOT:ZN1!',
  '1',  // 1-minute bars
  1     // 1 day
);
```

Analyze:
- Price volatility during announcement
- Volume spikes
- Correlation with yield curve changes

### 3. Multi-Asset Correlation

Monitor correlations between:
- Treasury futures (ZN, ZB)
- SOFR futures (SR3)
- Fed Funds futures
- Dollar Index (DXY)
- S&P 500 futures (ES)

### 4. Automated Trading Signals

Generate signals based on:
- Rate inversions
- Futures/spot spread anomalies
- Technical indicator crossovers
- Volume surges

## Configuration

**File**: `/Users/Tim/Backzest/config.yaml` additions:
```yaml
tradingview:
  enabled: true
  service_url: http://localhost:3001
  symbols:
    - CBOT:ZN1!  # 10Y T-Note Futures
    - CBOT:ZB1!  # 30Y T-Bond Futures
    - CBOT:ZT1!  # 2Y T-Note Futures
    - CBOT:ZF1!  # 5Y T-Note Futures
    - CME:SR3!   # 3M SOFR Futures
  timeframes:
    - '1'   # 1 minute
    - '5'   # 5 minutes
    - '15'  # 15 minutes
    - '60'  # 1 hour
  indicators:
    - RSI
    - MACD
    - Volume
  auth:
    # Optional: for premium features
    session_id: ${TRADINGVIEW_SESSION}
    signature: ${TRADINGVIEW_SIGNATURE}
```

## Deployment

### Development Setup
```bash
# 1. Navigate to services directory
cd /Users/Tim/Backzest/services/tradingview

# 2. Install Node.js dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with database credentials

# 4. Start TradingView service
npm start  # Runs on port 3001

# 5. Update Python backend to connect
# Backend will make HTTP requests to localhost:3001
```

### Production Setup
```bash
# Use PM2 for process management
npm install -g pm2
pm2 start services/tradingview/server.js --name tradingview-service
pm2 save
pm2 startup
```

## Benefits Summary

| Feature | Current (Backzest) | With TradingView |
|---------|-------------------|------------------|
| Data Frequency | Daily EOD | Real-time, 1-min intraday |
| Update Latency | 24 hours | < 1 second |
| Technical Indicators | None | Unlimited (RSI, MACD, etc.) |
| Symbol Coverage | ~20 contracts | 1000s of symbols |
| API Rate Limits | FRED: 120/min | Unlimited (websocket) |
| Historical Intraday | No | Yes (years of 1-min data) |
| Live Monitoring | No | Yes |
| Trading Signals | Manual | Automated |

## Cost

- **Free Tier**: Everything except some premium indicators
- **No API Fees**: Unlike Bloomberg, Refinitiv, etc.
- **Infrastructure**: Just need to run Node.js service

## Next Steps

1. ✅ Create directory structure
2. ✅ Implement TradingView collector service
3. ✅ Add database schema
4. ✅ Create Python backend endpoints
5. ✅ Build React frontend components
6. ✅ Test with sample futures contracts
7. ✅ Document and deploy

## Timeline Estimate

- **Phase 1** (TradingView Service): 2-3 days
- **Phase 2** (Database): 1 day
- **Phase 3** (Backend API): 1-2 days
- **Phase 4** (Frontend): 2-3 days
- **Testing & Documentation**: 1-2 days

**Total**: ~1-2 weeks for full integration

## Questions?

This integration will transform Backzest from an end-of-day data platform into a real-time market analysis system suitable for active trading and live monitoring.

