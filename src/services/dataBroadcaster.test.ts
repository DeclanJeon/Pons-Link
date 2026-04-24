import { describe, expect, it, vi } from 'vitest';
import { createBroadcaster } from './dataBroadcaster';

describe('createBroadcaster', () => {
  it('pauses binary draining while the transport is congested and resumes later', () => {
    vi.useFakeTimers();
    const sender = vi.fn();
    const shouldSend = vi.fn().mockReturnValue(false);
    const broadcaster = createBroadcaster(sender, { tickMs: 10, maxBytesPerSec: 1024, burstBytes: 1024, shouldSend });

    expect(broadcaster.enqueue(new Uint8Array([1, 2, 3]).buffer)).toBe(true);
    vi.advanceTimersByTime(30);

    expect(sender).not.toHaveBeenCalled();

    shouldSend.mockReturnValue(true);
    vi.advanceTimersByTime(10);

    expect(sender).toHaveBeenCalledTimes(1);
    expect(broadcaster.size()).toBe(0);
    broadcaster.stop();
    vi.useRealTimers();
  });

  it('rejects chunks that exceed the max queue budget', () => {
    const broadcaster = createBroadcaster(vi.fn(), { maxQueueBytes: 2 });

    expect(broadcaster.enqueue(new Uint8Array([1, 2, 3]).buffer)).toBe(false);
    expect(broadcaster.size()).toBe(0);
    broadcaster.stop();
  });
});
