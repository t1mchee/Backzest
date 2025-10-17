import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as api from '../services/api';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const [yieldCurveData, setYieldCurveData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data summary
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await api.getDataSummary();
        setSummary(data);
      } catch (error: any) {
        console.error('Failed to load summary:', error);
        setError(error.message);
      }
    };
    loadSummary();
  }, []);

  // Load yield curve
  useEffect(() => {
    const loadYieldCurve = async () => {
      try {
        const data = await api.getYieldCurve(selectedDate);
        setYieldCurveData(data);
        setLoading(false);
      } catch (error: any) {
        console.error('Failed to load yield curve:', error);
        setYieldCurveData({ data: [], count: 0 });
        setLoading(false);
      }
    };
    loadYieldCurve();
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const sortedData = yieldCurveData?.data ? [...yieldCurveData.data].sort((a: any, b: any) => a.maturity_years - b.maturity_years) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold">US Interest Rates Dashboard</h1>
          <p className="text-blue-100 mt-2">Real-time Treasury yields, Fed rates, and futures positioning</p>
        </div>
      </header>

      {/* Stats Cards */}
      {summary && (
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700">Treasury Rates</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {summary.treasury_rates.total_records.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {summary.treasury_rates.maturity_count} maturities tracked
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700">Fed Rates</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {summary.fed_rates.total_records.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {summary.fed_rates.rate_types} rate types
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700">COT Reports</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {summary.cftc_cot.total_records.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {summary.cftc_cot.contract_count} contracts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Yield Curve */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">US Treasury Yield Curve</h2>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {sortedData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No data available for the selected date
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={sortedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="maturity" 
                  label={{ value: 'Maturity', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#0ea5e9" 
                  strokeWidth={3}
                  dot={{ fill: '#0ea5e9', r: 5 }}
                  name="Yield"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="container mx-auto px-4 text-center">
          <p>US Interest Rates Analysis Platform</p>
          <p className="text-sm text-gray-400 mt-2">
            Data sources: FRED, US Treasury, CFTC
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;

