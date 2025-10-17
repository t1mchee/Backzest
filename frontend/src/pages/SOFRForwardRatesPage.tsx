import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSOFRTermRates, getSOFRForwardCurve } from '../services/api';
import { format, parseISO, subDays } from 'date-fns';
import ChartControls from '../components/ChartControls';

// Inline types to avoid module caching issues
interface SOFRTermRate {
  date: string;
  maturity: string;
  rate: number;
}

interface SOFRForwardPoint {
  period: string;
  label: string;
  forward_rate: number;
  days_forward: number;
  tenor_days: number;
}

const SOFRForwardRatesPage = () => {
  const [termRatesData, setTermRatesData] = useState<SOFRTermRate[] | null>(null);
  const [forwardCurveData, setForwardCurveData] = useState<SOFRForwardPoint[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [autoscaleTermRates, setAutoscaleTermRates] = useState(true);

  // Load SOFR term rates (30D, 90D, 180D)
  useEffect(() => {
    const loadTermRates = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
        const response = await getSOFRTermRates(startDate, endDate);
        setTermRatesData(response.data || []);
      } catch (error) {
        console.error('Error loading SOFR term rates:', error);
        setTermRatesData([]);
      } finally {
        setLoading(false);
      }
    };
    loadTermRates();
  }, []);

  // Load SOFR forward curve (calculated from term rates)
  useEffect(() => {
    const loadForwardCurve = async () => {
      try {
        const response = await getSOFRForwardCurve(selectedDate);
        setForwardCurveData(response.data || []);
      } catch (error) {
        console.error('Error loading SOFR forward curve:', error);
        setForwardCurveData([]);
      }
    };
    loadForwardCurve();
  }, [selectedDate]);

  // Format term rates data for chart
  const formattedTermRatesData = termRatesData
    ? termRatesData.reduce((acc: any[], rate) => {
        const existingDate = acc.find(item => item.date === rate.date);
        if (existingDate) {
          existingDate[rate.maturity] = rate.rate;
        } else {
          acc.push({
            date: format(parseISO(rate.date), 'MMM dd'),
            dateSort: rate.date,
            [rate.maturity]: rate.rate
          });
        }
        return acc;
      }, []).sort((a, b) => a.dateSort.localeCompare(b.dateSort))
    : [];

  // Separate spot and forward rates
  const spotRates = forwardCurveData?.filter(point => point.period.startsWith('spot')) || [];
  const forwardRates = forwardCurveData?.filter(point => !point.period.startsWith('spot')) || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">SOFR Forward Rates</h1>
        <p className="text-gray-600 mt-2">
          Analyze SOFR term structure and forward rates derived from futures markets
        </p>
      </div>

      {/* SOFR Term Rates Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">SOFR Term Rates (Past Year)</h2>
          <ChartControls 
            autoscale={autoscaleTermRates} 
            onToggleAutoscale={() => setAutoscaleTermRates(!autoscaleTermRates)} 
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : formattedTermRatesData.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            No SOFR term rate data available. Please collect data first.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={formattedTermRatesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
                domain={autoscaleTermRates ? ['dataMin - 0.1', 'dataMax + 0.1'] : [0, 'dataMax + 1']}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(3)}%`, '']}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="30D" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={false} 
                name="30-Day SOFR" 
              />
              <Line 
                type="monotone" 
                dataKey="90D" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={false} 
                name="90-Day SOFR" 
              />
              <Line 
                type="monotone" 
                dataKey="180D" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={false} 
                name="180-Day SOFR" 
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Forward Curve Date Selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Forward Rates - Select Date</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Curve Date (calculated from SOFR term rates)
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* SOFR Forward Rates Display */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            SOFR Forward Rates - {format(parseISO(selectedDate), 'MMM dd, yyyy')}
          </h2>
        </div>
        {!forwardCurveData || forwardCurveData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No forward rate data available for this date. Please collect SOFR term rates data first.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Spot Rates Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Current Spot Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {spotRates.map((rate) => (
                  <div key={rate.period} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-600 font-medium mb-1">{rate.label}</div>
                    <div className="text-3xl font-bold text-blue-900">{rate.forward_rate.toFixed(3)}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forward Rates Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Implied Forward Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forwardRates.map((rate) => (
                  <div key={rate.period} className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-sm text-green-600 font-medium mb-1">{rate.label}</div>
                    <div className="text-3xl font-bold text-green-900">{rate.forward_rate.toFixed(3)}%</div>
                    <div className="text-xs text-gray-600 mt-2">
                      {rate.tenor_days}-day rate, {rate.days_forward} days forward
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Detailed View</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate (%)
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Forward
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenor (Days)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {spotRates.map((rate) => (
                      <tr key={rate.period} className="bg-blue-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                          Spot
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {rate.label}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                          {rate.forward_rate.toFixed(3)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rate.days_forward}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rate.tenor_days}
                        </td>
                      </tr>
                    ))}
                    {forwardRates.map((rate) => (
                      <tr key={rate.period}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                          Forward
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {rate.label}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-900">
                          {rate.forward_rate.toFixed(3)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rate.days_forward}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rate.tenor_days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">About SOFR Forward Rates</h3>
        <div className="text-blue-800 space-y-2 text-sm">
          <p>
            <strong>SOFR (Secured Overnight Financing Rate):</strong> The benchmark interest rate for dollar-denominated 
            derivatives and loans, replacing LIBOR.
          </p>
          <p>
            <strong>Term SOFR:</strong> Average of daily SOFR over different periods (30-day, 90-day, 180-day) published by FRED.
          </p>
          <p>
            <strong>Forward Rates:</strong> Implied future interest rates calculated from the term structure. 
            For example, "30d rate, 30d forward" means the expected 30-day rate starting 30 days from now.
          </p>
          <p>
            <strong>Calculation Method:</strong> Forward rates are derived using the formula: 
            <code className="bg-white px-1 rounded">f = ((1 + r₂·t₂) / (1 + r₁·t₁) - 1) / (t₂-t₁)</code>
            where r₁ and r₂ are spot rates for periods t₁ and t₂.
          </p>
          <p>
            <strong>Interpretation:</strong> If forward rates are higher than spot rates, the market expects rates to rise. 
            If lower, the market expects rates to fall.
          </p>
          <p>
            <strong>Data Source:</strong> SOFR term averages from FRED (Federal Reserve Economic Data).
          </p>
        </div>
      </div>
    </div>
  );
};

export default SOFRForwardRatesPage;

