import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';
import CooldownDisplay from '@/components/CooldownDisplay';
import { dataService } from '@/services/dataService';
import HelpDialog from '@/components/HelpDialog';
import ThemeToggle from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';

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

const RECOMMENDED_ANSWERS: ('yes' | 'no')[] = [
  'no',
  'yes',
  'yes',
  'no',
  'yes',
  'no',
  'yes',
  'no'
];

const QUESTION_DURATION_MS = 45000;
const COOLDOWN_DURATION_MS = 20000;

// Function to get local IP address
const getLocalIPAddress = async (): Promise<string> => {
  try {
    // Method 1: Try to get local IP using WebRTC
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    
    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
          if (ipMatch && ipMatch[1] !== '127.0.0.1') {
            pc.close();
            resolve(ipMatch[1]);
            return;
          }
        }
      };
      
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // If no IP is obtained within 5 seconds, use fallback
      setTimeout(() => {
        pc.close();
        resolve(window.location.hostname || 'localhost');
      }, 5000);
    });
  } catch (error) {
    console.warn('Unable to get local IP address, using fallback:', error);
    return window.location.hostname || 'localhost';
  }
};

const Index = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [fps, setFps] = useState(30);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_DURATION_MS / 1000);
  const [cooldownRemaining, setCooldownRemaining] = useState(COOLDOWN_DURATION_MS / 1000);
  const [isCooldown, setIsCooldown] = useState(false);
  const [sessionStats, setSessionStats] = useState(dataService.getSessionStats());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [qrTopic, setQrTopic] = useState<string | null>(null);

  const [nodThreshold, setNodThreshold] = useState(0.04);
  const [shakeThreshold, setShakeThreshold] = useState(0.06);

  const [localIP, setLocalIP] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>('');

  
  // Track which face IDs have voted for which questions (persisted across question changes)
  const faceVotesRef = useRef<Record<number, Set<number>>>({});

  // Generate QR code URL
  const generateQRCode = useCallback(async () => {
    try {
      const ip = await getLocalIPAddress();
      setLocalIP(ip);
      
      const roomId = `question_${btoa(SECURITY_QUESTIONS[currentQuestion]).slice(0, 8)}`;
      const chatUrl = `http://${ip}:8080?room=${encodeURIComponent(roomId)}&topic=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion])}`;
      
      // Use online QR code generation service
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(chatUrl)}`;
      setQrCodeUrl(qrUrl);
      
      console.log('Generated chat URL:', chatUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast('Failed to generate QR code, please check network connection');
    }
  }, [currentQuestion]);

  // On mount, load session data
  useEffect(() => {
    dataService.logAnalyticsEvent('session_start');
    const savedQuestion = dataService.getCurrentQuestion();
    setCurrentQuestion(savedQuestion);

    const savedVotes = dataService.getVotesForQuestion(savedQuestion);
    setVotes(savedVotes);

    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) {
      setQrRoomId(r);
      const topic = params.get('topic');
      setQrTopic(topic);
      setIsDiscussionOpen(true);
      setFallbackMode(true);
      // Don't generate QR code when accessed via QR code (mobile mode)
      return;
    }

    // Generate initial QR code only for desktop/main interface
    generateQRCode();
  }, [generateQRCode]);

  // Regenerate QR code when question changes (only if not in QR mode)
  useEffect(() => {
    if (!qrRoomId) {
      generateQRCode();
    }
  }, [currentQuestion, generateQRCode, qrRoomId]);

  // Fetch AI answer when question changes
  useEffect(() => {
    setAiAnswer('');
    fetch(`/ai-answer?q=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion])}`)
      .then(res => res.json())
      .then(data => setAiAnswer(data.answer))
      .catch(err => console.error('Failed to fetch AI answer', err));
  }, [currentQuestion]);

  // Question/Cooldown cycle
  useEffect(() => {
    if (isCooldown) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, QUESTION_DURATION_MS - elapsed);
      setTimeRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setIsCooldown(true);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [currentQuestion, isCooldown]);

  // Cooldown timer
  useEffect(() => {
    if (!isCooldown) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, COOLDOWN_DURATION_MS - elapsed);
      setCooldownRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
        setCurrentQuestion(nextQuestion);
        dataService.setCurrentQuestion(nextQuestion);
        const questionVotes = dataService.getVotesForQuestion(nextQuestion);
        setVotes(questionVotes);
        setSessionStats(dataService.getSessionStats());
        setIsCooldown(false);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isCooldown, currentQuestion]);

  // Memoized Callback: handleGestureDetected
  const handleGestureDetected = useCallback((gesture: 'yes' | 'no', faceId: number) => {
    if (isCooldown) return;
    console.log(`Gesture detected: Face ${faceId} voted ${gesture} for question ${currentQuestion + 1}`);
    
    // Initialize vote tracking for this question if not exists
    if (!faceVotesRef.current[currentQuestion]) {
      faceVotesRef.current[currentQuestion] = new Set();
    }
    
    // Check if this face has already voted for this question
    if (faceVotesRef.current[currentQuestion].has(faceId)) {
      console.log(`Face ${faceId} has already voted for question ${currentQuestion + 1}, ignoring duplicate vote`);
      return;
    }
    
    // Record that this face has voted for this question
    faceVotesRef.current[currentQuestion].add(faceId);
    console.log(`Recorded vote for Face ${faceId} on question ${currentQuestion + 1}. Total faces voted: ${faceVotesRef.current[currentQuestion].size}`);

    // Add vote to persistence
    const newVotes = dataService.addVote(currentQuestion, gesture);
    setVotes(newVotes);

    // Log analytics
    dataService.logAnalyticsEvent('gesture_detected', {
      questionId: currentQuestion,
      gesture,
      faceId,
      fps,
    });

    // Update session stats
    setSessionStats(dataService.getSessionStats());

    // Minority confetti logic
    const total = newVotes.yes + newVotes.no;
    if (total > 3) {
      const yesPct = newVotes.yes / total;
      const noPct = newVotes.no / total;
      if (yesPct < 0.25 || noPct < 0.25) {
        console.log('🎉 Minority opinion detected! Great discussion starter.');
        toast('Minority viewpoint detected! 🎉 This creates interesting discussions.');
      }
    }
    
    console.log(`Vote recorded: ${gesture.toUpperCase()} | Current totals - Yes: ${newVotes.yes}, No: ${newVotes.no}`);
  }, [currentQuestion, fps]);

  // Memoized Callback: handleFaceData
  const handleFaceData = useCallback((faces: any[], currentFps: number) => {
    setDetectedFaces(faces);
    setFps(currentFps);
  }, []);

  const handleConflictPair = useCallback(() => {
    console.log('Conflict pair detected');
    toast('It\'s a cyber match!');
  }, []);

  // Clear / Export data
  const handleClearData = () => {
    if (confirm('Clear all session data? This will reset votes and statistics.')) {
      dataService.clearSessionData();
      setVotes({ yes: 0, no: 0 });
      setCurrentQuestion(0);
      setSessionStats(dataService.getSessionStats());
      // Clear face vote tracking
      faceVotesRef.current = {};
      console.log('Session data cleared');
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
    console.log('Data exported');
  };

  // Development helpers
  const handleTestVote = (gesture: 'yes' | 'no') => {
    // Use a negative face ID for test votes to distinguish from real faces
    const testFaceId = Math.floor(Math.random() * -1000);
    console.log(`Test vote: ${gesture} (Face ID: ${testFaceId})`);
    handleGestureDetected(gesture, testFaceId);
  };

  // Copy chat link to clipboard
  const copyToClipboard = async () => {
    if (localIP) {
      const roomId = `question_${btoa(SECURITY_QUESTIONS[currentQuestion]).slice(0, 8)}`;
      const chatUrl = `http://${localIP}:8080?room=${encodeURIComponent(roomId)}&topic=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion])}`;
      
      try {
        await navigator.clipboard.writeText(chatUrl);
        toast('Chat link copied to clipboard!');
      } catch (error) {
        console.error('Copy failed:', error);
        toast('Copy failed, please copy link manually');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* If accessed via QR code (mobile), show ONLY the chat interface */}
      {qrRoomId ? (
        <ChatInterface
          question={qrTopic ?? SECURITY_QUESTIONS[currentQuestion]}
          onClose={() => {
            // For QR code access, "closing" means going to a thank you page
            // instead of showing the full website
            window.location.href = '/';
          }}
          isMobileQRMode={true}
        />
      ) : (
        // Normal desktop interface
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              SecureMatch
            </h1>
            <p className="text-xl text-gray-300 mb-2">
              Production Gesture-Driven Security Dialogue
            </p>
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
              <Badge variant="outline" className="text-orange-400 border-orange-400">
                Q{currentQuestion + 1} Voters: {faceVotesRef.current[currentQuestion]?.size || 0}
              </Badge>
              {fallbackMode && (
                <Badge variant="destructive">
                  Fallback Mode
                </Badge>
              )}
            </div>
            <div className="mt-4 flex gap-2 justify-center items-center">
              <Button variant="outline" size="sm" onClick={() => setIsHelpOpen(true)}>
                Help
              </Button>
              <Link to="/stats">
                <Button variant="outline" size="sm">Stats</Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>

          {/* Question/Cooldown Display */}
          {isCooldown ? (
            <CooldownDisplay
              recommended={RECOMMENDED_ANSWERS[currentQuestion]}
              remaining={cooldownRemaining}
            />
          ) : (
            <QuestionDisplay
              question={SECURITY_QUESTIONS[currentQuestion]}
              questionIndex={currentQuestion + 1}
              totalQuestions={SECURITY_QUESTIONS.length}
              timeRemaining={timeRemaining}
              questionDuration={QUESTION_DURATION_MS / 1000}
              aiAnswer={aiAnswer}
            />
          )}

          {/* Threshold Slider Controls */}
          <div className="flex gap-8 mb-6">
            <div>
              <label className="block text-sm text-white mb-1">
                Nicken Threshold: {nodThreshold}
              </label>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.005"
                value={nodThreshold}
                onChange={e => setNodThreshold(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm text-white mb-1">
                Kopfschütteln Threshold: {shakeThreshold}
              </label>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.005"
                value={shakeThreshold}
                onChange={e => setShakeThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Webcam + Controls */}
            <div className="lg:col-span-2">
              <Card className="bg-black/50 border-gray-700 p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    Interactive Feed
                  </h2>
                  <p className="text-gray-300 text-sm">
                    {fallbackMode
                      ? "Welcome to the discussion!"
                      : "Nod for YES • Shake for NO"
                    }
                  </p>
                </div>

                <WebcamFeed
                  onGestureDetected={handleGestureDetected}
                  onFaceData={handleFaceData}
                  onConflictPair={handleConflictPair}
                  fallbackMode={fallbackMode}
                  debugMode={debugMode}
                  questionId={currentQuestion}
                  nodThreshold={nodThreshold}
                  shakeThreshold={shakeThreshold}
                />

                {/* Dev Controls */}
                <div className="mt-4 flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={() => handleTestVote('yes')}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Test YES
                  </Button>
                  <Button
                    onClick={() => handleTestVote('no')}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    Test NO
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

            {/* Right: Results + QR Code + Discussion */}
            <div className="space-y-6">
              <VoteChart votes={votes} />

              {/* QR Code Card */}
              <Card className="bg-black/50 border-gray-700 p-6 text-center">
                <h3 className="text-lg font-semibold text-white mb-4">📱 Join Discussion on Mobile</h3>
                
                {qrCodeUrl ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <img 
                        src={qrCodeUrl} 
                        alt="Scan to join chat" 
                        className="bg-white p-2 rounded-lg shadow-lg"
                        style={{ maxWidth: '200px', height: 'auto' }}
                      />
                    </div>
                    
                    <div className="text-sm text-gray-400">
                      <p>Scan QR code with your phone</p>
                      <p>Opens chat-only mobile experience</p>
                    </div>
                    
                    {localIP && (
                      <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">Or visit manually:</p>
                        <p className="text-xs text-green-400 font-mono break-all">
                          http://{localIP}:8080
                        </p>
                        <Button
                          onClick={copyToClipboard}
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                        >
                          Copy Link
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="text-gray-400">Generating QR code...</p>
                  </div>
                )}
                
                <p className="text-gray-400 text-xs mt-4">
                  Anonymous chat • No registration required
                </p>
              </Card>

              {/* Session Stats */}
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
                    <span className="text-white">
                      {sessionStats.chatOpened ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Q Faces:</span>
                    <span className="text-white">
                      {faceVotesRef.current[currentQuestion]?.size || 0}
                    </span>
                  </div>
                  {localIP && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Local IP:</span>
                      <span className="text-white text-xs">{localIP}</span>
                    </div>
                  )}
                </div>
                
                {debugMode && (
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Debug Info</h4>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Detected Faces: {detectedFaces.map((f: any) => f.id).join(', ') || 'None'}</div>
                      <div>Face Vote History:</div>
                      {Object.entries(faceVotesRef.current).map(([qId, faceIds]) => (
                        <div key={qId} className="ml-2">
                          Q{parseInt(qId) + 1}: [{Array.from(faceIds as Set<number>).join(', ')}]
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Chat Interface Modal - Only for desktop */}
          {isDiscussionOpen && (
            <ChatInterface
              question={SECURITY_QUESTIONS[currentQuestion]}
              onClose={() => setIsDiscussionOpen(false)}
              isMobileQRMode={false}
            />
          )}
          
          <HelpDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} />
        </div>
      )}
    </div>
  );
};

export default Index;