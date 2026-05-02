import { Navigate } from 'react-router-dom';
import { CalendarDays, MailCheck, Send } from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { useEmailDeliveries } from '@/features/personal-link/useEmailDeliveries';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeEmailDeliveries = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const bookings = useBookings(undefined, repositorySelection);
  const deliveries = useEmailDeliveries((bookings.list.data ?? []).map((booking) => booking.id), repositorySelection);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell>
        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400">
                <Send className="h-3.5 w-3.5" />
                Delivery Board
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Email guidance</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Track schedule notifications and join links sent to visitors in one place.</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
              {(deliveries.data ?? []).length} sent
            </div>
          </div>
        </section>

        {(deliveries.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.12] bg-[#111216]/70 p-10 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No email guidance created yet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Email guidance is created when you prepare a session from the booking detail.</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(deliveries.data ?? []).map((delivery) => (
              <div key={delivery.id} className="rounded-lg border border-white/[0.08] bg-[#111216]/80 p-5 text-white shadow-[0_20px_60px_-35px_rgba(20,184,166,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{delivery.subject}</p>
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-zinc-400">
                        <MailCheck className="h-4 w-4" />
                        {delivery.recipientEmail}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-400">
                      <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {delivery.calendarSummary}</p>
                      <p className="break-all">Link: {delivery.joinUrl}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-zinc-400 lg:min-w-52">
                    <div className="inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">Status · {delivery.deliveryStatus}</div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">Created {delivery.createdAt}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
    </LoungeShell>
  );
};

export default LoungeEmailDeliveries;
