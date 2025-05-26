import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuestionDisplayProps {
  question: string;
  questionIndex: number;
  totalQuestions: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  questionIndex,
  totalQuestions
}) => {
  return (
    <Card className="bg-black/50 border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Current Question</h3>
        <Badge variant="outline" className="text-blue-400 border-blue-400">
          {questionIndex} / {totalQuestions}
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-gray-300 text-lg leading-relaxed">{question}</p>
      </div>

      {/* Example label: "Next question in 15s" */}
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>Next question in 15s</span>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 w-full bg-gray-700 rounded-full h-1">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1 rounded-full transition-all duration-300"
          style={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
        ></div>
      </div>
    </Card>
  );
};

export default QuestionDisplay;
