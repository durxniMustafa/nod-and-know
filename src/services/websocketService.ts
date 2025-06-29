import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  image?: string;
  codeSnippet?: string;
  reactions?: Record<string, string[]>;
}

interface WebSocketServiceCallbacks {
  onMessage: (message: ChatMessage) => void;
  onUserJoined: (username: string) => void;
  onUserLeft: (username: string) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  onReaction: (payload: { messageId: string; emoji: string; userId: string }) => void;
  onMessageRemoved: (messageId: string) => void;
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
    // Create a more consistent username generation
    const adjectives = ['Anonymous', 'Curious', 'Helpful', 'Thoughtful', 'Wise', 'Kind', 'Smart', 'Friendly'];
    const nouns = ['User', 'Guest', 'Participant', 'Member', 'Contributor', 'Discussant'];
    
    // Use user ID to generate consistent but anonymous name
    const hash = this.userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const adjIndex = Math.abs(hash) % adjectives.length;
    const nounIndex = Math.abs(hash >> 4) % nouns.length;
    const number = Math.abs(hash) % 999 + 1;
    
    return `${adjectives[adjIndex]} ${nouns[nounIndex]} #${number}`;
  }

  connect(callbacks: WebSocketServiceCallbacks) {
    this.callbacks = callbacks;
    const url =
      import.meta.env.VITE_WS_URL ||
      `${window.location.protocol}//${window.location.hostname}:3001`;
    this.socket = io(url);

    this.socket.on('connect', () => {
      this.callbacks?.onConnectionStatusChange(true);
    });

    this.socket.on('disconnect', () => {
      this.callbacks?.onConnectionStatusChange(false);
    });

    this.socket.on('message', (message: any) => {
      const msg: ChatMessage = {
        ...message,
        timestamp: new Date(message.timestamp)
      };
      this.callbacks?.onMessage(msg);
    });

    this.socket.on('userJoined', (username: string) => {
      this.callbacks?.onUserJoined(username);
    });

    this.socket.on('userLeft', (username: string) => {
      this.callbacks?.onUserLeft(username);
    });

    this.socket.on('reaction', (payload: any) => {
      this.callbacks?.onReaction(payload);
    });

    this.socket.on('messageRemoved', ({ messageId }: any) => {
      this.callbacks?.onMessageRemoved(messageId);
    });
  }

  joinRoom(roomId: string) {
    if (!this.socket) return;
    this.currentRoom = roomId;
    this.socket.emit('joinRoom', {
      roomId,
      username: this.username
    });
  }

  sendMessage(text: string, image?: string, codeSnippet?: string) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('message', {
      roomId: this.currentRoom,
      text,
      userId: this.userId,
      username: this.username,
      image,
      codeSnippet
    });
  }

  sendReaction(messageId: string, emoji: string) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('reaction', {
      roomId: this.currentRoom,
      messageId,
      emoji,
      userId: this.userId
    });
  }

  reportMessage(messageId: string) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('reportMessage', {
      roomId: this.currentRoom,
      messageId
    });
  }

  leaveRoom() {
    if (this.currentRoom && this.socket) {
      this.socket.emit('leaveRoom', { roomId: this.currentRoom });
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

  // Add method to set custom username
  setCurrentUsername(username: string): void {
    this.username = username;
  }
}

export const websocketService = new WebSocketService();
export type { ChatMessage };