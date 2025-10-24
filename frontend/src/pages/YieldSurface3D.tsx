import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Calendar, Box, BarChart, TrendingUp, Download } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getTradingViewYieldSurface } from '../services/api';

export default function YieldSurface3D() {
  const [surfaceData, setSurfaceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));

  useEffect(() => {
    loadSurfaceData();
  }, [startDate, endDate, days]);

  const loadSurfaceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTradingViewYieldSurface(startDate, endDate, days);
      setSurfaceData(data);
    } catch (err: any) {
      console.error('Failed to load yield surface:', err);
      setError(err?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const presetRanges = [
    { label: '30 Days', days: 30 },
    { label: '90 Days', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
    { label: '2 Years', days: 730 },
    { label: '5 Years', days: 1825 },
  ];

  const handlePresetRange = (presetDays: number) => {
    const end = new Date();
    const start = subDays(end, presetDays);
    setEndDate(format(end, 'yyyy-MM-dd'));
    setStartDate(format(start, 'yyyy-MM-dd'));
    setDays(presetDays);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center">
                <Box className="w-10 h-10 mr-4 text-blue-500" />
                3D Yield Curve Surface
              </h1>
              <p className="text-gray-600 mt-2">
                Visualize how the entire yield curve evolves over time in 3D space
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Time Range</h2>
            <button
              onClick={loadSurfaceData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Preset Ranges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {presetRanges.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handlePresetRange(preset.days)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  days === preset.days
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {surfaceData && (
            <div className="mt-4 text-sm text-gray-600">
              <BarChart className="w-4 h-4 inline mr-1" />
              Showing {surfaceData.count} days of yield curves from {surfaceData.start_date} to {surfaceData.end_date}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 3D Surface Plot */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="flex items-center justify-center">
              <Box className="w-12 h-12 text-blue-500 animate-spin" />
              <span className="ml-4 text-lg text-gray-600">Loading 3D surface data...</span>
            </div>
          </div>
        ) : surfaceData ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Yield Curve Evolution</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>X: Time</span>
                <span>•</span>
                <span>Y: Maturity</span>
                <span>•</span>
                <span>Z: Yield (%)</span>
              </div>
            </div>

            <div className="relative" style={{ height: '700px' }}>
              <Plot
                data={[
                  {
                    type: 'surface',
                    x: surfaceData.dates,
                    y: surfaceData.maturities,
                    z: surfaceData.z_values,
                    colorscale: 'Viridis',
                    colorbar: {
                      title: 'Yield (%)',
                      titleside: 'right',
                    },
                    hovertemplate: 
                      '<b>Date:</b> %{x}<br>' +
                      '<b>Maturity:</b> %{y} years<br>' +
                      '<b>Yield:</b> %{z:.2f}%<br>' +
                      '<extra></extra>',
                  },
                ]}
                layout={{
                  autosize: true,
                  scene: {
                    xaxis: {
                      title: 'Date',
                      tickformat: '%Y-%m-%d',
                      nticks: 8,
                    },
                    yaxis: {
                      title: 'Maturity (Years)',
                      ticktext: ['3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'],
                      tickvals: [0.25, 0.5, 1, 2, 5, 10, 30],
                    },
                    zaxis: {
                      title: 'Yield (%)',
                    },
                    camera: {
                      eye: { x: 1.5, y: 1.5, z: 1.2 },
                      center: { x: 0, y: 0, z: 0 },
                    },
                  },
                  margin: { l: 0, r: 0, t: 0, b: 0 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ['toImage'],
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        ) : null}

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            How to Interpret the 3D Surface
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              • <strong>X-Axis (Time):</strong> Shows the progression of dates from {startDate} to {endDate}
            </p>
            <p>
              • <strong>Y-Axis (Maturity):</strong> Represents different Treasury maturities from 3 months to 30 years
            </p>
            <p>
              • <strong>Z-Axis (Yield):</strong> The height represents the yield percentage at that date and maturity
            </p>
            <p>
              • <strong>Color:</strong> Warmer colors (yellow/green) indicate higher yields, cooler colors (purple/blue) indicate lower yields
            </p>
            <p className="mt-4">
              • <strong>Features to Observe:</strong> Yield curve inversions, parallel shifts, steepening/flattening, and regime changes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

