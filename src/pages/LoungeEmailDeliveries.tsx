import { Navigate } from 'react-router-dom';
import { CalendarDays, MailCheck, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { useEmailDeliveries } from '@/features/personal-link/useEmailDeliveries';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

const LoungeEmailDeliveries = () => {
  const { t } = useTranslation();
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const bookings = useBookings(undefined, repositorySelection);
  const deliveries = useEmailDeliveries((bookings.list.data ?? []).map((booking) => booking.id), repositorySelection);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell>
        <section className="rounded-lg border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                {t('lounge.emailDeliveriesPage.eyebrow')}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('lounge.emailDeliveriesPage.title')}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('lounge.emailDeliveriesPage.description')}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-muted-foreground">
              {t('lounge.emailDeliveriesPage.sentCount', { count: (deliveries.data ?? []).length })}
            </div>
          </div>
        </section>

        {(deliveries.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-foreground">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t('lounge.emailDeliveriesPage.emptyTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('lounge.emailDeliveriesPage.emptyDescription')}</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(deliveries.data ?? []).map((delivery) => (
              <div key={delivery.id} className="rounded-lg border border-border/70 bg-white p-5 text-foreground shadow-[0_18px_55px_-45px_rgba(15,23,42,0.5)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{delivery.subject}</p>
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-sm text-muted-foreground">
                        <MailCheck className="h-4 w-4" />
                        {delivery.recipientEmail}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {delivery.calendarSummary}</p>
                      <p className="break-all">{t('lounge.emailDeliveriesPage.link', { url: delivery.joinUrl })}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:min-w-52">
                    <div className="inline-flex w-fit rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1">{t('lounge.emailDeliveriesPage.status', { status: delivery.deliveryStatus })}</div>
                    <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">{t('lounge.emailDeliveriesPage.created', { date: delivery.createdAt })}</div>
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
