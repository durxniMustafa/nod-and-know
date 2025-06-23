import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Users, Shield, Zap, MessageCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';

// Mock services since we can't import external ones
const mockWebsocketService = {
  connect: (callbacks: any) => {
    setTimeout(() => callbacks.onConnectionStatusChange(true), 1000);
  },
  disconnect: () => {},
  joinRoom: (roomId: string) => {},
  leaveRoom: () => {},
  sendMessage: (message: string) => {},
  getCurrentUserId: () => 'user_123'
};

const mockDataService = {
  logAnalyticsEvent: (type: string, data: any) => {}
};

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
}

interface ChatInterfaceProps {
  question: string;
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ question, onClose }) => {

  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get('topic');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>(['CyberGuard', 'SecPro', 'TechSafe']);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionPulse, setConnectionPulse] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mock connection animation
    const timer = setTimeout(() => setIsConnected(true), 1500);
    
    // Initialize with enhanced messages
    const topicMessage: ChatMessage = {
      id: 'topic',
      text: `🎯 Discussion Topic: "${question}"`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch AI'
    };

    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: '🛡️ Welcome to the secure discussion! Share your experiences anonymously and learn from the community. Your privacy is protected with end-to-end encryption.',
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch AI'
    };

    // Add some sample messages for demo
    const sampleMessages: ChatMessage[] = [
      {
        id: 'sample1',
        text: 'I recently implemented 2FA for all my accounts. The setup was easier than expected and I feel much more secure now.',
        timestamp: new Date(Date.now() - 300000),
        userId: 'user_456',
        username: 'CyberGuard'
      },
      {
        id: 'sample2',
        text: 'Great point! I also use a password manager now. It generates unique passwords for every site automatically.',
        timestamp: new Date(Date.now() - 240000),
        userId: 'user_789',
        username: 'SecPro'
      }
    ];

    setMessages([topicMessage, welcomeMessage, ...sampleMessages]);

    // Connection pulse animation
    const pulseInterval = setInterval(() => {
      setConnectionPulse(prev => (prev + 1) % 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      clearInterval(pulseInterval);
    };
  }, [question]);

  // Auto-scroll with smooth animation
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() && isConnected) {
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        text: newMessage.trim(),
        timestamp: new Date(),
        userId: 'user_123',
        username: 'You'
      };
      
      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');
      
      // Simulate typing indicator
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        // Add a mock response
        const responses = [
          "That's a great security practice! 👍",
          "I had a similar experience. Thanks for sharing!",
          "Interesting perspective. Security is definitely evolving.",
          "Good point! I'll try that approach too."
        ];
        const response: ChatMessage = {
          id: `resp_${Date.now()}`,
          text: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
          userId: 'user_' + Math.random(),
          username: ['TechSafe', 'InfoSecPro', 'DigitalGuard'][Math.floor(Math.random() * 3)]
        };
        setMessages(prev => [...prev, response]);
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentUserId = 'user_123';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/90 via-purple-900/20 to-blue-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl h-[85vh] bg-gradient-to-br from-gray-900/95 to-black/95 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 flex flex-col relative overflow-hidden backdrop-blur-lg">
        
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        {/* Header */}
        <div className="relative flex justify-between items-center p-6 border-b border-cyan-500/20 bg-gradient-to-r from-gray-900/50 to-transparent backdrop-blur-sm">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <Shield className="w-6 h-6 text-cyan-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Security Discussion
              </h2>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isConnected 
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-500/50' 
                      : 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse'
                  }`}></div>
                  {isConnected && (
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-300">
                  {isConnected ? 'Secure Connection' : 'Establishing Connection...'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-300 font-medium">
                  {onlineUsers.length + 1} Active Users
                </span>
                <div className="flex -space-x-1">
                  {onlineUsers.slice(0, 3).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full border border-gray-800 animate-pulse"
                      style={{ animationDelay: `${i * 200}ms` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={onClose} 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 hover:text-white hover:bg-red-500/20 transition-all duration-200 group"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 relative" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.userId === currentUserId;
              const isSystemMessage = message.userId === 'system';
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${
                      isSystemMessage 
                        ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                        : isOwnMessage
                        ? 'bg-gradient-to-r from-blue-600/90 to-cyan-600/90 text-white shadow-lg shadow-blue-500/20 border border-blue-400/30'
                        : 'bg-gradient-to-r from-gray-700/90 to-gray-600/90 text-gray-100 shadow-lg shadow-gray-500/10 border border-gray-500/20'
                    }`}
                  >
                    {!isSystemMessage && !isOwnMessage && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
                        <span className="text-xs font-semibold text-cyan-300">
                          {message.username}
                        </span>
                      </div>
                    )}
                    
                    {isSystemMessage && (
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-300">
                          {message.username}
                        </span>
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                      {!isSystemMessage && (
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 bg-current rounded-full opacity-50"></div>
                          <div className="w-1 h-1 bg-current rounded-full opacity-30"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-gradient-to-r from-gray-700/90 to-gray-600/90 text-gray-100 p-4 rounded-2xl backdrop-blur-sm border border-gray-500/20">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-gray-400">Someone is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-6 border-t border-cyan-500/20 bg-gradient-to-r from-gray-900/50 to-transparent backdrop-blur-sm relative">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isConnected ? "Share your security insights..." : "Connecting to secure channel..."}
                disabled={!isConnected}
                className="bg-gradient-to-r from-gray-800/90 to-gray-700/90 border-cyan-500/30 text-white placeholder-gray-400 pr-12 py-6 text-lg rounded-xl backdrop-blur-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                maxLength={500}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-cyan-400/50" />
              </div>
            </div>
            
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 px-6 py-6 rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:scale-105 group"
            >
              <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                End-to-end encrypted • Anonymous discussion
              </p>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Live</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`text-xs transition-colors duration-200 ${
                newMessage.length > 400 ? 'text-red-400' : 
                newMessage.length > 300 ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {newMessage.length}/500
              </div>
              <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    newMessage.length > 400 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    newMessage.length > 300 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${(newMessage.length / 500) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;