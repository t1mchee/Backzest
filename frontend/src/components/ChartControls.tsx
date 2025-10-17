import { ToggleLeft, ToggleRight } from 'lucide-react';

interface ChartControlsProps {
  autoscale: boolean;
  onToggleAutoscale: () => void;
  label?: string;
}

const ChartControls = ({ autoscale, onToggleAutoscale, label = 'Y-Axis Auto-scale' }: ChartControlsProps) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">{label}:</span>
      <button
        onClick={onToggleAutoscale}
        className={`flex items-center space-x-2 px-3 py-1 rounded-lg transition ${
          autoscale
            ? 'bg-green-100 text-green-700 border border-green-300'
            : 'bg-gray-100 text-gray-600 border border-gray-300'
        }`}
      >
        {autoscale ? (
          <>
            <ToggleRight className="w-4 h-4" />
            <span className="text-xs font-medium">ON</span>
          </>
        ) : (
          <>
            <ToggleLeft className="w-4 h-4" />
            <span className="text-xs font-medium">OFF</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ChartControls;

