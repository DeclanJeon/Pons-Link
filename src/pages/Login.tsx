import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, GoogleAuthError } from '@/features/personal-link/googleAuth';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { AuthSession, UserProfile } from '@/features/personal-link/types';
import { nanoid } from 'nanoid';

const Login = () => {
  const navigate = useNavigate();
  const repository = usePersonalLinkRepository();
  const { setSession } = useAuthSession();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const googleUser = await signInWithGoogle();
      const session: AuthSession = {
        userId: nanoid(),
        providerSubject: googleUser.providerSubject,
        email: googleUser.email,
        displayName: googleUser.displayName,
        avatarUrl: googleUser.avatarUrl,
        loggedInAt: new Date().toISOString(),
      };
      setSession(session);
      const existing = await repository.getAuthBootstrapProfile(googleUser.email);
      if (!existing.userProfile) {
        const userProfile: UserProfile = {
          userId: session.userId,
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
      if (err instanceof GoogleAuthError) setError(err.message);
      else setError('Google 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">PonsLink 로그인</h1>
      <p className="text-sm text-muted-foreground">Google 계정으로만 로그인할 수 있습니다.</p>
      <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={handleLogin} disabled={loading}>
        {loading ? '로그인 중...' : 'Google로 계속하기'}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
};

export default Login;
