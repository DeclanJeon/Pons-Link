import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useFriends } from '@/features/personal-link/useFriends';

const LoungeFriends = () => {
  const { session } = useAuthSession();
  const { list, addFriend, blockFriend, removeFriend } = useFriends();
  const [slug, setSlug] = useState('');

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">친구 관리</h1>
      <div className="flex gap-2">
        <input className="flex-1 rounded border p-2" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="상대 slug" />
        <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => void addFriend.mutateAsync(slug).then(() => setSlug(''))}>추가</button>
      </div>
      <div className="space-y-2">
        {(list.data ?? []).map((friend) => (
          <div key={friend.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{friend.friendSlug}</p>
              <p className="text-xs text-muted-foreground">{friend.status}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-2 py-1" onClick={() => void blockFriend.mutateAsync(friend.id)}>차단</button>
              <button className="rounded border px-2 py-1" onClick={() => void removeFriend.mutateAsync(friend.id)}>제거</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoungeFriends;
