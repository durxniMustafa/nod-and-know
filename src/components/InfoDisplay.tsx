import React from 'react';
import { Card } from '@/components/ui/card';

interface InfoDisplayProps {
  info: string;
  timeRemainingInfo: number;
  infoDuration: number;
}

const InfoDisplay: React.FC<InfoDisplayProps> = ({
  info,
  infoDuration,
  timeRemainingInfo,
}) => {
  return (
    <div>
        <div
            className="mt-2 mb-8 w-full bg-gray-700 rounded-full h-1"
            style={{ marginTop: '-25px' }}>
            <div
                className="bg-yellow-400 h-1 rounded-full transition-all duration-1000"
                style={{ width: `${((infoDuration - timeRemainingInfo) / infoDuration) * 100}%` }}
            ></div>
        </div>
        
        <div className="mb-6">
            <p className="text-gray-200 text-2xl leading-relaxed text-center">
                {info}
            </p>
        </div>
    </div>
  );
};

export default InfoDisplay;