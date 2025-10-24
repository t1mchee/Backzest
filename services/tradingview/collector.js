/**
 * TradingView Data Collector
 * Collects real-time price data and technical indicators from TradingView
 */

const TradingView = require('@mathieuc/tradingview');
const { insertPrice, insertIndicator } = require('./database');

class TradingViewCollector {
  constructor(config = {}) {
    this.config = config;
    this.client = null;
    this.charts = new Map();
    this.indicators = new Map();
    this.subscriptions = new Map();
    this.callbacks = new Map();
  }

  /**
   * Initialize the TradingView client
   */
  initialize() {
    const clientOptions = {};
    
    if (this.config.session && this.config.signature) {
      clientOptions.token = this.config.session;
      clientOptions.signature = this.config.signature;
      console.log('✅ Initializing TradingView client with authentication');
    } else {
      console.log('⚠️  Initializing TradingView client without authentication (limited features)');
    }

    this.client = new TradingView.Client(clientOptions);

    this.client.onError((...err) => {
      console.error('❌ TradingView client error:', ...err);
    });

    console.log('✅ TradingView client initialized');
    return this;
  }

  /**
   * Subscribe to a symbol for real-time data
   * @param {string} symbol - TradingView symbol (e.g., 'CBOT:ZN1!')
   * @param {object} options - Subscription options
   * @returns {string} subscriptionId
   */
  subscribeToSymbol(symbol, options = {}) {
    const {
      timeframe = '5',
      indicators = [],
      onUpdate = null,
      saveToDb = true,
    } = options;

    const subscriptionId = `${symbol}_${timeframe}`;

    if (this.subscriptions.has(subscriptionId)) {
      console.log(`⚠️  Already subscribed to ${subscriptionId}`);
      return subscriptionId;
    }

    console.log(`📊 Subscribing to ${symbol} (${timeframe} min)`);

    // Create a chart session
    const chart = new this.client.Session.Chart();
    this.charts.set(subscriptionId, chart);

    chart.setMarket(symbol, { timeframe });

    chart.onSymbolLoaded(() => {
      console.log(`✅ ${symbol} loaded: ${chart.infos.description}`);
      
      // Store subscription info
      this.subscriptions.set(subscriptionId, {
        symbol,
        timeframe,
        description: chart.infos.description,
        currency: chart.infos.currency_id,
        exchange: chart.infos.exchange,
        type: chart.infos.type,
        loaded: true,
      });

      // Add indicators if requested
      if (indicators.length > 0) {
        this.addIndicators(subscriptionId, indicators);
      }
    });

    chart.onUpdate(() => {
      if (!chart.periods[0]) return;

      const candle = chart.periods[0];
      const timestamp = new Date(candle.time * 1000);

      const priceData = {
        symbol,
        timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        timeframe,
      };

      // Save to database if enabled
      if (saveToDb) {
        insertPrice(priceData).catch(err => {
          console.error(`Error saving ${symbol} to database:`, err.message);
        });
      }

      // Call custom callback if provided
      if (onUpdate) {
        onUpdate(priceData);
      }

      // Trigger any registered callbacks
      const callbacks = this.callbacks.get(subscriptionId) || [];
      callbacks.forEach(cb => cb(priceData));
    });

    chart.onError((...err) => {
      console.error(`❌ Error for ${symbol}:`, ...err);
    });

    return subscriptionId;
  }

  /**
   * Add technical indicators to a subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {array} indicators - Array of indicator names
   */
  async addIndicators(subscriptionId, indicators) {
    const chart = this.charts.get(subscriptionId);
    if (!chart) {
      throw new Error(`No chart found for ${subscriptionId}`);
    }

    const subscription = this.subscriptions.get(subscriptionId);

    for (const indicatorName of indicators) {
      try {
        console.log(`📈 Adding ${indicatorName} to ${subscription.symbol}`);

        const indicator = await TradingView.getIndicator(`STD;${indicatorName}`);
        const study = new chart.Study(indicator);

        study.onUpdate(() => {
          if (!study.periods[0]) return;

          const indicatorData = {
            symbol: subscription.symbol,
            timestamp: new Date(),
            indicator_name: indicatorName,
            values: study.periods[0],
            timeframe: subscription.timeframe,
          };

          // Save to database
          insertIndicator(indicatorData).catch(err => {
            console.error(`Error saving ${indicatorName} to database:`, err.message);
          });
        });

        this.indicators.set(`${subscriptionId}_${indicatorName}`, study);
        console.log(`✅ ${indicatorName} added to ${subscription.symbol}`);
      } catch (err) {
        console.error(`Error adding ${indicatorName}:`, err.message);
      }
    }
  }

  /**
   * Register a callback for subscription updates
   * @param {string} subscriptionId - Subscription ID
   * @param {function} callback - Callback function
   */
  onUpdate(subscriptionId, callback) {
    if (!this.callbacks.has(subscriptionId)) {
      this.callbacks.set(subscriptionId, []);
    }
    this.callbacks.get(subscriptionId).push(callback);
  }

  /**
   * Get latest price for a symbol
   * @param {string} subscriptionId - Subscription ID
   * @returns {object} Price data
   */
  getLatestPrice(subscriptionId) {
    const chart = this.charts.get(subscriptionId);
    if (!chart || !chart.periods[0]) {
      return null;
    }

    const candle = chart.periods[0];
    return {
      timestamp: new Date(candle.time * 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    };
  }

  /**
   * Unsubscribe from a symbol
   * @param {string} subscriptionId - Subscription ID
   */
  unsubscribe(subscriptionId) {
    const chart = this.charts.get(subscriptionId);
    if (chart) {
      chart.delete();
      this.charts.delete(subscriptionId);
      this.subscriptions.delete(subscriptionId);
      this.callbacks.delete(subscriptionId);
      console.log(`🛑 Unsubscribed from ${subscriptionId}`);
    }
  }

  /**
   * Get all active subscriptions
   * @returns {array} List of subscriptions
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
  }

  /**
   * Search for symbols on TradingView
   * @param {string} query - Search query
   * @returns {array} Search results
   */
  async searchSymbols(query) {
    try {
      const results = await TradingView.searchMarketV3(query);
      return results.map(r => ({
        symbol: r.symbol,
        description: r.description,
        exchange: r.exchange,
        type: r.type,
      }));
    } catch (err) {
      console.error('Error searching symbols:', err.message);
      return [];
    }
  }

  /**
   * Shutdown the collector
   */
  async shutdown() {
    console.log('🛑 Shutting down TradingView collector...');
    
    // Unsubscribe from all
    for (const subscriptionId of this.subscriptions.keys()) {
      this.unsubscribe(subscriptionId);
    }

    if (this.client) {
      await this.client.end();
    }

    console.log('✅ TradingView collector shut down');
  }
}

module.exports = TradingViewCollector;

