import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  type?: 'message' | 'system' | 'tip' | 'poll' | 'reaction';
  metadata?: {
    replyTo?: string;
    reactions?: { [emoji: string]: string[] };
    isTyping?: boolean;
    expertise?: 'beginner' | 'intermediate' | 'expert';
    sentiment?: 'positive' | 'neutral' | 'concerned';
  };
}

interface WebSocketServiceCallbacks {
  onMessage: (message: ChatMessage) => void;
  onUserJoined: (username: string, expertise?: string) => void;
  onUserLeft: (username: string) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  onTypingIndicator?: (username: string, isTyping: boolean) => void;
  onUserActivity?: (activity: { type: string; username: string; data?: any }) => void;
}

interface AIPersonality {
  username: string;
  expertise: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
  responseStyle: 'helpful' | 'curious' | 'cautious' | 'technical' | 'enthusiastic';
  activityLevel: number; // 0-1, how often they respond
  personalityTraits: string[];
}

class EnhancedWebSocketService {
  private socket: Socket | null = null;
  private callbacks: WebSocketServiceCallbacks | null = null;
  private currentRoom: string | null = null;
  private userId: string;
  private username: string;
  private aiPersonalities: AIPersonality[] = [];
  private activeUsers: Set<string> = new Set();
  private messageHistory: ChatMessage[] = [];
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private roomTopic: string = '';

  constructor() {
    this.userId = this.generateUserId();
    this.username = this.generateUsername();
    this.initializeAIPersonalities();
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
    return `${adj}${noun}${num}`;
  }

  private initializeAIPersonalities() {
    this.aiPersonalities = [
      {
        username: 'CyberSage42',
        expertise: 'expert',
        interests: ['penetration testing', 'cryptography', 'incident response'],
        responseStyle: 'technical',
        activityLevel: 0.7,
        personalityTraits: ['analytical', 'detail-oriented', 'experienced']
      },
      {
        username: 'SecurityNewbie',
        expertise: 'beginner',
        interests: ['password security', 'basic privacy', 'safe browsing'],
        responseStyle: 'curious',
        activityLevel: 0.9,
        personalityTraits: ['eager to learn', 'asks questions', 'grateful']
      },
      {
        username: 'PrivacyAdvocate',
        expertise: 'intermediate',
        interests: ['data protection', 'surveillance', 'digital rights'],
        responseStyle: 'cautious',
        activityLevel: 0.5,
        personalityTraits: ['privacy-focused', 'thoughtful', 'concerned']
      },
      {
        username: 'TechEnthusiast99',
        expertise: 'intermediate',
        interests: ['new tech', 'biometrics', 'IoT security'],
        responseStyle: 'enthusiastic',
        activityLevel: 0.8,
        personalityTraits: ['excited', 'optimistic', 'forward-thinking']
      },
      {
        username: 'InfoSecMentor',
        expertise: 'expert',
        interests: ['training', 'awareness', 'best practices'],
        responseStyle: 'helpful',
        activityLevel: 0.6,
        personalityTraits: ['teaching-oriented', 'patient', 'supportive']
      }
    ];
  }

