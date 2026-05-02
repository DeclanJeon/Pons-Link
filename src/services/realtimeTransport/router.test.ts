import { describe, expect, it, vi } from 'vitest';
import { RealtimeTransportRouter } from './router';

describe('RealtimeTransportRouter', () => {
  it('drops disposable media when the media channel is congested', () => {
    const send = vi.fn(() => true);
    const router = new RealtimeTransportRouter({
      send,
      getBufferedAmount: () => 300 * 1024,
      now: () => 1000,
    });

    const result = router.enqueue({
      channel: 'media',
      kind: 'ponscast-frame',
      priority: 4,
      reliability: 'latest',
      payload: { seq: 1 },
    });

    expect(result).toEqual({ sent: false, dropped: true, deferred: false, reason: 'congested' });
    expect(send).not.toHaveBeenCalled();
  });

  it('defers reliable messages when the channel is above its hard limit', () => {
    let bufferedAmount = 3 * 1024 * 1024;
    const send = vi.fn(() => true);
    const router = new RealtimeTransportRouter({
      send,
      getBufferedAmount: () => bufferedAmount,
      now: () => 1000,
    });

    const result = router.enqueue({
      channel: 'file',
      kind: 'file-chunk',
      priority: 3,
      payload: { index: 1 },
    });

    expect(result).toEqual({ sent: false, dropped: false, deferred: true, reason: 'congested' });
    expect(router.getQueueSizes()).toEqual({ latest: 0, reliable: 1 });
    expect(send).not.toHaveBeenCalled();

    bufferedAmount = 0;
    expect(router.flush().sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(router.getQueueSizes()).toEqual({ latest: 0, reliable: 0 });
  });

  it('keeps only the latest message for latest-wins traffic', () => {
    let bufferedAmount = 2 * 1024 * 1024;
    const sentPayloads: string[] = [];
    const router = new RealtimeTransportRouter({
      send: (payload) => {
        sentPayloads.push(String(payload));
        return true;
      },
      getBufferedAmount: () => bufferedAmount,
      now: () => 1000,
    });

    router.enqueue({
      channel: 'whiteboard',
      kind: 'cursor',
      priority: 2,
      reliability: 'latest',
      dedupeKey: 'cursor:user-1',
      payload: { x: 1 },
    });
    router.enqueue({
      channel: 'whiteboard',
      kind: 'cursor',
      priority: 2,
      reliability: 'latest',
      dedupeKey: 'cursor:user-1',
      payload: { x: 2 },
    });

    expect(sentPayloads).toHaveLength(0);
    expect(router.getQueueSizes()).toEqual({ latest: 1, reliable: 0 });

    bufferedAmount = 0;
    router.flush();

    expect(sentPayloads).toHaveLength(1);
    expect(JSON.parse(sentPayloads.at(-1) || '{}')).toEqual({ x: 2 });
  });

  it('drops expired queued messages', () => {
    let now = 1000;
    const router = new RealtimeTransportRouter({
      send: vi.fn(() => true),
      getBufferedAmount: () => 3 * 1024 * 1024,
      now: () => now,
    });

    router.enqueue({
      channel: 'file',
      kind: 'subtitle-chunk',
      priority: 3,
      ttlMs: 100,
      payload: { index: 1 },
    });

    now = 1200;
    expect(router.flush()).toEqual({ sent: false, dropped: true, deferred: false, reason: 'expired' });
    expect(router.getQueueSizes()).toEqual({ latest: 0, reliable: 0 });
  });

  it('does not emit router metadata into the wire payload', () => {
    const sentPayloads: string[] = [];
    const router = new RealtimeTransportRouter({
      send: (payload) => {
        sentPayloads.push(String(payload));
        return true;
      },
    });

    router.enqueue({
      channel: 'text',
      kind: 'chat',
      payload: { type: 'chat', text: 'hello' },
    });

    const payload = JSON.parse(sentPayloads[0] || '{}');
    expect(payload).toEqual({ type: 'chat', text: 'hello' });
    expect(payload.v).toBeUndefined();
    expect(payload.channel).toBeUndefined();
    expect(payload.kind).toBeUndefined();
    expect(payload.payload).toBeUndefined();
  });

  it('passes through string and binary payloads unchanged', () => {
    const sentPayloads: Array<string | ArrayBuffer | Uint8Array> = [];
    const router = new RealtimeTransportRouter({
      send: (payload) => {
        sentPayloads.push(payload);
        return true;
      },
    });
    const binary = new Uint8Array([1, 2, 3]);

    router.enqueue({
      channel: 'diagnostics',
      kind: 'ping',
      payload: 'raw-string',
    });
    router.enqueue({
      channel: 'file',
      kind: 'chunk',
      payload: binary,
    });

    expect(sentPayloads[0]).toBe('raw-string');
    expect(sentPayloads[1]).toBe(binary);
  });
});
