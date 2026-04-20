export const JOIN_EARLY_MINUTES = 15;
export const JOIN_LATE_MINUTES = 30;

export const getJoinWindowStart = (scheduledStartAt: string): string => {
  return new Date(new Date(scheduledStartAt).getTime() - JOIN_EARLY_MINUTES * 60_000).toISOString();
};

export const getJoinWindowEnd = (scheduledEndAt: string): string => {
  return new Date(new Date(scheduledEndAt).getTime() + JOIN_LATE_MINUTES * 60_000).toISOString();
};

export const getJoinAccessState = (
  nowIso: string,
  joinWindowStartsAt: string,
  joinWindowEndsAt: string,
): 'waiting' | 'allowed' | 'expired' => {
  const now = new Date(nowIso).getTime();
  const start = new Date(joinWindowStartsAt).getTime();
  const end = new Date(joinWindowEndsAt).getTime();

  if (now < start) return 'waiting';
  if (now > end) return 'expired';
  return 'allowed';
};
