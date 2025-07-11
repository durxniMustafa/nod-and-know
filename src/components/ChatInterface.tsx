import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Users, LogOut, Send, Smile, X,  Shield, CheckCircle, XCircle, AlertCircle, Loader2} from 'lucide-react';
import { websocketService, ChatMessage } from '@/services/websocketService';
import { dataService } from '@/services/dataService';

interface ChatInterfaceProps {
  question: string;
  onClose: () => void;
  roomId?: string;
  isMobileQRMode?: boolean;
}

interface FactCheckResult {
  success: boolean;
  status: 'verified' | 'partial' | 'unverified';
  confidence: number;
  is_supported: boolean;
  formatted_response: string;
  claim_results: any[];
  sources: any[];
  error?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  question,
  onClose,
  roomId: overrideRoomId,
  isMobileQRMode = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [showFactCheckPopup, setShowFactCheckPopup] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const roomId = useMemo(
    () => overrideRoomId ?? `question_${btoa(question).slice(0, 8)}`,
    [question, overrideRoomId]
  );

  // Generate a friendly user ID and name
  const currentUserId = useMemo(() => {
    return websocketService.getCurrentUserId();
  }, []);

  const currentUserName = useMemo(() => {
    // Get the consistent username from the websocket service
    const username = websocketService.getCurrentUsername();
    return username;
  }, []);

