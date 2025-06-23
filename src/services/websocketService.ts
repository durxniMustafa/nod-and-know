import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  type?: 'message' | 'system' | 'tip' | 'poll' | 'reaction';
  deviceType?: 'desktop' | 'mobile';
  metadata?: {
    replyTo?: string;
    reactions?: { [emoji: string]: string[] };
    isTyping?: boolean;
    expertise?: 'beginner' | 'intermediate' | 'expert';
    sentiment?: 'positive' | 'neutral' | 'concerned';
    location?: string;
  };
}

interface WebSocketServiceCallbacks {
  onMessage: (message: ChatMessage) => void;
  onUserJoined: (username: string, expertise?: string, deviceType?: string) => void;
  onUserLeft: (username: string) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  onTypingIndicator?: (username: string, isTyping: boolean) => void;
  onUserActivity?: (activity: { type: string; username: string; data?: any }) => void;
  onMobileUserJoined?: (userId: string, deviceInfo?: any) => void;
  onQRCodeScanned?: (userId: string, timestamp: Date) => void;
}

interface AIPersonality {
  username: string;
  expertise: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
  responseStyle: 'helpful' | 'curious' | 'cautious' | 'technical' | 'enthusiastic';
  activityLevel: number;
  personalityTraits: string[];
  deviceType: 'desktop' | 'mobile';
}

interface MobileUser {
  userId: string;
  username: string;
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    joinedVia: 'qr' | 'link';
    timestamp: Date;
  };
  isActive: boolean;
}

class EnhancedWebSocketService {
  private socket: Socket | null = null;
  private callbacks: WebSocketServiceCallbacks | null = null;
  private currentRoom: string | null = null;
  private userId: string;
  private username: string;
  private deviceType: 'desktop' | 'mobile';
  private aiPersonalities: AIPersonality[] = [];
  private activeUsers: Set<string> = new Set();
  private mobileUsers: Map<string, MobileUser> = new Map();
  private messageHistory: ChatMessage[] = [];
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private roomTopic: string = '';
  private ngrokUrl: string = '';

  constructor(ngrokUrl?: string) {
    this.userId = this.generateUserId();
    this.username = this.generateUsername();
    this.deviceType = this.detectDeviceType();
    this.ngrokUrl = ngrokUrl || process.env.REACT_APP_NGROK_URL || 'http://localhost:3000';
    this.initializeAIPersonalities();
  }

  private detectDeviceType(): 'desktop' | 'mobile' {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    return isMobile ? 'mobile' : 'desktop';
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private generateUsername(): string {
    const adjectives = ['Anonymous', 'Curious', 'Security', 'Cyber', 'Digital', 'Tech', 'Privacy', 'Safe', 'Secure', 'Smart'];
    const nouns = ['Explorer', 'Guardian', 'Student', 'Learner', 'Researcher', 'User', 'Expert', 'Ninja', 'Wizard', 'Hero'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    const deviceEmoji = this.deviceType === 'mobile' ? '📱' : '💻';
    return `${adj}${noun}${num}${deviceEmoji}`;
  }

  private initializeAIPersonalities() {
    this.aiPersonalities = [
      {
        username: 'CyberSage42💻',
        expertise: 'expert',
        interests: ['penetration testing', 'cryptography', 'incident response'],
        responseStyle: 'technical',
        activityLevel: 0.7,
        personalityTraits: ['analytical', 'detail-oriented', 'experienced'],
        deviceType: 'desktop'
      },
      {
        username: 'SecurityNewbie📱',
        expertise: 'beginner',
        interests: ['password security', 'basic privacy', 'safe browsing'],
        responseStyle: 'curious',
        activityLevel: 0.9,
        personalityTraits: ['eager to learn', 'asks questions', 'grateful'],
        deviceType: 'mobile'
      },
      {
        username: 'PrivacyAdvocate💻',
        expertise: 'intermediate',
        interests: ['data protection', 'surveillance', 'digital rights'],
        responseStyle: 'cautious',
        activityLevel: 0.5,
        personalityTraits: ['privacy-focused', 'thoughtful', 'concerned'],
        deviceType: 'desktop'
      },
      {
        username: 'TechEnthusiast99📱',
        expertise: 'intermediate',
        interests: ['new tech', 'biometrics', 'IoT security'],
        responseStyle: 'enthusiastic',
        activityLevel: 0.8,
        personalityTraits: ['excited', 'optimistic', 'forward-thinking'],
        deviceType: 'mobile'
      },
      {
        username: 'InfoSecMentor💻',
        expertise: 'expert',
        interests: ['training', 'awareness', 'best practices'],
        responseStyle: 'helpful',
        activityLevel: 0.6,
        personalityTraits: ['teaching-oriented', 'patient', 'supportive'],
        deviceType: 'desktop'
      },
      {
        username: 'MobileSecPro📱',
        expertise: 'expert',
        interests: ['mobile security', 'app permissions', 'device management'],
        responseStyle: 'technical',
        activityLevel: 0.7,
        personalityTraits: ['mobile-focused', 'practical', 'security-conscious'],
        deviceType: 'mobile'
      }
    ];
  }

  // QR码相关方法
  generateQRCodeUrl(roomId: string, question: string): string {
    const encodedQuestion = encodeURIComponent(question);
    const mobileUrl = `${this.ngrokUrl}/mobile-chat?room=${roomId}&question=${encodedQuestion}&userId=${this.userId}&timestamp=${Date.now()}`;
    return mobileUrl;
  }

  // 处理移动端连接
  handleMobileConnection(qrData: any) {
    const mobileUser: MobileUser = {
      userId: qrData.userId || this.generateUserId(),
      username: this.generateUsername(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenSize: `${screen.width}x${screen.height}`,
        joinedVia: qrData.joinedVia || 'qr',
        timestamp: new Date()
      },
      isActive: true
    };

    this.mobileUsers.set(mobileUser.userId, mobileUser);
    this.callbacks?.onMobileUserJoined?.(mobileUser.userId, mobileUser.deviceInfo);
    this.callbacks?.onQRCodeScanned?.(mobileUser.userId, new Date());

    // 发送欢迎消息
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `📱 ${mobileUser.username} 通过移动设备加入了讨论！`,
        timestamp: new Date(),
        userId: 'system',
        username: 'SecureMatch Assistant',
        type: 'system',
        deviceType: 'mobile'
      };
      this.callbacks?.onMessage(welcomeMessage);
    }, 1000);

