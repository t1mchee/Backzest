# TradingView Integration - Visual Guide

## 🎨 System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    YOUR BACKZEST PLATFORM                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │              React Frontend Dashboard                    │  │
│  │              http://localhost:5173                       │  │
│  │                                                           │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │   │  Yield      │  │  Treasury   │  │  LIVE       │    │  │
│  │   │  Curves     │  │  Spreads    │  │  FUTURES    │◄── NEW!
│  │   └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │                                                           │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│                          │ HTTP                                 │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │         FastAPI Backend (Python)                         │  │
│  │         http://localhost:8000                            │  │
│  │                                                           │  │
│  │  Existing:                    NEW:                       │  │
│  │  • /api/treasury/rates        • /api/tradingview/*      │  │
│  │  • /api/fed/rates             • /ws/tradingview         │  │
│  │  • /api/cftc/cot                                         │  │
│  │                                                           │  │
│  └─────────┬──────────────────────────┬──────────────────────┘  │
│            │                          │                         │
│            │                          │ HTTP                    │
│            │                          ▼                         │
│            │                  ┌──────────────────────┐          │
│            │                  │                      │          │
│            │                  │  TradingView Service │◄─── NEW!
│            │                  │  (Node.js)           │          │
│            │                  │  :3001               │          │
│            │                  │                      │          │
│            │                  │  • WebSocket to TV   │          │
│            │                  │  • Real-time data    │          │
│            │                  │  • Indicators        │          │
│            │                  │                      │          │
│            │                  └──────┬───────────────┘          │
│            │                         │                          │
│            │                         │                          │
│            ▼                         ▼                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │           PostgreSQL Database                           │   │
│  │           interest_rates_db                             │   │
│  │                                                          │   │
│  │  EXISTING TABLES:      NEW TABLES:                      │   │
│  │  • treasury_rates      • tradingview_prices      ◄── NEW!
│  │  • fed_rates           • tradingview_indicators  ◄── NEW!
│  │  • cftc_cot            • tradingview_symbols     ◄── NEW!
│  │  • futures_prices                                       │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                    ▲
                    │
                    │ WebSocket
                    │
        ┌───────────┴───────────┐
        │                       │
        │   TradingView.com     │
        │   (Real-time data)    │
        │                       │
        └───────────────────────┘
```

---

## 📁 File Structure

```
/Users/Tim/Backzest/
│
├── 📘 Documentation (NEW!)
│   ├── TRADINGVIEW_INTEGRATION_PLAN.md    ← Architecture & planning
│   ├── TRADINGVIEW_QUICKSTART.md          ← 10-minute start guide
│   ├── TRADINGVIEW_SUMMARY.md             ← What we built
│   └── TRADINGVIEW_VISUAL_GUIDE.md        ← This file
│
├── 🔧 Backend (Python/FastAPI)
│   ├── backend/
│   │   └── main.py                        ← Add TradingView endpoints here
│   └── src/
│       └── collectors/
│           ├── fred_collector.py          ← Existing
│           ├── treasury_collector.py      ← Existing
│           ├── cftc_collector.py          ← Existing
│           └── tradingview_collector.py   ← NEW! Python interface
│
├── 🚀 TradingView Service (NEW!)
│   └── services/
│       └── tradingview/
│           ├── package.json               ← Dependencies
│           ├── server.js                  ← REST API server
│           ├── collector.js               ← WebSocket collector
│           ├── database.js                ← PostgreSQL integration
│           ├── schema.sql                 ← Database tables
│           ├── test.js                    ← Test script
│           └── README.md                  ← Service docs
│
├── 🗄️ Database
│   └── src/
│       └── database/
│           ├── schema.sql                 ← Existing tables
│           └── models.py                  ← Add new models
│
└── 🎨 Frontend (React)
    └── frontend/
        └── src/
            └── components/
                └── (Add LivePriceWidget, etc.)
```

---

## 🔄 Data Flow

### Real-Time Price Updates

```
1. TradingView.com (Market Data)
         │
         │ WebSocket
         ▼
2. TradingView Service (Node.js)
   • Receives price update
   • Processes OHLCV data
         │
         │ INSERT
         ▼
3. PostgreSQL Database
   • tradingview_prices table
   • Indexed by symbol, timestamp
         │
         │ SELECT
         ▼
4. FastAPI Backend (Python)
   • Queries latest prices
   • Formats response
         │
         │ HTTP/WebSocket
         ▼
5. React Frontend
   • Displays live prices
   • Updates charts
   • Shows indicators
```

### Historical Data Query

```
1. User clicks "Show 10Y Futures"
         │
         ▼
2. React Frontend
   • fetch('/api/tradingview/intraday/CBOT:ZN1!')
         │
         ▼
3. FastAPI Backend
   • Calls TradingViewCollector.get_historical_prices()
         │
         ▼
4. TradingView Service
   • Queries database
   • Returns last 100 bars
         │
         ▼
5. PostgreSQL Database
   • SELECT * FROM tradingview_prices
   • ORDER BY timestamp DESC
   • LIMIT 100
         │
         ▼
6. React Frontend
   • Renders candlestick chart
   • Shows volume bars
   • Displays indicators
```

---

## 🎯 Quick Reference

### Start Everything

```bash
# Terminal 1: Start TradingView Service
cd /Users/Tim/Backzest/services/tradingview
npm start

# Terminal 2: Start FastAPI Backend
cd /Users/Tim/Backzest/backend
uvicorn main:app --reload

# Terminal 3: Start React Frontend
cd /Users/Tim/Backzest/frontend
npm run dev
```

### Check Status

```bash
# TradingView service
curl http://localhost:3001/health

# Backend
curl http://localhost:8000/

# Frontend
# Open browser: http://localhost:5173
```

### View Data

```bash
# Latest prices
curl http://localhost:3001/price/CBOT:ZN1!_5

# Historical
curl "http://localhost:3001/historical/CBOT:ZN1!?limit=10"

# Database
psql -d interest_rates_db -c "SELECT * FROM v_tradingview_latest_prices;"
```

---

## 📊 Database Tables

### Existing Tables
```
┌─────────────────────┐
│  treasury_rates     │  ← FRED & Treasury data
│  • date             │     Daily EOD
│  • maturity         │     1M, 3M, 6M, 1Y, 2Y, 5Y, 7Y, 10Y, 20Y, 30Y
│  • rate             │
└─────────────────────┘

┌─────────────────────┐
│  fed_rates          │  ← Policy rates
│  • date             │     Fed Funds, SOFR, EFFR
│  • rate_type        │
│  • rate             │
└─────────────────────┘

┌─────────────────────┐
│  cftc_cot           │  ← Weekly positioning
│  • report_date      │     Commercial vs Non-commercial
│  • contract_name    │
│  • positions_long   │
│  • positions_short  │
└─────────────────────┘
```

### NEW Tables
```
┌─────────────────────────┐
│  tradingview_prices     │  ← REAL-TIME INTRADAY!
│  • timestamp            │     Every 1-60 minutes
│  • symbol               │     CBOT:ZN1!, etc.
│  • price (OHLCV)        │     Open, High, Low, Close, Volume
│  • timeframe            │     1, 5, 15, 60, D
└─────────────────────────┘

┌─────────────────────────┐
│  tradingview_indicators │  ← TECHNICAL ANALYSIS!
│  • timestamp            │     RSI, MACD, etc.
│  • symbol               │
│  • indicator_name       │
│  • indicator_value      │
│  • parameters (JSON)    │
└─────────────────────────┘

┌─────────────────────────┐
│  tradingview_symbols    │  ← METADATA
│  • symbol               │
│  • description          │     "10Y T-Note Futures"
│  • exchange             │     CBOT, CME, etc.
│  • type                 │     futures, bonds, forex
└─────────────────────────┘
```

---

## 🎨 Example Dashboard Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Backzest - US Interest Rates Analysis                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  Yield Curve        │  │  Live Treasury      │          │
│  │                     │  │  Futures            │ ◄── NEW! │
│  │      ╱╲             │  │                     │          │
│  │     ╱  ╲            │  │  ZN  $109.75  ▲    │          │
│  │    ╱    ╲___        │  │  ZB  $142.50  ▼    │          │
│  │   ╱         ╲__     │  │  ZT  $102.25  ▲    │          │
│  │  ╱             ╲_   │  │  ZF  $106.00  ▲    │          │
│  │                     │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │  10Y T-Note Intraday Chart                   │ ◄── NEW! │
│  │                                               │          │
│  │     110 ┤        ╭──╮                        │          │
│  │         │       ╱    ╲                       │          │
│  │     109 ┤   ╭──╯      ╰──╮                  │          │
│  │         │  ╱              ╰──╮               │          │
│  │     108 ┤─╯                  ╰──            │          │
│  │         └─────────────────────────          │          │
│  │         9am   11am   1pm    3pm             │          │
│  │                                               │          │
│  │  RSI: 65.4  |  MACD: +0.12  |  Vol: 12.5K  │ ◄── NEW! │
│  └──────────────────────────────────────────────┘          │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  Treasury Spreads   │  │  CFTC Positioning   │          │
│  │                     │  │                     │          │
│  │  10Y-2Y:  +45 bps  │  │  Net Long: +15K    │          │
│  │  10Y-3M:  +120 bps │  │  Commercial: +25K  │          │
│  │  30Y-10Y: +20 bps  │  │  Speculative: -10K │          │
│  │                     │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚦 Status Indicators

### Service Health
```
✅ TradingView Service Running
✅ Database Connected
✅ 4 Symbols Subscribed
✅ Real-time Updates Active
✅ Last Update: 2 seconds ago
```

### Data Quality
```
📊 Today's Data Collection

Futures Prices:     1,234 bars  ✅
Indicators (RSI):     248 values ✅
Treasury Rates:        11 values ✅
CFTC Reports:           1 report ✅

Database Size:      2.5 GB
Last Backup:        Oct 23, 2025
```

---

## 🎯 Common Tasks

### Monitor 10Y Futures in Real-Time
```python
from src.collectors.tradingview_collector import TradingViewCollector
import time

tv = TradingViewCollector()
tv.subscribe('CBOT:ZN1!', timeframe='1')  # 1-minute bars

while True:
    price = tv.get_latest_price('CBOT:ZN1!_1')
    print(f"10Y Futures: ${price['close']:.2f}")
    time.sleep(5)
```

### Get RSI Signal
```python
tv = TradingViewCollector()
tv.subscribe('CBOT:ZN1!', timeframe='15', indicators=['RSI'])
time.sleep(10)

rsi = tv.get_indicator_history('CBOT:ZN1!', 'RSI', limit=1)[0]
if rsi['indicator_value'] > 70:
    print("🔴 OVERBOUGHT")
elif rsi['indicator_value'] < 30:
    print("🟢 OVERSOLD")
```

### Compare Futures vs Spot
```sql
-- Get futures price and Treasury yield
SELECT 
    f.timestamp,
    f.price as futures_price,
    t.rate as spot_yield,
    (100 - f.price) / 10 as implied_yield,
    ((100 - f.price) / 10 - t.rate) as basis
FROM tradingview_prices f
CROSS JOIN LATERAL (
    SELECT rate 
    FROM treasury_rates 
    WHERE maturity = '10Y' 
    ORDER BY date DESC 
    LIMIT 1
) t
WHERE f.symbol = 'CBOT:ZN1!'
  AND f.timeframe = '5'
ORDER BY f.timestamp DESC
LIMIT 10;
```

---

## 🎓 Learning Path

```
Day 1: Setup & Testing
┌─────────────────────────────┐
│ 1. Install dependencies     │ 15 min
│ 2. Set up database          │ 10 min
│ 3. Start service            │  5 min
│ 4. Test basic queries       │ 10 min
└─────────────────────────────┘

Day 2: Python Integration
┌─────────────────────────────┐
│ 1. Run example script       │ 10 min
│ 2. Subscribe to symbols     │ 15 min
│ 3. Query historical data    │ 15 min
│ 4. Add indicators           │ 20 min
└─────────────────────────────┘

Day 3: Backend Integration
┌─────────────────────────────┐
│ 1. Add FastAPI endpoints    │ 30 min
│ 2. Test endpoints           │ 15 min
│ 3. Add error handling       │ 15 min
└─────────────────────────────┘

Week 2: Frontend Dashboard
┌─────────────────────────────┐
│ 1. Create LivePriceWidget   │ 1 hour
│ 2. Add real-time charts     │ 2 hours
│ 3. Build indicator panel    │ 1 hour
│ 4. Add alerts               │ 1 hour
└─────────────────────────────┘

Week 3: Advanced Features
┌─────────────────────────────┐
│ 1. Correlation analysis     │ 2 hours
│ 2. Trading signals          │ 3 hours
│ 3. Backtesting              │ 4 hours
└─────────────────────────────┘
```

---

## 🎉 Success Metrics

After full integration, you'll have:

✅ **Real-time market data** - Sub-second latency  
✅ **Intraday analysis** - 1-minute to hourly bars  
✅ **Technical indicators** - RSI, MACD, Volume Profile  
✅ **Historical intraday** - Years of minute-level data  
✅ **Python integration** - Clean, documented API  
✅ **Database integration** - Efficient storage & queries  
✅ **REST API** - Easy to extend  
✅ **WebSocket streaming** - For frontend real-time updates  
✅ **Zero cost** - No API fees, no subscriptions  
✅ **Unlimited symbols** - Track anything on TradingView  

**Result**: Professional-grade financial data platform! 🚀

---

## 📚 Documentation Index

1. **Start Here** → `TRADINGVIEW_QUICKSTART.md`
2. **Architecture** → `TRADINGVIEW_INTEGRATION_PLAN.md`
3. **Implementation** → `TRADINGVIEW_SUMMARY.md`
4. **Visual Guide** → This file
5. **Service Docs** → `services/tradingview/README.md`

---

**Ready to build something amazing? Start with the Quick Start guide!** 🎯

