import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Spread } from '../../services/api';

interface SpreadsChartProps {
  data: Spread[];
}

const SpreadsChart: React.FC<SpreadsChartProps> = ({ data }) => {
  // Sort data by date and format for display
  const formattedData = data
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(item => ({
      ...item,
      dateFormatted: format(parseISO(item.date), 'MMM dd, yyyy')
    }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Treasury Yield Spreads</h2>
      <p className="text-gray-600 mb-4">
        Spread inversion (negative values) can signal economic recession
      </p>
      
      {formattedData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No spread data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={formattedData}>
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
      )}
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded">
          <div className="text-sm text-gray-600">Current 10Y-2Y Spread</div>
          <div className="text-2xl font-bold text-blue-600">
            {formattedData.length > 0 ? `${formattedData[formattedData.length - 1].spread_10y2y.toFixed(2)} bps` : 'N/A'}
          </div>
        </div>
        <div className="p-4 bg-amber-50 rounded">
          <div className="text-sm text-gray-600">Current 10Y-3M Spread</div>
          <div className="text-2xl font-bold text-amber-600">
            {formattedData.length > 0 ? `${formattedData[formattedData.length - 1].spread_10y3m.toFixed(2)} bps` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpreadsChart;

