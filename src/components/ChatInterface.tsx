
import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

interface ChatInterfaceProps {
  question: string;
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ question, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Discussion topic: "${question}"`,
      timestamp: new Date(),
      isOwn: false
    },
    {
      id: '2', 
      text: 'Welcome to the security discussion! Share your thoughts and experiences.',
      timestamp: new Date(),
      isOwn: false
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Simulate WebSocket connection
  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 1000);

    // Simulate incoming messages
    const messageTimer = setTimeout(() => {
      addMessage("I always use different passwords for important accounts!", false);
    }, 5000);

    const messageTimer2 = setTimeout(() => {
      addMessage("Two-factor auth saved me once when someone tried to hack my email.", false);
    }, 12000);

    return () => {
      clearTimeout(connectTimer);
      clearTimeout(messageTimer);
      clearTimeout(messageTimer2);
    };
  }, []);

  const addMessage = (text: string, isOwn: boolean) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      isOwn
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && isConnected) {
      addMessage(newMessage, true);
      setNewMessage('');
      
      // Simulate response delay
      setTimeout(() => {
        const responses = [
          "That's a great point!",
          "I hadn't thought of that before.",
          "Same here, security is so important.",
          "Thanks for sharing your experience!",
          "Good reminder for everyone."
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        addMessage(randomResponse, false);
      }, 2000 + Math.random() * 3000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[80vh] bg-gray-900 border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Security Discussion</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-sm text-gray-400">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.isOwn
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <p>{message.text}</p>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
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
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            💡 Tip: Share your personal experiences to help others learn about security best practices.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;
