import { Link, Navigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useFriends } from '@/features/personal-link/useFriends';
import { useRequests } from '@/features/personal-link/useRequests';
import { useBookings } from '@/features/personal-link/useBookings';
import { useMyProfile } from '@/features/personal-link/useMyProfile';

const Lounge = () => {
  const { session, logout } = useAuthSession();
  const friends = useFriends();
  const requests = useRequests('pending');
  const bookings = useBookings('confirmed');
  const profile = useMyProfile();

  if (!session) return <Navigate to="/login" replace />;

  const slug = profile.bootstrap.data?.publicProfile?.slug ?? '';
  const displayName = profile.bootstrap.data?.accountProfile?.displayName ?? session.displayName;
  const image = profile.bootstrap.data?.accountProfile?.profileImageUrl ?? '';

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {image ? <img src={image} alt={displayName} className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full border bg-muted" />}
          <div>
            <h1 className="text-2xl font-bold">라운지</h1>
            <p className="text-sm text-muted-foreground">{displayName || '프로필 설정 필요'}</p>
          </div>
        </div>
        <button className="rounded border px-3 py-2" onClick={logout}>로그아웃</button>
      </div>
      <div className="rounded border p-4">
        <p className="text-sm text-muted-foreground">내 링크</p>
        <p className="font-medium">{slug ? `${window.location.origin}/u/${slug}` : '온보딩 필요'}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4">친구 수: {friends.list.data?.length ?? 0}</div>
        <div className="rounded border p-4">대기 요청: {requests.data?.length ?? 0}</div>
        <div className="rounded border p-4">예약 수: {bookings.list.data?.length ?? 0}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded border px-3 py-2" to="/lounge/profile">프로필 관리</Link>
        <Link className="rounded border px-3 py-2" to="/lounge/friends">친구 관리</Link>
        <Link className="rounded border px-3 py-2" to="/lounge/requests">요청함</Link>
        <Link className="rounded border px-3 py-2" to="/lounge/bookings">예약</Link>
        <Link className="rounded border px-3 py-2" to="/lounge/email-deliveries">이메일 안내</Link>
        {slug ? <Link className="rounded border px-3 py-2" to={`/u/${slug}`}>공개 링크 보기</Link> : null}
      </div>
    </div>
  );
};

export default Lounge;
