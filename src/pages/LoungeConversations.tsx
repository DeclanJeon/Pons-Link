import { Link, Navigate } from 'react-router-dom';
import { CalendarDays, MessageSquareText, RadioTower } from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useConversations } from '@/features/personal-link/useConversations';

const LoungeConversations = () => {
  const { session } = useAuthSession();
  const conversations = useConversations();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell badges={{ conversations: conversations.counts.total }}>
        <section className="rounded-lg border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5" />
                Communication History
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Conversation history</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  View requests and bookings as one counterpart history instead of separate tools, and move straight to the next action.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{conversations.counts.total}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Requests</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{conversations.counts.requests}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Reservations</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{conversations.counts.reservations}</p>
              </div>
            </div>
          </div>
        </section>

        {conversations.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No conversations recorded yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Once your public link is live and the first request arrives, you can track request and booking history together here.
            </p>
          </div>
        ) : (
          <section className="grid gap-4">
            {conversations.items.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="group rounded-lg border border-border/70 bg-white p-5 text-foreground shadow-[0_18px_55px_-45px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-[#1E63FF]/30 hover:shadow-[0_24px_70px_-48px_rgba(30,99,255,0.35)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
                        {item.kind === 'request' ? (
                          <MessageSquareText className="h-4 w-4" />
                        ) : (
                          <CalendarDays className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold tracking-tight">{item.title}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{item.counterpart}</p>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:min-w-64 lg:items-end">
                    <div className="inline-flex w-fit rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1">
                      {item.meta} · {item.statusLabel}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
                      <RadioTower className="h-4 w-4" />
                      {item.kind === 'request' ? 'Open request thread' : 'Open reservation detail'}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
    </LoungeShell>
  );
};

export default LoungeConversations;
