import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { format, subDays, parseISO } from 'date-fns';
import ChartControls from '../components/ChartControls';

const API_BASE_URL = 'http://localhost:8000';

const FuturesPage = () => {
  const [activeTab, setActiveTab] = useState<'prices' | 'positioning'>('prices');
  
  // Prices data
  const [priceData, setPriceData] = useState<any>(null);
  const [priceSymbols, setPriceSymbols] = useState<any[]>([]);
  const [selectedPriceSymbol, setSelectedPriceSymbol] = useState('ZN=F'); // 10Y default
  
  // COT data
  const [cotData, setCOTData] = useState<any>(null);
  const [cotContracts, setCOTContracts] = useState<any[]>([]);
  const [selectedCOTContract, setSelectedCOTContract] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [autoscalePrices, setAutoscalePrices] = useState(true);
  const [autoscaleCOT, setAutoscaleCOT] = useState(true);

  // Symbol display names
  const symbolNames: any = {
    'ZT=F': '2Y T-Note',
    'ZF=F': '5Y T-Note',
    'ZN=F': '10Y T-Note',
    'ZB=F': '30Y T-Bond',
    'UB=F': 'Ultra T-Bond',
    'TN=F': 'Ultra 10Y T-Note',
  };

  // Load price symbols
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/futures/symbols`);
        setPriceSymbols(response.data.symbols || []);
      } catch (error) {
        console.error('Failed to load futures symbols:', error);
      }
    };
    loadSymbols();
  }, []);

  // Load price data
  useEffect(() => {
    if (!selectedPriceSymbol) return;

    const loadPrices = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/futures/prices`, {
          params: {
            start_date: startDate,
            end_date: endDate,
            symbol: selectedPriceSymbol
          }
        });
        setPriceData(response.data);
      } catch (error) {
        console.error('Failed to load futures prices:', error);
        setPriceData({ data: [], count: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadPrices();
  }, [selectedPriceSymbol]);

  // Load COT contracts
  useEffect(() => {
    const loadContracts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/cftc/contracts`);
        setCOTContracts(response.data.contracts || []);
        if (response.data.contracts && response.data.contracts.length > 0) {
          setSelectedCOTContract(response.data.contracts[0].contract_name);
        }
      } catch (error) {
        console.error('Failed to load COT contracts:', error);
      }
    };
    loadContracts();
  }, []);

  // Load COT data
  useEffect(() => {
    if (!selectedCOTContract) return;

    const loadCOT = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
        const response = await axios.get(`${API_BASE_URL}/api/cftc/cot`, {
          params: {
            start_date: startDate,
            end_date: endDate,
            contract_name: selectedCOTContract
          }
        });
        setCOTData(response.data);
      } catch (error) {
        console.error('Failed to load COT data:', error);
        setCOTData({ data: [], count: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadCOT();
  }, [selectedCOTContract]);

  // Format price data for chart
  const formattedPriceData = priceData?.data ?
    priceData.data
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item: any) => ({
        date: format(parseISO(item.date), 'yyyy-MM-dd'),
        dateFormatted: format(parseISO(item.date), 'MMM dd, yyyy'),
        close: item.close,
        high: item.high,
        low: item.low,
        open: item.open,
      })) : [];

  // Format COT data for chart
  const formattedCOTData = cotData?.data ?
    cotData.data
      .sort((a: any, b: any) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
      .map((item: any) => ({
        date: format(parseISO(item.report_date), 'MMM dd'),
        noncomm_net: item.noncomm_positions_long - item.noncomm_positions_short,
        comm_net: item.comm_positions_long - item.comm_positions_short,
        raw: item
      })) : [];

  const latestPrice = formattedPriceData[formattedPriceData.length - 1];
  const latestCOT = cotData?.data?.[0];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Treasury Futures</h1>
        <p className="text-gray-600 mt-2">
          Futures prices and trader positioning data
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('prices')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'prices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📈 Futures Prices
            </button>
            <button
              onClick={() => setActiveTab('positioning')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'positioning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 COT Positioning
            </button>
          </nav>
        </div>
      </div>

      {/* Prices Tab Content */}
      {activeTab === 'prices' && (
        <>
          {/* Symbol Selector */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-3">Select Contract</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(symbolNames).map(([symbol, name]) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedPriceSymbol(symbol)}
                  className={`p-4 rounded-lg font-medium transition ${
                    selectedPriceSymbol === symbol
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Latest Price */}
          {latestPrice && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold mb-4">{symbolNames[selectedPriceSymbol]} - Latest Price</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Close</div>
                  <div className="text-3xl font-bold text-blue-600 mt-1">
                    {latestPrice.close.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">High</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {latestPrice.high.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Low</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {latestPrice.low.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Open</div>
                  <div className="text-2xl font-bold text-gray-600 mt-1">
                    {latestPrice.open.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Price Chart */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Price History (1 Year)</h2>
              <ChartControls 
                autoscale={autoscalePrices} 
                onToggleAutoscale={() => setAutoscalePrices(!autoscalePrices)} 
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-gray-600">Loading...</div>
              </div>
            ) : formattedPriceData.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                No price data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={formattedPriceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return format(date, 'MMM dd');
                    }}
                  />
                  <YAxis 
                    label={{ value: 'Price', angle: -90, position: 'insideLeft' }} 
                    domain={autoscalePrices ? ['dataMin - 0.5', 'dataMax + 0.5'] : ['auto', 'auto']}
                  />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return format(date, 'MMM dd, yyyy');
                    }}
                    formatter={(value: number) => [value.toFixed(4), '']}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="close" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Close" />
                  <Line type="monotone" dataKey="high" stroke="#10b981" strokeWidth={1} dot={false} name="High" />
                  <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={1} dot={false} name="Low" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">📈 About Futures Prices</h3>
            <p className="text-blue-800 mb-2">
              Treasury futures are standardized contracts to buy or sell Treasury securities at a future date.
            </p>
            <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
              <li><strong>Price moves inverse to yields</strong>: When yields rise, futures prices fall</li>
              <li><strong>Highly liquid</strong>: 10Y T-Note (ZN) is the most actively traded</li>
              <li><strong>Used for hedging</strong>: Banks and institutions hedge interest rate risk</li>
              <li><strong>Leverage available</strong>: Control large positions with small margin</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3">
              <strong>Data Source:</strong> Yahoo Finance (delayed/end-of-day data)
            </p>
          </div>
        </>
      )}

      {/* Positioning Tab Content */}
      {activeTab === 'positioning' && (
        <>
          {/* Contract Selector */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-3">Select Contract</h2>
            <select
              value={selectedCOTContract}
              onChange={(e) => setSelectedCOTContract(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            >
              {cotContracts.map((contract) => (
                <option key={contract.contract_name} value={contract.contract_name}>
                  {contract.contract_name.split(' - ')[0]} ({contract.record_count} reports)
                </option>
              ))}
            </select>
          </div>

          {/* Latest COT Data */}
          {latestCOT && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold mb-2">{selectedCOTContract.split(' - ')[0]}</h2>
              <p className="text-gray-600 mb-4">Latest Report: {format(parseISO(latestCOT.report_date), 'MMMM dd, yyyy')}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Non-Comm Long</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {latestCOT.noncomm_positions_long.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {latestCOT.pct_noncomm_long.toFixed(1)}% of OI
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Non-Comm Short</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {latestCOT.noncomm_positions_short.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {latestCOT.pct_noncomm_short.toFixed(1)}% of OI
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Commercial Long</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {latestCOT.comm_positions_long.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-gray-600 font-semibold">Commercial Short</div>
                  <div className="text-2xl font-bold text-orange-600 mt-1">
                    {latestCOT.comm_positions_short.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COT Chart */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Net Positioning Over Time</h2>
              <ChartControls 
                autoscale={autoscaleCOT} 
                onToggleAutoscale={() => setAutoscaleCOT(!autoscaleCOT)} 
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-gray-600">Loading...</div>
              </div>
            ) : formattedCOTData.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                No COT data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={formattedCOTData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis 
                    label={{ value: 'Net Position', angle: -90, position: 'insideLeft' }} 
                    domain={autoscaleCOT ? ['dataMin - 10000', 'dataMax + 10000'] : ['auto', 'auto']}
                  />
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Bar dataKey="noncomm_net" fill="#0ea5e9" name="Non-Commercial Net" />
                  <Bar dataKey="comm_net" fill="#10b981" name="Commercial Net" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">📊 Understanding COT Data</h3>
            <ul className="list-disc list-inside text-purple-800 space-y-1 text-sm">
              <li><strong>Non-Commercial (Speculators)</strong>: Hedge funds, traders betting on direction</li>
              <li><strong>Commercial (Hedgers)</strong>: Banks, dealers hedging interest rate exposure</li>
              <li><strong>Net Position</strong>: Long minus short contracts</li>
              <li><strong>Contrarian indicator</strong>: Extreme speculator positioning often signals reversals</li>
            </ul>
            <p className="text-xs text-purple-700 mt-3">
              <strong>Data Source:</strong> CFTC - Weekly reports (released Friday for Tuesday positions)
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default FuturesPage;