  useEffect(() => {
    // Log chat opened event
    dataService.logAnalyticsEvent('chat_opened', { question });

    // Initialize chat with topic message
    const topicMessage: ChatMessage = {
      id: 'topic',
      text: `Discussion topic: "${question}"`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: isMobileQRMode
        ? `Welcome to the mobile discussion, ${currentUserName}! Share your security experiences and learn from others. All conversations are anonymous.`
        : `Welcome, ${currentUserName}! Share your security experiences and learn from others. All conversations are anonymous.`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    const aiHintMessage: ChatMessage = {
      id: 'ai_hint',
      text: 'Hint: start a message with @ai to ask our AI assistant.',
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    setMessages([topicMessage, welcomeMessage, aiHintMessage]);

    // Connect to WebSocket
    websocketService.connect({
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
      },
      onUserJoined: (username) => {
        setOnlineUsers(prev => [...prev, username]);
        // Add a system message when someone joins
        const joinMessage: ChatMessage = {
          id: `join_${Date.now()}`,
          text: `${username} joined the discussion`,
          timestamp: new Date(),
          userId: 'system',
          username: 'SecureMatch'
        };
        setMessages(prev => [...prev, joinMessage]);
      },
      onUserLeft: (username) => {
        setOnlineUsers(prev => prev.filter(u => u !== username));
        // Add a system message when someone leaves
        const leaveMessage: ChatMessage = {
          id: `leave_${Date.now()}`,
          text: `${username} left the discussion`,
          timestamp: new Date(),
          userId: 'system',
          username: 'SecureMatch'
        };
        setMessages(prev => [...prev, leaveMessage]);
      },
      onConnectionStatusChange: (connected) => {
        setIsConnected(connected);
      }
    });

    // Join room based on question
    websocketService.joinRoom(roomId, question);

    // Fetch AI answer and add as message
    fetch(`/ai-answer?q=${encodeURIComponent(question)}`)
      .then(res => res.json())
      .then(data => {
        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          text: data.answer,
          timestamp: new Date(),
          userId: 'deepseek',
          username: 'AI Assistant'
        };
        setMessages(prev => [...prev, aiMsg]);
      })
      .catch(err => console.error('Failed to fetch AI answer', err));

    return () => {
      websocketService.leaveRoom();
      websocketService.disconnect();
    };
  }, [question, overrideRoomId, isMobileQRMode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const performFactCheck = async (message: string): Promise<FactCheckResult> => {
    try {
      const response = await fetch('http://localhost:5000/api/factcheck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Factcheck error:', error);
      return {
        success: false,
        status: 'unverified',
        confidence: 0,
        is_supported: false,
        formatted_response: `Fehler beim Fact-Check: ${error.message}`,
        claim_results: [],
        sources: [],
        error: error.message
      };
    }
  };


  const handleSendMessage = async() => {
    if (newMessage.trim() && isConnected) {
      const messageText = newMessage.trim();
      websocketService.sendMessage(messageText);
      setNewMessage('');

      // Perform fact-check
      setFactCheckLoading(true);
      try {
        const result = await performFactCheck(messageText);
        setFactCheckResult(result);
        setShowFactCheckPopup(true);
      } catch (error) {
        console.error('Fact-check failed:', error);
      } finally {
        setFactCheckLoading(false);
      }
    }

  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleUserList = () => {
    setShowUserList(!showUserList);
  };
  const getFactCheckIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'unverified':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-500" />;
    }
  };

  const getFactCheckColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'border-green-500 bg-green-50';
      case 'partial':
        return 'border-yellow-500 bg-yellow-50';
      case 'unverified':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      
      {/* Chat Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-purple-600 text-white px-4 py-2 rounded-lg text-center font-semibold">
            SecureMatch
          </div>
          
          <div className="flex-1 text-center">
            <h2 className="text-xl font-semibold text-white mb-1">Discussion Question:</h2>
            <p className="text-lg text-gray-300 break-words">{question}</p>
          </div>
        </div>
        
        {/* Connection status and user count */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-gray-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="text-gray-400">
            {onlineUsers.length + 1} participant{onlineUsers.length !== 0 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-3 md:p-6" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => {
            const isOwnMessage = message.userId === currentUserId;
            const isSystemMessage = message.userId === 'system';
            
            if (isSystemMessage) {
              return (
                <div key={message.id} className="text-center">
                  <div className="inline-block px-4 py-2 bg-purple-900/30 text-purple-200 border border-purple-700 rounded-lg text-sm">
                    {message.text}
                  </div>
                </div>
              );
            }
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] md:max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                  {!isOwnMessage && (
                    <div className="text-xs text-gray-400 mb-1 px-4">
                      {message.username}
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    {message.followUp && message.followUp.length > 0 && (
                      <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                        {message.followUp.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    )}
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="bg-gray-800 border-t border-gray-700 p-3 md:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 md:gap-3 items-end">
            <div className="flex-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your message (use @ai for help)"
                disabled={isConnected || factCheckLoading}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm md:text-base"
                maxLength={500}
              />
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white p-2 md:p-3 hidden sm:flex"
            >
              <Smile className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected || !factCheckLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 p-2 md:p-3 rounded-lg"
            >
              {factCheckLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
          
          <div className="text-xs text-gray-500 mt-2 text-right">
            {newMessage.length}/500
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="bg-gray-800 border-t border-gray-700 p-3 md:p-4">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 md:gap-3 justify-center">
          <Button 
            variant="ghost"
            className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <FileText className="w-4 h-4" />
            <span>Resources</span>
          </Button>
          
          <Button 
            onClick={toggleUserList}
            variant="ghost"
            className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Users className="w-4 h-4" />
            <span>About</span>
          </Button>
          
          <Button 
            onClick={onClose}
            variant="ghost"
            className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 hover:text-red-400"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
          </Button>
        </div>
      </div>

      {/* User List Overlay */}
      {showUserList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={toggleUserList}>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Online Participants ({onlineUsers.length + 1})
            </h4>
            <div className="space-y-3">
              {/* Current user */}
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-400 font-medium">{currentUserName} (You)</span>
              </div>
              {/* Other users */}
              {onlineUsers.map((username, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">{username}</span>
                </div>
              ))}
            </div>
            <Button 
              onClick={toggleUserList}
              variant="outline" 
              className="mt-4 w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {/* Fact Check Popup */}
      {showFactCheckPopup && factCheckResult && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
          <Card className={`w-full max-w-md max-h-[80vh] ${getFactCheckColor(factCheckResult.status)} border-2 overflow-hidden`}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getFactCheckIcon(factCheckResult.status)}
                  <h3 className="font-semibold text-gray-800">Fact Check Result</h3>
                </div>
                <Button 
                  onClick={() => setShowFactCheckPopup(false)} 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-2">
                <div className="text-sm text-gray-600">
                  Confidence: {(factCheckResult.confidence * 100).toFixed(1)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full ${
                      factCheckResult.status === 'verified' ? 'bg-green-500' :
                      factCheckResult.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${factCheckResult.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="prose prose-sm max-w-none">
                <div 
                  className="text-gray-800 whitespace-pre-wrap text-sm"
                  dangerouslySetInnerHTML={{ 
                    __html: factCheckResult.formatted_response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                  }}
                />
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <Button 
                onClick={() => setShowFactCheckPopup(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;