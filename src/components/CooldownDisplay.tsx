import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CooldownDisplayProps {
  recommended: 'yes' | 'no';
  remaining: number;
}

const CooldownDisplay: React.FC<CooldownDisplayProps> = ({ recommended, remaining }) => {
  return (
    <Card className="bg-black/60 border-gray-700 p-8 text-center shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">Hold on...</h3>
      <p className="text-gray-200 text-lg mb-4">
        Recommended answer: <span className={recommended === 'yes' ? 'text-green-400' : 'text-red-400'}>{recommended.toUpperCase()}</span>
      </p>
      <p className="text-gray-400 text-sm">Next question in {remaining}s</p>
      <div className="mt-4 w-full bg-gray-700 rounded-full h-1">
        <div
          className="bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full transition-all duration-1000"
          style={{ width: `${((20 - remaining) / 20) * 100}%` }}
        ></div>
      </div>
      <div className="mt-4">
        <Badge variant="outline" className="text-yellow-400 border-yellow-400">
          Cooldown
        </Badge>
      </div>
    </Card>
  );
};

export default CooldownDisplay;
