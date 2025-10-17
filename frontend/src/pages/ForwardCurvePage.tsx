import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getForwardCurve, getAvailableCurveDates } from '../services/api';
import { format, parseISO } from 'date-fns';
import ChartControls from '../components/ChartControls';

// Inline types to avoid module caching issues
interface ForwardCurvePoint {
  date: string;
  symbol: string;
  contract_month: string;
  expiration_date: string;
  price: number;
  high: number;
  low: number;
  open: number;
  change: number;
}

interface AvailableDate {
  date: string;
  num_contracts: number;
}

const ForwardCurvePage = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('ZN');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [curveData, setCurveData] = useState<ForwardCurvePoint[] | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoscale, setAutoscale] = useState(true);

  const symbolNames: Record<string, string> = {
    'ZT': '2Y T-Note',
    'ZF': '5Y T-Note',
    'ZN': '10Y T-Note',
    'ZB': '30Y T-Bond',
    'UB': 'Ultra T-Bond',
    'TN': 'Ultra 10Y T-Note',
  };

  // Load available dates when symbol changes
  useEffect(() => {
    const loadDates = async () => {
      try {
        const response = await getAvailableCurveDates(selectedSymbol);
        setAvailableDates(response.dates || []);
        // Set default to most recent date
        if (response.dates && response.dates.length > 0) {
          setSelectedDate(response.dates[0].date);
        }
      } catch (error) {
        console.error('Error loading available dates:', error);
      }
    };
    loadDates();
  }, [selectedSymbol]);

  // Load curve data when symbol or date changes
  useEffect(() => {
    if (!selectedDate) return;
    
    const loadCurve = async () => {
      setLoading(true);
      try {
        const response = await getForwardCurve(selectedSymbol, selectedDate);
        setCurveData(response.data || []);
      } catch (error) {
        console.error('Error loading forward curve:', error);
        setCurveData([]);
      } finally {
        setLoading(false);
      }
    };
    loadCurve();
  }, [selectedSymbol, selectedDate]);

  // Format data for chart
  const formattedData = curveData ?
    curveData.map((point) => ({
      contract: point.contract_month,
      expiration: format(parseISO(point.expiration_date), 'MMM yyyy'),
      price: point.price,
      high: point.high,
      low: point.low,
    })) : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Futures Forward Curves</h1>
        <p className="text-gray-600 mt-2">
          View term structure of Treasury futures prices across contract months
        </p>
      </div>

      {/* Symbol Selection */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Select Contract</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(symbolNames).map(([symbol, name]) => (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                selectedSymbol === symbol
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Date Selection */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Select Date</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curve Date ({availableDates.length} available)
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableDates.map((d) => (
                <option key={d.date} value={d.date}>
                  {format(parseISO(d.date), 'MMM dd, yyyy')} ({d.num_contracts} contracts)
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="bg-blue-50 p-4 rounded-lg w-full">
              <div className="text-sm text-gray-600">Selected:</div>
              <div className="text-lg font-bold text-blue-600">
                {symbolNames[selectedSymbol]} - {selectedDate ? format(parseISO(selectedDate), 'MMM dd, yyyy') : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Prices */}
      {curveData && curveData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Contract Prices</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {curveData.map((point, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-1">
                  {point.contract_month}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {point.price.toFixed(4)}
                </div>
                <div className="text-xs text-gray-600">
                  {format(parseISO(point.expiration_date), 'MMM yyyy')}
                </div>
                <div className={`text-xs font-semibold mt-1 ${
                  point.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {point.change >= 0 ? '+' : ''}{point.change.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forward Curve Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Forward Curve</h2>
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
            No forward curve data available for this date
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="expiration" 
                label={{ value: 'Contract Expiration', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Price', angle: -90, position: 'insideLeft' }}
                domain={autoscale ? ['dataMin - 0.5', 'dataMax + 0.5'] : ['auto', 'auto']}
              />
              <Tooltip 
                formatter={(value: number) => [value.toFixed(4), '']}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 6 }} 
                name="Settlement Price" 
              />
              <Line 
                type="monotone" 
                dataKey="high" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={{ r: 4 }} 
                name="High" 
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="low" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={{ r: 4 }} 
                name="Low" 
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📊 About Forward Curves</h3>
        <div className="text-blue-800 space-y-2">
          <p>
            <strong>What is a Forward Curve?</strong> Shows prices of different contract months at a single point in time.
          </p>
          <p>
            <strong>Contango:</strong> Upward sloping curve (later contracts more expensive) - typical for financials
          </p>
          <p>
            <strong>Backwardation:</strong> Downward sloping curve (later contracts cheaper) - less common for rates
          </p>
          <p>
            <strong>Use Cases:</strong> Roll costs, term structure analysis, arbitrage opportunities
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForwardCurvePage;

