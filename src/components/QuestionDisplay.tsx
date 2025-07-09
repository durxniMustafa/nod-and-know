import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuestionDisplayProps {
  question: string;
  timeRemaining: number;
  questionDuration: number;
  aiAnswer?: string;
  phase: 'question' | 'results';
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  timeRemaining,
  questionDuration,
  aiAnswer,
  phase
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
      </div>

      <div className="flex justify-center items-center text-xs text-gray-400"
        style={{ marginTop: '-50px' }}
      >
      </div>
      {phase === 'question' && (
        <div className="mt-2 mb-8 w-full bg-gray-700 rounded-full h-1">
          <div
            className="bg-yellow-400 h-1 rounded-full transition-all duration-1000"
            style={{ width: `${((questionDuration - timeRemaining) / questionDuration) * 100}%` }}
          ></div>
        </div>
      )}

      <div className="mb-0 mt-20">
        <p className="text-gray-200 text-4xl leading-relaxed text-center">
          {question}
        </p>
      </div>

      {aiAnswer && (
        <div className="mb-6 text-sm text-purple-200 text-center whitespace-pre-wrap">
          {aiAnswer}
        </div>
      )}

    </div>
  );
};

export default QuestionDisplay;