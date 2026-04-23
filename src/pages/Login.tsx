import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithGoogle, GoogleAuthError } from '@/features/personal-link/googleAuth';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import { supportsSessionAuthAtApiUrl } from '@/features/personal-link/backendSurface';
import type { AuthSession, UserProfile } from '@/features/personal-link/types';
import { nanoid } from 'nanoid';

type BackendAuthResponse = {
  error?: string;
  session?: {
    token?: string;
  };
};

const getBackendSessionToken = async (apiUrl: string, idToken: string): Promise<string> => {
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

  return payload.session.token;
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
      const sessionToken = supportsBackendSession && apiUrl
        ? await getBackendSessionToken(apiUrl, googleUser.idToken)
        : undefined;
      const newSession: AuthSession = {
        userId: nanoid(),
        providerSubject: googleUser.providerSubject,
        email: googleUser.email,
        displayName: googleUser.displayName,
        avatarUrl: googleUser.avatarUrl,
        sessionToken,
        loggedInAt: new Date().toISOString(),
      };
      setSession(newSession);
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
    <div
      className="flex min-h-screen flex-col bg-[#080808] text-white"
      style={{ backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(99,102,241,0.14), transparent)' }}
    >
      {/* Top gradient line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Nav */}
      <nav className="flex h-14 items-center justify-between px-6 lg:px-10">
        <Link to="/" className="flex cursor-pointer items-center gap-3">
          <img
            src="/logo.svg"
            alt="PonsLink"
            className="h-8 w-auto drop-shadow-[0_10px_24px_rgba(99,102,241,0.16)]"
            loading="eager"
          />
        </Link>
        <Link to="/" className="text-sm text-zinc-600 transition hover:text-zinc-300">
          ← Back
        </Link>
      </nav>

      {/* Main */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D0D0D]">
            {/* Card top accent */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

            <div className="p-8">
              {/* Logo mark */}
              <div className="mb-8 flex justify-center">
                <img
                  src="/logo.svg"
                  alt="PonsLink"
                  className="h-12 w-auto drop-shadow-[0_14px_32px_rgba(99,102,241,0.18)]"
                  loading="eager"
                />
              </div>

              <div className="mb-8 text-center">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Sign in to PonsLink
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Manage your personal link, requests, and bookings.
                </p>
              </div>

              {/* Sign in button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="group relative flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:border-white/[0.16] hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-zinc-400">Signing in...</span>
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

              {/* Error */}
              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3">
                  <p className="text-center text-xs text-red-400">{error}</p>
                  {error.toLowerCase().includes('origin') || error.toLowerCase().includes('mismatch') ? (
                    <p className="mt-1.5 text-center text-[10px] text-zinc-600">
                      Add <code className="text-zinc-500">{window.location.origin}</code> to your Google Cloud Console OAuth authorized origins.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Card footer */}
            <div className="border-t border-white/[0.06] px-8 py-4 text-center">
              <p className="text-xs text-zinc-600">
                By continuing, you agree to PonsLink's{' '}
                <span className="text-zinc-500 underline-offset-2 hover:underline cursor-pointer">Terms</span>
                {' '}and{' '}
                <span className="text-zinc-500 underline-offset-2 hover:underline cursor-pointer">Privacy Policy</span>.
              </p>
            </div>
          </div>

          {/* Below card */}
          <p className="mt-6 text-center text-xs text-zinc-700">
            Only Google accounts are supported at this time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
