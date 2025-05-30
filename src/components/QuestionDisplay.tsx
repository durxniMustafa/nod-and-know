import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Zap, TrendingUp, Eye } from 'lucide-react';

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
  const [timeLeft, setTimeLeft] = useState(15);
  const [isActive, setIsActive] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulated viewer count with realistic fluctuation
    const viewerTimer = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.floor(Math.random() * 6) - 2; // -2 to +3
        const newCount = Math.max(47, Math.min(156, prev + change));
        return newCount;
      });
    }, 3000);

    // Initial viewer count
    setViewerCount(73 + Math.floor(Math.random() * 20));

    // Pulse animation
    const pulseTimer = setInterval(() => {
      setPulseIntensity(prev => (prev + 1) % 100);
    }, 50);

    return () => {
      clearInterval(timer);
      clearInterval(viewerTimer);
      clearInterval(pulseTimer);
    };
  }, [questionIndex]);

  // Reset timer when question changes
  useEffect(() => {
    setTimeLeft(15);
    setIsActive(true);
  }, [questionIndex]);

  const progressPercentage = (questionIndex / totalQuestions) * 100;
  const timePercentage = (timeLeft / 15) * 100;
  const urgencyLevel = timeLeft <= 5 ? 'high' : timeLeft <= 10 ? 'medium' : 'low';

  return (
    <Card className="relative bg-gradient-to-br from-gray-900/95 to-black/90 border border-cyan-500/30 p-8 overflow-hidden backdrop-blur-lg shadow-2xl shadow-cyan-500/10">
      
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5"></div>
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl animate-pulse delay-1000"></div>

      {/* Header Section */}
      <div className="relative flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <div className="absolute inset-0 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Current Question
          </h3>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge 
            variant="outline" 
            className="text-cyan-400 border-cyan-400/50 bg-cyan-400/10 backdrop-blur-sm px-4 py-2 text-lg font-semibold"
          >
            {questionIndex} / {totalQuestions}
          </Badge>
          
          <div className="flex items-center gap-2 text-gray-300">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">{viewerCount}</span>
          </div>
        </div>
      </div>

      {/* Question Text */}
      <div className="relative mb-8">
        <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
        <p className="text-gray-100 text-xl leading-relaxed font-medium pl-8 relative">
          {question}
          <div className="absolute -bottom-2 left-8 w-12 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent"></div>
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border border-gray-600/30">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <div>
            <div className="text-green-400 font-bold text-lg">+{Math.floor(Math.random() * 20 + 15)}</div>
            <div className="text-xs text-gray-400">Responses</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border border-gray-600/30">
          <Users className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-blue-400 font-bold text-lg">{viewerCount}</div>
            <div className="text-xs text-gray-400">Active Now</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border border-gray-600/30">
          <Zap className="w-5 h-5 text-yellow-400" />
          <div>
            <div className="text-yellow-400 font-bold text-lg">{Math.floor(Math.random() * 5 + 3)}.{Math.floor(Math.random() * 10)}</div>
            <div className="text-xs text-gray-400">Avg Score</div>
          </div>
        </div>
      </div>

      {/* Timer Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 transition-colors duration-300 ${
            urgencyLevel === 'high' ? 'text-red-400' :
            urgencyLevel === 'medium' ? 'text-yellow-400' : 'text-cyan-400'
          }`} />
          <span className={`text-sm font-medium transition-colors duration-300 ${
            urgencyLevel === 'high' ? 'text-red-400' :
            urgencyLevel === 'medium' ? 'text-yellow-400' : 'text-gray-400'
          }`}>
            Next question in {timeLeft}s
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-300 ${
            isActive ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'
          }`}></div>
          <span className={`text-sm font-medium ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
            {isActive ? 'Live' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Timer Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              urgencyLevel === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600' :
              urgencyLevel === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
              'bg-gradient-to-r from-cyan-500 to-blue-500'
            }`}
            style={{ 
              width: `${timePercentage}%`,
              boxShadow: urgencyLevel === 'high' ? '0 0 10px rgba(239, 68, 68, 0.5)' : 
                        urgencyLevel === 'medium' ? '0 0 10px rgba(245, 158, 11, 0.5)' :
                        '0 0 10px rgba(6, 182, 212, 0.5)'
            }}
          ></div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400 font-medium">Session Progress</span>
          <span className="text-sm text-cyan-400 font-bold">{Math.round(progressPercentage)}%</span>
        </div>
        
        <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden backdrop-blur-sm relative">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${progressPercentage}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse"></div>
          </div>
          
          {/* Progress markers */}
          {[25, 50, 75].map(marker => (
            <div
              key={marker}
              className="absolute top-0 w-0.5 h-full bg-gray-600/80"
              style={{ left: `${marker}%` }}
            ></div>
          ))}
        </div>
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>Start</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>Complete</span>
        </div>
      </div>

      {/* Floating particles effect */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-bounce opacity-60"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 2) * 40}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${2 + i * 0.5}s`
          }}
        ></div>
      ))}
    </Card>
  );
};

export default QuestionDisplay;