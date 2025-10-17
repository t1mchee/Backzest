import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import ChartControls from '../components/ChartControls';

const API_BASE_URL = 'http://localhost:8000';

const YieldCurvePage = () => {
  const [yieldCurveData, setYieldCurveData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [autoscale, setAutoscale] = useState(true);

  useEffect(() => {
    const loadYieldCurve = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/treasury/yield-curve`, {
          params: { curve_date: selectedDate }
        });
        setYieldCurveData(response.data);
      } catch (error) {
        console.error('Failed to load yield curve:', error);
        setYieldCurveData({ data: [], count: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadYieldCurve();
  }, [selectedDate]);

  const sortedData = yieldCurveData?.data ? 
    [...yieldCurveData.data].sort((a: any, b: any) => a.maturity_years - b.maturity_years) : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">US Treasury Yield Curve</h1>
        <p className="text-gray-600 mt-2">
          Visualize the term structure of interest rates across different maturities
        </p>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Select Date</h2>
            <p className="text-sm text-gray-600 mt-1">View historical yield curves</p>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <input
              type="date"
              value={selectedDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Yield Curve - {selectedDate}</h2>
          <ChartControls 
            autoscale={autoscale} 
            onToggleAutoscale={() => setAutoscale(!autoscale)} 
          />
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No data available for {selectedDate}</p>
              <p className="text-sm">Try 2025-10-16 or earlier</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={sortedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="maturity" 
                label={{ value: 'Maturity', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft' }}
                domain={autoscale ? ['dataMin - 0.5', 'dataMax + 0.5'] : [0, 'dataMax + 1']}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Yield']}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ fill: '#0ea5e9', r: 6 }}
                name="Yield"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data Table */}
      {sortedData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Yield Data</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Maturity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yield (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.maturity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.rate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">📊 Understanding the Yield Curve</h3>
        <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
          <li><strong>Normal Curve</strong>: Upward sloping (longer maturities have higher yields)</li>
          <li><strong>Flat Curve</strong>: Little difference between short and long-term rates</li>
          <li><strong>Inverted Curve</strong>: Downward sloping (short rates higher than long) - Often predicts recession</li>
        </ul>
      </div>
    </div>
  );
};

export default YieldCurvePage;

