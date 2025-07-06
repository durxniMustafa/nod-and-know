import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, FileText, Users, Settings, LogOut, Send, Smile, Menu, X } from 'lucide-react';
import { websocketService, ChatMessage } from '@/services/websocketService';
import { dataService } from '@/services/dataService';

interface ChatInterfaceProps {
  question: string;
  onClose: () => void;
  roomId?: string;
  isMobileQRMode?: boolean;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    setMessages([topicMessage, welcomeMessage]);

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

  const toggleUserList = () => {
    setShowUserList(!showUserList);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex z-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-gray-800 border-r border-gray-700 flex flex-col transition-transform duration-300 ease-in-out z-50
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative md:z-auto
        fixed md:static
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="bg-purple-600 text-white px-4 py-2 rounded-lg text-center font-semibold flex-1">
            SecureMatch
          </div>
          
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={closeSidebar}
            className="md:hidden ml-2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>
          
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span>Resources</span>
          </button>
          
          <button 
            onClick={() => {
              toggleUserList();
              closeSidebar();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Users className="w-5 h-5" />
            <span>About</span>
          </button>
          
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Leave Button */}
        <div className="p-4 border-t border-gray-700">
          <button 
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
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
                  placeholder="Enter your message"
                  disabled={!isConnected}
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
                disabled={!newMessage.trim() || !isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 p-2 md:p-3 rounded-lg"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
            
            <div className="text-xs text-gray-500 mt-2 text-right">
              {newMessage.length}/500
            </div>
          </div>
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
    </div>
  );
};

export default ChatInterface;