import { create } from 'zustand';
import type { AuthSession } from './types';
import { PERSONAL_LINK_AUTH_SESSION_KEY } from './storageKeys';

interface AuthSessionState {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  bootstrap: () => void;
  logout: () => void;
}

const readStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PERSONAL_LINK_AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(PERSONAL_LINK_AUTH_SESSION_KEY);
    return null;
  }
};

export const useAuthSessionStore = create<AuthSessionState>((set) => ({
  session: readStoredSession(),
  setSession: (session) => {
    if (typeof window !== 'undefined') {
      if (session) {
        window.localStorage.setItem(PERSONAL_LINK_AUTH_SESSION_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(PERSONAL_LINK_AUTH_SESSION_KEY);
      }
    }
    set({ session });
  },
  bootstrap: () => set({ session: readStoredSession() }),
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PERSONAL_LINK_AUTH_SESSION_KEY);
    }
    set({ session: null });
  },
}));
