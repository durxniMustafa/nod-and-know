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
  type: 'vote' | 'gesture_detected' | 'chat_opened' | 'session_start' | 'mobile_user_joined';
  timestamp: number;
  data: Record<string, any>;
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

interface SessionStats {
  sessionDuration: number;
  totalVotes: number;
  gestureCount: number;
  chatOpened: boolean;
  questionsAnswered: number;
}

interface ExportedData {
  votes: Record<number, VoteData>;
  totalInteractions: number;
  events: Array<{
    type: string;
    timestamp: number;
    data: Record<string, any>;
  }>;
  sessionStats: SessionStats;
}

// Custom error classes for better error handling
class DataServiceError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'DataServiceError';
  }
}

class ValidationError extends DataServiceError {
  constructor(message: string) {
    super(message, 'validation');
    this.name = 'ValidationError';
  }
}

class DataService {
  // In-memory storage instead of localStorage
  private sessionData: SessionData;
  private analyticsEvents: AnalyticsEvent[] = [];
  private goals: Goal[] = [];
  private leaderboard: LeaderboardEntry[] = [];
  
  // Configuration
  private readonly MAX_ANALYTICS_EVENTS = 100;
  private readonly MAX_USERNAME_LENGTH = 50;
  private readonly MAX_GOAL_TEXT_LENGTH = 200;

  constructor() {
    this.sessionData = this.createDefaultSessionData();
    this.logAnalyticsEvent('session_start');
  }

  // Input validation helpers
  private validateQuestionId(questionId: number): void {
    if (!Number.isInteger(questionId) || questionId < 0) {
      throw new ValidationError(`Invalid question ID: ${questionId}`);
    }
  }