  private getContextualResponses(messageText: string, topic: string): string[] {
    const lowerText = messageText.toLowerCase();
    const lowerTopic = topic.toLowerCase();
    
    // Smart contextual responses based on keywords and topic
    const responses: { [key: string]: string[] } = {
      password: [
        "I use a password manager religiously - game changer!",
        "The 'correct horse battery staple' method works well for memorable passwords",
        "Had my passwords leaked in a breach once. Now I use unique ones everywhere.",
        "Biometric + password combo feels like the sweet spot for me",
        "Anyone else struggle with work forcing password changes every 30 days?"
      ],
      '2fa': [
        "2FA saved my account when someone got my password",
        "Hardware keys like YubiKey are worth the investment",
        "SMS 2FA is better than nothing, but authenticator apps are way safer",
        "The inconvenience is so worth the peace of mind",
        "Backup codes are crucial - learned that the hard way"
      ],
      phishing: [
        "I got caught by a really convincing phishing email last year. Humbling experience.",
        "The grammar mistakes aren't always there anymore - some are really sophisticated",
        "Hover over links before clicking - saved me so many times",
        "My company does phishing simulations. Embarrassing but educational!",
        "The urgency tactics are what usually get people"
      ],
      privacy: [
        "Started reading privacy policies after the Cambridge Analytica thing",
        "VPNs are great but choose carefully - some log everything",
        "The amount of data companies collect is honestly terrifying",
        "GDPR was a step in the right direction but we need more",
        "Try using DuckDuckGo for a week - you'll be surprised"
      ],
      social: [
        "I audit my social media privacy settings quarterly now",
        "Those personality quizzes are often data harvesting operations",
        "Location tracking on photos caught me off guard",
        "The people search sites are creepy - worth paying to remove yourself",
        "Friend requests from strangers always make me suspicious now"
      ],
      work: [
        "Remote work changed our security game completely",
        "BYOD policies are a nightmare to implement securely",
        "Our IT team blocks everything but somehow malware still gets through",
        "Security training at work is usually pretty outdated",
        "The human element is always the weakest link"
      ]
    };

    // Find matching categories
    let possibleResponses: string[] = [];
    
    for (const [category, categoryResponses] of Object.entries(responses)) {
      if (lowerText.includes(category) || lowerTopic.includes(category)) {
        possibleResponses.push(...categoryResponses);
      }
    }

    // Fallback to general responses
    if (possibleResponses.length === 0) {
      possibleResponses = [
        "That's a really good point to consider",
        "I've been thinking about this too lately",
        "Thanks for sharing your experience!",
        "This is exactly why these discussions are valuable",
        "Similar thing happened to a friend of mine",
        "The landscape changes so fast, hard to keep up",
        "Education is key - most people just don't know",
        "Balance between security and usability is tricky",
        "Corporate policies often miss the mark on this",
        "Personal experience teaches better than any training"
      ];
    }

    return possibleResponses;
  }

  private generatePersonalizedResponse(personality: AIPersonality, messageText: string): string {
    const contextualResponses = this.getContextualResponses(messageText, this.roomTopic);
    let response = contextualResponses[Math.floor(Math.random() * contextualResponses.length)];

    // Modify response based on personality
    switch (personality.responseStyle) {
      case 'technical':
        if (Math.random() > 0.5) {
          const techAdditions = [
            " From a technical standpoint, ",
            " The attack vectors for this include ",
            " I've seen this in pentests - ",
            " The cryptographic implications are "
          ];
          response += techAdditions[Math.floor(Math.random() * techAdditions.length)];
        }
        break;
      
      case 'curious':
        if (Math.random() > 0.6) {
          const questions = [
            " What's your experience been?",
            " How do you handle this?",
            " Any tools you'd recommend?",
            " Is this common in your experience?"
          ];
          response += questions[Math.floor(Math.random() * questions.length)];
        }
        break;
      
      case 'enthusiastic':
        const enthusiasm = ["!", " 🚀", " This is so important!", " Love seeing this discussion!"];
        response += enthusiasm[Math.floor(Math.random() * enthusiasm.length)];
        break;
      
      case 'cautious':
        if (Math.random() > 0.5) {
          const cautions = [
            " Though be careful with ",
            " Just make sure to verify ",
            " I'd be cautious about ",
            " Double-check the source on "
          ];
          response += cautions[Math.floor(Math.random() * cautions.length)];
        }
        break;
    }

    return response;
  }

  private simulateTyping(username: string) {
    this.callbacks?.onTypingIndicator?.(username, true);
    
    setTimeout(() => {
      this.callbacks?.onTypingIndicator?.(username, false);
    }, 1000 + Math.random() * 2000);
  }

