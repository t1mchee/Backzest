import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface LivePriceCardProps {
  symbol: string;
  description: string;
  price: number;
  open: number;
  volume: number;
  timestamp: string;
}

export default function LivePriceCard({ 
  symbol, 
  description, 
  price, 
  open,
  volume, 
  timestamp 
}: LivePriceCardProps) {
  const change = price - open;
  const changePercent = open !== 0 ? (change / open) * 100 : 0;
  const isPositive = change >= 0;

  // Format timestamp
  const lastUpdate = new Date(timestamp).toLocaleTimeString();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{description}</h3>
          <p className="text-xs text-gray-400 mt-1">{symbol}</p>
        </div>
        <Activity className="w-5 h-5 text-blue-500" />
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900">
          ${price.toFixed(4)}
        </div>
        <div className="flex items-center mt-2 space-x-2">
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{change.toFixed(4)} ({changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-xs text-gray-500">Open</p>
          <p className="text-sm font-semibold text-gray-900">${open.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Volume</p>
          <p className="text-sm font-semibold text-gray-900">{volume.toLocaleString()}</p>
        </div>
      </div>

      {/* Last Update */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Last update: {lastUpdate}
        </p>
      </div>
    </div>
  );
}

