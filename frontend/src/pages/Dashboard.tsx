import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import axios from 'axios';
import { Calendar } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

const API_BASE_URL = 'http://localhost:8000';

const Dashboard = () => {
  const [yieldCurveData, setYieldCurveData] = useState<any>(null);
  const [spreadsData, setSpreadsData] = useState<any>(null);
  const [cotData, setCOTData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load data summary
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/stats/summary`);
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to load summary:', error);
      }
    };
    loadSummary();
  }, []);

  // Load yield curve
  useEffect(() => {
    const loadYieldCurve = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/treasury/yield-curve`, {
          params: { curve_date: selectedDate }
        });
        setYieldCurveData(response.data);
      } catch (error) {
        console.error('Failed to load yield curve:', error);
        setYieldCurveData({ data: [], count: 0 });
      }
    };
    loadYieldCurve();
  }, [selectedDate]);

  // Load spreads data
  useEffect(() => {
    const loadSpreads = async () => {
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 730), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/treasury/spreads`, {
          params: { start_date: startDate, end_date: endDate }
        });
        setSpreadsData(response.data);
      } catch (error) {
        console.error('Failed to load spreads:', error);
        setSpreadsData({ data: [], count: 0 });
      }
    };
    loadSpreads();
  }, []);

  // Load COT contracts
  useEffect(() => {
    const loadContracts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/cftc/contracts`);
        setContracts(response.data.contracts || []);
        if (response.data.contracts && response.data.contracts.length > 0) {
          setSelectedContract(response.data.contracts[0].contract_name);
        }
      } catch (error) {
        console.error('Failed to load contracts:', error);
      } finally {
        setLoading(false);
      }
    };
    loadContracts();
  }, []);

  // Load COT data for selected contract
  useEffect(() => {
    if (!selectedContract) return;

    const loadCOT = async () => {
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 180), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/cftc/cot`, {
          params: {
            start_date: startDate,
            end_date: endDate,
            contract_name: selectedContract
          }
        });
        setCOTData(response.data);
      } catch (error) {
        console.error('Failed to load COT data:', error);
        setCOTData({ data: [], count: 0 });
      }
    };
    loadCOT();
  }, [selectedContract]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Prepare yield curve data
  const sortedYieldData = yieldCurveData?.data ? 
    [...yieldCurveData.data].sort((a: any, b: any) => a.maturity_years - b.maturity_years) : [];

  // Prepare spreads data
  const formattedSpreadsData = spreadsData?.data ? 
    spreadsData.data
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item: any) => ({
        ...item,
        dateFormatted: format(parseISO(item.date), 'MMM dd, yyyy')
      })) : [];

  // Prepare COT data
  const formattedCOTData = cotData?.data ?
    cotData.data
      .sort((a: any, b: any) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
      .map((item: any) => ({
        date: format(parseISO(item.report_date), 'MMM dd'),
        noncomm_net: item.noncomm_positions_long - item.noncomm_positions_short,
        comm_net: item.comm_positions_long - item.comm_positions_short,
        noncomm_long: item.noncomm_positions_long,
        noncomm_short: -item.noncomm_positions_short,
        comm_long: item.comm_positions_long,
        comm_short: -item.comm_positions_short,
        raw: item
      })) : [];

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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Yield Curve Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">US Treasury Yield Curve</h2>
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
          
          {sortedYieldData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No data available for {selectedDate}. Try 2025-10-16 or earlier.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={sortedYieldData}>
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

        {/* Spreads Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-2">Treasury Yield Spreads</h2>
          <p className="text-gray-600 mb-4">
            Spread inversion (negative values) can signal economic recession
          </p>
          
          {formattedSpreadsData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No spread data available
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={formattedSpreadsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateFormatted"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    label={{ value: 'Spread (basis points)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(2)} bps`}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
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
              
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <div className="text-sm text-gray-600">Current 10Y-2Y Spread</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formattedSpreadsData[formattedSpreadsData.length - 1]?.spread_10y2y.toFixed(2)} bps
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formattedSpreadsData[formattedSpreadsData.length - 1]?.spread_10y2y > 0 ? 
                      '✓ Normal curve' : '⚠️ Inverted!'}
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded">
                  <div className="text-sm text-gray-600">Current 10Y-3M Spread</div>
                  <div className="text-2xl font-bold text-amber-600">
                    {formattedSpreadsData[formattedSpreadsData.length - 1]?.spread_10y3m.toFixed(2)} bps
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formattedSpreadsData[formattedSpreadsData.length - 1]?.spread_10y3m > 0 ? 
                      '✓ Normal curve' : '⚠️ Inverted!'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* COT Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Futures Positioning (COT)</h2>
              <p className="text-gray-600 text-sm">
                Net positions of commercial (hedgers) vs non-commercial (speculators) traders
              </p>
            </div>
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent max-w-xs"
            >
              {contracts.map((contract) => (
                <option key={contract.contract_name} value={contract.contract_name}>
                  {contract.contract_name.split(' - ')[0]} ({contract.record_count})
                </option>
              ))}
            </select>
          </div>
          
          {formattedCOTData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No COT data available for this contract
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={formattedCOTData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Net Position (Contracts)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Bar dataKey="noncomm_net" fill="#0ea5e9" name="Non-Commercial Net (Speculators)" />
                  <Bar dataKey="comm_net" fill="#10b981" name="Commercial Net (Hedgers)" />
                </BarChart>
              </ResponsiveContainer>
              
              {cotData?.data && cotData.data[0] && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Latest Report ({format(parseISO(cotData.data[0].report_date), 'MMM dd, yyyy')})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded">
                      <div className="text-sm text-gray-600">Non-Comm Long</div>
                      <div className="text-xl font-bold text-blue-600">
                        {cotData.data[0].noncomm_positions_long.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cotData.data[0].pct_noncomm_long.toFixed(1)}% of OI
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 rounded">
                      <div className="text-sm text-gray-600">Non-Comm Short</div>
                      <div className="text-xl font-bold text-red-600">
                        {cotData.data[0].noncomm_positions_short.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cotData.data[0].pct_noncomm_short.toFixed(1)}% of OI
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded">
                      <div className="text-sm text-gray-600">Commercial Long</div>
                      <div className="text-xl font-bold text-green-600">
                        {cotData.data[0].comm_positions_long.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded">
                      <div className="text-sm text-gray-600">Commercial Short</div>
                      <div className="text-xl font-bold text-orange-600">
                        {cotData.data[0].comm_positions_short.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg font-semibold">US Interest Rates Analysis Platform</p>
          <p className="text-sm text-gray-400 mt-2">
            Data sources: FRED, US Treasury, CFTC • Updated daily
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Built with React, FastAPI, PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
