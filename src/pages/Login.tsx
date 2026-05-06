import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithGoogle, GoogleAuthError } from '@/features/personal-link/googleAuth';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import { supportsSessionAuthAtApiUrl } from '@/features/personal-link/backendSurface';
import { writeOwnerDeviceToken } from '@/features/personal-link/ownerDeviceStore';
import type { AuthSession, UserProfile } from '@/features/personal-link/types';
import { nanoid } from 'nanoid';

type BackendAuthResponse = {
  error?: string;
  user?: {
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
    primaryAlias?: string;
    uniqueNumber?: string;
  };
  session?: {
    userId?: string;
    token?: string;
  };
};

type OwnerDeviceResponse = {
  token?: string;
};

const exchangeBackendAuthSession = async (apiUrl: string, idToken: string): Promise<BackendAuthResponse> => {
  const response = await fetch(`${apiUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json() as BackendAuthResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? `Backend auth failed with ${response.status}`);
  }

  if (!payload.session?.token) {
    throw new Error('Backend auth response did not include a session token');
  }

  return payload;
};

const registerOwnerDevice = async (apiUrl: string, sessionToken?: string): Promise<void> => {
  const token = sessionToken?.trim();
  if (!apiUrl || !token) {
    return;
  }

  const response = await fetch(`${apiUrl}/api/auth/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ label: 'Browser' }),
  });
  const payload = await response.json() as OwnerDeviceResponse;

  if (!response.ok) {
    throw new Error(`Trusted device registration failed with ${response.status}`);
  }

  if (payload.token) {
    writeOwnerDeviceToken(payload.token);
  }
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const { session, setSession } = useAuthSession();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const supportsBackendSession = await supportsSessionAuthAtApiUrl(apiUrl);

    // Skip Google prompt when a valid session already exists in localStorage
    if (session && (!supportsBackendSession || session.sessionToken)) {
      const existing = await repository.getAuthBootstrapProfile(session.email);
      navigate(existing.publicProfile ? '/lounge' : '/lounge/onboarding');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const googleUser = await signInWithGoogle();
      const backendAuth = supportsBackendSession && apiUrl
        ? await exchangeBackendAuthSession(apiUrl, googleUser.idToken)
        : undefined;
      const backendUser = backendAuth?.user;
      const backendSession = backendAuth?.session;
      const sessionToken = backendSession?.token;
      const newSession: AuthSession = {
        userId: backendSession?.userId ?? backendUser?.userId ?? nanoid(),
        providerSubject: googleUser.providerSubject,
        email: googleUser.email,
        displayName: backendUser?.displayName ?? googleUser.displayName,
        avatarUrl: backendUser?.avatarUrl ?? googleUser.avatarUrl,
        primaryAlias: backendUser?.primaryAlias,
        uniqueNumber: backendUser?.uniqueNumber,
        sessionToken,
        loggedInAt: new Date().toISOString(),
      };
      setSession(newSession);
      try {
        await registerOwnerDevice(apiUrl, sessionToken);
      } catch (deviceError) {
        console.warn('Trusted device registration failed:', deviceError);
      }
      const existing = await repository.getAuthBootstrapProfile(googleUser.email);
      if (!existing.userProfile) {
        const userProfile: UserProfile = {
          userId: newSession.userId,
          providerSubject: googleUser.providerSubject,
          primaryEmail: googleUser.email,
          emailVerified: true,
          displayName: googleUser.displayName,
          avatarUrl: googleUser.avatarUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await repository.saveUserProfile(userProfile);
        navigate('/lounge/onboarding');
        return;
      }
      navigate('/lounge');
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        setError(err.message);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#111827]">
      <nav className="flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-white/90 px-6 backdrop-blur lg:px-10">
        <Link to="/" className="flex cursor-pointer items-center gap-3">
          <img
            src="/icon.svg"
            alt=""
            className="h-8 w-8"
            loading="eager"
          />
          <span className="text-lg font-bold tracking-tight text-[#111827]">PonsLink</span>
        </Link>
        <Link to="/" className="text-sm font-medium text-[#6B7280] transition hover:text-[#1E63FF]">
          Back to home
        </Link>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <div className="p-8">
              <div className="mb-8 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src="/icon.svg"
                    alt=""
                    className="h-12 w-12"
                    loading="eager"
                  />
                  <span className="text-xl font-bold tracking-tight text-[#111827]">PonsLink</span>
                </div>
              </div>

              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                  Sign in to PonsLink
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  Manage your personal link, requests, and meetings.
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="group relative flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm transition hover:border-[#BCD4FF] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-[#6B7280]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[#6B7280]">Signing in...</span>
                  </>
                ) : session ? (
                  <>Continue as {session.displayName}</>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
                  <p className="text-center text-xs text-[#B91C1C]">{error}</p>
                  {error.toLowerCase().includes('origin') || error.toLowerCase().includes('mismatch') ? (
                    <p className="mt-1.5 text-center text-[10px] text-[#6B7280]">
                      Add <code className="text-[#111827]">{window.location.origin}</code> to your Google Cloud Console OAuth authorized origins.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-8 py-4 text-center">
              <p className="text-xs text-[#6B7280]">
                By continuing, you agree to PonsLink's{' '}
                <span className="cursor-pointer text-[#1E63FF] underline-offset-2 hover:underline">Terms</span>
                {' '}and{' '}
                <span className="cursor-pointer text-[#1E63FF] underline-offset-2 hover:underline">Privacy Policy</span>.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[#6B7280]">
            Only Google accounts are supported at this time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
