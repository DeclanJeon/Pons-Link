import type { RealtimeChannelName, RealtimeChannelPolicy } from './types';

const KiB = 1024;

export const REALTIME_CHANNEL_POLICIES: Record<RealtimeChannelName, RealtimeChannelPolicy> = {
  control: {
    channel: 'control',
    ordered: true,
    limits: { high: 256 * KiB, hard: 512 * KiB },
    dropWhenCongested: false,
    latestWins: false,
  },
  text: {
    channel: 'text',
    ordered: true,
    limits: { high: 256 * KiB, hard: 512 * KiB },
    dropWhenCongested: false,
    latestWins: false,
  },
  whiteboard: {
    channel: 'whiteboard',
    ordered: false,
    maxRetransmits: 0,
    limits: { high: 512 * KiB, hard: 1024 * KiB },
    dropWhenCongested: false,
    latestWins: true,
  },
  file: {
    channel: 'file',
    ordered: true,
    limits: { high: 512 * KiB, hard: 2 * 1024 * KiB },
    dropWhenCongested: false,
    latestWins: false,
  },
  media: {
    channel: 'media',
    ordered: false,
    maxRetransmits: 0,
    limits: { high: 256 * KiB, hard: 512 * KiB },
    dropWhenCongested: true,
    latestWins: true,
  },
  diagnostics: {
    channel: 'diagnostics',
    ordered: false,
    maxRetransmits: 1,
    limits: { high: 128 * KiB, hard: 256 * KiB },
    dropWhenCongested: true,
    latestWins: true,
  },
  legacy: {
    channel: 'legacy',
    ordered: true,
    limits: { high: 512 * KiB, hard: 2 * 1024 * KiB },
    dropWhenCongested: false,
    latestWins: false,
  },
};

export const getRealtimeChannelPolicy = (channel: RealtimeChannelName) => REALTIME_CHANNEL_POLICIES[channel];

