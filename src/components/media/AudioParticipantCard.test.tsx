import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AudioParticipantCard } from './AudioParticipantCard';

const mockParticipant = {
  userId: 'user-1',
  nickname: 'TestUser',
  isLocal: true,
  audioEnabled: true,
  videoEnabled: false,
  connectionState: 'connected',
  isSharingScreen: false,
  isStreamingFile: false,
  isRelay: false,
  stream: null,
  avatarUrl: null,
  transcript: null,
};

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({
    translationTargetLanguage: 'en',
  }),
}));

class MockAnalyser {
  fftSize = 512;
  smoothingTimeConstant = 0.82;
  frequencyBinCount = 256;
  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(80);
  }
  disconnect() {}
}
class MockAudioContext {
  state = 'running';
  createAnalyser() { return new MockAnalyser(); }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  close() { return Promise.resolve(); }
}
Object.defineProperty(globalThis, 'AudioContext', {
  value: MockAudioContext,
  writable: true,
  configurable: true,
});

// Mock MediaStream for jsdom
class FakeMediaStream {
  tracks: any[];
  constructor(tracks: any[]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks; }
  getVideoTracks() { return []; }
}
Object.defineProperty(globalThis, 'MediaStream', {
  value: FakeMediaStream,
  writable: true,
  configurable: true,
});

// Mock requestAnimationFrame
let rafCallbacks: FrameRequestCallback[] = [];
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  },
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: () => {},
  writable: true,
  configurable: true,
});

describe('AudioParticipantCard i18n', () => {
  beforeEach(() => {
    cleanup();
    rafCallbacks = [];
  });

  it('renders all UI text in English only', () => {
    render(<AudioParticipantCard participant={mockParticipant as any} />);

    expect(screen.getByText('Voice activity')).toBeInTheDocument();

    const koreanRegex = /[가-힣]/;
    const allText = document.body.textContent || '';
    expect(allText).not.toMatch(koreanRegex);
  });

  it('shows speaking state text in English', () => {
    const streamMock = {
      getAudioTracks: () => [{ enabled: true }],
    };
    const speakingParticipant = {
      ...mockParticipant,
      stream: streamMock as any,
    };
    render(<AudioParticipantCard participant={speakingParticipant} />);

    // Fire RAF callbacks to trigger the audio level update
    rafCallbacks.forEach(cb => cb(performance.now()));

    expect(screen.getByText('Speaking now')).toBeInTheDocument();
  });

  it('shows muted state text in English', () => {
    const mutedParticipant = {
      ...mockParticipant,
      audioEnabled: false,
    };
    render(<AudioParticipantCard participant={mutedParticipant} />);
    expect(screen.getByText('Voice activity')).toBeInTheDocument();
    expect(screen.getByText('Microphone is off. Voice activity is not being detected.')).toBeInTheDocument();
  });
});