    return mobileUser;
  }

  private getContextualResponses(messageText: string, topic: string, deviceType?: 'desktop' | 'mobile'): string[] {
    const lowerText = messageText.toLowerCase();
    const lowerTopic = topic.toLowerCase();
    
    const responses: { [key: string]: string[] } = {
      password: [
        "我使用密码管理器 - 真的改变了游戏规则！",
        "手机上的生物识别+密码组合感觉是最佳选择",
        "在数据泄露中丢失过密码。现在到处都用独特的密码。",
        "工作强制每30天更改一次密码，有人也这样苦恼吗？",
        deviceType === 'mobile' ? "手机密码管理器比桌面版更方便" : "桌面版密码管理器功能更全面"
      ],
      '2fa': [
        "2FA在有人获得我的密码时拯救了我的账户",
        "像YubiKey这样的硬件密钥值得投资",
        "短信2FA总比没有好，但认证器应用更安全",
        "不便利性完全值得这份安心",
        deviceType === 'mobile' ? "手机认证器应用很方便" : "桌面2FA管理工具更强大"
      ],
      mobile: [
        "移动安全真的是另一个层面的挑战",
        "应用权限管理比大多数人想象的更重要",
        "手机丢失比电脑被盗更常见",
        "移动设备的物理安全经常被忽视",
        "生物识别在移动端真正发挥作用"
      ],
      privacy: [
        "剑桥分析事件后开始阅读隐私政策",
        "公司收集的数据量真的很可怕",
        "GDPR是正确方向的一步，但我们需要更多",
        deviceType === 'mobile' ? "手机应用收集的数据比网站更多" : "桌面浏览器有更好的隐私工具"
      ]
    };

    let possibleResponses: string[] = [];
    
    for (const [category, categoryResponses] of Object.entries(responses)) {
      if (lowerText.includes(category) || lowerTopic.includes(category)) {
        possibleResponses.push(...categoryResponses.filter(r => r));
      }
    }

    if (possibleResponses.length === 0) {
      const generalResponses = [
        "这是一个很好的观点",
        "我最近也在思考这个问题",
        "感谢分享您的经验！",
        "这正是这些讨论有价值的原因",
        deviceType === 'mobile' ? "移动端的体验确实不同" : "桌面端有更多选择",
        "安全性和可用性之间的平衡很棘手",
        "个人经验比任何培训都教得更好"
      ];
      possibleResponses = generalResponses;
    }

    return possibleResponses;
  }

  private generatePersonalizedResponse(personality: AIPersonality, messageText: string): string {
    const contextualResponses = this.getContextualResponses(messageText, this.roomTopic, personality.deviceType);
    let response = contextualResponses[Math.floor(Math.random() * contextualResponses.length)];

    // 根据设备类型调整响应
    if (personality.deviceType === 'mobile') {
      const mobileModifiers = [
        " (从手机发送)",
        " 📱",
        " 在路上用手机回复",
        ""
      ];
      response += mobileModifiers[Math.floor(Math.random() * mobileModifiers.length)];
    }

    // 根据个性调整响应
    switch (personality.responseStyle) {
      case 'technical':
        if (Math.random() > 0.5) {
          response += personality.deviceType === 'mobile' 
            ? " 移动端的技术细节更复杂" 
            : " 从技术角度来看";
        }
        break;
      
      case 'curious':
        if (Math.random() > 0.6) {
          const questions = [
            " 您的经验如何？",
            " 您如何处理这个问题？",
            " 有什么工具推荐吗？",
            " 在您的经验中这常见吗？"
          ];
          response += questions[Math.floor(Math.random() * questions.length)];
        }
        break;
      
      case 'enthusiastic':
        const enthusiasm = ["！", " 🚀", " 这太重要了！", " 喜欢看到这样的讨论！"];
        response += enthusiasm[Math.floor(Math.random() * enthusiasm.length)];
        break;
      
      case 'cautious':
        if (Math.random() > 0.5) {
          response += personality.deviceType === 'mobile' 
            ? " 不过手机上要特别小心" 
            : " 不过要小心验证";
        }
        break;
    }

    return response;
  }

  connect(callbacks: WebSocketServiceCallbacks, ngrokUrl?: string) {
    this.callbacks = callbacks;
    if (ngrokUrl) {
      this.ngrokUrl = ngrokUrl;
    }
    this.simulateConnection();
  }

  private simulateConnection() {
    setTimeout(() => {
      this.callbacks?.onConnectionStatusChange(true);
      this.simulateUserActivity();
      this.generateSystemMessages();
    }, 800 + Math.random() * 400);
  }

  private simulateUserActivity() {
    // 根据设备类型添加AI用户
    this.aiPersonalities.forEach((personality, index) => {
      setTimeout(() => {
        this.activeUsers.add(personality.username);
        this.callbacks?.onUserJoined(personality.username, personality.expertise, personality.deviceType);
        
        this.startPersonalityActivity(personality);
      }, (index + 1) * 2000 + Math.random() * 3000);
    });

    setInterval(() => {
      if (Math.random() > 0.9) {
        this.simulateUserChurn();
      }
    }, 15000);
  }

  private startPersonalityActivity(personality: AIPersonality) {
    const baseInterval = 10000 / personality.activityLevel;
    
    const scheduleNextActivity = () => {
      setTimeout(() => {
        if (Math.random() < personality.activityLevel && this.messageHistory.length > 0) {
          const recentMessage = this.messageHistory[this.messageHistory.length - 1];
          if (recentMessage && recentMessage.userId !== personality.username) {
            this.simulateTyping(personality.username);
            
            setTimeout(() => {
              const response = this.generatePersonalizedResponse(personality, recentMessage.text);
              const message: ChatMessage = {
                id: Date.now().toString() + personality.username,
                text: response,
                timestamp: new Date(),
                userId: personality.username + '_ai',
                username: personality.username,
                deviceType: personality.deviceType,
                metadata: {
                  expertise: personality.expertise,
                  sentiment: Math.random() > 0.7 ? 'positive' : 'neutral'
                }
              };
              
              this.callbacks?.onMessage(message);
              this.messageHistory.push(message);
            }, 1500 + Math.random() * 2000);
          }
        }
        
        scheduleNextActivity();
      }, baseInterval + Math.random() * baseInterval);
    };
    
    scheduleNextActivity();
  }

  private simulateTyping(username: string) {
    this.callbacks?.onTypingIndicator?.(username, true);
    
    setTimeout(() => {
      this.callbacks?.onTypingIndicator?.(username, false);
    }, 1000 + Math.random() * 2000);
  }

  private generateSystemMessages() {
    const tips = [
      "💡 提示：在所有重要账户上启用2FA",
      "🔒 记住：如果听起来好得不真实，可能就不是真的",
      "⚠️ 警告：谨慎对待紧急安全邮件",
      "📱 专业提示：保持应用更新以获得最新安全补丁",
      "🎯 事实：81%的数据泄露涉及弱密码或被盗密码",
      "📱 移动提示：定期检查应用权限",
      "💻 桌面提示：使用浏览器安全扩展"
    ];

    setInterval(() => {
      if (Math.random() > 0.7 && this.callbacks) {
        const tip = tips[Math.floor(Math.random() * tips.length)];
        const message: ChatMessage = {
          id: Date.now().toString(),
          text: tip,
          timestamp: new Date(),
          userId: 'system',
          username: 'SecureMatch Assistant',
          type: 'tip'
        };
        this.callbacks.onMessage(message);
      }
    }, 30000);
  }

  private simulateUserChurn() {
    if (this.activeUsers.size > 2 && Math.random() > 0.5) {
      const users = Array.from(this.activeUsers);
      const leavingUser = users[Math.floor(Math.random() * users.length)];
      this.activeUsers.delete(leavingUser);
      this.callbacks?.onUserLeft(leavingUser);
      
      setTimeout(() => {
        if (Math.random() > 0.6) {
          this.activeUsers.add(leavingUser);
          this.callbacks?.onUserJoined(leavingUser);
        }
      }, 30000 + Math.random() * 60000);
    } else {
      const newUser = this.generateUsername();
      this.activeUsers.add(newUser);
      this.callbacks?.onUserJoined(newUser, 'intermediate', this.deviceType);
    }
  }

  joinRoom(roomId: string) {
    this.currentRoom = roomId;
    this.roomTopic = atob(roomId.replace('question_', ''));
    console.log(`Joined room: ${roomId} with topic: ${this.roomTopic}`);
    
    setTimeout(() => {
      const welcomeMessages = [
        `欢迎来到"${this.roomTopic}"的讨论！`,
        "很好的话题 - 我对此有一些经验",
        "完美的时机，我正在思考这个问题",
        "这是一个非常重要的讨论"
      ];
      
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        text: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
        timestamp: new Date(),
        userId: 'welcomer_ai',
        username: 'SecurityWelcomer',
        type: 'system',
        deviceType: this.deviceType
      };
      
      this.callbacks?.onMessage(welcomeMessage);
    }, 3000);
  }

  sendMessage(text: string) {
    if (!this.callbacks || !this.currentRoom) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      userId: this.userId,
      username: this.username,
      deviceType: this.deviceType
    };

    this.callbacks.onMessage(message);
    this.messageHistory.push(message);

    const respondingPersonalities = this.aiPersonalities.filter(p => 
      Math.random() < p.activityLevel * 0.7
    );

    respondingPersonalities.forEach((personality, index) => {
      setTimeout(() => {
        this.simulateTyping(personality.username);
        
        setTimeout(() => {
          const response = this.generatePersonalizedResponse(personality, text);
          const responseMessage: ChatMessage = {
            id: (Date.now() + index).toString(),
            text: response,
            timestamp: new Date(),
            userId: personality.username + '_ai',
            username: personality.username,
            deviceType: personality.deviceType,
            metadata: {
              replyTo: message.id,
              expertise: personality.expertise
            }
          };
          
          this.callbacks?.onMessage(responseMessage);
          this.messageHistory.push(responseMessage);
        }, 2000 + Math.random() * 3000);
      }, index * 1000 + Math.random() * 2000);
    });
  }

  // 移动端特定方法
  getMobileUsers(): MobileUser[] {
    return Array.from(this.mobileUsers.values());
  }

  updateNgrokUrl(newUrl: string) {
    this.ngrokUrl = newUrl;
  }

  // 原有方法保持不变
  leaveRoom() {
    if (this.currentRoom) {
      console.log(`Left room: ${this.currentRoom}`);
      this.currentRoom = null;
      this.messageHistory = [];
      this.activeUsers.clear();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks?.onConnectionStatusChange(false);
    this.callbacks = null;
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }

  getCurrentUserId(): string {
    return this.userId;
  }

  getCurrentUsername(): string {
    return this.username;
  }

  getActiveUsers(): string[] {
    return Array.from(this.activeUsers);
  }

  getDeviceType(): 'desktop' | 'mobile' {
    return this.deviceType;
  }

  addReaction(messageId: string, emoji: string) {
    setTimeout(() => {
      this.callbacks?.onUserActivity?.({
        type: 'reaction',
        username: this.aiPersonalities[Math.floor(Math.random() * this.aiPersonalities.length)].username,
        data: { messageId, emoji }
      });
    }, 1000 + Math.random() * 2000);
  }
}

export const websocketService = new EnhancedWebSocketService();
export type { ChatMessage, WebSocketServiceCallbacks, MobileUser };