import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { YieldCurvePoint } from '../../services/api';

interface YieldCurveChartProps {
  data: YieldCurvePoint[];
  date?: string;
}

const YieldCurveChart: React.FC<YieldCurveChartProps> = ({ data, date }) => {
  // Sort data by maturity years for proper curve
  const sortedData = [...data].sort((a, b) => a.maturity_years - b.maturity_years);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">
        US Treasury Yield Curve
        {date && <span className="text-gray-500 text-lg ml-2">- {date}</span>}
      </h2>
      
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
  );
};

export default YieldCurveChart;

