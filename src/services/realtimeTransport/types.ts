export type RealtimeChannelName =
  | 'control'
  | 'text'
  | 'whiteboard'
  | 'file'
  | 'media'
  | 'diagnostics'
  | 'legacy';

export type RealtimeReliability = 'reliable' | 'unreliable' | 'latest';

export type RealtimePriority = 0 | 1 | 2 | 3 | 4;

export interface RealtimeEnvelope<T = unknown> {
  v: 1;
  id: string;
  channel: RealtimeChannelName;
  kind: string;
  priority: RealtimePriority;
  reliability: RealtimeReliability;
  dedupeKey?: string;
  ttlMs?: number;
  createdAt: number;
  payload: T;
}

export interface RealtimeChannelLimits {
  high: number;
  hard: number;
}

export interface RealtimeChannelPolicy {
  channel: RealtimeChannelName;
  ordered: boolean;
  maxRetransmits?: number;
  limits: RealtimeChannelLimits;
  dropWhenCongested: boolean;
  latestWins: boolean;
}

export interface RealtimeSendResult {
  sent: boolean;
  dropped: boolean;
  deferred: boolean;
  reason?: 'expired' | 'congested' | 'not-ready' | 'send-failed';
}

