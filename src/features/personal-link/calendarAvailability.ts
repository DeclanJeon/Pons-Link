interface FetchCalendarBusySlotsOptions {
  apiUrl?: string | null;
  start: string;
  end: string;
}

const resolveCalendarApiUrl = (apiUrl?: string | null) => {
  const value = apiUrl?.trim();
  return value ? value.replace(/\/$/, '') : null;
};

export const fetchCalendarBusySlots = async ({
  apiUrl,
  start,
  end,
}: FetchCalendarBusySlotsOptions): Promise<Array<{ start: string; end: string }>> => {
  const baseUrl = resolveCalendarApiUrl(apiUrl);
  if (!baseUrl) return [];

  try {
    const params = new URLSearchParams({ start, end });
    const response = await fetch(`${baseUrl}/api/calendar/free-busy?${params.toString()}`, {
      method: 'GET',
    });
    if (!response.ok) return [];
    const payload = await response.json() as { authorized?: boolean; busy?: Array<{ start: string; end: string }> };
    return payload.authorized ? payload.busy ?? [] : [];
  } catch {
    return [];
  }
};
