import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';
import InfoDisplay from '@/components/InfoDisplay';
import { dataService } from '@/services/dataService';
import HelpDialog from '@/components/HelpDialog';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';

export interface SecurityQuestionSet {
  recommended: 'yes' | 'no';
  question: string;
  followUps: string[];
}

const SECURITY_INFOS = [
  "36% of Americans use a password manager.",
  "81% of data breaches are caused by weak or reused passwords.",
  "Only 10% of people use two-factor authentication on all accounts.",
  "Public WiFi can expose your data to attackers—use a VPN for safety.",
  "Regularly updating software helps protect against security vulnerabilities.",
  "Back up your important files to avoid data loss from ransomware.",
  "Never share your login credentials, even with close friends.",
  "Think before you click: phishing emails can look very convincing."
];

const SECURITY_QUESTIONS: SecurityQuestionSet[] = [
  {
    recommended: 'no',
    question: "Do you reuse the same password across multiple accounts?",
    followUps: [
      "What reasons do you have for not using a password more than once?",
      "How do you deal with the challenge of having to remember many passwords?",
      "Do you use a password manager or another system to manage them?",
      "Have you (or someone you know) ever had problems because of password reuse?"
    ]
  },
  {
    recommended: 'yes',
    question: "Have you enabled two-factor authentication on your main email?",
    followUps: [
      "What is 2FA?",
      "Why is 2FA more secure?",
      "What has stopped you (or motivated you) to enable 2FA?",
      "Would you recommend 2FA to someone who is not very tech-savvy?"
    ]
  },
  {
    recommended: 'yes',
    question: "Do you use your fingerprint to unlock your phone?",
    followUps: [
      "Do you feel safer or less safe with biometric unlocking – why?",
      "Are there situations where you prefer a password over your fingerprint?",
      "Do you have concerns about entrusting your biometric data to a device?",
      "Do you think convenience plays a bigger role than security when choosing an unlocking method?"
    ]
  },
  {
    recommended: 'no',
    question: "Would you click a link in an unexpected email from your bank?",
    followUps: [
      "How would you check if such an email is genuine?",
      "Has this ever happened to you or someone you know?",
      "How do you generally handle suspicious emails?",
      ""
    ]
  },
  {
    recommended: 'yes',
    question: "Do you regularly update your software when prompted?",
    followUps: [
      "What are the advantages or disadvantages of automatic updates for you?",
      "Have you ever had problems after a software update?",
      "How important do you think updates are in terms of security?",
      "How do I update my devices?"
    ]
  },
  {
    recommended: 'no',
    question: "Would you connect to free public WiFi for online banking?",
    followUps: [
      "What risks do you see in online banking over public WiFi?",
      "Are there alternatives you use instead (e.g., mobile data)?",
      "What would have to happen for you to feel safe using public WiFi?",
      "Do you know of examples where public WiFi has caused problems?"
    ]
  },
  {
    recommended: 'yes',
    question: "Do you backup your important files regularly?",
    followUps: [
      "How do you back up your files – locally, in the cloud, or both?",
      "Have you ever lost data? What did you learn from it?",
      "What prevents you (or motivates you) to make regular backups?",
      "Which files are especially important to you – and why?"
    ]
  },
  {
    recommended: 'no',
    question: "Would you share your login credentials with a close friend?",
    followUps: [
      "In what situations might you do this – or never do it?",
      "What would be your biggest concern about giving someone your login details?",
      "How do you handle shared accounts, e.g., for streaming services?",
      "Do you think trust justifies such an action – or not?"
    ]
  }
];

const RECOMMENDED_ANSWERS: ('yes' | 'no')[] = SECURITY_QUESTIONS.map(q => q.recommended);

//Timers
const Info_DURATION_MS = 10000; //10000;
const QUESTION_DURATION_MS = 45000; //45000;
const RESULTS_DURATION_MS = 90000; //90000;
const FOLLOW_UP_INTERVAL_MS = 15000; //15000;

