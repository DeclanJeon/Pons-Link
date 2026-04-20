import { Navigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { useEmailDeliveries } from '@/features/personal-link/useEmailDeliveries';

const LoungeEmailDeliveries = () => {
  const { session } = useAuthSession();
  const bookings = useBookings();
  const deliveries = useEmailDeliveries((bookings.list.data ?? []).map((booking) => booking.id));

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">이메일 안내</h1>
      {(deliveries.data ?? []).length === 0 ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">아직 생성된 이메일 안내가 없습니다.</div>
      ) : null}
      {(deliveries.data ?? []).map((delivery) => (
        <div key={delivery.id} className="rounded border p-4 text-sm">
          <p className="font-medium">{delivery.subject}</p>
          <p>수신: {delivery.recipientEmail}</p>
          <p>캘린더: {delivery.calendarSummary}</p>
          <p className="break-all">링크: {delivery.joinUrl}</p>
          <p>상태: {delivery.deliveryStatus}</p>
          <p className="text-xs text-muted-foreground">생성: {delivery.createdAt}</p>
        </div>
      ))}
    </div>
  );
};

export default LoungeEmailDeliveries;
