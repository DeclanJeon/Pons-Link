import { Navigate, Link } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequests, useExpireRequests } from '@/features/personal-link/useRequests';
import { useEffect } from 'react';

const LoungeRequests = () => {
  const { session } = useAuthSession();
  const requests = useRequests();
  const expireRequests = useExpireRequests();

  useEffect(() => {
    void expireRequests.mutateAsync();
  }, [expireRequests]);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">요청함</h1>
      {(requests.data ?? []).map((request) => (
        <Link key={request.id} to={`/lounge/requests/${request.id}`} className="rounded border p-4">
          <p className="font-medium">{request.visitorName}</p>
          <p className="text-sm text-muted-foreground">{request.requestType} · {request.status}</p>
          <p className="text-sm">{request.message}</p>
          {request.expiresAt ? <p className="text-xs text-muted-foreground">만료 예정: {request.expiresAt}</p> : null}
        </Link>
      ))}
    </div>
  );
};

export default LoungeRequests;