const PHASES = {
  INFO: "info",
  QUESTION: "question",
  RESULTS: "results",
} as const;
type Phase = typeof PHASES[keyof typeof PHASES];

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
  const [currentInfo, setCurrentInfo] = useState(0);
  const [currentFollowUpIndex, setCurrentFollowUpIndex] = useState(0);
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [fps, setFps] = useState(30);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_DURATION_MS / 1000);
  const [timeRemainingInfo, setTimeRemainingInfo] = useState(Info_DURATION_MS / 1000);
  const [isCooldown, setIsCooldown] = useState(false);
  const [sessionStats, setSessionStats] = useState(dataService.getSessionStats());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [qrTopic, setQrTopic] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(PHASES.INFO);

  const [nodThreshold, setNodThreshold] = useState(0.05);
  const [shakeThreshold, setShakeThreshold] = useState(0.04);

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
      
      const roomId = `question_${btoa(SECURITY_QUESTIONS[currentQuestion].question).slice(0, 8)}`;
      const chatUrl = `http://${ip}:8080?room=${encodeURIComponent(roomId)}&topic=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion].question)}`;
      
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
  //
  //
  //
  //Hier hatte ich etwas gelöscht
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
      return;
    }

    generateQRCode();
    // ACHTUNG: Dependency-Array leer lassen!
  }, []);

  // Regenerate QR code when question changes (only if not in QR mode)
  useEffect(() => {
    if (!qrRoomId) {
      generateQRCode();
    }
  }, [currentQuestion, generateQRCode, qrRoomId]);

  // Fetch AI answer when question changes
  useEffect(() => {
    setAiAnswer('');
    fetch(`/ai-answer?q=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion].question)}`)
      .then(res => res.json())
      .then(data => setAiAnswer(data.answer))
      .catch(err => console.error('Failed to fetch AI answer', err));
  }, [currentQuestion]);

  useEffect(() => {
    if (phase === PHASES.QUESTION) {
      setTimeRemaining(QUESTION_DURATION_MS / 1000);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, QUESTION_DURATION_MS - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => clearInterval(t);
    }
  }, [phase, currentQuestion]);

  // Follow-up Fragen Rotation
  useEffect(() => {
    setCurrentFollowUpIndex(0); // Reset bei Fragewechsel
    const followUps = SECURITY_QUESTIONS[currentQuestion].followUps;
    if (!followUps.length) return;
    const interval = setInterval(() => {
      setCurrentFollowUpIndex(prev =>
        (prev + 1) % followUps.length
      );
    }, FOLLOW_UP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentQuestion]);

    // Timer logic for phase transitions
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (phase === PHASES.INFO) {
      timeout = setTimeout(() => setPhase(PHASES.QUESTION), Info_DURATION_MS);
    } else if (phase === PHASES.QUESTION) {
      timeout = setTimeout(() => setPhase(PHASES.RESULTS), QUESTION_DURATION_MS);
    } else if (phase === PHASES.RESULTS) {
      timeout = setTimeout(() => {
        // Next info, next question
        const nextInfo = (currentInfo + 1) % SECURITY_INFOS.length;
        setCurrentInfo(nextInfo);
        const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
        setCurrentQuestion(nextQuestion);
        setPhase(PHASES.INFO);
      }, RESULTS_DURATION_MS);
    }
    return () => clearTimeout(timeout);
  }, [phase, currentInfo, currentQuestion]);

  // Countdown timer for current info display
  useEffect(() => {
    if (phase === PHASES.INFO) {
      setTimeRemainingInfo(Info_DURATION_MS / 1000);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, Info_DURATION_MS - elapsed);
        setTimeRemainingInfo(Math.ceil(remaining / 1000));
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => clearInterval(t);
    }
  }, [phase, currentInfo]);

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
      setCurrentInfo(0);
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
      const roomId = `question_${btoa(SECURITY_QUESTIONS[currentQuestion].question).slice(0, 8)}`;
      const chatUrl = `http://${localIP}:8080?room=${encodeURIComponent(roomId)}&topic=${encodeURIComponent(SECURITY_QUESTIONS[currentQuestion].question)}`;

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
    <div className="min-h-screen bg-[#80319F] p-4">
      {/* If accessed via QR code (mobile), show ONLY the chat interface */}
      {qrRoomId ? (
        <ChatInterface
          question={qrTopic ?? SECURITY_QUESTIONS[currentQuestion].question}
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
            <Card className="bg-black/50 px-4 py-2 inline-block border-0 shadow-none" style={{ marginTop: '-25px' }}>
              <h1 className="text-gray-200 text-4xl leading-relaxed text-center">
                SecureMatch
              </h1>
            </Card>
          </div>

          {/* Info Phase */}
          {phase === PHASES.INFO && (
            <Card className="bg-black/50 border-0 p-6 mb-8">
              <InfoDisplay
                info={SECURITY_INFOS[currentInfo]}
                timeRemainingInfo={timeRemainingInfo}
                infoDuration={Info_DURATION_MS / 1000}
              />
            </Card>
          )}

          {/*Question/Cooldown Display
          {isCooldown ? (
            <CooldownDisplay
              recommended={RECOMMENDED_ANSWERS[currentQuestion]}
              remaining={cooldownRemaining}
            />
          ) */}


          {/* Question/Results Display */}
          {(phase === PHASES.QUESTION || phase === PHASES.RESULTS) && (
            <Card
              className="bg-black/50 border-0 p-6 mb-8 h-screen flex flex-col justify-start"
              style={{ minHeight: '60vh', maxHeight: '85vh' }}
            >
              {/* QuestionDisplay nur in Question-Phase */}
              {/* {phase === PHASES.QUESTION && ( */}
                <QuestionDisplay
                  question={SECURITY_QUESTIONS[currentQuestion].question}
                  timeRemaining={timeRemaining}
                  questionDuration={QUESTION_DURATION_MS / 1000}
                  aiAnswer={aiAnswer}
                  phase={phase}
                />
              {/* )} */}

              {/* DiscussionCard nur in Results-Phase */}
              {phase === PHASES.RESULTS && (
                <div className="mt-6 mb-8 gap-6 items-center">
                  <div className="mb-6">
                    <p className="text-gray-200 text-4xl leading-relaxed text-center">
                      {/* Talk to the person with the same number! */}
                      <br />
                      
                      {SECURITY_QUESTIONS[currentQuestion].followUps.length > 0 && (
                        <div className="mt-4 text-lg text-center">
                          <h3 className="text-gray-200 text-2xl text-center">
                            The recommended answer is{' '}
                            <span className={RECOMMENDED_ANSWERS[currentQuestion] === 'yes' ? 'text-green-400' : 'text-red-400'}>
                              {RECOMMENDED_ANSWERS[currentQuestion]}
                            </span>
                            . Find the person with the same number and start a conversation! Ask them:
                          </h3>
                          <div className="text-yellow-300 text-2xl mt-5">
                            {SECURITY_QUESTIONS[currentQuestion].followUps[currentFollowUpIndex]}
                          </div>
                        </div>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* WebcamFeed bleibt immer gemountet, Sichtbarkeit über Phase */}
              <div className="block mt-4">
                <WebcamFeed
                  onGestureDetected={handleGestureDetected}
                  onFaceData={handleFaceData}
                  debugMode={debugMode}
                  questionId={currentQuestion}
                  fallbackMode={fallbackMode}
                  nodThreshold={nodThreshold}
                  shakeThreshold={shakeThreshold}
                  phase={phase}
                />
              </div>

              {/* QR Code Card*/}
              {phase === PHASES.RESULTS && (
                <div className="mt-6 mb-8 flex flex-col lg:flex-row items-center justify-center gap-8">
                  {/* Text */}
                  <div className="flex-1">
                    <h3 className="text-gray-200 text-2xl leading-relaxed text-center lg:text-left">
                      Or anonymously stay in touch over the Chat by scanning the code!
                    </h3>
                  </div>
                  {/* QR Code */}
                  <div className="flex-1 flex justify-center">
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
                        {/* {localIP && (
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
                        )} */}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-gray-400">Generating QR code...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Debug Mode */}
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

            </div>
          )}

          {/* Chat Interface Modal - Only for desktop */}
          {isDiscussionOpen && (
            <ChatInterface
              question={SECURITY_QUESTIONS[currentQuestion].question}
              onClose={() => setIsDiscussionOpen(false)}
              isMobileQRMode={false}
            />
          )}
          
        </div>
      )}
    </div>
  );
};

export default Index;