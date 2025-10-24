/**
 * Database Integration for TradingView Service
 * Connects to PostgreSQL and stores real-time data
 */

const { Pool } = require('pg');

class Database {
  constructor(config) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });

    console.log(`📦 Database pool created: ${config.database}@${config.host}`);
  }

  /**
   * Insert real-time price data
   */
  async insertPrice(data) {
    const query = `
      INSERT INTO tradingview_prices (
        timestamp, symbol, exchange, price, open, high, low, volume, timeframe, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TRADINGVIEW')
      ON CONFLICT (timestamp, symbol, timeframe) DO UPDATE SET
        price = EXCLUDED.price,
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        volume = EXCLUDED.volume,
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
      data.timestamp,
      data.symbol,
      data.exchange || null,
      data.close,
      data.open,
      data.high,
      data.low,
      (data.volume && !isNaN(data.volume)) ? data.volume : null,
      data.timeframe,
    ];

    try {
      await this.pool.query(query, values);
    } catch (err) {
      console.error('Database insert error:', err.message);
      throw err;
    }
  }

  /**
   * Insert technical indicator data
   */
  async insertIndicator(data) {
    const query = `
      INSERT INTO tradingview_indicators (
        timestamp, symbol, indicator_name, indicator_value, parameters
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (timestamp, symbol, indicator_name) DO UPDATE SET
        indicator_value = EXCLUDED.indicator_value,
        parameters = EXCLUDED.parameters,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Extract main value (varies by indicator)
    let mainValue = null;
    if (data.values.plot_0 !== undefined) {
      mainValue = data.values.plot_0;
    } else if (data.values.value !== undefined) {
      mainValue = data.values.value;
    }

    const values = [
      data.timestamp,
      data.symbol,
      data.indicator_name,
      mainValue,
      JSON.stringify(data.values),
    ];

    try {
      await this.pool.query(query, values);
    } catch (err) {
      console.error('Database insert indicator error:', err.message);
      throw err;
    }
  }

  /**
   * Insert or update symbol metadata
   */
  async upsertSymbol(data) {
    const query = `
      INSERT INTO tradingview_symbols (
        symbol, description, exchange, type, tradingview_symbol, last_updated
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (symbol) DO UPDATE SET
        description = EXCLUDED.description,
        exchange = EXCLUDED.exchange,
        type = EXCLUDED.type,
        tradingview_symbol = EXCLUDED.tradingview_symbol,
        last_updated = CURRENT_TIMESTAMP
    `;

    const values = [
      data.symbol,
      data.description,
      data.exchange,
      data.type,
      data.tradingview_symbol,
    ];

    try {
      await this.pool.query(query, values);
    } catch (err) {
      console.error('Database upsert symbol error:', err.message);
      throw err;
    }
  }

  /**
   * Get latest prices for a symbol
   */
  async getLatestPrices(symbol, timeframe, limit = 100) {
    const query = `
      SELECT timestamp, price, open, high, low, volume
      FROM tradingview_prices
      WHERE symbol = $1 AND timeframe = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [symbol, timeframe, limit]);
    return result.rows;
  }

  /**
   * Get indicator history
   */
  async getIndicatorHistory(symbol, indicatorName, limit = 100) {
    const query = `
      SELECT timestamp, indicator_value, parameters
      FROM tradingview_indicators
      WHERE symbol = $1 AND indicator_name = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [symbol, indicatorName, limit]);
    return result.rows;
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
    console.log('📦 Database connection closed');
  }
}

// Singleton instance
let dbInstance = null;

function initDatabase(config) {
  if (!dbInstance) {
    dbInstance = new Database(config);
  }
  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

// Convenience functions
async function insertPrice(data) {
  const db = getDatabase();
  return db.insertPrice(data);
}

async function insertIndicator(data) {
  const db = getDatabase();
  return db.insertIndicator(data);
}

async function upsertSymbol(data) {
  const db = getDatabase();
  return db.upsertSymbol(data);
}

module.exports = {
  Database,
  initDatabase,
  getDatabase,
  insertPrice,
  insertIndicator,
  upsertSymbol,
};

