import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoWatchPanel } from './CoWatchPanel';
import { useCoWatchStore } from '@/stores/useCoWatchStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

const { providerInstances, MockYouTubeProvider } = vi.hoisted(() => {
  class Provider {
    container: HTMLElement;
    onReady: (videoData?: { title: string; thumbnail: string }) => void;
    onState: (state: { currentTime: number; duration: number; playing: boolean; muted: boolean; volume: number; rate: number }) => void;
    state = { currentTime: 42, duration: 180, playing: true, muted: false, volume: 80, rate: 1 };
    destroyed = false;
    loadVideo = vi.fn(async () => undefined);
    play = vi.fn(async () => {
      this.state.playing = true;
      this.onState({ ...this.state });
    });
    pause = vi.fn(() => {
      this.state.playing = false;
      this.onState({ ...this.state });
    });
    seek = vi.fn((time: number) => {
      this.state.currentTime = time;
    });
    setVolume = vi.fn((volume: number) => {
      this.state.volume = volume;
    });
    mute = vi.fn(() => {
      this.state.muted = true;
    });
    unmute = vi.fn(() => {
      this.state.muted = false;
    });
    setRate = vi.fn((rate: number) => {
      this.state.rate = rate;
    });
    getSnapshot = vi.fn(() => ({ ...this.state }));
    destroy = vi.fn(() => {
      this.destroyed = true;
    });

    constructor(
      container: HTMLElement,
      onReady: (videoData?: { title: string; thumbnail: string }) => void,
      onState: (state: { currentTime: number; duration: number; playing: boolean; muted: boolean; volume: number; rate: number }) => void,
    ) {
      this.container = container;
      this.onReady = onReady;
      this.onState = onState;
      instances.push(this);
      const player = document.createElement('div');
      player.dataset.testid = 'mock-youtube-player';
      container.appendChild(player);
      queueMicrotask(() => {
        this.onReady({ title: 'Mock video', thumbnail: '' });
      });
    }
  }

  const instances: Provider[] = [];

  return { providerInstances: instances, MockYouTubeProvider: Provider };
});

vi.mock('@/lib/cowatch/youtube', () => ({
  YouTubeProvider: MockYouTubeProvider,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({
      sendToAllPeers: vi.fn(() => ({ successful: [], failed: [] })),
      sendToPeer: vi.fn(),
      peers: new Map(),
    }),
  },
}));

const seedCoWatch = () => {
  useSessionStore.getState().setSession('host-1', 'Host', 'room-1', 'video-group');
  useCoWatchStore.setState({
    tabs: [{
      id: 'tab-1',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      title: 'Mock video',
      ownerId: 'host-1',
      ownerName: 'Host',
      status: 'ready',
    }],
    activeTabId: 'tab-1',
    role: 'host',
    hostId: 'host-1',
    playing: true,
    currentTime: 42,
    duration: 180,
    muted: false,
    volume: 80,
    rate: 1,
    isLoading: false,
    loadingMessage: '',
    lastBroadcastTime: 0,
  });
  useUIManagementStore.getState().setActivePanel('cowatch');
};

const renderReadyPanel = async () => {
  render(<CoWatchPanel isOpen onClose={vi.fn()} />);
  await waitFor(() => expect(providerInstances.length).toBeGreaterThan(0));
  await waitFor(() => expect(providerInstances[0].loadVideo).toHaveBeenCalledWith('dQw4w9WgXcQ'));
  await waitFor(() => expect(screen.getAllByTestId('mock-youtube-player').length).toBeGreaterThan(0));
};

beforeAll(() => {
  class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverMock,
    writable: true,
    configurable: true,
  });
});

describe('CoWatchPanel panel modes', () => {
  beforeEach(() => {
    providerInstances.length = 0;
    vi.clearAllMocks();
    useCoWatchStore.setState({
      tabs: [],
      activeTabId: null,
      role: 'viewer',
      hostId: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      muted: false,
      volume: 100,
      captions: false,
      rate: 1,
      isLoading: false,
      loadingMessage: '',
      lastBroadcastTime: 0,
    });
    useUIManagementStore.getState().reset();
    useSessionStore.getState().clearSession();
    seedCoWatch();
  });

  it('deactivates the cowatch navigation state when the panel is closed', async () => {
    render(<CoWatchPanel isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Close'));

    await waitFor(() => {
      expect(useUIManagementStore.getState().activePanel).not.toBe('cowatch');
      expect(useUIManagementStore.getState().isPanelOpen('cowatch')).toBe(false);
    });
  });

  it('rehosts the YouTube player when switching to PIP so playback controls keep working', async () => {
    await renderReadyPanel();
    const fullProvider = providerInstances[0];

    fireEvent.click(screen.getByTitle('Minimize to PIP'));

    await waitFor(() => expect(providerInstances.length).toBe(2));
    const pipProvider = providerInstances[1];
    expect(fullProvider.destroy).toHaveBeenCalled();
    await waitFor(() => expect(pipProvider.seek).toHaveBeenCalledWith(42));
    expect(pipProvider.setVolume).toHaveBeenCalledWith(80);
    await waitFor(() => expect(pipProvider.play).toHaveBeenCalled());

    const pipButtons = screen.getAllByRole('button');
    fireEvent.click(pipButtons[3]);
    await waitFor(() => expect(pipProvider.pause).toHaveBeenCalled());
  });

  it('keeps a live YouTube player mounted while minimized so playback can continue', async () => {
    await renderReadyPanel();

    fireEvent.click(screen.getByTitle('Minimize to PIP'));
    await waitFor(() => expect(providerInstances.length).toBe(2));

    fireEvent.click(screen.getByTitle('Minimize'));

    await waitFor(() => expect(providerInstances.length).toBe(3));
    const minimizedProvider = providerInstances[2];
    expect(screen.getAllByTestId('mock-youtube-player').length).toBeGreaterThan(0);
    await waitFor(() => expect(minimizedProvider.seek).toHaveBeenCalledWith(42));
    await waitFor(() => expect(minimizedProvider.play).toHaveBeenCalled());
  });
});
