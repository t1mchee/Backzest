import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { format, subDays, parseISO } from 'date-fns';
import ChartControls from '../components/ChartControls';

const API_BASE_URL = 'http://localhost:8000';

const FedRatesPage = () => {
  const [fedRatesData, setFedRatesData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState(365);
  const [loading, setLoading] = useState(true);
  const [autoscale, setAutoscale] = useState(true);

  useEffect(() => {
    const loadFedRates = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), timeRange), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/fed/rates`, {
          params: { start_date: startDate, end_date: endDate }
        });
        setFedRatesData(response.data);
      } catch (error) {
        console.error('Failed to load Fed rates:', error);
        setFedRatesData({ data: [], count: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadFedRates();
  }, [timeRange]);

  // Group data by rate type for the chart
  const chartData = fedRatesData?.data ? (() => {
    const grouped: any = {};
    fedRatesData.data.forEach((item: any) => {
      const date = format(parseISO(item.date), 'MMM dd, yyyy');
      if (!grouped[date]) {
        grouped[date] = { date };
      }
      grouped[date][item.rate_type] = item.rate;
    });
    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  })() : [];

  // Get latest rates
  const latestRates = fedRatesData?.data ? (() => {
    const ratesByType: any = {};
    fedRatesData.data.forEach((item: any) => {
      if (!ratesByType[item.rate_type] || new Date(item.date) > new Date(ratesByType[item.rate_type].date)) {
        ratesByType[item.rate_type] = item;
      }
    });
    return Object.values(ratesByType);
  })() : [];

  const rateTypes = [...new Set(fedRatesData?.data?.map((item: any) => item.rate_type) || [])];

  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Federal Reserve Rates</h1>
        <p className="text-gray-600 mt-2">
          Track policy rates set by the Federal Reserve
        </p>
      </div>

      {/* Latest Rates Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {latestRates.map((rate: any, idx: number) => (
          <div key={idx} className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">{rate.rate_type}</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {rate.rate.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              As of {format(parseISO(rate.date), 'MMM dd, yyyy')}
            </p>
          </div>
        ))}
      </div>

      {/* Time Range Selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-3">Time Range</h2>
        <div className="flex space-x-2">
          {[
            { label: '3 Months', days: 90 },
            { label: '6 Months', days: 180 },
            { label: '1 Year', days: 365 },
            { label: '2 Years', days: 730 },
            { label: '5 Years', days: 1825 },
            { label: '10 Years', days: 3650 },
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

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Fed Rates Over Time</h2>
          <ChartControls 
            autoscale={autoscale} 
            onToggleAutoscale={() => setAutoscale(!autoscale)} 
          />
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            No Fed rates data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
                domain={autoscale ? ['dataMin - 0.5', 'dataMax + 0.5'] : [0, 'dataMax + 1']}
              />
              <Tooltip 
                formatter={(value: number) => `${value?.toFixed(2)}%`}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
              />
              <Legend />
              {rateTypes.map((rateType: any, idx: number) => (
                <Line 
                  key={rateType}
                  type="monotone" 
                  dataKey={rateType} 
                  stroke={colors[idx % colors.length]} 
                  strokeWidth={2}
                  dot={false}
                  name={rateType}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">💵 About Federal Reserve Rates</h3>
        <ul className="list-disc list-inside text-green-800 space-y-1 text-sm">
          <li><strong>Federal Funds Rate</strong>: The target rate banks charge each other for overnight loans</li>
          <li><strong>SOFR (Secured Overnight Financing Rate)</strong>: Replacement for LIBOR, based on Treasury repo transactions</li>
          <li><strong>Effective Federal Funds Rate</strong>: The actual average rate for federal funds transactions</li>
          <li><strong>Overnight Bank Funding Rate</strong>: Broad measure of wholesale funding costs</li>
        </ul>
        <p className="text-xs text-green-700 mt-3">
          <strong>Note:</strong> The Fed adjusts these rates to influence economic activity, inflation, and employment.
        </p>
      </div>
    </div>
  );
};

export default FedRatesPage;

