/**
 * TradingView Service REST API
 * Provides HTTP endpoints for the Python backend to interact with TradingView data
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const TradingViewCollector = require('./collector');
const { initDatabase, getDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'interest_rates_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

try {
  initDatabase(dbConfig);
  console.log('✅ Database initialized');
} catch (err) {
  console.error('❌ Database initialization failed:', err.message);
  console.log('⚠️  Service will run without database (in-memory only)');
}

// Initialize TradingView collector
const collector = new TradingViewCollector({
  session: process.env.TRADINGVIEW_SESSION,
  signature: process.env.TRADINGVIEW_SIGNATURE,
});

collector.initialize();

// Store WebSocket clients
const wsClients = new Map();

// ============================================
// REST API Endpoints
// ============================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'TradingView Data Service',
    version: '1.0.0',
    subscriptions: collector.getSubscriptions().length,
  });
});

/**
 * Get all active subscriptions
 */
app.get('/subscriptions', (req, res) => {
  const subscriptions = collector.getSubscriptions();
  res.json({
    count: subscriptions.length,
    subscriptions,
  });
});

/**
 * Subscribe to a symbol
 */
app.post('/subscribe', async (req, res) => {
  try {
    const { symbol, timeframe = '5', indicators = [] } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const subscriptionId = collector.subscribeToSymbol(symbol, {
      timeframe,
      indicators,
      saveToDb: true,
    });

    res.json({
      success: true,
      subscriptionId,
      symbol,
      timeframe,
      indicators,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Unsubscribe from a symbol
 */
app.post('/unsubscribe', (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }

    collector.unsubscribe(subscriptionId);

    res.json({
      success: true,
      message: `Unsubscribed from ${subscriptionId}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get latest price for a subscription
 */
app.get('/price/:subscriptionId', (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const price = collector.getLatestPrice(subscriptionId);

    if (!price) {
      return res.status(404).json({ error: 'No data available for this subscription' });
    }

    res.json(price);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get historical prices from database
 */
app.get('/historical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '5', limit = 100 } = req.query;

    const db = getDatabase();
    const prices = await db.getLatestPrices(symbol, timeframe, parseInt(limit));

    res.json({
      symbol,
      timeframe,
      count: prices.length,
      data: prices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get indicator history from database
 */
app.get('/indicators/:symbol/:indicator', async (req, res) => {
  try {
    const { symbol, indicator } = req.params;
    const { limit = 100 } = req.query;

    const db = getDatabase();
    const data = await db.getIndicatorHistory(symbol, indicator, parseInt(limit));

    res.json({
      symbol,
      indicator,
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Search for symbols
 */
app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const results = await collector.searchSymbols(query);

    res.json({
      query,
      count: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add indicators to an existing subscription
 */
app.post('/indicators/add', async (req, res) => {
  try {
    const { subscriptionId, indicators } = req.body;

    if (!subscriptionId || !indicators || !Array.isArray(indicators)) {
      return res.status(400).json({ 
        error: 'subscriptionId and indicators array are required' 
      });
    }

    await collector.addIndicators(subscriptionId, indicators);

    res.json({
      success: true,
      subscriptionId,
      indicators,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WebSocket Server for Real-Time Streaming
// ============================================

const server = app.listen(PORT, () => {
  console.log(`🚀 TradingView Service running on http://localhost:${PORT}`);
  console.log(`📊 Ready to collect real-time market data`);
  console.log('');
  console.log('Example usage:');
  console.log(`  curl -X POST http://localhost:${PORT}/subscribe -H "Content-Type: application/json" -d '{"symbol":"CBOT:ZN1!","timeframe":"5"}'`);
  console.log('');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  console.log(`🔌 WebSocket client connected: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.action === 'subscribe') {
        const { symbol, timeframe = '5' } = data;
        const subscriptionId = collector.subscribeToSymbol(symbol, {
          timeframe,
          saveToDb: true,
        });

        // Register callback to send updates to this client
        collector.onUpdate(subscriptionId, (priceData) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'price_update',
              subscriptionId,
              data: priceData,
            }));
          }
        });

        wsClients.set(clientId, { ws, subscriptions: [subscriptionId] });

        ws.send(JSON.stringify({
          type: 'subscribed',
          subscriptionId,
          symbol,
          timeframe,
        }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket client disconnected: ${clientId}`);
    wsClients.delete(clientId);
  });
});

// ============================================
// Auto-subscribe to default symbols
// ============================================

if (process.env.ENABLE_AUTO_COLLECTION === 'true') {
  console.log('📊 Auto-subscribing to default symbols...');
  
  const defaultSymbols = [
    { symbol: 'CBOT:ZN1!', name: '10Y T-Note Futures' },
    { symbol: 'CBOT:ZB1!', name: '30Y T-Bond Futures' },
    { symbol: 'CBOT:ZT1!', name: '2Y T-Note Futures' },
    { symbol: 'CBOT:ZF1!', name: '5Y T-Note Futures' },
    // SOFR Futures for forward curve (next 12 quarterly contracts)
    { symbol: 'CME:SR3Z2024', name: 'SOFR Dec 2024' },
    { symbol: 'CME:SR3H2025', name: 'SOFR Mar 2025' },
    { symbol: 'CME:SR3M2025', name: 'SOFR Jun 2025' },
    { symbol: 'CME:SR3U2025', name: 'SOFR Sep 2025' },
    { symbol: 'CME:SR3Z2025', name: 'SOFR Dec 2025' },
    { symbol: 'CME:SR3H2026', name: 'SOFR Mar 2026' },
    { symbol: 'CME:SR3M2026', name: 'SOFR Jun 2026' },
    { symbol: 'CME:SR3U2026', name: 'SOFR Sep 2026' },
    { symbol: 'CME:SR3Z2026', name: 'SOFR Dec 2026' },
    { symbol: 'CME:SR3H2027', name: 'SOFR Mar 2027' },
    { symbol: 'CME:SR3M2027', name: 'SOFR Jun 2027' },
    { symbol: 'CME:SR3U2027', name: 'SOFR Sep 2027' },
  ];

  setTimeout(() => {
    defaultSymbols.forEach(({ symbol, name }) => {
      console.log(`📈 Auto-subscribing to ${name} (${symbol})`);
      collector.subscribeToSymbol(symbol, {
        timeframe: '5',
        indicators: [],
        saveToDb: true,
      });
    });
  }, 2000);
}

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  await collector.shutdown();
  
  try {
    const db = getDatabase();
    await db.close();
  } catch (err) {
    // Database might not be initialized
  }

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = { app, collector };

