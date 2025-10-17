import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { COTData } from '../../services/api';

interface COTChartProps {
  data: COTData[];
  contractName: string;
}

const COTChart: React.FC<COTChartProps> = ({ data, contractName }) => {
  // Calculate net positions and format data
  const formattedData = data
    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
    .map(item => ({
      date: format(parseISO(item.report_date), 'MMM dd'),
      noncomm_net: item.noncomm_positions_long - item.noncomm_positions_short,
      comm_net: item.comm_positions_long - item.comm_positions_short,
      noncomm_long: item.noncomm_positions_long,
      noncomm_short: -item.noncomm_positions_short, // Negative for display
      comm_long: item.comm_positions_long,
      comm_short: -item.comm_positions_short,
    }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2">COT Positioning: {contractName}</h2>
      <p className="text-gray-600 mb-4">
        Net positions of commercial (hedgers) vs non-commercial (speculators) traders
      </p>
      
      {formattedData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No COT data available for this contract
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formattedData}>
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
              <Bar dataKey="noncomm_net" fill="#0ea5e9" name="Non-Commercial Net" />
              <Bar dataKey="comm_net" fill="#10b981" name="Commercial Net" />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Latest Report</h3>
            {data[0] && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <div className="text-sm text-gray-600">Non-Comm Long</div>
                  <div className="text-xl font-bold text-blue-600">
                    {data[0].noncomm_positions_long.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {data[0].pct_noncomm_long.toFixed(1)}% of OI
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded">
                  <div className="text-sm text-gray-600">Non-Comm Short</div>
                  <div className="text-xl font-bold text-red-600">
                    {data[0].noncomm_positions_short.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {data[0].pct_noncomm_short.toFixed(1)}% of OI
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-sm text-gray-600">Commercial Long</div>
                  <div className="text-xl font-bold text-green-600">
                    {data[0].comm_positions_long.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded">
                  <div className="text-sm text-gray-600">Commercial Short</div>
                  <div className="text-xl font-bold text-orange-600">
                    {data[0].comm_positions_short.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default COTChart;

