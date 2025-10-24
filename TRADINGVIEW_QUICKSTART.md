# TradingView Integration - Quick Start Guide

Get real-time market data in your Backzest platform in under 10 minutes!

## 🚀 Setup (5 minutes)

### Step 1: Install TradingView Service

```bash
# Navigate to the TradingView service directory
cd /Users/Tim/Backzest/services/tradingview

# Install Node.js dependencies
npm install
```

### Step 2: Set Up Database

```bash
# Add TradingView tables to your existing database
psql -U postgres -d interest_rates_db -f schema.sql
```

You should see:
```
CREATE TABLE
CREATE INDEX
CREATE TABLE
...
CREATE VIEW
```

### Step 3: Configure Environment

Create `.env` file in `/Users/Tim/Backzest/services/tradingview/`:

```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=interest_rates_db
DB_USER=postgres
DB_PASSWORD=your_password
ENABLE_AUTO_COLLECTION=true
```

### Step 4: Start the Service

```bash
npm start
```

You should see:
```
✅ Database initialized
✅ TradingView client initialized
🚀 TradingView Service running on http://localhost:3001
📊 Auto-subscribing to default symbols...
```

🎉 **You're now collecting real-time Treasury futures data!**

---

## 📊 Usage Examples

### Example 1: Check What's Running

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "service": "TradingView Data Service",
  "version": "1.0.0",
  "subscriptions": 4
}
```

### Example 2: Subscribe to a New Symbol

```bash
curl -X POST http://localhost:3001/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "CME:SR31!",
    "timeframe": "5",
    "indicators": ["RSI"]
  }'
```

Response:
```json
{
  "success": true,
  "subscriptionId": "CME:SR31!_5",
  "symbol": "CME:SR31!",
  "timeframe": "5",
  "indicators": ["RSI"]
}
```

### Example 3: Get Latest Price

```bash
curl http://localhost:3001/price/CBOT:ZN1!_5
```

Response:
```json
{
  "timestamp": "2025-10-24T15:30:00.000Z",
  "open": 109.5,
  "high": 109.8,
  "low": 109.4,
  "close": 109.7,
  "volume": 12345
}
```

### Example 4: Search for Symbols

```bash
curl "http://localhost:3001/search?query=SOFR"
```

---

## 🐍 Python Integration

Use the TradingView collector from your Python scripts:

```python
from src.collectors.tradingview_collector import TradingViewCollector

# Initialize
tv = TradingViewCollector()

# Subscribe to 10Y T-Note futures
tv.subscribe('CBOT:ZN1!', timeframe='5', indicators=['RSI', 'MACD'])

# Get latest price
price = tv.get_latest_price('CBOT:ZN1!_5')
print(f"Current price: ${price['close']:.2f}")

# Get historical intraday data
historical = tv.get_historical_prices('CBOT:ZN1!', timeframe='5', limit=100)
print(f"Retrieved {len(historical)} 5-minute bars")

# Get RSI values
rsi_data = tv.get_indicator_history('CBOT:ZN1!', 'RSI', limit=50)
for point in rsi_data[:5]:
    print(f"{point['timestamp']}: RSI = {point['indicator_value']}")
```

---

## 🎯 Common Use Cases

### Monitor Treasury Futures in Real-Time

```python
from src.collectors.tradingview_collector import TradingViewCollector
import time

tv = TradingViewCollector()

# Subscribe to all Treasury futures
symbols = [
    'CBOT:ZT1!',  # 2Y
    'CBOT:ZF1!',  # 5Y
    'CBOT:ZN1!',  # 10Y
    'CBOT:ZB1!',  # 30Y
]

for symbol in symbols:
    tv.subscribe(symbol, timeframe='5')

# Monitor prices every minute
while True:
    print('\n📊 Current Treasury Futures Prices:')
    for symbol in symbols:
        sub_id = f'{symbol}_5'
        price = tv.get_latest_price(sub_id)
        if price:
            print(f"  {symbol}: ${price['close']:.2f}")
    
    time.sleep(60)
```

### Alert on RSI Extremes

```python
from src.collectors.tradingview_collector import TradingViewCollector
import time

tv = TradingViewCollector()
tv.subscribe('CBOT:ZN1!', timeframe='15', indicators=['RSI'])

print('🔔 Monitoring RSI for overbought/oversold conditions...\n')

while True:
    rsi_data = tv.get_indicator_history('CBOT:ZN1!', 'RSI', limit=1)
    
    if rsi_data:
        rsi = rsi_data[0]['indicator_value']
        
        if rsi > 70:
            print(f'🔴 OVERBOUGHT: RSI = {rsi:.2f}')
        elif rsi < 30:
            print(f'🟢 OVERSOLD: RSI = {rsi:.2f}')
        else:
            print(f'⚪ Neutral: RSI = {rsi:.2f}')
    
    time.sleep(60)
```

### Compare Futures vs Spot Rates

```python
from src.collectors.tradingview_collector import TradingViewCollector
from src.database.connection import DatabaseManager
import pandas as pd

tv = TradingViewCollector()
db = DatabaseManager()

# Get latest 10Y futures price
tv.subscribe('CBOT:ZN1!', timeframe='5')
futures_price = tv.get_latest_price('CBOT:ZN1!_5')

# Get latest 10Y Treasury yield from your FRED data
with db.engine.connect() as conn:
    spot_rate = pd.read_sql(
        "SELECT rate FROM treasury_rates WHERE maturity='10Y' ORDER BY date DESC LIMIT 1",
        conn
    )['rate'][0]

print(f"10Y Futures: ${futures_price['close']:.2f}")
print(f"10Y Spot Yield: {spot_rate:.3f}%")

