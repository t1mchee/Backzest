import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import { Download } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const DataTablesPage = () => {
  const [activeTab, setActiveTab] = useState('treasury');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd'); // Last 30 days

        let response;
        switch (activeTab) {
          case 'treasury':
            response = await axios.get(`${API_BASE_URL}/api/treasury/rates`, {
              params: { start_date: startDate, end_date: endDate }
            });
            break;
          case 'fed':
            response = await axios.get(`${API_BASE_URL}/api/fed/rates`, {
              params: { start_date: startDate, end_date: endDate }
            });
            break;
          case 'spreads':
            response = await axios.get(`${API_BASE_URL}/api/treasury/spreads`, {
              params: { start_date: startDate, end_date: endDate }
            });
            break;
          default:
            response = { data: { data: [] } };
        }
        setData(response.data.data || []);
      } catch (error) {
        console.error('Failed to load data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  const exportToCSV = () => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_data_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Data Tables</h1>
            <p className="text-gray-600 mt-2">
              Explore and export raw data
            </p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={data.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <Download className="w-5 h-5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'treasury', label: 'Treasury Rates' },
              { id: 'fed', label: 'Fed Rates' },
              { id: 'spreads', label: 'Spreads' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Table */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-600">Loading...</div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No data available
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {data.length} records (last 30 days)
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(data[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {Object.values(row).map((value: any, valueIdx) => (
                          <td key={valueIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof value === 'number' ? value.toFixed(2) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">📄 Data Export</h3>
        <p className="text-gray-700 text-sm">
          Click "Export CSV" to download the current table data in CSV format. 
          You can open this file in Excel, Google Sheets, or any data analysis tool.
        </p>
        <p className="text-gray-600 text-xs mt-2">
          <strong>Note:</strong> Currently showing the most recent 30 days of data. 
          For larger exports, use the API directly or contact support.
        </p>
      </div>
    </div>
  );
};

export default DataTablesPage;

