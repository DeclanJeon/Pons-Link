import { Link, Navigate } from 'react-router-dom';
import { CalendarCheck2, CalendarRange, RadioTower } from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeBookings = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const bookings = useBookings(undefined, repositorySelection);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell badges={{ bookings: (bookings.list.data ?? []).length }}>
        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <CalendarCheck2 className="h-3.5 w-3.5" />
                Reservation board
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Reservations</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Track confirmed appointments, session readiness, and rescheduling needs in one place.</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
              {(bookings.list.data ?? []).length} reservations.
            </div>
          </div>
        </section>

        {(bookings.list.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.12] bg-[#111216]/70 p-10 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
              <CalendarRange className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No confirmed reservations yet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Accept a request to create a booking, then proceed to session prep and email guidance.</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(bookings.list.data ?? []).map((booking) => (
              <Link key={booking.id} to={`/lounge/bookings/${booking.id}`} className="group rounded-lg border border-white/[0.08] bg-[#111216]/80 p-5 text-white transition hover:-translate-y-0.5 hover:border-teal-300/30 hover:bg-[#15171d] hover:shadow-[0_20px_60px_-35px_rgba(20,184,166,0.45)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{booking.guestDisplayName}</p>
                      <p className="mt-1 text-sm text-zinc-400">{booking.guestEmail}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-zinc-400">
                      <RadioTower className="h-4 w-4" />
                      {booking.roomType}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-zinc-400 lg:min-w-60">
                    <div className="inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
                      Status · {booking.status}
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                      Starts {booking.scheduledStartAt}
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

export default LoungeBookings;