  private validateUsername(username: string): void {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Username is required and must be a string');
    }
    if (username.trim().length === 0) {
      throw new ValidationError('Username cannot be empty');
    }
    if (username.length > this.MAX_USERNAME_LENGTH) {
      throw new ValidationError(`Username too long (max ${this.MAX_USERNAME_LENGTH} characters)`);
    }
  }

  private validateGoalText(text: string): void {
    if (!text || typeof text !== 'string') {
      throw new ValidationError('Goal text is required and must be a string');
    }
    if (text.trim().length === 0) {
      throw new ValidationError('Goal text cannot be empty');
    }
    if (text.length > this.MAX_GOAL_TEXT_LENGTH) {
      throw new ValidationError(`Goal text too long (max ${this.MAX_GOAL_TEXT_LENGTH} characters)`);
    }
  }

  private validateGoalId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Goal ID is required and must be a string');
    }
  }

  // Improved ID generation
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `goal_${timestamp}_${randomPart}`;
  }

  private createDefaultSessionData(): SessionData {
    return {
      votes: {},
      currentQuestion: 0,
      sessionStartTime: Date.now(),
      totalInteractions: 0
    };
  }

  // Session Management
  getSessionData(): SessionData {
    try {
      // Return a deep copy to prevent external mutations
      return JSON.parse(JSON.stringify(this.sessionData));
    } catch (error) {
      throw new DataServiceError('Failed to retrieve session data', 'getSessionData');
    }
  }

  private updateSessionData(updater: (data: SessionData) => void): void {
    try {
      updater(this.sessionData);
    } catch (error) {
      throw new DataServiceError('Failed to update session data', 'updateSessionData');
    }
  }

  // Goal Management
  getGoals(): Goal[] {
    try {
      // Return a deep copy to prevent external mutations
      return JSON.parse(JSON.stringify(this.goals));
    } catch (error) {
      throw new DataServiceError('Failed to retrieve goals', 'getGoals');
    }
  }

  addGoal(text: string): Goal {
    try {
      this.validateGoalText(text);
      
      const goal: Goal = {
        id: this.generateId(),
        text: text.trim(),
        completed: false,
        createdAt: Date.now()
      };
      
      this.goals.push(goal);
      return JSON.parse(JSON.stringify(goal)); // Return copy
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to add goal', 'addGoal');
    }
  }

  completeGoal(id: string, username: string): boolean {
    try {
      this.validateGoalId(id);
      this.validateUsername(username);
      
      const goal = this.goals.find(g => g.id === id);
      if (!goal) {
        throw new ValidationError(`Goal with ID ${id} not found`);
      }
      
      if (goal.completed) {
        return false; // Already completed
      }
      
      goal.completed = true;
      goal.completedAt = Date.now();
      
      this.updateLeaderboard(username.trim());
      
      // Simple confetti effect (since we can't import the external library)
      try {
        console.log('🎉 Goal completed! Confetti effect would trigger here.');
      } catch (confettiError) {
        console.warn('Confetti effect failed:', confettiError);
      }
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to complete goal', 'completeGoal');
    }
  }

  deleteGoal(id: string): boolean {
    try {
      this.validateGoalId(id);
      
      const initialLength = this.goals.length;
      this.goals = this.goals.filter(g => g.id !== id);
      
      return this.goals.length < initialLength;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to delete goal', 'deleteGoal');
    }
  }

  // Leaderboard Management
  getLeaderboard(): LeaderboardEntry[] {
    try {
      // Return sorted copy
      return [...this.leaderboard].sort((a, b) => b.completed - a.completed);
    } catch (error) {
      throw new DataServiceError('Failed to retrieve leaderboard', 'getLeaderboard');
    }
  }

  private updateLeaderboard(username: string): void {
    try {
      let entry = this.leaderboard.find(e => e.username === username);
      if (!entry) {
        entry = { username, completed: 0 };
        this.leaderboard.push(entry);
      }
      entry.completed += 1;
    } catch (error) {
      throw new DataServiceError('Failed to update leaderboard', 'updateLeaderboard');
    }
  }

  // Vote Management
  getVotesForQuestion(questionId: number): { yes: number; no: number } {
    try {
      this.validateQuestionId(questionId);
      
      const voteData = this.sessionData.votes[questionId];
      return voteData ? { yes: voteData.yes, no: voteData.no } : { yes: 0, no: 0 };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to retrieve votes', 'getVotesForQuestion');
    }
  }

  addVote(questionId: number, vote: 'yes' | 'no'): { yes: number; no: number } {
    try {
      this.validateQuestionId(questionId);
      
      if (vote !== 'yes' && vote !== 'no') {
        throw new ValidationError('Vote must be either "yes" or "no"');
      }

      this.updateSessionData((sessionData) => {
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
      });

      this.logAnalyticsEvent('vote', { questionId, vote });

      return {
        yes: this.sessionData.votes[questionId].yes,
        no: this.sessionData.votes[questionId].no
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to add vote', 'addVote');
    }
  }

  // Question Management
  getCurrentQuestion(): number {
    return this.sessionData.currentQuestion;
  }

  setCurrentQuestion(questionId: number): void {
    try {
      this.validateQuestionId(questionId);
      
      this.updateSessionData((sessionData) => {
        sessionData.currentQuestion = questionId;
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DataServiceError('Failed to set current question', 'setCurrentQuestion');
    }
  }

  // Analytics (Privacy-Compliant)
  logAnalyticsEvent(type: AnalyticsEvent['type'], data: Record<string, any> = {}): void {
    try {
      const event: AnalyticsEvent = {
        type,
        timestamp: Date.now(),
        data: this.sanitizeAnalyticsData(data)
      };

      this.analyticsEvents.push(event);

      // Keep only recent events to prevent memory bloat
      if (this.analyticsEvents.length > this.MAX_ANALYTICS_EVENTS) {
        this.analyticsEvents = this.analyticsEvents.slice(-this.MAX_ANALYTICS_EVENTS);
      }
    } catch (error) {
      // Don't throw for analytics failures - log and continue
      console.error('Failed to log analytics event:', error);
    }
  }

  private sanitizeAnalyticsData(data: Record<string, any>): Record<string, any> {
    try {
      // Create a sanitized copy, removing sensitive information
      const sanitized = { ...data };
      
      // Remove potentially sensitive fields
      const sensitiveFields = [
        'userAgent', 'ipAddress', 'personalData', 'email', 'phone', 
        'address', 'password', 'token', 'secret', 'key'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitized[field];
      });
      
      return sanitized;
    } catch (error) {
      console.error('Failed to sanitize analytics data:', error);
      return {};
    }
  }

  getAnalyticsEvents(): AnalyticsEvent[] {
    try {
      // Return a deep copy to prevent external mutations
      return JSON.parse(JSON.stringify(this.analyticsEvents));
    } catch (error) {
      throw new DataServiceError('Failed to retrieve analytics events', 'getAnalyticsEvents');
    }
  }

  // Session Statistics
  getSessionStats(): SessionStats {
    try {
      const sessionDuration = Date.now() - this.sessionData.sessionStartTime;
      const gestureCount = this.analyticsEvents.filter(e => e.type === 'gesture_detected').length;
      const chatOpened = this.analyticsEvents.some(e => e.type === 'chat_opened');
      
      return {
        sessionDuration,
        totalVotes: this.sessionData.totalInteractions,
        gestureCount,
        chatOpened,
        questionsAnswered: Object.keys(this.sessionData.votes).length
      };
    } catch (error) {
      throw new DataServiceError('Failed to calculate session stats', 'getSessionStats');
    }
  }

  // Data Management
  clearSessionData(): void {
    try {
      this.sessionData = this.createDefaultSessionData();
      this.analyticsEvents = [];
      console.log('Session data cleared successfully');
    } catch (error) {
      throw new DataServiceError('Failed to clear session data', 'clearSessionData');
    }
  }

  clearAllData(): void {
    try {
      this.sessionData = this.createDefaultSessionData();
      this.analyticsEvents = [];
      this.goals = [];
      this.leaderboard = [];
      console.log('All data cleared successfully');
    } catch (error) {
      throw new DataServiceError('Failed to clear all data', 'clearAllData');
    }
  }

  // Export data for debugging/research (anonymized)
  exportAnonymizedData(): ExportedData {
    try {
      return {
        votes: { ...this.sessionData.votes },
        totalInteractions: this.sessionData.totalInteractions,
        events: this.analyticsEvents.map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          // Only include non-sensitive data fields
          data: e.data.questionId ? { questionId: e.data.questionId } : {}
        })),
        sessionStats: this.getSessionStats()
      };
    } catch (error) {
      throw new DataServiceError('Failed to export data', 'exportAnonymizedData');
    }
  }

  // Utility method to get service health/status
  getServiceStatus() {
    try {
      return {
        isHealthy: true,
        sessionActive: true,
        dataIntegrity: {
          goalsCount: this.goals.length,
          leaderboardEntries: this.leaderboard.length,
          analyticsEvents: this.analyticsEvents.length,
          votedQuestions: Object.keys(this.sessionData.votes).length
        },
        memoryUsage: {
          approximateSize: JSON.stringify({
            sessionData: this.sessionData,
            goals: this.goals,
            leaderboard: this.leaderboard,
            analytics: this.analyticsEvents
          }).length
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance and types
export const dataService = new DataService();
export type { 
  SessionData, 
  VoteData, 
  AnalyticsEvent, 
  Goal, 
  LeaderboardEntry, 
  SessionStats,
  ExportedData 
};
export { DataServiceError, ValidationError };