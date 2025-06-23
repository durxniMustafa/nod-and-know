import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { dataService } from '@/services/dataService';
import { QrCode, MessageCircle, Monitor, Smartphone } from 'lucide-react';

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
  const [debugMode, setDebugMode] = useState(false);
  const [fps, setFps] = useState(30);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [sessionStats, setSessionStats] = useState(dataService.getSessionStats());
  
  // QR code related state
  const [showQRCode, setShowQRCode] = useState(false);
  const [mobileUsers, setMobileUsers] = useState<string[]>([]);
  const [ngrokUrl, setNgrokUrl] = useState('https://your-ngrok-url.ngrok.io'); // Get from environment variables or config
  const [joinMethod, setJoinMethod] = useState<'desktop' | 'mobile' | 'both'>('both');

  // Generate room ID for current question
  const getCurrentRoomId = () => {
    return `question_${currentQuestion}_${btoa(SECURITY_QUESTIONS[currentQuestion]).slice(0, 10)}`;
  };

  // On mount, load session data
  useEffect(() => {
    dataService.logAnalyticsEvent('session_start');
    const savedQuestion = dataService.getCurrentQuestion();
    setCurrentQuestion(savedQuestion);

    const savedVotes = dataService.getVotesForQuestion(savedQuestion);
    setVotes(savedVotes);

    // Check if accessing from mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      setJoinMethod('mobile');
    }

    // Check ngrok URL from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const ngrokFromUrl = urlParams.get('ngrok');
    if (ngrokFromUrl) {
      setNgrokUrl(ngrokFromUrl);
    }
  }, []);

  // Rotate questions every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
      setCurrentQuestion(nextQuestion);
      dataService.setCurrentQuestion(nextQuestion);

      const questionVotes = dataService.getVotesForQuestion(nextQuestion);
      setVotes(questionVotes);

      setSessionStats(dataService.getSessionStats());
    }, 15000);

    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Handle gesture detection
  const handleGestureDetected = useCallback((gesture: 'yes' | 'no') => {
    const newVotes = dataService.addVote(currentQuestion, gesture);
    setVotes(newVotes);

    dataService.logAnalyticsEvent('gesture_detected', {
      questionId: currentQuestion,
      gesture,
      fps,
    });

    setSessionStats(dataService.getSessionStats());

    const total = newVotes.yes + newVotes.no;
    if (total > 3) {
      const yesPct = newVotes.yes / total;
      const noPct = newVotes.no / total;
      if (yesPct < 0.25 || noPct < 0.25) {
        console.log('🎉 Minority opinion detected! Great discussion starter.');
      }
    }
  }, [currentQuestion, fps]);

  // Handle face data
  const handleFaceData = useCallback((faces: any[], currentFps: number) => {
    setDetectedFaces(faces);
    setFps(currentFps);
  }, []);

  const handleConflictPair = useCallback(() => {
    if (!isDiscussionOpen) {
      setIsDiscussionOpen(true);
    }
  }, [isDiscussionOpen]);

  // Handle mobile user joining
  const handleMobileUserJoined = useCallback((userId: string) => {
    setMobileUsers(prev => {
      if (!prev.includes(userId)) {
        dataService.logAnalyticsEvent('mobile_user_joined', { userId });
        return [...prev, userId];
      }
      return prev;
    });
  }, []);

  // Unified method to open chat
  const openDiscussion = (source: 'desktop' | 'qr' | 'mobile' = 'desktop') => {
    setIsDiscussionOpen(true);
    dataService.logAnalyticsEvent('chat_opened', { source });
  };

  // Data management
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
          <p className="text-xl text-gray-300 mb-2">
            Multi-Platform Security Dialogue System
          </p>
          <div className="flex justify-center gap-4 text-sm text-gray-400 flex-wrap">
            <Badge variant="outline" className="text-green-400 border-green-400">
              FPS: {Math.round(fps)}
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-400">
              Faces Detected: {detectedFaces.length}
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-400">
              Votes: {sessionStats.totalVotes}
            </Badge>
            <Badge variant="outline" className="text-cyan-400 border-cyan-400">
              Mobile Users: {mobileUsers.length}
            </Badge>
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              Session Duration: {Math.round(sessionStats.sessionDuration / 1000 / 60)} mins
            </Badge>
            {fallbackMode && (
              <Badge variant="destructive">
                Fallback Mode
              </Badge>
            )}
          </div>

          {/* Join method selector */}
          <div className="flex justify-center gap-2 mt-4">
            <Button
              onClick={() => setJoinMethod('desktop')}
              variant={joinMethod === 'desktop' ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Desktop Mode
            </Button>
            <Button
              onClick={() => setJoinMethod('mobile')}
              variant={joinMethod === 'mobile' ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Mobile Mode
            </Button>
            <Button
              onClick={() => setJoinMethod('both')}
              variant={joinMethod === 'both' ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Hybrid Mode
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Camera + Controls (shown in desktop/hybrid mode) */}
          {(joinMethod === 'desktop' || joinMethod === 'both') && (
            <div className="lg:col-span-2">
              <Card className="bg-black/50 border-gray-700 p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    Interactive Feedback
                  </h2>
                  <p className="text-gray-300 text-sm">
                    {fallbackMode
                      ? "Scan the QR code below to join the discussion"
                      : "Nod to agree • Shake head to disagree"
                    }
                  </p>
                </div>

                <WebcamFeed
                  onGestureDetected={handleGestureDetected}
                  onFaceData={handleFaceData}
                  onConflictPair={handleConflictPair}
                  fallbackMode={fallbackMode}
                  debugMode={debugMode}
                />

                {/* Development control panel */}
                <div className="mt-4 flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={() => handleGestureDetected('yes')}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Test Agree
                  </Button>
                  <Button
                    onClick={() => handleGestureDetected('no')}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    Test Disagree
                  </Button>
                  <Button
                    onClick={() => setFallbackMode(f => !f)}
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
                  <Button
                    onClick={() => setDebugMode(d => !d)}
                    variant="outline"
                    size="sm"
                    className="text-purple-400 border-purple-400"
                  >
                    {debugMode ? 'Hide Debug' : 'Show Debug'}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Right: Question + Voting + QR Code + Discussion */}
          <div className={`space-y-6 ${joinMethod === 'mobile' ? 'lg:col-span-3' : ''}`}>
            <QuestionDisplay
              question={SECURITY_QUESTIONS[currentQuestion]}
              questionIndex={currentQuestion + 1}
              totalQuestions={SECURITY_QUESTIONS.length}
            />
            
            <VoteChart votes={votes} />

            {/* QR Code component (shown in mobile/hybrid mode) */}
            {(joinMethod === 'mobile' || joinMethod === 'both') && (
              <QRCodeGenerator
                currentQuestion={SECURITY_QUESTIONS[currentQuestion]}
                roomId={getCurrentRoomId()}
                ngrokUrl={ngrokUrl}
                onMobileUserJoined={handleMobileUserJoined}
              />
            )}

            {/* Discussion button */}
            <Card className="bg-black/50 border-gray-700 p-6 text-center">
              <div className="space-y-3">
                <Button
                  onClick={() => openDiscussion('desktop')}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                  size="lg"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Join Discussion
                </Button>
                
                {joinMethod === 'both' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowQRCode(!showQRCode)}
                      variant="outline"
                      className="flex-1 text-cyan-400 border-cyan-400"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
                    </Button>
                  </div>
                )}
              </div>
              
              <p className="text-gray-400 text-sm mt-2">
                Anonymous chat • No registration required
              </p>
              
              {mobileUsers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="text-sm text-cyan-300">
                    {mobileUsers.length} mobile devices connected
                  </p>
                </div>
              )}
            </Card>

            {/* Session statistics */}
            <Card className="bg-black/50 border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Session Statistics</h3>
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
                  <span className="text-gray-400">Mobile Joins:</span>
                  <span className="text-white">{mobileUsers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chat Opened:</span>
                  <span className="text-white">
                    {sessionStats.chatOpened ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Chat interface modal */}
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