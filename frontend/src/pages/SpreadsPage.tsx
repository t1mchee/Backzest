import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import axios from 'axios';
import { format, subDays, parseISO } from 'date-fns';
import ChartControls from '../components/ChartControls';

const API_BASE_URL = 'http://localhost:8000';

const SpreadsPage = () => {
  const [spreadsData, setSpreadsData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState(730); // days
  const [loading, setLoading] = useState(true);
  const [autoscale, setAutoscale] = useState(true);

  useEffect(() => {
    const loadSpreads = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), timeRange), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/treasury/spreads`, {
          params: { start_date: startDate, end_date: endDate }
        });
        setSpreadsData(response.data);
      } catch (error) {
        console.error('Failed to load spreads:', error);
        setSpreadsData({ data: [], count: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadSpreads();
  }, [timeRange]);

  const formattedData = spreadsData?.data ? 
    spreadsData.data
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item: any) => ({
        ...item,
        dateFormatted: format(parseISO(item.date), 'MMM dd, yyyy')
      })) : [];

  const latest = formattedData[formattedData.length - 1];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Treasury Yield Spreads</h1>
        <p className="text-gray-600 mt-2">
          Monitor yield curve spreads as economic indicators
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-3">Time Range</h2>
        <div className="flex space-x-2">
          {[
            { label: '1 Month', days: 30 },
            { label: '3 Months', days: 90 },
            { label: '6 Months', days: 180 },
            { label: '1 Year', days: 365 },
            { label: '2 Years', days: 730 },
            { label: '5 Years', days: 1825 },
          ].map((range) => (
            <button
              key={range.days}
              onClick={() => setTimeRange(range.days)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                timeRange === range.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Spreads Cards */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className={`p-6 rounded-lg shadow-md ${latest.spread_10y2y >= 0 ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
            <h3 className="text-lg font-semibold text-gray-700">10Y-2Y Spread</h3>
            <p className={`text-4xl font-bold mt-2 ${latest.spread_10y2y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {latest.spread_10y2y.toFixed(2)} bps
            </p>
            <p className={`text-sm mt-2 ${latest.spread_10y2y >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {latest.spread_10y2y >= 0 ? '✓ Normal Curve' : '⚠️ INVERTED - Recession Signal'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              10Y: {latest.rate_10y.toFixed(2)}% | 2Y: {latest.rate_2y.toFixed(2)}%
            </p>
          </div>

          <div className={`p-6 rounded-lg shadow-md ${latest.spread_10y3m >= 0 ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
            <h3 className="text-lg font-semibold text-gray-700">10Y-3M Spread</h3>
            <p className={`text-4xl font-bold mt-2 ${latest.spread_10y3m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {latest.spread_10y3m.toFixed(2)} bps
            </p>
            <p className={`text-sm mt-2 ${latest.spread_10y3m >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {latest.spread_10y3m >= 0 ? '✓ Normal Curve' : '⚠️ INVERTED - Recession Signal'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              10Y: {latest.rate_10y.toFixed(2)}% | 3M: {latest.rate_3m.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Spreads Over Time</h2>
          <ChartControls 
            autoscale={autoscale} 
            onToggleAutoscale={() => setAutoscale(!autoscale)} 
          />
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : formattedData.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            No spread data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="dateFormatted"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: 'Spread (basis points)', angle: -90, position: 'insideLeft' }}
                domain={autoscale ? ['dataMin - 0.5', 'dataMax + 0.5'] : [-2, 'dataMax + 1']}
              />
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(2)} bps`}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" label="Zero" />
              <Line 
                type="monotone" 
                dataKey="spread_10y2y" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                dot={false}
                name="10Y-2Y Spread"
              />
              <Line 
                type="monotone" 
                dataKey="spread_10y3m" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={false}
                name="10Y-3M Spread"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ Understanding Yield Spreads</h3>
        <p className="text-amber-800 mb-3">
          Yield spreads measure the difference between long-term and short-term Treasury rates.
        </p>
        <ul className="list-disc list-inside text-amber-800 space-y-1 text-sm">
          <li><strong>Positive Spread</strong>: Normal economic conditions (steep or normal curve)</li>
          <li><strong>Near Zero</strong>: Economic uncertainty (flat curve)</li>
          <li><strong>Negative Spread (Inversion)</strong>: Strong recession predictor - Historically precedes recessions by 6-18 months</li>
        </ul>
        <p className="text-xs text-amber-700 mt-3">
          <strong>Note:</strong> The 10Y-2Y spread has accurately predicted every US recession since 1955.
        </p>
      </div>
    </div>
  );
};

export default SpreadsPage;

