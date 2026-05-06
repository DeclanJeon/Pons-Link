import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, ShieldOff, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';
import { useFriends } from '@/features/personal-link/useFriends';

const LoungeFriends = () => {
  const { t } = useTranslation();
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const { list, addFriend, blockFriend, removeFriend } = useFriends(repositorySelection);
  const [slug, setSlug] = useState('');

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell contentClassName="max-w-5xl" badges={{ friends: (list.data ?? []).length }}>
        <section className="rounded-lg border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t('lounge.friendsPage.eyebrow')}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('lounge.friendsPage.title')}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('lounge.friendsPage.description')}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-muted-foreground">
              {t('lounge.friendsPage.contactsCount', { count: (list.data ?? []).length })}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-white p-5 shadow-[0_18px_55px_-45px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-11 flex-1 rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('lounge.friendsPage.friendSlug')}
            />
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1E63FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#174fd1]"
              onClick={() => void addFriend.mutateAsync(slug).then(() => setSlug(''))}
            >
              <Plus className="h-4 w-4" />
              {t('common.add')}
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {(list.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-[#F8FAFC] p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{t('lounge.friendsPage.emptyTitle')}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t('lounge.friendsPage.emptyDescription')}</p>
              </div>
            ) : (
              (list.data ?? []).map((friend) => (
              <div key={friend.id} className="flex flex-col gap-4 rounded-lg border border-border/70 bg-[#F8FAFC] p-4 text-foreground sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{friend.friendSlug}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{friend.status}</p>
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition hover:bg-amber-50 hover:text-amber-700" onClick={() => void blockFriend.mutateAsync(friend.id)}>
                    <ShieldOff className="h-4 w-4" />
                    {t('lounge.friendsPage.block')}
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition hover:bg-red-50 hover:text-red-700" onClick={() => void removeFriend.mutateAsync(friend.id)}>
                    <Trash2 className="h-4 w-4" />
                    {t('lounge.friendsPage.remove')}
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
