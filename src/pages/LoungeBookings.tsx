import { Link, Navigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useBookings } from '@/features/personal-link/useBookings';

const LoungeBookings = () => {
  const { session } = useAuthSession();
  const bookings = useBookings();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">예약</h1>
      {(bookings.list.data ?? []).map((booking) => (
        <Link key={booking.id} to={`/lounge/bookings/${booking.id}`} className="rounded border p-4">
          <p className="font-medium">{booking.guestDisplayName}</p>
          <p className="text-sm text-muted-foreground">{booking.roomType} · {booking.status}</p>
          <p className="text-sm">{booking.scheduledStartAt}</p>
        </Link>
      ))}
    </div>
  );
};

export default LoungeBookings;
