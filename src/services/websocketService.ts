
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
  }

  joinRoom(roomId: string) {
    if (!this.socket) return;
    this.currentRoom = roomId;
    this.socket.emit('joinRoom', {
      roomId,
      username: this.username
    });
  }

  sendMessage(text: string) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('message', {
      roomId: this.currentRoom,
      text,
      userId: this.userId,
      username: this.username
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
}

export const websocketService = new WebSocketService();
export type { ChatMessage };
