import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Inbox, MessageSquareText, UserRound } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequests, useExpireRequests } from '@/features/personal-link/useRequests';
import { useEffect } from 'react';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeRequests = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const requests = useRequests(undefined, repositorySelection);
  const expireRequests = useExpireRequests(apiUrl);

  useEffect(() => {
    if (repository.kind === 'remote') {
      return;
    }

    void expireRequests.mutateAsync();
  }, [expireRequests, repository.kind]);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_26%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-border/70 bg-card/75 px-4 py-3 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <p className="hidden text-xs text-muted-foreground sm:block">Personal link workspace</p>
          </div>
          <Link to="/lounge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Lounge
          </Link>
        </div>
        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Inbox className="h-3.5 w-3.5" />
                Request inbox
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Requests</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Read why visitors want to connect first, then choose to accept, suggest an alternative time, or decline.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm text-muted-foreground">
              {(requests.data ?? []).length} requests total.
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/lounge/conversations" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
              <MessageSquareText className="h-4 w-4" />
              Communication History
            </Link>
            <Link to="/lounge/aliases" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
              <UserRound className="h-4 w-4" />
              Alias Management
            </Link>
          </div>
        </section>

        {(requests.data ?? []).length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border/80 bg-card/70 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No requests yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Share your public link so visitors can leave their purpose and preferred time.</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(requests.data ?? []).map((request) => (
              <Link key={request.id} to={`/lounge/requests/${request.id}`} className="group rounded-[24px] border border-border/70 bg-card/80 p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_60px_-35px_rgba(99,102,241,0.45)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{request.visitorName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{request.visitorEmail}</p>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-foreground/90">{request.message}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:min-w-52">
                    <div className="inline-flex w-fit rounded-full border border-border/70 bg-background/80 px-3 py-1">
                      {request.requestType} · {request.status}
                    </div>
                    {request.expiresAt ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2">
                        <CalendarClock className="h-4 w-4" />
                        Expires {request.expiresAt}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default LoungeRequests;
