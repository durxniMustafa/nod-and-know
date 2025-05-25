
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';
import { dataService } from '@/services/dataService';

const SECURITY_QUESTIONS = [
  "Do you reuse the same password across multiple accounts?",
  "Have you enabled two-factor authentication on your main email?",
  "Do you use your fingerprint to unlock your phone?",
  "Would you click a link in an unexpected email from your bank?",
  "Do you regularly update your software when prompted?",
  "Would you connect to free public WiFi for online banking?",
  "Do you backup your important files regularly?",
  "Would you share your login credentials with a close friend?"
];

const Index = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fps, setFps] = useState(30);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [sessionStats, setSessionStats] = useState(dataService.getSessionStats());

  // Initialize session and load persisted data
  useEffect(() => {
    // Log session start
    dataService.logAnalyticsEvent('session_start');
    
    // Load current question from persistence
    const savedQuestion = dataService.getCurrentQuestion();
    setCurrentQuestion(savedQuestion);
    
    // Load votes for current question
    const savedVotes = dataService.getVotesForQuestion(savedQuestion);
    setVotes(savedVotes);
  }, []);

  // Rotate questions every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
      setCurrentQuestion(nextQuestion);
      
      // Persist current question
      dataService.setCurrentQuestion(nextQuestion);
      
      // Load votes for new question
      const questionVotes = dataService.getVotesForQuestion(nextQuestion);
      setVotes(questionVotes);
      
      // Update session stats
      setSessionStats(dataService.getSessionStats());
    }, 15000);

    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Monitor FPS for fallback mode
  useEffect(() => {
    if (fps < 15) {
      setFallbackMode(true);
    } else if (fps > 20) {
      // Only exit fallback mode if FPS is consistently good
      setFallbackMode(false);
    }
  }, [fps]);

  const handleGestureDetected = (gesture: 'yes' | 'no') => {
    // Add vote to persistence
    const newVotes = dataService.addVote(currentQuestion, gesture);
    setVotes(newVotes);
    
    // Log gesture detection
    dataService.logAnalyticsEvent('gesture_detected', { 
      questionId: currentQuestion, 
      gesture,
      fps 
    });
    
    // Update session stats
    setSessionStats(dataService.getSessionStats());
    
    // Trigger confetti for minority vote
    const total = newVotes.yes + newVotes.no;
    const minorityThreshold = 0.25;
    const yesPercentage = newVotes.yes / total;
    const noPercentage = newVotes.no / total;
    
    if (total > 3 && (yesPercentage < minorityThreshold || noPercentage < minorityThreshold)) {
      // Create confetti effect
      console.log('🎉 Minority opinion detected! Great discussion starter.');
      // In a real implementation, this could trigger a visual confetti animation
    }
  };

  const handleFaceData = (faces: any[], currentFps: number) => {
    setDetectedFaces(faces);
    setFps(currentFps);
  };

  const handleClearData = () => {
    if (confirm('Clear all session data? This will reset votes and statistics.')) {
      dataService.clearSessionData();
      setVotes({ yes: 0, no: 0 });
      setCurrentQuestion(0);
      setSessionStats(dataService.getSessionStats());
    }
  };

  const handleExportData = () => {
    const data = dataService.exportAnonymizedData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securematch_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            SecureMatch
          </h1>
          <p className="text-xl text-gray-300 mb-2">Production Gesture-Driven Security Dialogue</p>
          <div className="flex justify-center gap-4 text-sm text-gray-400 flex-wrap">
            <Badge variant="outline" className="text-green-400 border-green-400">
              FPS: {Math.round(fps)}
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-400">
              Faces: {detectedFaces.length}
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-400">
              Votes: {sessionStats.totalVotes}
            </Badge>
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              Session: {Math.round(sessionStats.sessionDuration / 1000 / 60)}m
            </Badge>
            {fallbackMode && (
              <Badge variant="destructive">
                Fallback Mode
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webcam Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-black/50 border-gray-700 p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Interactive Feed
                </h2>
                <p className="text-gray-300 text-sm">
                  {fallbackMode ? 
                    "Scan QR code below to join the discussion" : 
                    "Nod for YES • Shake for NO"
                  }
                </p>
              </div>
              
              <WebcamFeed 
                onGestureDetected={handleGestureDetected}
                onFaceData={handleFaceData}
                fallbackMode={fallbackMode}
              />
              
              {/* Development Controls */}
              <div className="mt-4 flex gap-2 justify-center flex-wrap">
                <Button 
                  onClick={() => handleGestureDetected('yes')}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  Test YES
                </Button>
                <Button 
                  onClick={() => handleGestureDetected('no')}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                >
                  Test NO
                </Button>
                <Button 
                  onClick={() => setFallbackMode(!fallbackMode)}
                  variant="outline"
                  size="sm"
                >
                  Toggle Fallback
                </Button>
                <Button 
                  onClick={handleClearData}
                  variant="outline"
                  size="sm"
                  className="text-yellow-400 border-yellow-400"
                >
                  Clear Data
                </Button>
                <Button 
                  onClick={handleExportData}
                  variant="outline"
                  size="sm"
                  className="text-blue-400 border-blue-400"
                >
                  Export Data
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Current Question */}
            <QuestionDisplay 
              question={SECURITY_QUESTIONS[currentQuestion]}
              questionIndex={currentQuestion + 1}
              totalQuestions={SECURITY_QUESTIONS.length}
            />

            {/* Vote Chart */}
            <VoteChart votes={votes} />

            {/* Discussion Button */}
            <Card className="bg-black/50 border-gray-700 p-6 text-center">
              <Button 
                onClick={() => setIsDiscussionOpen(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                size="lg"
              >
                💬 Join Discussion
              </Button>
              <p className="text-gray-400 text-sm mt-2">
                Anonymous chat • No registration required
              </p>
            </Card>

            {/* Session Statistics */}
            <Card className="bg-black/50 border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Session Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Questions Answered:</span>
                  <span className="text-white">{sessionStats.questionsAnswered}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gestures Detected:</span>
                  <span className="text-white">{sessionStats.gestureCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chat Opened:</span>
                  <span className="text-white">{sessionStats.chatOpened ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Chat Interface Modal */}
        {isDiscussionOpen && (
          <ChatInterface 
            question={SECURITY_QUESTIONS[currentQuestion]}
            onClose={() => setIsDiscussionOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
