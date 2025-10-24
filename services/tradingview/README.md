# TradingView Service for Backzest

Real-time market data service that integrates TradingView into the Backzest platform.

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/Tim/Backzest/services/tradingview
npm install
```

### 2. Set Up Database

```bash
# Apply the schema to your existing database
psql -U postgres -d interest_rates_db -f schema.sql
```

### 3. Configure Environment

Create a `.env` file (copy from `.env.example` in the docs):

```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=interest_rates_db
DB_USER=postgres
DB_PASSWORD=your_password
ENABLE_AUTO_COLLECTION=true
```

### 4. Start the Service

```bash
npm start
```

The service will start on `http://localhost:3001`

## API Endpoints

### Health Check
```bash
GET /health
```

### Subscribe to Symbol
```bash
POST /subscribe
Content-Type: application/json

{
  "symbol": "CBOT:ZN1!",
  "timeframe": "5",
  "indicators": ["RSI", "MACD"]
}
```

### Get Latest Price
```bash
GET /price/:subscriptionId
```

### Get Historical Data
```bash
GET /historical/:symbol?timeframe=5&limit=100
```

### Search Symbols
```bash
GET /search?query=CBOT
```

## WebSocket API

Connect to `ws://localhost:3001/ws` and send:

```json
{
  "action": "subscribe",
  "symbol": "CBOT:ZN1!",
  "timeframe": "5"
}
```

You'll receive real-time updates:

```json
{
  "type": "price_update",
  "subscriptionId": "CBOT:ZN1!_5",
  "data": {
    "symbol": "CBOT:ZN1!",
    "timestamp": "2025-10-24T12:00:00Z",
    "open": 109.5,
    "high": 109.8,
    "low": 109.4,
    "close": 109.7,
    "volume": 1234
  }
}
```

## Example Usage

### Subscribe to Treasury Futures

```javascript
const axios = require('axios');

// Subscribe to 10Y T-Note futures
await axios.post('http://localhost:3001/subscribe', {
  symbol: 'CBOT:ZN1!',
  timeframe: '5',
  indicators: ['RSI', 'MACD']
});
```

### Get Real-Time Data in Python

```python
import requests

# Subscribe
response = requests.post('http://localhost:3001/subscribe', json={
    'symbol': 'CBOT:ZN1!',
    'timeframe': '5',
    'indicators': ['RSI']
})
subscription_id = response.json()['subscriptionId']

# Get latest price
price = requests.get(f'http://localhost:3001/price/{subscription_id}').json()
print(f"Latest price: {price['close']}")
```

## Supported Symbols

### Treasury Futures
- `CBOT:ZN1!` - 10Y T-Note Futures
- `CBOT:ZB1!` - 30Y T-Bond Futures
- `CBOT:ZT1!` - 2Y T-Note Futures
- `CBOT:ZF1!` - 5Y T-Note Futures

### SOFR Futures
- `CME:SR31!` - 3M SOFR Futures
- `CME:SR11!` - 1M SOFR Futures

### Other
- Any symbol on TradingView (stocks, crypto, forex, etc.)

## Timeframes

- `1` - 1 minute
- `5` - 5 minutes
- `15` - 15 minutes
- `30` - 30 minutes
- `60` - 1 hour
- `240` - 4 hours
- `D` - Daily

## Technical Indicators

- `RSI` - Relative Strength Index
- `MACD` - Moving Average Convergence Divergence
- `Volume` - Volume
- `Supertrend` - Supertrend
- And many more...

Search for indicators:
```javascript
const TradingView = require('@mathieuc/tradingview');
const results = await TradingView.searchIndicator('RSI');
```

## Production Deployment

Use PM2 for process management:

```bash
npm install -g pm2
pm2 start server.js --name tradingview-service
pm2 save
pm2 startup
```

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Ensure database exists: `psql -l`

### No Data Received
- Check TradingView symbol format (use search endpoint)
- Verify internet connection
- Check service logs

### High CPU Usage
- Reduce number of subscriptions
- Increase timeframe (use '15' or '60' instead of '1')
- Disable indicators if not needed

## Integration with Backzest Backend

See `TRADINGVIEW_INTEGRATION_PLAN.md` for full integration guide.

## License

Same as Backzest project (for personal/educational use).

