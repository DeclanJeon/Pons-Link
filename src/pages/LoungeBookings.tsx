import { Link, Navigate } from 'react-router-dom';
import { CalendarCheck2, CalendarRange, RadioTower } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeBookings = () => {
  const { t } = useTranslation();
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const bookings = useBookings(undefined, repositorySelection);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell badges={{ bookings: (bookings.list.data ?? []).length }}>
        <section className="rounded-lg border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <CalendarCheck2 className="h-3.5 w-3.5" />
                {t('bookings.board')}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{t('lounge.bookingsPage.title')}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('lounge.bookingsPage.description')}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-muted-foreground">
              {t('lounge.bookingsPage.count', { count: (bookings.list.data ?? []).length })}
            </div>
          </div>
        </section>

        {(bookings.list.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-foreground">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
              <CalendarRange className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t('lounge.bookingsPage.emptyTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('lounge.bookingsPage.emptyDescription')}</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(bookings.list.data ?? []).map((booking) => (
              <Link key={booking.id} to={`/lounge/bookings/${booking.id}`} className="group rounded-lg border border-border/70 bg-white p-5 text-foreground shadow-[0_18px_55px_-45px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-[#1E63FF]/30 hover:shadow-[0_24px_70px_-48px_rgba(30,99,255,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{booking.guestDisplayName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{booking.guestEmail}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-sm text-muted-foreground">
                      <RadioTower className="h-4 w-4" />
                      {booking.roomType}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:min-w-60">
                    <div className="inline-flex w-fit rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1">
                      {t('lounge.bookingsPage.status', { status: booking.status })}
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                      {t('lounge.bookingsPage.starts', { date: booking.scheduledStartAt })}
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
