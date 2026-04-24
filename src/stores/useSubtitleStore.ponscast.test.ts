import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubtitleStore } from './useSubtitleStore';

vi.mock('@/services/subtitleTransport', () => ({
  subtitleTransport: {
    sendTrack: vi.fn(),
    sendState: vi.fn(),
  },
}));

const initialState = useSubtitleStore.getInitialState();

const resetStore = () => {
  useSubtitleStore.setState({
    ...initialState,
    tracks: new Map(),
    incoming: new Map(),
    style: { ...initialState.style },
    customPosition: { ...initialState.customPosition },
  });
};

describe('useSubtitleStore PonsCast subtitle reception', () => {
  beforeEach(() => {
    resetStore();
  });

  it('applies remote subtitle state needed by synchronized PonsCast viewing', () => {
    useSubtitleStore.getState().receiveSubtitleState({
      isEnabled: true,
      activeTrackId: 'remote-track',
      syncOffset: 250,
      speedMultiplier: 1.25,
      position: 'top',
      style: { fontSize: 'large' },
    });

    const state = useSubtitleStore.getState();
    expect(state.isRemoteSubtitleEnabled).toBe(true);
    expect(state.activeTrackId).toBe('remote-track');
    expect(state.syncOffset).toBe(250);
    expect(state.speedMultiplier).toBe(1.25);
    expect(state.position).toBe('top');
    expect(state.style.fontSize).toBe('large');
    expect(state.style.color).toBe(initialState.style.color);
  });

  it('rejects malformed remote subtitle chunk indexes without corrupting assembler state', () => {
    useSubtitleStore.getState().receiveTrackMeta({
      trackId: 'track-1',
      label: 'English',
      language: 'en',
      totalBytes: 10,
      totalChunks: 2,
      format: 'vtt',
    });

    useSubtitleStore.getState().receiveTrackChunk({ trackId: 'track-1', index: 9, data: 'bad' });

    const assembler = useSubtitleStore.getState().incoming.get('track-1');
    expect(assembler?.received).toBe(0);
    expect(assembler?.chunks).toEqual(['', '']);
  });
});
