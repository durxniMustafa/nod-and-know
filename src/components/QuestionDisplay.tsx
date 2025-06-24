import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuestionDisplayProps {
  question: string;
  answer: string;
  questionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  questionDuration: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  answer,
  questionIndex,
  totalQuestions,
  timeRemaining,
  questionDuration,
}) => {
  return (
    <Card className="bg-black/60 border-gray-700 p-8 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white text-center flex-1">
          Current Question
        </h3>
        <Badge
          variant="outline"
          className="text-blue-400 border-blue-400 ml-4 shrink-0"
        >
          {questionIndex} / {totalQuestions}
        </Badge>
      </div>

      <div className="mb-6">
        <p className="text-gray-200 text-xl leading-relaxed text-center">
          {question}
        </p>
        <p className="text-sm text-gray-400 mt-2 text-center">Recommended answer: {answer}</p>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>Next question in {timeRemaining}s</span>
        <div className="flex gap-2 items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>
      <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
        <div
          className="bg-gradient-to-r from-green-500 to-blue-500 h-1 rounded-full transition-all duration-1000"
          style={{ width: `${((questionDuration - timeRemaining) / questionDuration) * 100}%` }}
        ></div>
      </div>

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
