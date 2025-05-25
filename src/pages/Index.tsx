
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';

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

  // Rotate questions every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuestion((prev) => (prev + 1) % SECURITY_QUESTIONS.length);
      setVotes({ yes: 0, no: 0 }); // Reset votes for new question
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Monitor FPS for fallback mode
  useEffect(() => {
    if (fps < 15) {
      setFallbackMode(true);
    } else {
      setFallbackMode(false);
    }
  }, [fps]);

  const handleGestureDetected = (gesture: 'yes' | 'no') => {
    setVotes(prev => ({
      ...prev,
      [gesture]: prev[gesture] + 1
    }));
    
    // Trigger confetti for minority vote
    const total = votes.yes + votes.no + 1;
    const newCount = votes[gesture] + 1;
    if (total > 3 && newCount / total < 0.3) {
      // Minority opinion - trigger celebration
      console.log('Confetti burst for minority opinion!');
    }
  };

  const handleFaceData = (faces: any[], currentFps: number) => {
    setDetectedFaces(faces);
    setFps(currentFps);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            SecureMatch
          </h1>
          <p className="text-xl text-gray-300 mb-2">Gesture-Driven Security Dialogue</p>
          <div className="flex justify-center gap-4 text-sm text-gray-400">
            <Badge variant="outline" className="text-green-400 border-green-400">
              FPS: {Math.round(fps)}
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-400">
              Faces: {detectedFaces.length}
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
              
              {/* Manual Controls for Testing */}
              <div className="mt-4 flex gap-4 justify-center">
                <Button 
                  onClick={() => handleGestureDetected('yes')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Manual YES
                </Button>
                <Button 
                  onClick={() => handleGestureDetected('no')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Manual NO
                </Button>
                <Button 
                  onClick={() => setFallbackMode(!fallbackMode)}
                  variant="outline"
                >
                  Toggle Fallback
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
                Share your thoughts with others
              </p>
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