# Calculate implied yield from futures price
# (Simplified - actual calculation more complex)
implied_yield = (100 - futures_price['close']) / 10
print(f"Implied Yield: {implied_yield:.3f}%")
print(f"Spread: {(implied_yield - spot_rate):.3f}%")
```

---

## 📈 Adding to FastAPI Backend

Add these endpoints to `/Users/Tim/Backzest/backend/main.py`:

```python
from src.collectors.tradingview_collector import TradingViewCollector

# Initialize TradingView collector
tv_collector = TradingViewCollector()

@app.get("/api/tradingview/realtime/{symbol}")
async def get_realtime_price(symbol: str, timeframe: str = '5'):
    """Get real-time price from TradingView"""
    try:
        # Ensure subscription exists
        sub_id = f'{symbol}_{timeframe}'
        price = tv_collector.get_latest_price(sub_id)
        
        if not price:
            # Subscribe if not already subscribed
            tv_collector.subscribe(symbol, timeframe=timeframe)
            await asyncio.sleep(2)  # Wait for data
            price = tv_collector.get_latest_price(sub_id)
        
        if not price:
            raise HTTPException(status_code=404, detail="No price data available")
        
        return price
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tradingview/intraday/{symbol}")
async def get_intraday_data(
    symbol: str,
    timeframe: str = '5',
    limit: int = 100
):
    """Get historical intraday data"""
    try:
        data = tv_collector.get_historical_prices(symbol, timeframe, limit)
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tradingview/search")
async def search_tradingview_symbols(query: str):
    """Search for symbols on TradingView"""
    try:
        results = tv_collector.search_symbols(query)
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 🖥️ React Frontend Integration

Create a real-time price widget:

```typescript
// frontend/src/components/LivePriceWidget.tsx
import { useEffect, useState } from 'react';

interface PriceData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

export function LivePriceWidget({ symbol }: { symbol: string }) {
  const [price, setPrice] = useState<PriceData | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/tradingview/realtime/${symbol}`
        );
        const data = await response.json();
        setPrice(data);
      } catch (err) {
        console.error('Error fetching price:', err);
      }
    };

    // Fetch immediately
    fetchPrice();

    // Then fetch every 5 seconds
    const interval = setInterval(fetchPrice, 5000);

    return () => clearInterval(interval);
  }, [symbol]);

  if (!price) return <div>Loading...</div>;

  const priceChange = price.close - price.open;
  const isPositive = priceChange >= 0;

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-sm text-gray-600">{symbol}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">
          ${price.close.toFixed(2)}
        </span>
        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
          {isPositive ? '↗' : '↘'} {Math.abs(priceChange).toFixed(2)}
        </span>
      </div>
      <div className="mt-2 text-sm text-gray-500">
        <div>High: ${price.high.toFixed(2)}</div>
        <div>Low: ${price.low.toFixed(2)}</div>
        <div>Volume: {price.volume.toLocaleString()}</div>
      </div>
    </div>
  );
}
```

---

## 🔧 Testing

### Test the Node.js service

```bash
cd /Users/Tim/Backzest/services/tradingview
npm test
```

### Test Python integration

```bash
cd /Users/Tim/Backzest
python src/collectors/tradingview_collector.py
```

---

## 📊 Query the Database

View collected data directly:

```sql
-- Latest prices for all symbols
SELECT * FROM v_tradingview_latest_prices;

-- Price changes
SELECT * FROM v_tradingview_price_changes;

-- Recent 10Y T-Note prices
SELECT timestamp, price, volume
FROM tradingview_prices
WHERE symbol = 'CBOT:ZN1!' AND timeframe = '5'
ORDER BY timestamp DESC
LIMIT 20;

-- RSI values
SELECT timestamp, indicator_value
FROM tradingview_indicators
WHERE symbol = 'CBOT:ZN1!' AND indicator_name = 'RSI'
ORDER BY timestamp DESC
LIMIT 20;
```

---

## 🎉 What You Can Do Now

✅ **Real-time monitoring** - Track Treasury futures, SOFR, bonds  
✅ **Intraday analysis** - 1-minute to hourly data  
✅ **Technical indicators** - RSI, MACD, Volume Profile  
✅ **Historical data** - Years of intraday bars  
✅ **Trading signals** - Build automated alerts  
✅ **Correlation analysis** - Compare futures vs spot rates  

---

## 🆘 Troubleshooting

### Service won't start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Check Node.js version (need 18+)
node --version

# Check logs
cd /Users/Tim/Backzest/services/tradingview
npm start 2>&1 | tee debug.log
```

### No data appearing
```bash
# Check subscriptions
curl http://localhost:3001/subscriptions

# Check database
psql -d interest_rates_db -c "SELECT COUNT(*) FROM tradingview_prices;"

# Check service logs for errors
```

### Python can't connect
```bash
# Verify service is running
curl http://localhost:3001/health

# Check firewall settings
# Ensure localhost:3001 is accessible
```

---

## 📚 Next Steps

1. ✅ **Add to Dashboard** - Display real-time prices in React frontend
2. ✅ **Set Up Alerts** - Email/SMS when conditions are met
3. ✅ **Correlation Analysis** - Compare futures movements with your FRED data
4. ✅ **Backtesting** - Use historical intraday data for strategy testing
5. ✅ **Machine Learning** - Feed real-time data into ML models

---

## 📖 Documentation

- Full Integration Plan: `TRADINGVIEW_INTEGRATION_PLAN.md`
- Service README: `services/tradingview/README.md`
- TradingView API Docs: Original examples in `/examples`

---

## 💡 Tips

- Start with 5-minute bars to balance data granularity and performance
- Use indicators sparingly (they increase CPU usage)
- Monitor database size - intraday data grows quickly
- Set up log rotation for production
- Use PM2 for automatic restarts in production

---

**Happy Trading! 📈**

