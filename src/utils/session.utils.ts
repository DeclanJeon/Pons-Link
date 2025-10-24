const SESSION_STORAGE_KEY = 'user_session';

interface StoredSession {
  nickname: string;
  timestamp: number;
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const sessionManager = {
  saveNickname(nickname: string): void {
    const session: StoredSession = {
      nickname,
      timestamp: Date.now()
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  },

  getNickname(): string | null {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const session: StoredSession = JSON.parse(stored);
      
      if (Date.now() - session.timestamp > SESSION_EXPIRY_MS) {
        this.clearNickname();
        return null;
      }

      return session.nickname;
    } catch {
      return null;
    }
  },

  clearNickname(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  },

  isSessionValid(): boolean {
    return this.getNickname() !== null;
  }
};
