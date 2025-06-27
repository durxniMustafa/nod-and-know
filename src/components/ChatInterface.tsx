
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, QrCode } from 'lucide-react';
import { websocketService, ChatMessage } from '@/services/websocketService';
import { dataService } from '@/services/dataService';
import QRCode from 'qrcode.js';

interface ChatInterfaceProps {
  question: string;
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ question, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showQR, setShowQR] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const roomId = useMemo(() => `question_${btoa(question).slice(0, 8)}`, [question]);

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
      text: 'Welcome! Share your security experiences and learn from others. All conversations are anonymous.',
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    setMessages([topicMessage, welcomeMessage]);

    // Connect to WebSocket
    websocketService.connect({
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
      },
      onUserJoined: (username) => {
        setOnlineUsers(prev => [...prev, username]);
      },
      onUserLeft: (username) => {
        setOnlineUsers(prev => prev.filter(u => u !== username));
      },
      onConnectionStatusChange: (connected) => {
        setIsConnected(connected);
      }
    });

    // Join room based on question
    websocketService.joinRoom(roomId);

    return () => {
      websocketService.leaveRoom();
      websocketService.disconnect();
    };
  }, [question]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() && isConnected) {
      websocketService.sendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (showQR && qrRef.current) {
      qrRef.current.innerHTML = '';
      // @ts-ignore
      new QRCode(qrRef.current, {
        text: `${window.location.origin}?room=${encodeURIComponent(roomId)}`,
        width: 160,
        height: 160
      });
    }
  }, [showQR, roomId]);

  const currentUserId = websocketService.getCurrentUserId();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[80vh] bg-gray-900 border-gray-700 flex flex-col relative">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">Security Discussion</h2>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm text-gray-400">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
              {onlineUsers.length > 0 && (
                <div className="text-sm text-gray-400">
                  {onlineUsers.length + 1} participant{onlineUsers.length !== 0 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowQR(true)} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <QrCode className="w-5 h-5" />
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.userId === currentUserId;
              const isSystemMessage = message.userId === 'system';
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      isSystemMessage 
                        ? 'bg-purple-900/30 text-purple-200 border border-purple-700'
                        : isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    {!isSystemMessage && !isOwnMessage && (
                      <div className="text-xs text-gray-400 mb-1">
                        {message.username}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Share your thoughts..." : "Connecting..."}
              disabled={!isConnected}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              maxLength={500}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-400">
              💡 Tip: Share experiences to help others learn about security practices
            </p>
            <div className="text-xs text-gray-500">
              {newMessage.length}/500
            </div>
          </div>
        </div>
      </Card>
      {showQR && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
          <div ref={qrRef} className="bg-white p-2 rounded" />
          <Button onClick={() => setShowQR(false)} variant="ghost" className="mt-4 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
