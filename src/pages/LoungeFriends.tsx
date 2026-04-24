import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, MessageSquareText, UserRound, Users } from 'lucide-react';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-border/70 bg-card/75 px-4 py-3 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <p className="hidden text-xs text-muted-foreground sm:block">Trusted counterpart network</p>
          </div>
          <Link to="/lounge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Lounge
          </Link>
        </div>

        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Trusted contacts
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Friend management</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Manage people you want to see again in conversations and bookings, including blocking or removing them, all in one place.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/lounge/conversations" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
                <MessageSquareText className="h-4 w-4" />
                Communication History
              </Link>
              <Link to="/lounge/aliases" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
                <UserRound className="h-4 w-4" />
                Alias Management
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Friend slug"
            />
            <button
              className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
              onClick={() => void addFriend.mutateAsync(slug).then(() => setSlug(''))}
            >
              Add
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {(list.data ?? []).map((friend) => (
              <div key={friend.id} className="flex items-center justify-between rounded-[24px] border border-border/70 bg-background/70 p-4">
                <div>
                  <p className="font-medium">{friend.friendSlug}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{friend.status}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-full border px-3 py-2 text-sm" onClick={() => void blockFriend.mutateAsync(friend.id)}>Block</button>
                  <button className="rounded-full border px-3 py-2 text-sm" onClick={() => void removeFriend.mutateAsync(friend.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoungeFriends;
