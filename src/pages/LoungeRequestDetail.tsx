import { Navigate, useParams } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequestDetail } from '@/features/personal-link/useRequestDetail';
import { useFriends } from '@/features/personal-link/useFriends';
import { useState } from 'react';

const LoungeRequestDetail = () => {
  const { session } = useAuthSession();
  const { requestId = '' } = useParams();
  const { detail, accept, counter, decline } = useRequestDetail(requestId);
  const { list, blockFriend } = useFriends();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('audio-one-to-one');
  const [message, setMessage] = useState('');

  if (!session) return <Navigate to="/login" replace />;
  if (!detail.data) return <div className="p-6">요청을 찾을 수 없습니다.</div>;

  const isBlocked = (list.data ?? []).some((friend) => friend.friendSlug === detail.data.visitorEmail.toLowerCase() && friend.status === 'blocked');

  const payload = () => ({
    proposedStartAt: new Date(start).toISOString(),
    proposedEndAt: new Date(end).toISOString(),
    roomType,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">요청 상세</h1>
      <p>{detail.data.visitorName}</p>
      <p className="text-sm text-muted-foreground">{detail.data.visitorEmail}</p>
      <p>{detail.data.message}</p>
      <p className="text-sm text-muted-foreground">상태: {detail.data.status}</p>
      {isBlocked ? <div className="rounded border border-destructive p-3 text-sm text-destructive">차단된 상대입니다. 새 예약을 만들 수 없습니다.</div> : null}
      <input type="datetime-local" className="rounded border p-2" value={start} onChange={(e) => setStart(e.target.value)} />
      <input type="datetime-local" className="rounded border p-2" value={end} onChange={(e) => setEnd(e.target.value)} />
      <select className="rounded border p-2" value={roomType} onChange={(e) => setRoomType(e.target.value as 'audio-one-to-one' | 'video-one-to-one')}>
        <option value="audio-one-to-one">1:1 오디오</option>
        <option value="video-one-to-one">1:1 화상</option>
      </select>
      <div className="flex gap-2">
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={isBlocked} onClick={() => void accept.mutateAsync(payload()).then(() => setMessage('요청을 수락했습니다.'))}>수락</button>
        <button className="rounded border px-4 py-2" disabled={isBlocked} onClick={() => void counter.mutateAsync(payload()).then(() => setMessage('대체 시간을 제안했습니다.'))}>대체 시간 제안</button>
        <button className="rounded border px-4 py-2" onClick={() => void decline.mutateAsync().then(() => setMessage('요청을 거절했습니다.'))}>거절</button>
        <button
          className="rounded border px-4 py-2"
          onClick={() => {
            const target = (list.data ?? []).find((friend) => friend.friendSlug === detail.data.visitorEmail.toLowerCase());
            if (target) {
              void blockFriend.mutateAsync(target.id).then(() => setMessage('친구를 차단했습니다.'));
            } else {
              setMessage('현재 친구 목록에 없는 상대입니다.');
            }
          }}
        >
          친구 차단
        </button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
};

export default LoungeRequestDetail;
