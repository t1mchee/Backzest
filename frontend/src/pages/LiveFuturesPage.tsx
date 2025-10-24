import { useState, useEffect } from 'react';
import { RefreshCw, Activity, TrendingUp } from 'lucide-react';
import LivePriceCard from '../components/LivePriceCard';
import { getTradingViewLatestPrices, getTradingViewSubscriptions, type TradingViewPrice, type TradingViewSubscription } from '../services/api';

export default function LiveFuturesPage() {
  const [prices, setPrices] = useState<TradingViewPrice[]>([]);
  const [subscriptions, setSubscriptions] = useState<TradingViewSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data
  const fetchData = async () => {
    try {
      const [pricesData, subsData] = await Promise.all([
        getTradingViewLatestPrices(),
        getTradingViewSubscriptions(),
      ]);
      
      setPrices(pricesData.data || []);
      setSubscriptions(subsData.subscriptions || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch TradingView data:', err);
      setError('Failed to load live data. Make sure TradingView service is running.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  // Get subscription info for a symbol
  const getSubscriptionInfo = (symbol: string) => {
    return subscriptions.find(sub => sub.symbol === symbol);
  };

  if (loading && prices.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="ml-3 text-lg text-gray-600">Loading live data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Activity className="w-8 h-8 mr-3 text-blue-500" />
                Live Futures Prices
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time Treasury futures and SOFR data from TradingView
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Auto-refresh toggle */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Auto-refresh (10s)</span>
              </label>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Last update */}
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            {autoRefresh && (
              <span className="ml-4 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Live
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <p className="text-sm text-red-600 mt-1">
              Run: <code className="bg-red-100 px-2 py-1 rounded">cd services/tradingview && npm start</code>
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{subscriptions.length}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Live Prices</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{prices.length}</p>
              </div>
              <Activity className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Update Frequency</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">5m</p>
              </div>
              <RefreshCw className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Live Price Cards */}
        {prices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prices.map((price) => {
              const subInfo = getSubscriptionInfo(price.symbol);
              return (
                <LivePriceCard
                  key={price.symbol}
                  symbol={price.symbol}
                  description={subInfo?.description || price.symbol}
                  price={price.close}
                  open={price.open}
                  volume={price.volume}
                  timestamp={price.timestamp}
                />
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Live Data Available</h3>
            <p className="text-gray-600 mb-4">
              The TradingView service is not running or no symbols are subscribed.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-sm text-gray-700 font-medium mb-2">To get started:</p>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Start the service: <code className="bg-gray-200 px-2 py-1 rounded">cd services/tradingview && npm start</code></li>
                <li>2. Wait for auto-subscription to default symbols</li>
                <li>3. Refresh this page</li>
              </ol>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📊 About Live Data</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              • <strong>Source:</strong> Real-time data from TradingView via our local service
            </p>
            <p>
              • <strong>Update Frequency:</strong> Every 5 minutes during market hours
            </p>
            <p>
              • <strong>Data Stored:</strong> Historical intraday bars saved to PostgreSQL database
            </p>
            <p>
              • <strong>Default Symbols:</strong> 2Y, 5Y, 10Y, 30Y T-Note Futures + 3M SOFR Futures
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

