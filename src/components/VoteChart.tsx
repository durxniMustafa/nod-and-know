
import React from 'react';
import { Card } from '@/components/ui/card';

interface VoteChartProps {
  votes: {
    yes: number;
    no: number;
  };
}

const VoteChart: React.FC<VoteChartProps> = ({ votes }) => {
  const total = votes.yes + votes.no;
  const yesPercentage = total > 0 ? (votes.yes / total) * 100 : 50;
  const noPercentage = total > 0 ? (votes.no / total) * 100 : 50;

  return (
    <Card className="bg-black/50 border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Live Results</h3>
      
      <div className="space-y-4">
        {/* YES Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400 font-medium">YES</span>
            <span className="text-green-400 text-sm">{votes.yes} votes</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${yesPercentage}%` }}
            ></div>
          </div>
          <div className="text-right text-green-400 text-sm mt-1">
            {yesPercentage.toFixed(1)}%
          </div>
        </div>

        {/* NO Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-red-400 font-medium">NO</span>
            <span className="text-red-400 text-sm">{votes.no} votes</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-red-500 to-red-400 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${noPercentage}%` }}
            ></div>
          </div>
          <div className="text-right text-red-400 text-sm mt-1">
            {noPercentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 text-center">
          <div className="text-gray-400 text-sm">
            Total Responses: <span className="text-white font-semibold">{total}</span>
          </div>
        </div>
      )}

      {/* Minority Alert */}
      {total > 3 && (Math.min(yesPercentage, noPercentage) < 30) && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
          <div className="text-yellow-400 text-sm text-center">
            🎉 Minority opinion detected! Great discussion starter.
          </div>
        </div>
      )}
    </Card>
  );
};

export default VoteChart;
