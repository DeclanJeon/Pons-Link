import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, ShieldOff, Trash2, Users } from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';
import { useFriends } from '@/features/personal-link/useFriends';

const LoungeFriends = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const { list, addFriend, blockFriend, removeFriend } = useFriends(repositorySelection);
  const [slug, setSlug] = useState('');

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell contentClassName="max-w-5xl" badges={{ friends: (list.data ?? []).length }}>
        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400">
                <Users className="h-3.5 w-3.5" />
                Trusted contacts
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Friend management</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Manage people you want to see again in conversations and bookings, including blocking or removing them, all in one place.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
              {(list.data ?? []).length} contacts
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-5 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-11 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-teal-300/40 focus:ring-4 focus:ring-teal-300/10"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Friend slug"
            />
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#101114] transition hover:opacity-90"
              onClick={() => void addFriend.mutateAsync(slug).then(() => setSlug(''))}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {(list.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.03] p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">No trusted contacts yet</h2>
                <p className="mt-2 text-sm text-zinc-400">Add a slug to keep repeat visitors easy to find and manage.</p>
              </div>
            ) : (
              (list.data ?? []).map((friend) => (
              <div key={friend.id} className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{friend.friendSlug}</p>
                  <p className="mt-1 text-xs text-zinc-500">{friend.status}</p>
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-zinc-300 transition hover:bg-amber-400/10 hover:text-amber-200" onClick={() => void blockFriend.mutateAsync(friend.id)}>
                    <ShieldOff className="h-4 w-4" />
                    Block
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-zinc-300 transition hover:bg-red-500/10 hover:text-red-200" onClick={() => void removeFriend.mutateAsync(friend.id)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
              ))
            )}
          </div>
        </section>
    </LoungeShell>
  );
};

export default LoungeFriends;
