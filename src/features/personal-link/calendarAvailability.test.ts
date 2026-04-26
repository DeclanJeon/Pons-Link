import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCalendarBusySlots } from './calendarAvailability';

describe('fetchCalendarBusySlots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns busy slots from the calendar API when authorized', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        authorized: true,
        busy: [
          { start: '2026-05-01T13:00:00.000Z', end: '2026-05-01T13:45:00.000Z' },
        ],
      }),
    } as Response);

    const result = await fetchCalendarBusySlots({
      apiUrl: 'http://localhost:6650/',
      start: '2026-05-01T00:00:00.000Z',
      end: '2026-05-15T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/calendar/free-busy?start=2026-05-01T00%3A00%3A00.000Z&end=2026-05-15T00%3A00%3A00.000Z',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual([
      { start: '2026-05-01T13:00:00.000Z', end: '2026-05-01T13:45:00.000Z' },
    ]);
  });

  it('returns an empty list when the calendar is not connected or unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ authorized: false, busy: [] }),
    } as Response);

    await expect(fetchCalendarBusySlots({
      apiUrl: 'http://localhost:6650',
      start: '2026-05-01T00:00:00.000Z',
      end: '2026-05-15T00:00:00.000Z',
    })).resolves.toEqual([]);
  });
});
