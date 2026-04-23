import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { SessionAccessResult } from '@/features/personal-link/types';

const SessionAccess = () => {
  const { reservationId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') ?? undefined;
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const [result, setResult] = useState<SessionAccessResult | null>(null);

  useEffect(() => {
    void repository.getSessionAccess(reservationId, accessToken).then(setResult);
  }, [accessToken, repository, reservationId]);

  if (!result) return <div className="p-6">세션 접근 확인 중...</div>;
  if (result.state === 'allowed' && result.reservation) return <Navigate to={result.reservation.joinPath} replace />;
  if (result.state === 'email_mismatch') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">이메일이 일치하지 않습니다</h1>
        <p>안내 이메일에 포함된 최신 게스트 링크로 다시 접속하세요.</p>
        <p className="text-sm text-muted-foreground">예약 이메일: {result.reservation?.guestEmail ?? '확인 불가'}</p>
        <div className="flex flex-col gap-2">
          <Link className="rounded border px-3 py-2 text-center" to="/">홈으로 이동</Link>
          <p className="text-xs text-muted-foreground">필요하면 Host에게 최신 안내 메일을 다시 요청하세요.</p>
        </div>
      </div>
    );
  }
  if (result.state === 'unauthenticated') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">접속 토큰이 필요합니다</h1>
        <p>안내 이메일의 세션 링크로 다시 접속하세요.</p>
        <p className="text-sm text-muted-foreground">링크가 오래되었거나 토큰이 누락된 경우 Host에게 재안내를 요청하세요.</p>
      </div>
    );
  }
  if (result.state === 'waiting') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">아직 입장 시간이 아닙니다</h1>
        <p>예약 시간에 맞춰 다시 접속하세요.</p>
        <p className="text-sm text-muted-foreground">안내 메일의 일정 정보와 캘린더 시간을 다시 확인해 주세요.</p>
      </div>
    );
  }
  if (result.state === 'expired') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">입장 가능 시간이 지났습니다</h1>
        <p>재조율이 필요합니다.</p>
        <p className="text-sm text-muted-foreground">Host가 새 시간으로 다시 안내하면 최신 링크로 접속할 수 있습니다.</p>
        <Link className="rounded border px-3 py-2 text-center" to="/login">로그인으로 돌아가기</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">세션 정보를 찾을 수 없습니다</h1>
      <p>안내 이메일에 포함된 최신 링크로 다시 접속하세요.</p>
      <p className="text-sm text-muted-foreground">토큰이 없거나 만료된 링크라면 Host에게 재안내를 요청하세요.</p>
    </div>
  );
};

export default SessionAccess;
