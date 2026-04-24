import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPonsCastFrame } from '@/lib/ponscast/protocol';
import { usePonsCastReceiver } from './usePonsCastReceiver';

class FakeSourceBuffer extends EventTarget {
  mode = 'segments';
  updating = false;
  appendBuffer = vi.fn((buffer: ArrayBuffer) => {
    this.updating = true;
    this.lastBuffer = buffer;
  });
  remove = vi.fn();
  lastBuffer: ArrayBuffer | null = null;
}

const sourceBuffers: FakeSourceBuffer[] = [];
const mediaSources: FakeMediaSource[] = [];

class FakeMediaSource extends EventTarget {
  static isTypeSupported = vi.fn(() => true);
  readyState: MediaSourceReadyState = 'closed';
  addSourceBuffer = vi.fn(() => {
    const sb = new FakeSourceBuffer();
    sourceBuffers.push(sb);
    return sb as unknown as SourceBuffer;
  });
  removeSourceBuffer = vi.fn();
  endOfStream = vi.fn();

  constructor() {
    super();
    mediaSources.push(this);
  }

  open() {
    this.readyState = 'open';
    this.dispatchEvent(new Event('sourceopen'));
  }
}

const makeVideoRef = () => ({
  current: {
    src: '',
    currentTime: 0,
    buffered: { length: 0, start: () => 0 },
  } as unknown as HTMLVideoElement,
});

describe('usePonsCastReceiver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sourceBuffers.length = 0;
    mediaSources.length = 0;
    FakeMediaSource.isTypeSupported.mockReturnValue(true);
    vi.stubGlobal('MediaSource', FakeMediaSource);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:ponscast'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('drains frames that arrive before MediaSource becomes ready', () => {
    const videoRef = makeVideoRef();
    const { result } = renderHook(() => usePonsCastReceiver({ videoRef, jitterBufferMs: 0 }));
    const payload = new Uint8Array([10, 20, 30]).buffer;

    act(() => {
      result.current.handleData(createPonsCastFrame(1, payload, 123));
    });

    expect(sourceBuffers).toHaveLength(0);

    act(() => {
      mediaSources[0].open();
      vi.runOnlyPendingTimers();
    });

    expect(sourceBuffers[0].appendBuffer).toHaveBeenCalledTimes(1);
    expect(sourceBuffers[0].appendBuffer).toHaveBeenCalledWith(payload);
  });

  it('reports an unsupported browser instead of constructing MediaSource', () => {
    vi.unstubAllGlobals();
    const videoRef = makeVideoRef();

    const { result } = renderHook(() => usePonsCastReceiver({ videoRef }));

    expect(result.current.error).toBe('PonsCast playback is not supported on this browser.');
    expect(result.current.isReady).toBe(false);
  });
});
