
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

    const url = process.env.NODE_ENV === 'production'
      ? undefined
      : 'http://localhost:3001';
    this.socket = io(url, {
      query: { username: this.username }
    });

    this.socket.on('connect', () => {
      this.callbacks?.onConnectionStatusChange(true);
    });

    this.socket.on('disconnect', () => {
      this.callbacks?.onConnectionStatusChange(false);
    });

    this.socket.on('message', (message: ChatMessage) => {
      message.timestamp = new Date(message.timestamp);
      this.callbacks?.onMessage(message);
    });

    this.socket.on('user_joined', (username: string) => {
      this.callbacks?.onUserJoined(username);
    });

    this.socket.on('user_left', (username: string) => {
      this.callbacks?.onUserLeft(username);
    });
  }

  joinRoom(roomId: string) {
    this.currentRoom = roomId;
    this.socket?.emit('join', { roomId, username: this.username });
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

    this.socket?.emit('message', { roomId: this.currentRoom, message });
  }

  leaveRoom() {
    if (this.currentRoom) {
      this.socket?.emit('leave', this.currentRoom);
      this.currentRoom = null;
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.currentRoom) {
        this.socket.emit('leave', this.currentRoom);
        this.currentRoom = null;
      }
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
