import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Users, 
  Shield, 
  Smartphone, 
  ArrowLeft,
  MessageCircle,
  Wifi,
  Signal,
  Battery
} from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  deviceType?: 'desktop' | 'mobile';
}

interface MobileChatPageProps {
  roomId?: string;
  question?: string;
  onBack?: () => void;
}

const MobileChatPage: React.FC<MobileChatPageProps> = ({ 
  roomId = 'demo-room',
  question = "Do you reuse the same password across multiple accounts?",
  onBack 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>(['CyberGuard💻', 'SecPro📱', 'TechSafe💻']);
  const [isTyping, setIsTyping] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [signalStrength, setSignalStrength] = useState(4);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate connection process
    const timer = setTimeout(() => setIsConnected(true), 1000);
    
    // Initialize messages
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: `🛡️ Welcome to join the security discussion via mobile device! Current topic: ${question}`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch AI',
    };

    const sampleMessages: ChatMessage[] = [
      {
        id: 'sample1',
        text: 'I recently implemented 2FA for all my accounts. The setup was easier than expected and I feel much more secure now.',
        timestamp: new Date(Date.now() - 300000),
        userId: 'user_456',
        username: 'CyberGuard💻',
        deviceType: 'desktop'
      },
      {
        id: 'sample2',
        text: 'Good point! I now use a password manager too. It automatically generates unique passwords for each website. 📱',
        timestamp: new Date(Date.now() - 240000),
        userId: 'user_789',
        username: 'SecPro📱',
        deviceType: 'mobile'
      },
      {
        id: 'sample3',
        text: 'Mobile security is indeed another challenge. App permission management is more important than most people think.',
        timestamp: new Date(Date.now() - 180000),
        userId: 'user_101',
        username: 'MobileExpert📱',
        deviceType: 'mobile'
      }
    ];

    setMessages([welcomeMessage, ...sampleMessages]);

    // Simulate battery and signal status
    const statusInterval = setInterval(() => {
      setBatteryLevel(prev => Math.max(20, prev - Math.random() * 2));
      setSignalStrength(prev => Math.max(1, Math.min(4, prev + (Math.random() - 0.5))));
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(statusInterval);
    };
  }, [question]);

  // Auto scroll
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
        userId: 'mobile_user_123',
        username: 'You📱',
        deviceType: 'mobile'
      };
      
      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');
      
      // Simulate typing indicator
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const responses = [
          "Great mobile practice! 👍",
          "I have similar experience on mobile. Thanks for sharing!",
          "Interesting point. Mobile security is indeed constantly evolving.",
          "Good point! I'll try this approach too. 📱"
        ];
        const response: ChatMessage = {
          id: `resp_${Date.now()}`,
          text: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
          userId: 'user_' + Math.random(),
          username: ['TechSafe💻', 'InfoSecPro📱', 'DigitalGuard💻'][Math.floor(Math.random() * 3)],
          deviceType: Math.random() > 0.5 ? 'mobile' : 'desktop'
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

  const getDeviceIcon = (deviceType?: string) => {
    return deviceType === 'mobile' ? '📱' : '💻';
  };

  const getBatteryColor = () => {
    if (batteryLevel > 50) return 'text-green-400';
    if (batteryLevel > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSignalBars = () => {
    return Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className={`w-1 bg-current rounded-sm ${
          i < signalStrength ? 'opacity-100' : 'opacity-30'
        }`}
        style={{ height: `${(i + 1) * 3 + 2}px` }}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Mobile status bar */}
      <div className="bg-black/80 text-white px-4 py-2 flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4 text-cyan-400" />
          <div className="flex items-end gap-px text-cyan-400">
            {getSignalBars()}
          </div>
          <span className="text-xs text-gray-300">SecureMatch</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs">21:34</span>
          <div className="flex items-center gap-1">
            <Battery className={`w-4 h-4 ${getBatteryColor()}`} />
            <span className={`text-xs ${getBatteryColor()}`}>{Math.round(batteryLevel)}%</span>
          </div>
        </div>
      </div>

      {/* Chat header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-cyan-500/20">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-bold text-white">Security Discussion</h1>
              <Smartphone className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-gray-300">
              {isConnected ? 'Secure Connection' : 'Connecting...'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-300">{onlineUsers.length + 1} Online</span>
          </div>
        </div>
      </div>

      {/* Current topic card */}
      <div className="p-4">
        <Card className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-500/30 p-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
            <div>
              <div className="text-xs text-cyan-300 mb-1">Current Discussion Topic</div>
              <div className="text-sm text-white font-medium leading-relaxed">
                {question}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
        <div className="space-y-3 pb-4">
          {messages.map((message, index) => {
            const isOwnMessage = message.userId === 'mobile_user_123';
            const isSystemMessage = message.userId === 'system';
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl backdrop-blur-sm transition-all duration-300 ${
                    isSystemMessage 
                      ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-200 border border-cyan-500/30'
                      : isOwnMessage
                      ? 'bg-gradient-to-r from-blue-600/90 to-cyan-600/90 text-white border border-blue-400/30'
                      : 'bg-gradient-to-r from-gray-700/90 to-gray-600/90 text-gray-100 border border-gray-500/20'
                  }`}
                >
                  {!isSystemMessage && !isOwnMessage && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
                      <span className="text-xs font-semibold text-cyan-300">
                        {message.username}
                      </span>
                      <span className="text-xs opacity-50">
                        {getDeviceIcon(message.deviceType)}
                      </span>
                    </div>
                  )}
                  
                  {isSystemMessage && (
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-cyan-300">
                        {message.username}
                      </span>
                    </div>
                  )}
                  
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.text}</p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {isOwnMessage && (
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
              <div className="bg-gradient-to-r from-gray-700/90 to-gray-600/90 text-gray-100 p-3 rounded-2xl backdrop-blur-sm border border-gray-500/20">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-xs text-gray-400">Someone is typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-t border-cyan-500/20 backdrop-blur-sm">
        <div className="flex gap-2 mb-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Share your security insights..." : "Connecting to secure channel..."}
              disabled={!isConnected}
              className="bg-gradient-to-r from-gray-700/90 to-gray-600/90 border-cyan-500/30 text-white placeholder-gray-400 pr-10 py-3 text-base rounded-xl backdrop-blur-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
              maxLength={300}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Smartphone className="w-4 h-4 text-cyan-400/50" />
            </div>
          </div>
          
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 px-4 py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:scale-105"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-3">
            <p className="text-gray-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              End-to-end encrypted
            </p>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400">Live</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`transition-colors duration-200 ${
              newMessage.length > 250 ? 'text-red-400' : 
              newMessage.length > 200 ? 'text-yellow-400' : 'text-gray-500'
            }`}>
              {newMessage.length}/300
            </div>
            <div className="w-8 h-1 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  newMessage.length > 250 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                  newMessage.length > 200 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${(newMessage.length / 300) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Online users indicator */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 justify-center">
          <div className="flex -space-x-1">
            {onlineUsers.slice(0, 4).map((user, i) => (
              <div 
                key={i} 
                className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full border border-gray-800 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              ></div>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {onlineUsers.length + 1} people discussing security topics
          </span>
        </div>
      </div>

      {/* Mobile-specific quick actions */}
      <div className="bg-gray-800/50 p-2 border-t border-gray-700/50">
        <div className="flex justify-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-green-400 hover:bg-green-400/10"
            onClick={() => setNewMessage(prev => prev + " 👍")}
          >
            👍 Agree
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-400 hover:bg-red-400/10"
            onClick={() => setNewMessage(prev => prev + " 👎")}
          >
            👎 Disagree
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-400 hover:bg-blue-400/10"
            onClick={() => setNewMessage("Interesting point!")}
          >
            💭 Interesting
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-purple-400 hover:bg-purple-400/10"
            onClick={() => setNewMessage("I have similar experience")}
          >
            🤝 Same here
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileChatPage;