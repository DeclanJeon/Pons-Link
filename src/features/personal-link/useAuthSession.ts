import { useEffect } from 'react';
import { useAuthSessionStore } from './authSessionStore';

export const useAuthSession = () => {
  const session = useAuthSessionStore((state) => state.session);
  const bootstrap = useAuthSessionStore((state) => state.bootstrap);
  const setSession = useAuthSessionStore((state) => state.setSession);
  const logout = useAuthSessionStore((state) => state.logout);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return {
    session,
    setSession,
    logout,
    isAuthenticated: Boolean(session),
  };
};
