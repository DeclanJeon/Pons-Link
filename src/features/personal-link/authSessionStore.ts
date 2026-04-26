import { create } from 'zustand';
import type { AuthSession } from './types';
import { PERSONAL_LINK_AUTH_SESSION_KEY } from './storageKeys';

interface AuthSessionState {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  bootstrap: () => void;
  logout: () => void;
}

const normalizeStoredSession = (value: unknown): AuthSession | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const session = value as Partial<AuthSession>;
  if (
    typeof session.userId !== 'string' ||
    typeof session.providerSubject !== 'string' ||
    typeof session.email !== 'string' ||
    typeof session.displayName !== 'string' ||
    typeof session.loggedInAt !== 'string'
  ) {
    return null;
  }

  return {
    userId: session.userId,
    providerSubject: session.providerSubject,
    email: session.email,
    displayName: session.displayName,
    avatarUrl: typeof session.avatarUrl === 'string' ? session.avatarUrl : undefined,
    primaryAlias: typeof session.primaryAlias === 'string' ? session.primaryAlias : undefined,
    uniqueNumber: typeof session.uniqueNumber === 'string' ? session.uniqueNumber : undefined,
    sessionToken: typeof session.sessionToken === 'string' ? session.sessionToken : undefined,
    loggedInAt: session.loggedInAt,
  };
};

const readStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PERSONAL_LINK_AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    return normalizeStoredSession(JSON.parse(raw));
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
