import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MailCheck, Send } from 'lucide-react';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/lounge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Lounge
        </Link>
        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                Delivery Board
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">이메일 안내</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">방문자에게 전달된 일정 안내와 접속 링크를 한곳에서 추적합니다.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm text-muted-foreground">
              총 {(deliveries.data ?? []).length}건 발송됨
            </div>
          </div>
        </section>

        {(deliveries.data ?? []).length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border/80 bg-card/70 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">아직 생성된 이메일 안내가 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">예약 상세에서 세션을 준비하면 이메일 안내가 생성됩니다.</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(deliveries.data ?? []).map((delivery) => (
              <div key={delivery.id} className="rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-[0_20px_60px_-35px_rgba(59,130,246,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{delivery.subject}</p>
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-sm text-muted-foreground">
                        <MailCheck className="h-4 w-4" />
                        {delivery.recipientEmail}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {delivery.calendarSummary}</p>
                      <p className="break-all">링크: {delivery.joinUrl}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:min-w-52">
                    <div className="inline-flex w-fit rounded-full border border-border/70 bg-background/80 px-3 py-1">상태 · {delivery.deliveryStatus}</div>
                    <div className="rounded-2xl bg-muted/60 px-3 py-2">생성 {delivery.createdAt}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default LoungeEmailDeliveries;
