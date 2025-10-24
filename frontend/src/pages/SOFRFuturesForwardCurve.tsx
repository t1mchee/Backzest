import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, RefreshCw, Calendar, Activity } from 'lucide-react';

interface SOFRFuturesContract {
  symbol: string;
  contract_month: string;
  years_forward: number;
  price: number;
  implied_rate: number;
}

interface SOFRForwardCurve {
  curve_date: string;
  data: SOFRFuturesContract[];
  count: number;
}

const SOFRFuturesForwardCurve = () => {
  const [curveData, setCurveData] = useState<SOFRForwardCurve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadCurve = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/sofr/futures-forward-curve');
      if (!response.ok) {
        throw new Error('Failed to load SOFR futures forward curve');
      }
      const data = await response.json();
      setCurveData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading SOFR futures forward curve:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurve();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadCurve, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format data for the chart
  const chartData = curveData?.data.map(contract => ({
    name: contract.contract_month,
    years: contract.years_forward,
    rate: contract.implied_rate,
    price: contract.price
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center">
                <Activity className="w-10 h-10 mr-4 text-blue-500" />
                SOFR Futures Forward Curve
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time implied forward rates from CME SOFR futures prices
              </p>
            </div>
            <button
              onClick={loadCurve}
              disabled={loading}
              className="flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-md"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {lastUpdated && (
            <div className="mt-4 text-sm text-gray-500 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Last updated: {lastUpdated}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
            <p className="text-red-600 text-sm mt-2">
              Make sure the TradingView service is running and collecting SOFR futures data.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && !curveData ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
              <span className="ml-4 text-lg text-gray-600">Loading forward curve data...</span>
            </div>
          </div>
        ) : curveData ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">Contracts</div>
                <div className="text-3xl font-bold text-blue-600">{curveData.count}</div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">Current Rate</div>
                <div className="text-3xl font-bold text-green-600">
                  {curveData.data[0]?.implied_rate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">2Y Forward</div>
                <div className="text-3xl font-bold text-purple-600">
                  {curveData.data[curveData.data.length - 1]?.implied_rate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">Horizon</div>
                <div className="text-3xl font-bold text-orange-600">
                  {curveData.data[curveData.data.length - 1]?.years_forward.toFixed(1)}y
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 mr-3 text-blue-500" />
                Implied Forward Rates
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    label={{ value: 'Implied Rate (%)', angle: -90, position: 'insideLeft' }}
                    domain={['dataMin - 0.2', 'dataMax + 0.2']}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'rate') return [`${value.toFixed(3)}%`, 'Implied Rate'];
                      if (name === 'price') return [value.toFixed(4), 'Futures Price'];
                      return [value, name];
                    }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 5 }} 
                    name="Implied Rate (%)" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contract Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Years Forward</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Futures Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Implied Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {curveData.data.map((contract) => (
                      <tr key={contract.symbol} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {contract.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {contract.contract_month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                          {contract.years_forward.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {contract.price.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                          {contract.implied_rate.toFixed(3)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">About SOFR Futures Forward Curve</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>SOFR Futures:</strong> CME Group's Three-Month SOFR futures (SR3) provide price discovery for forward-looking term rates.
            </p>
            <p>
              <strong>Implied Rate Calculation:</strong> Futures Price = 100 - Implied 3-Month SOFR Rate. 
              For example, if SR3H2025 trades at 95.65, the implied 3-month SOFR for March 2025 is 4.35%.
            </p>
            <p>
              <strong>Forward Curve:</strong> The curve shows the market's expectation of where 3-month SOFR will be at different points in the future.
            </p>
            <p>
              <strong>Data Source:</strong> Real-time prices from TradingView for CME SOFR futures contracts.
            </p>
            <p>
              <strong>Update Frequency:</strong> Prices update every 5 minutes during market hours. Auto-refresh enabled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOFRFuturesForwardCurve;

