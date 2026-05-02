import { nanoid } from 'nanoid';
import { getRealtimeChannelPolicy } from './policies';
import type {
  RealtimeChannelName,
  RealtimeEnvelope,
  RealtimePriority,
  RealtimeReliability,
  RealtimeSendResult,
} from './types';

type SendFunction = (payload: string | ArrayBuffer | Uint8Array) => boolean;
type BufferedAmountFunction = () => number;

export interface RealtimeRouterOptions {
  send: SendFunction;
  getBufferedAmount?: BufferedAmountFunction;
  now?: () => number;
}

export interface RealtimeSendInput<T = unknown> {
  channel: RealtimeChannelName;
  kind: string;
  payload: string | ArrayBuffer | Uint8Array | T;
  priority?: RealtimePriority;
  reliability?: RealtimeReliability;
  dedupeKey?: string;
  ttlMs?: number;
}

export class RealtimeTransportRouter {
  private readonly send: SendFunction;
  private readonly getBufferedAmount: BufferedAmountFunction;
  private readonly now: () => number;
  private latestQueue = new Map<string, RealtimeEnvelope>();
  private reliableQueue: RealtimeEnvelope[] = [];

  constructor(options: RealtimeRouterOptions) {
    this.send = options.send;
    this.getBufferedAmount = options.getBufferedAmount ?? (() => 0);
    this.now = options.now ?? (() => Date.now());
  }

  enqueue<T>(input: RealtimeSendInput<T>): RealtimeSendResult {
    const createdAt = this.now();
    const envelope: RealtimeEnvelope<T> = {
      v: 1,
      id: nanoid(),
      channel: input.channel,
      kind: input.kind,
      priority: input.priority ?? 2,
      reliability: input.reliability ?? 'reliable',
      dedupeKey: input.dedupeKey,
      ttlMs: input.ttlMs,
      createdAt,
      payload: input.payload,
    };

    const policy = getRealtimeChannelPolicy(envelope.channel);
    const bufferedAmount = this.getBufferedAmount();

    if (policy.dropWhenCongested && bufferedAmount >= policy.limits.high) {
      return { sent: false, dropped: true, deferred: false, reason: 'congested' };
    }

    if (envelope.reliability === 'latest' || policy.latestWins) {
      const key = envelope.dedupeKey ?? `${envelope.channel}:${envelope.kind}`;
      this.latestQueue.set(key, envelope);
      return this.flush();
    }

    if (bufferedAmount >= policy.limits.hard) {
      this.reliableQueue.push(envelope);
      return { sent: false, dropped: false, deferred: true, reason: 'congested' };
    }

    return this.sendEnvelope(envelope);
  }

  flush(): RealtimeSendResult {
    let result: RealtimeSendResult = { sent: false, dropped: false, deferred: false };

    const latest = Array.from(this.latestQueue.entries())
      .sort(([, a], [, b]) => a.priority - b.priority || a.createdAt - b.createdAt);
    this.latestQueue.clear();

    for (const [key, envelope] of latest) {
      const sendResult = this.trySendQueuedEnvelope(envelope);
      if (sendResult.deferred) {
        this.latestQueue.set(key, envelope);
        return sendResult;
      }
      result = sendResult;
    }

    this.reliableQueue.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    while (this.reliableQueue.length > 0) {
      const envelope = this.reliableQueue[0];
      const sendResult = this.trySendQueuedEnvelope(envelope);
      if (sendResult.deferred) return sendResult;
      this.reliableQueue.shift();
      result = sendResult;
    }

    return result;
  }

  getQueueSizes() {
    return {
      latest: this.latestQueue.size,
      reliable: this.reliableQueue.length,
    };
  }

  clear() {
    this.latestQueue.clear();
    this.reliableQueue = [];
  }

  private trySendQueuedEnvelope(envelope: RealtimeEnvelope): RealtimeSendResult {
    if (this.isExpired(envelope)) {
      return { sent: false, dropped: true, deferred: false, reason: 'expired' };
    }

    const policy = getRealtimeChannelPolicy(envelope.channel);
    const bufferedAmount = this.getBufferedAmount();

    if (policy.dropWhenCongested && bufferedAmount >= policy.limits.high) {
      return { sent: false, dropped: true, deferred: false, reason: 'congested' };
    }

    if (bufferedAmount >= policy.limits.hard) {
      return { sent: false, dropped: false, deferred: true, reason: 'congested' };
    }

    return this.sendEnvelope(envelope);
  }

  private sendEnvelope(envelope: RealtimeEnvelope): RealtimeSendResult {
    try {
      const sent = this.send(this.serializePayload(envelope.payload));
      return sent
        ? { sent: true, dropped: false, deferred: false }
        : { sent: false, dropped: false, deferred: true, reason: 'not-ready' };
    } catch {
      return { sent: false, dropped: false, deferred: true, reason: 'send-failed' };
    }
  }

  private serializePayload(payload: unknown): string | ArrayBuffer | Uint8Array {
    if (typeof payload === 'string' || payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
      return payload;
    }

    return JSON.stringify(payload);
  }

  private isExpired(envelope: RealtimeEnvelope) {
    return typeof envelope.ttlMs === 'number' && this.now() - envelope.createdAt > envelope.ttlMs;
  }
}
