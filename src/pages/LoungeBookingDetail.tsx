import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, CheckCircle2, Mail, RadioTower, RefreshCcw, ShieldAlert, TimerReset, UserRound, XCircle } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { useState } from 'react';
import { useSessionReservation } from '@/features/personal-link/useSessionReservation';
import { useBookingDetail } from '@/features/personal-link/useBookingDetail';
import { useEmailDelivery } from '@/features/personal-link/useEmailDeliveries';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeBookingDetail = () => {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const { bookingId = '' } = useParams();
  const [message, setMessage] = useState('');
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const { createReservation, createEmailDelivery, resendEmailDelivery } = useSessionReservation(repositorySelection);
  const { cancelBooking, markNoShow, markRescheduleNeeded } = useBookings(undefined, repositorySelection);
  const { detail, reservation } = useBookingDetail(bookingId, repositorySelection);
  const delivery = useEmailDelivery(bookingId, repositorySelection);
  const booking = detail.data;
  const isRemoteSurface = repository.kind === 'remote';

  if (!session) return <Navigate to="/login" replace />;
  if (!booking) return <div className="p-6">Booking not found.</div>;

  const prepare = async () => {
    await createReservation.mutateAsync(bookingId);
    await createEmailDelivery.mutateAsync(bookingId);
    setMessage('Session reservation and email guidance created.');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                Booking Detail
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">{booking.guestDisplayName}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
                      <Mail className="h-4 w-4" />
                      {booking.guestEmail}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
                      <RadioTower className="h-4 w-4" />
                      {booking.roomType} · {booking.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Start</p>
                  <p className="mt-3 text-sm leading-6">{booking.scheduledStartAt}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">End</p>
                  <p className="mt-3 text-sm leading-6">{booking.scheduledEndAt}</p>
                </div>
              </div>

              {delivery.data ? (
                <div className="rounded-[24px] border border-border/70 bg-background/75 p-5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">Email guidance</h2>
                    <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">{delivery.data.deliveryStatus}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-muted-foreground">
                    <p>Recipient: {delivery.data.recipientEmail}</p>
                    <p>Calendar summary: {delivery.data.calendarSummary}</p>
                    <p className="break-all">Join link: {delivery.data.joinUrl}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/85 p-5 sm:p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">operations</p>
                <h2 className="text-2xl font-semibold tracking-tight">Session operations</h2>
                <p className="text-sm leading-6 text-muted-foreground">Change booking status, prepare the session, or resend email guidance.</p>
              </div>

              <div className="mt-5 grid gap-3">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90" onClick={() => void prepare()}>
                  <CheckCircle2 className="h-4 w-4" />
                  Prepare session
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent" onClick={() => void resendEmailDelivery.mutateAsync(bookingId).then(() => setMessage('Email guidance regenerated with the latest link.'))}>
                  <RefreshCcw className="h-4 w-4" />
                  Resend email
                </button>
                {isRemoteSurface ? (
                  <p className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Booking status change actions are currently hidden on this screen because they are not yet exposed in the remote backend lounge.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent" onClick={() => void markRescheduleNeeded.mutateAsync({ id: bookingId, actor: 'host' }).then(() => setMessage('Rescheduling needed.'))}>
                        <TimerReset className="h-4 w-4" />
                        Reschedule needed
                      </button>
                      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent" onClick={() => void markNoShow.mutateAsync({ id: bookingId, actor: 'host' }).then(() => setMessage('Recorded as no-show.'))}>
                        <ShieldAlert className="h-4 w-4" />
                        Mark no-show
                      </button>
                    </div>
                    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent" onClick={() => void cancelBooking.mutateAsync({ id: bookingId, actor: 'host', reason: 'host_cancelled' }).then(() => setMessage('Booking cancelled.'))}>
                      <XCircle className="h-4 w-4" />
                      Cancel booking
                    </button>
                  </>
                )}
              </div>

              {reservation.data?.joinPath ? (
                <a className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/15" href={reservation.data.joinPath}>
                  Check session entry
                </a>
              ) : null}

              {message ? <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoungeBookingDetail;
