import { simpleConfetti } from '@/lib/confetti';

interface VoteData {
  questionId: number;
  yes: number;
  no: number;
  timestamp: number;
}

interface SessionData {
  votes: Record<number, VoteData>;
  currentQuestion: number;
  sessionStartTime: number;
  totalInteractions: number;
}

interface AnalyticsEvent {
  type: 'vote' | 'gesture_detected' | 'chat_opened' | 'session_start';
  timestamp: number;
  data: any;
}

interface Goal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

interface LeaderboardEntry {
  username: string;
  completed: number;
}

class DataService {
  private readonly STORAGE_KEY = 'securematch_session';
  private readonly ANALYTICS_KEY = 'securematch_analytics';
  private readonly VOTE_PERSISTENCE_KEY = 'securematch_votes';
  private readonly GOALS_KEY = 'securematch_goals';
  private readonly LEADERBOARD_KEY = 'securematch_leaderboard';

  // Session Management
  getSessionData(): SessionData {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse session data:', error);
      }
    }

    // Return default session data
    return {
      votes: {},
      currentQuestion: 0,
      sessionStartTime: Date.now(),
      totalInteractions: 0
    };
  }

  saveSessionData(data: SessionData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  // Goal Management
  private getStoredGoals(): Goal[] {
    const stored = localStorage.getItem(this.GOALS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse goals:', error);
      }
    }
    return [];
  }

  private saveGoals(goals: Goal[]): void {
    try {
      localStorage.setItem(this.GOALS_KEY, JSON.stringify(goals));
    } catch (error) {
      console.error('Failed to save goals:', error);
    }
  }

  getGoals(): Goal[] {
    return this.getStoredGoals();
  }

  addGoal(text: string): Goal {
    const goals = this.getStoredGoals();
    const goal: Goal = {
      id: 'goal_' + Math.random().toString(36).substr(2, 9),
      text,
      completed: false,
      createdAt: Date.now()
    };
    goals.push(goal);
    this.saveGoals(goals);
    return goal;
  }

  completeGoal(id: string, username: string): void {
    const goals = this.getStoredGoals();
    const goal = goals.find(g => g.id === id);
    if (!goal || goal.completed) return;
    goal.completed = true;
    goal.completedAt = Date.now();
    this.saveGoals(goals);
    this.updateLeaderboard(username);
    simpleConfetti();
  }

  // Leaderboard Management
  private getStoredLeaderboard(): LeaderboardEntry[] {
    const stored = localStorage.getItem(this.LEADERBOARD_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse leaderboard:', error);
      }
    }
    return [];
  }

  private saveLeaderboard(lb: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(this.LEADERBOARD_KEY, JSON.stringify(lb));
    } catch (error) {
      console.error('Failed to save leaderboard:', error);
    }
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.getStoredLeaderboard();
  }

  private updateLeaderboard(username: string) {
    const lb = this.getStoredLeaderboard();
    let entry = lb.find(e => e.username === username);
    if (!entry) {
      entry = { username, completed: 0 };
      lb.push(entry);
    }
    entry.completed += 1;
    lb.sort((a, b) => b.completed - a.completed);
    this.saveLeaderboard(lb);
  }

  // Vote Management
  getVotesForQuestion(questionId: number): { yes: number; no: number } {
    const sessionData = this.getSessionData();
    const voteData = sessionData.votes[questionId];
    return voteData ? { yes: voteData.yes, no: voteData.no } : { yes: 0, no: 0 };
  }

  addVote(questionId: number, vote: 'yes' | 'no'): { yes: number; no: number } {
    const sessionData = this.getSessionData();
    
    if (!sessionData.votes[questionId]) {
      sessionData.votes[questionId] = {
        questionId,
        yes: 0,
        no: 0,
        timestamp: Date.now()
      };
    }

    sessionData.votes[questionId][vote]++;
    sessionData.totalInteractions++;
    
    this.saveSessionData(sessionData);
    this.logAnalyticsEvent('vote', { questionId, vote });

    return {
      yes: sessionData.votes[questionId].yes,
      no: sessionData.votes[questionId].no
    };
  }

  // Question Management
  getCurrentQuestion(): number {
    return this.getSessionData().currentQuestion;
  }

  setCurrentQuestion(questionId: number): void {
    const sessionData = this.getSessionData();
    sessionData.currentQuestion = questionId;
    this.saveSessionData(sessionData);
  }

  // Analytics (Privacy-Compliant)
  logAnalyticsEvent(type: AnalyticsEvent['type'], data: any = {}): void {
    try {
      const events = this.getAnalyticsEvents();
      const event: AnalyticsEvent = {
        type,
        timestamp: Date.now(),
        data: this.sanitizeAnalyticsData(data)
      };

      events.push(event);

      // Keep only last 100 events to prevent storage bloat
      const recentEvents = events.slice(-100);
      localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to log analytics event:', error);
    }
  }

  private sanitizeAnalyticsData(data: any): any {
    // Remove any potentially sensitive information
    const sanitized = { ...data };
    delete sanitized.userAgent;
    delete sanitized.ipAddress;
    delete sanitized.personalData;
    return sanitized;
  }

  getAnalyticsEvents(): AnalyticsEvent[] {
    const stored = localStorage.getItem(this.ANALYTICS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse analytics data:', error);
      }
    }
    return [];
  }

  // Session Statistics
  getSessionStats() {
    const sessionData = this.getSessionData();
    const events = this.getAnalyticsEvents();
    
    const sessionDuration = Date.now() - sessionData.sessionStartTime;
    const gestureCount = events.filter(e => e.type === 'gesture_detected').length;
    const chatOpened = events.some(e => e.type === 'chat_opened');
    
    return {
      sessionDuration,
      totalVotes: sessionData.totalInteractions,
      gestureCount,
      chatOpened,
      questionsAnswered: Object.keys(sessionData.votes).length
    };
  }

  // Cleanup
  clearSessionData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ANALYTICS_KEY);
    localStorage.removeItem(this.VOTE_PERSISTENCE_KEY);
  }

  // Export data for debugging/research (anonymized)
  exportAnonymizedData() {
    const sessionData = this.getSessionData();
    const events = this.getAnalyticsEvents();
    
    return {
      votes: sessionData.votes,
      totalInteractions: sessionData.totalInteractions,
      events: events.map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        // Only include non-sensitive data fields
        data: e.data.questionId ? { questionId: e.data.questionId } : {}
      })),
      sessionStats: this.getSessionStats()
    };
  }
}

export const dataService = new DataService();
export type { SessionData, VoteData, AnalyticsEvent, Goal, LeaderboardEntry };
