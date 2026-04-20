import { Navigate, useParams } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';
import { useState } from 'react';
import { useSessionReservation } from '@/features/personal-link/useSessionReservation';
import { useBookingDetail } from '@/features/personal-link/useBookingDetail';
import { useEmailDelivery } from '@/features/personal-link/useEmailDeliveries';

const LoungeBookingDetail = () => {
  const { session } = useAuthSession();
  const { bookingId = '' } = useParams();
  const [message, setMessage] = useState('');
  const { createReservation, createEmailDelivery, resendEmailDelivery } = useSessionReservation();
  const { cancelBooking, markNoShow, markRescheduleNeeded } = useBookings();
  const { detail, reservation } = useBookingDetail(bookingId);
  const delivery = useEmailDelivery(bookingId);
  const booking = detail.data;

  if (!session) return <Navigate to="/login" replace />;
  if (!booking) return <div className="p-6">예약을 찾을 수 없습니다.</div>;

  const prepare = async () => {
    await createReservation.mutateAsync(bookingId);
    await createEmailDelivery.mutateAsync(bookingId);
    setMessage('세션 예약과 이메일 안내를 생성했습니다.');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">예약 상세</h1>
      <p>{booking.guestDisplayName}</p>
      <p>{booking.guestEmail}</p>
      <p>{booking.roomType}</p>
      <p>{booking.scheduledStartAt}</p>
      <p className="text-sm text-muted-foreground">상태: {booking.status}</p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={() => void prepare()}>세션 준비</button>
        <button className="rounded border px-4 py-2" onClick={() => void cancelBooking.mutateAsync({ id: bookingId, actor: 'host', reason: 'host_cancelled' }).then(() => setMessage('예약을 취소했습니다.'))}>취소</button>
        <button className="rounded border px-4 py-2" onClick={() => void markNoShow.mutateAsync({ id: bookingId, actor: 'host' }).then(() => setMessage('no-show로 기록했습니다.'))}>노쇼 처리</button>
        <button className="rounded border px-4 py-2" onClick={() => void markRescheduleNeeded.mutateAsync({ id: bookingId, actor: 'host' }).then(() => setMessage('재조율이 필요합니다.'))}>재조율 필요</button>
        <button className="rounded border px-4 py-2" onClick={() => void resendEmailDelivery.mutateAsync(bookingId).then(() => setMessage('최신 링크로 이메일 안내를 재생성했습니다.'))}>이메일 재발송</button>
      </div>
      {reservation.data ? <a className="text-primary underline" href={`/session-access/${bookingId}`}>세션 입장 확인</a> : null}
      {delivery.data ? (
        <div className="rounded border p-4 text-sm">
          <p>수신 이메일: {delivery.data.recipientEmail}</p>
          <p>캘린더 요약: {delivery.data.calendarSummary}</p>
          <p>접속 링크: {delivery.data.joinUrl}</p>
          <p>상태: {delivery.data.deliveryStatus}</p>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
};

export default LoungeBookingDetail;
