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
        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400">
                <MessageSquareText className="h-3.5 w-3.5" />
                Communication History
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Conversation history</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  View requests and bookings as one counterpart history instead of separate tools, and move straight to the next action.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-zinc-400">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Total</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conversations.counts.total}</p>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Requests</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conversations.counts.requests}</p>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Reservations</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conversations.counts.reservations}</p>
              </div>
            </div>
          </div>
        </section>

        {conversations.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.12] bg-[#111216]/70 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No conversations recorded yet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Once your public link is live and the first request arrives, you can track request and booking history together here.
            </p>
          </div>
        ) : (
          <section className="grid gap-4">
            {conversations.items.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="group rounded-lg border border-white/[0.08] bg-[#111216]/80 p-5 text-white transition hover:-translate-y-0.5 hover:border-teal-300/30 hover:bg-[#15171d] hover:shadow-[0_20px_60px_-35px_rgba(20,184,166,0.45)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
                        {item.kind === 'request' ? (
                          <MessageSquareText className="h-4 w-4" />
                        ) : (
                          <CalendarDays className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold tracking-tight">{item.title}</p>
                        <p className="mt-1 truncate text-sm text-zinc-400">{item.counterpart}</p>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-zinc-300">{item.summary}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-zinc-400 lg:min-w-64 lg:items-end">
                    <div className="inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
                      {item.meta} · {item.statusLabel}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
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
