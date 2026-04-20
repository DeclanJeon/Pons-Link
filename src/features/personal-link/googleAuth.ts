declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
          renderButton?: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export interface GoogleAuthPayload {
  providerSubject: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export type GoogleAuthErrorCode = 'cancelled' | 'denied' | 'config_error' | 'unknown';

export class GoogleAuthError extends Error {
  constructor(public code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

const GOOGLE_SCRIPT_ID = 'google-identity-services';

const decodeJwt = (credential: string): Record<string, unknown> => {
  const [, payload] = credential.split('.');
  if (!payload) {
    throw new GoogleAuthError('unknown', 'Invalid Google credential payload');
  }

  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded) as Record<string, unknown>;
};

export const loadGoogleIdentityScript = async (): Promise<void> => {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    throw new GoogleAuthError('config_error', 'VITE_GOOGLE_CLIENT_ID is missing');
  }

  if (window.google?.accounts?.id) return;

  const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.id) resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new GoogleAuthError('unknown', 'Google script failed to load')), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new GoogleAuthError('unknown', 'Google script failed to load'));
    document.head.appendChild(script);
  });
};

export const signInWithGoogle = async (): Promise<GoogleAuthPayload> => {
  await loadGoogleIdentityScript();

  return new Promise<GoogleAuthPayload>((resolve, reject) => {
    try {
      window.google?.accounts?.id?.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response: { credential?: string }) => {
          try {
            if (!response.credential) {
              reject(new GoogleAuthError('cancelled', 'Google login cancelled'));
              return;
            }
            const payload = decodeJwt(response.credential);
            resolve({
              providerSubject: String(payload.sub ?? ''),
              email: String(payload.email ?? ''),
              displayName: String(payload.name ?? payload.email ?? ''),
              avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
            });
          } catch (error) {
            reject(error instanceof GoogleAuthError ? error : new GoogleAuthError('unknown', 'Google login failed'));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google?.accounts?.id?.prompt();
    } catch (error) {
      reject(error instanceof GoogleAuthError ? error : new GoogleAuthError('unknown', 'Google login failed'));
    }
  });
};
