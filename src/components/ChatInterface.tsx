import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Home, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Send, 
  Smile, 
  Menu, 
  X, 
  Bot, 
  Sparkles, 
  MessageCircle, 
  Shield,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Zap
} from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, { likes: number; dislikes: number }>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const roomId = useMemo(
    () => overrideRoomId ?? `question_${btoa(question).slice(0, 8)}`,
    [question, overrideRoomId]
  );

  const currentUserId = useMemo(() => {
    return websocketService.getCurrentUserId();
  }, []);

  const currentUserName = useMemo(() => {
    return websocketService.getCurrentUsername();
  }, []);

  // Enhanced AI response with streaming effect
  const fetchEnhancedAIResponse = async (userMessage: string) => {
    setAiTyping(true);
    try {
      const response = await fetch('/ai-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          context: question,
          previousMessages: messages.slice(-5) // Last 5 messages for context
        })
      });
      
      const data = await response.json();
      
      // Simulate streaming by adding message character by character
      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        text: '',
        timestamp: new Date(),
        userId: 'deepseek',
        username: 'DeepSeek AI',
        followUp: data.followUpQuestions || []
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Simulate typing effect
      const fullText = data.answer;
      let currentText = '';
      
      for (let i = 0; i < fullText.length; i++) {
        currentText += fullText[i];
        
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessage.id 
            ? { ...msg, text: currentText }
            : msg
        ));
        
        // Add small delay for typing effect
        if (i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      setAiTyping(false);
    } catch (error) {
      console.error('Failed to fetch AI response:', error);
      setAiTyping(false);
    }
  };

  useEffect(() => {
    dataService.logAnalyticsEvent('chat_opened', { question });

    // Enhanced welcome messages
    const topicMessage: ChatMessage = {
      id: 'topic',
      text: `🔐 Security Discussion: "${question}"`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: isMobileQRMode
        ? `👋 Welcome ${currentUserName}! You've joined a live security discussion. Share your experiences and learn from others. All conversations are anonymous and secure.`
        : `🎉 Welcome ${currentUserName}! This is your secure discussion space. Share your cybersecurity experiences, ask questions, and learn from the community. Remember, all conversations are anonymous.`,
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    const aiHintMessage: ChatMessage = {
      id: 'ai_hint',
      text: '💡 Pro tip: Type @ai followed by your question to get instant AI-powered security advice!',
      timestamp: new Date(),
      userId: 'system',
      username: 'SecureMatch'
    };

    setMessages([topicMessage, welcomeMessage, aiHintMessage]);

    // Connect to WebSocket
    websocketService.connect({
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
        
        // Check if message starts with @ai for AI response
        if (message.text.toLowerCase().startsWith('@ai') && message.userId !== currentUserId) {
          const aiQuery = message.text.substring(3).trim();
          if (aiQuery) {
            setTimeout(() => fetchEnhancedAIResponse(aiQuery), 1000);
          }
        }
      },
      onUserJoined: (username) => {
        setOnlineUsers(prev => [...prev, username]);
        const joinMessage: ChatMessage = {
          id: `join_${Date.now()}`,
          text: `🟢 ${username} joined the discussion`,
          timestamp: new Date(),
          userId: 'system',
          username: 'SecureMatch'
        };
        setMessages(prev => [...prev, joinMessage]);
      },
      onUserLeft: (username) => {
        setOnlineUsers(prev => prev.filter(u => u !== username));
        const leaveMessage: ChatMessage = {
          id: `leave_${Date.now()}`,
          text: `🔴 ${username} left the discussion`,
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

    websocketService.joinRoom(roomId, question);

    // Fetch initial AI context about the question
    fetchEnhancedAIResponse(`Please provide a brief introduction to the security topic: "${question}"`);

    return () => {
      websocketService.leaveRoom();
      websocketService.disconnect();
    };
  }, [question, overrideRoomId, isMobileQRMode, currentUserId, roomId]);

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
      const messageText = newMessage.trim();
      websocketService.sendMessage(messageText);
      setNewMessage('');
      
      // Check if it's an AI query
      if (messageText.toLowerCase().startsWith('@ai')) {
        const aiQuery = messageText.substring(3).trim();
        if (aiQuery) {
          setTimeout(() => fetchEnhancedAIResponse(aiQuery), 500);
        }
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleReaction = (messageId: string, type: 'like' | 'dislike') => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: {
        likes: type === 'like' ? (prev[messageId]?.likes || 0) + 1 : (prev[messageId]?.likes || 0),
        dislikes: type === 'dislike' ? (prev[messageId]?.dislikes || 0) + 1 : (prev[messageId]?.dislikes || 0)
      }
    }));
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getMessageAvatar = (message: ChatMessage) => {
    if (message.userId === 'system') return '🛡️';
    if (message.userId === 'deepseek') return '🤖';
    if (message.userId === currentUserId) return '👤';
    return '👥';
  };

  const getMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const closeSidebar = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex z-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Enhanced Sidebar */}
      <div className={`
        w-64 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-purple-500/20 flex flex-col transition-transform duration-300 ease-in-out z-50 backdrop-blur-xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative md:z-auto
        fixed md:static
      `}>
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-center font-bold flex-1 shadow-lg">
            <Shield className="inline mr-2 w-5 h-5" />
            SecureMatch
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={closeSidebar}
            className="md:hidden ml-2 text-gray-400 hover:text-white hover:bg-purple-600/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Enhanced Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-pink-600/20 rounded-lg transition-all duration-200 group"
          >
            <Home className="w-5 h-5 group-hover:text-purple-400" />
            <span className="group-hover:text-white">Home</span>
          </button>
          
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-pink-600/20 rounded-lg transition-all duration-200 group"
          >
            <FileText className="w-5 h-5 group-hover:text-purple-400" />
            <span className="group-hover:text-white">Security Resources</span>
          </button>
          
          <button 
            onClick={() => {
              setShowUserList(true);
              closeSidebar();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-pink-600/20 rounded-lg transition-all duration-200 group"
          >
            <Users className="w-5 h-5 group-hover:text-purple-400" />
            <span className="group-hover:text-white">Community ({onlineUsers.length + 1})</span>
            <Badge variant="secondary" className="ml-auto bg-purple-600/20 text-purple-200">
              {onlineUsers.length + 1}
            </Badge>
          </button>
          
          <button 
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-pink-600/20 rounded-lg transition-all duration-200 group"
          >
            <Settings className="w-5 h-5 group-hover:text-purple-400" />
            <span className="group-hover:text-white">Settings</span>
          </button>
        </nav>

        {/* Enhanced Leave Button */}
        <div className="p-4 border-t border-purple-500/20">
          <button 
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-300 hover:bg-gradient-to-r hover:from-red-600/20 hover:to-red-500/20 rounded-lg transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:text-red-400" />
            <span className="group-hover:text-red-200">Leave Discussion</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Enhanced Chat Header */}
        <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 border-b border-purple-500/20 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white hover:bg-purple-600/20"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MessageCircle className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Security Discussion
                </h2>
              </div>
              <p className="text-lg text-gray-200 break-words leading-relaxed">{question}</p>
            </div>
          </div>
          
          {/* Enhanced connection status */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <span className={`${isConnected ? 'text-green-400' : 'text-yellow-400'} font-medium`}>
                  {isConnected ? '🟢 Connected' : '🟡 Connecting...'}
                </span>
              </div>
              {aiTyping && (
                <div className="flex items-center gap-2 text-purple-400">
                  <Bot className="w-4 h-4" />
                  <span className="text-xs">AI is thinking...</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-4 h-4" />
              <span>{onlineUsers.length + 1} participant{onlineUsers.length !== 0 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Enhanced Messages Area */}
        <ScrollArea className="flex-1 p-3 md:p-6" ref={scrollAreaRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => {
              const isOwnMessage = message.userId === currentUserId;
              const isSystemMessage = message.userId === 'system';
              const isAIMessage = message.userId === 'deepseek';
              const reactions = messageReactions[message.id];
              
              if (isSystemMessage) {
                return (
                  <div key={message.id} className="text-center">
                    <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 text-purple-200 border border-purple-700/50 rounded-lg text-sm backdrop-blur-sm">
                      {message.text}
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`max-w-[85%] md:max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                    {!isOwnMessage && (
                      <div className="flex items-center gap-2 mb-2 px-4">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className={`text-xs ${isAIMessage ? 'bg-purple-600' : 'bg-gray-600'}`}>
                            {getMessageAvatar(message)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-gray-400 font-medium">
                          {message.username}
                        </span>
                        {isAIMessage && (
                          <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <Card
                      className={`px-4 py-3 shadow-lg border-0 ${
                        isOwnMessage
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                          : isAIMessage
                          ? 'bg-gradient-to-br from-purple-700/80 to-purple-800/80 text-purple-100 backdrop-blur-sm'
                          : 'bg-gradient-to-br from-gray-700/80 to-gray-800/80 text-gray-100 backdrop-blur-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
                      
                      {/* AI Follow-up Questions */}
                      {message.followUp && message.followUp.length > 0 && (
                        <div className="mt-3 p-3 bg-black/20 rounded-lg border border-purple-500/20">
                          <p className="text-xs text-purple-300 mb-2 font-medium">💡 Follow-up questions:</p>
                          <ul className="space-y-1 text-sm">
                            {message.followUp.map((q, idx) => (
                              <li key={idx} className="text-purple-200 hover:text-purple-100 cursor-pointer transition-colors" 
                                  onClick={() => setNewMessage(`@ai ${q}`)}>
                                • {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs opacity-70">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {getMessageTime(message.timestamp)}
                          </span>
                        </div>
                        
                        {/* Message Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-white/10"
                            onClick={() => toggleReaction(message.id, 'like')}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          {reactions?.likes > 0 && (
                            <span className="text-xs">{reactions.likes}</span>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-white/10"
                            onClick={() => toggleReaction(message.id, 'dislike')}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </Button>
                          {reactions?.dislikes > 0 && (
                            <span className="text-xs">{reactions.dislikes}</span>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-white/10"
                            onClick={() => copyMessage(message.text)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Enhanced Message Input */}
        <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 border-t border-purple-500/20 p-3 md:p-4 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto">
            {/* AI Quick Actions */}
            <div className="flex gap-2 mb-3 overflow-x-auto">
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap border-purple-500/30 text-purple-300 hover:bg-purple-600/20"
                onClick={() => setNewMessage('@ai What are the best practices for ')}
              >
                <Zap className="w-4 h-4 mr-1" />
                Ask AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap border-purple-500/30 text-purple-300 hover:bg-purple-600/20"
                onClick={() => setNewMessage('@ai Can you explain ')}
              >
                <Bot className="w-4 h-4 mr-1" />
                Explain
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap border-purple-500/30 text-purple-300 hover:bg-purple-600/20"
                onClick={() => setNewMessage('@ai What should I do if ')}
              >
                <Shield className="w-4 h-4 mr-1" />
                Security Tip
              </Button>
            </div>
            
            <div className="flex gap-2 md:gap-3 items-end">
              <div className="flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Share your thoughts or type @ai for AI help..."
                  disabled={!isConnected}
                  className="bg-gray-700/50 border-purple-500/30 text-white placeholder-gray-400 rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm md:text-base backdrop-blur-sm focus:border-purple-400 focus:ring-purple-400/20"
                  maxLength={500}
                />
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-2 md:p-3 hidden sm:flex hover:bg-purple-600/20"
              >
                <Smile className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              
              <Button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !isConnected}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 p-2 md:p-3 rounded-lg transition-all duration-200 shadow-lg"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
            
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
              <span>Press Enter to send • @ai for AI assistance</span>
              <span>{newMessage.length}/500</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowUserList(false)}>
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Online Participants ({onlineUsers.length + 1})
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {/* Current user */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-600/20 border border-blue-500/30">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-600 text-white">👤</AvatarFallback>
                </Avatar>
                <span className="text-blue-400 font-medium">{currentUserName} (You)</span>
                <Badge variant="secondary" className="ml-auto bg-blue-600/20 text-blue-300">
                  Online
                </Badge>
              </div>
              
              {/* Other users */}
              {onlineUsers.map((username, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gray-600 text-white">👥</AvatarFallback>
                  </Avatar>
                  <span className="text-gray-300">{username}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full ml-auto animate-pulse"></div>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => setShowUserList(false)}
              variant="outline" 
              className="mt-4 w-full border-purple-500/30 text-purple-300 hover:bg-purple-600/20"
            >
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;