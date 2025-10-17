import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const Overview = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/stats/summary`);
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to load summary:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">
          Real-time US interest rates, Treasury yields, and futures positioning data
        </p>
      </div>

      {/* Stats Grid */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-700">Treasury Rates</h3>
            <p className="text-4xl font-bold text-blue-600 mt-3">
              {summary.treasury_rates.total_records.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              📊 {summary.treasury_rates.maturity_count} maturities tracked
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {summary.treasury_rates.earliest_date} to {summary.treasury_rates.latest_date}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <h3 className="text-lg font-semibold text-gray-700">Fed Rates</h3>
            <p className="text-4xl font-bold text-green-600 mt-3">
              {summary.fed_rates.total_records.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              📈 {summary.fed_rates.rate_types} rate types
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {summary.fed_rates.earliest_date} to {summary.fed_rates.latest_date}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold text-gray-700">COT Reports</h3>
            <p className="text-4xl font-bold text-purple-600 mt-3">
              {summary.cftc_cot.total_records.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              📊 {summary.cftc_cot.contract_count} contracts
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {summary.cftc_cot.earliest_date} to {summary.cftc_cot.latest_date}
            </p>
          </div>
        </div>
      )}

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-blue-900 mb-3">📈 Yield Curve</h3>
          <p className="text-gray-700 mb-3">
            View the US Treasury yield curve across all maturities. Track the shape and identify inversions.
          </p>
          <a href="/yield-curve" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            View Yield Curve →
          </a>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-amber-900 mb-3">🔀 Spreads</h3>
          <p className="text-gray-700 mb-3">
            Monitor 10Y-2Y and 10Y-3M spreads. Track yield curve inversions as recession indicators.
          </p>
          <a href="/spreads" className="inline-block bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition">
            View Spreads →
          </a>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-green-900 mb-3">💵 Fed Rates</h3>
          <p className="text-gray-700 mb-3">
            Track Federal Reserve rates including Fed Funds, SOFR, and other policy rates.
          </p>
          <a href="/fed-rates" className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
            View Fed Rates →
          </a>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-purple-900 mb-3">📊 Futures/COT</h3>
          <p className="text-gray-700 mb-3">
            Analyze positioning in Treasury futures. Track commercial vs non-commercial traders.
          </p>
          <a href="/futures" className="inline-block bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
            View COT Data →
          </a>
        </div>
      </div>

      {/* Data Update Info */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">📅 Data Collection</h3>
        <p className="text-gray-600 mb-2">
          Data is collected daily from multiple sources:
        </p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li><strong>FRED</strong> - Federal Reserve Economic Data</li>
          <li><strong>US Treasury</strong> - Daily Treasury yield curve rates</li>
          <li><strong>CFTC</strong> - Commitments of Traders reports (weekly)</li>
        </ul>
        <p className="text-sm text-gray-500 mt-4">
          Last updated: {summary?.last_updated ? new Date(summary.last_updated).toLocaleString() : 'Loading...'}
        </p>
      </div>
    </div>
  );
};

export default Overview;