  private generateSystemMessages() {
    const tips = [
      "💡 Tip: Enable 2FA on all important accounts",
      "🔒 Remember: If it sounds too good to be true, it probably is",
      "⚠️ Warning: Be cautious of urgent security emails",
      "📱 Pro tip: Keep your apps updated for latest security patches",
      "🎯 Fact: 81% of breaches involve weak or stolen passwords"
    ];

    const pollQuestions = [
      "Quick poll: Do you use a password manager? React with 👍 for yes, 👎 for no",
      "What's your biggest security concern? React: 💻 for malware, 🎣 for phishing, 🔐 for passwords",
      "How often do you update your passwords? React: 📅 monthly, 🗓️ yearly, ❌ never"
    ];

    // Send periodic tips
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
    }, 30000); // Every 30 seconds

    // Send occasional polls
    setInterval(() => {
      if (Math.random() > 0.8 && this.callbacks) {
        const poll = pollQuestions[Math.floor(Math.random() * pollQuestions.length)];
        const message: ChatMessage = {
          id: Date.now().toString(),
          text: poll,
          timestamp: new Date(),
          userId: 'system',
          username: 'SecureMatch Assistant',
          type: 'poll'
        };
        this.callbacks.onMessage(message);
      }
    }, 60000); // Every minute
  }

  connect(callbacks: WebSocketServiceCallbacks) {
    this.callbacks = callbacks;
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
    // Add AI users gradually
    this.aiPersonalities.forEach((personality, index) => {
      setTimeout(() => {
        this.activeUsers.add(personality.username);
        this.callbacks?.onUserJoined(personality.username, personality.expertise);
        
        // Start their activity patterns
        this.startPersonalityActivity(personality);
      }, (index + 1) * 2000 + Math.random() * 3000);
    });

    // Simulate occasional user leaving/joining
    setInterval(() => {
      if (Math.random() > 0.9) {
        this.simulateUserChurn();
      }
    }, 15000);
  }

  private startPersonalityActivity(personality: AIPersonality) {
    const baseInterval = 10000 / personality.activityLevel; // More active = shorter intervals
    
    const scheduleNextActivity = () => {
      setTimeout(() => {
        if (Math.random() < personality.activityLevel && this.messageHistory.length > 0) {
          // Maybe respond to recent message
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

  private simulateUserChurn() {
    if (this.activeUsers.size > 2 && Math.random() > 0.5) {
      // Someone leaves
      const users = Array.from(this.activeUsers);
      const leavingUser = users[Math.floor(Math.random() * users.length)];
      this.activeUsers.delete(leavingUser);
      this.callbacks?.onUserLeft(leavingUser);
      
      // They might come back later
      setTimeout(() => {
        if (Math.random() > 0.6) {
          this.activeUsers.add(leavingUser);
          this.callbacks?.onUserJoined(leavingUser);
        }
      }, 30000 + Math.random() * 60000);
    } else {
      // New user joins
      const newUser = this.generateUsername();
      this.activeUsers.add(newUser);
      this.callbacks?.onUserJoined(newUser, 'intermediate');
    }
  }

  joinRoom(roomId: string) {
    this.currentRoom = roomId;
    this.roomTopic = atob(roomId.replace('question_', ''));
    console.log(`Joined room: ${roomId} with topic: ${this.roomTopic}`);
    
    // Send contextual welcome based on topic
    setTimeout(() => {
      const welcomeMessages = [
        `Welcome to the discussion on "${this.roomTopic}"!`,
        "Great topic - I've had some experience with this",
        "Perfect timing, I was just thinking about this",
        "This is such an important discussion to have"
      ];
      
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        text: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
        timestamp: new Date(),
        userId: 'welcomer_ai',
        username: 'SecurityWelcomer',
        type: 'system'
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
      username: this.username
    };

    this.callbacks.onMessage(message);
    this.messageHistory.push(message);

    // Trigger more realistic AI responses
    const respondingPersonalities = this.aiPersonalities.filter(p => 
      Math.random() < p.activityLevel * 0.7 // 70% chance they'll respond
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

  // New methods for enhanced features
  addReaction(messageId: string, emoji: string) {
    // Simulate others reacting to messages
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
export type { ChatMessage, WebSocketServiceCallbacks };