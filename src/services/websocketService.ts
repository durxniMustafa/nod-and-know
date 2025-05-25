
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
}

interface WebSocketServiceCallbacks {
  onMessage: (message: ChatMessage) => void;
  onUserJoined: (username: string) => void;
  onUserLeft: (username: string) => void;
  onConnectionStatusChange: (connected: boolean) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private callbacks: WebSocketServiceCallbacks | null = null;
  private currentRoom: string | null = null;
  private userId: string;
  private username: string;

  constructor() {
    this.userId = this.generateUserId();
    this.username = this.generateUsername();
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private generateUsername(): string {
    const adjectives = ['Anonymous', 'Curious', 'Security', 'Cyber', 'Digital', 'Tech'];
    const nouns = ['Explorer', 'Guardian', 'Student', 'Learner', 'Researcher', 'User'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
  }

  connect(callbacks: WebSocketServiceCallbacks) {
    this.callbacks = callbacks;
    
    // For demo purposes, we'll simulate WebSocket with local state
    // In production, this would connect to a real WebSocket server
    this.simulateConnection();
  }

  private simulateConnection() {
    // Simulate connection delay
    setTimeout(() => {
      this.callbacks?.onConnectionStatusChange(true);
      this.simulateIncomingMessages();
    }, 1000);
  }

  private simulateIncomingMessages() {
    const messages = [
      "I think 2FA is essential these days!",
      "Had my account compromised once, learned my lesson about password reuse.",
      "Anyone know good password managers?",
      "Biometric authentication feels so much safer.",
      "The security vs convenience balance is tricky."
    ];

    messages.forEach((text, index) => {
      setTimeout(() => {
        const message: ChatMessage = {
          id: Date.now().toString() + index,
          text,
          timestamp: new Date(),
          userId: 'other_user_' + index,
          username: `SecurityUser${index + 1}`
        };
        this.callbacks?.onMessage(message);
      }, (index + 1) * 5000 + Math.random() * 3000);
    });
  }

  joinRoom(roomId: string) {
    this.currentRoom = roomId;
    console.log(`Joined room: ${roomId}`);
    
    // Simulate user joining
    setTimeout(() => {
      this.callbacks?.onUserJoined('SecurityExpert42');
    }, 2000);
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

    // Simulate message sending
    this.callbacks.onMessage(message);

    // Simulate response
    setTimeout(() => {
      const responses = [
        "Great point!",
        "I agree with that.",
        "That's really helpful, thanks!",
        "Same experience here.",
        "Good reminder for everyone."
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const responseMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: randomResponse,
        timestamp: new Date(),
        userId: 'responder_' + Date.now(),
        username: 'SecurityBuddy'
      };
      
      this.callbacks?.onMessage(responseMessage);
    }, 1000 + Math.random() * 2000);
  }

  leaveRoom() {
    if (this.currentRoom) {
      console.log(`Left room: ${this.currentRoom}`);
      this.currentRoom = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks?.onConnectionStatusChange(false);
    this.callbacks = null;
  }

  getCurrentUserId(): string {
    return this.userId;
  }

  getCurrentUsername(): string {
    return this.username;
  }
}

export const websocketService = new WebSocketService();
export type { ChatMessage };
