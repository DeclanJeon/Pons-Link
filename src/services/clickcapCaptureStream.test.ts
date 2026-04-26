import { describe, expect, it, vi } from 'vitest';
import { createClickCapCaptureStream } from './clickcapCaptureStream';

const createTrack = (kind: 'audio' | 'video', settings: MediaTrackSettings = {}) => ({
  kind,
  enabled: true,
  readyState: 'live',
  stop: vi.fn(),
  getSettings: () => settings,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}) as unknown as MediaStreamTrack;

class FakeMediaStream {
  private tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
}

Object.defineProperty(globalThis, 'MediaStream', {
  value: FakeMediaStream,
  writable: true,
  configurable: true,
});

class FakeAudioContext {
  state = 'running';
  destinationTrack = createTrack('audio');
  destination = { stream: new FakeMediaStream([this.destinationTrack]) };
  createMediaStreamDestination = vi.fn(() => this.destination);
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  close = vi.fn(async () => { this.state = 'closed'; });
}

describe('createClickCapCaptureStream', () => {
  it('creates a cropped canvas capture stream and cleans up source resources', async () => {
    const sourceVideoTrack = createTrack('video', { width: 1280, height: 720 });
    const sourceAudioTrack = createTrack('audio');
    const micAudioTrack = createTrack('audio');
    const outputVideoTrack = createTrack('video');
    const sourceStream = new FakeMediaStream([sourceVideoTrack, sourceAudioTrack]) as unknown as MediaStream;
    const micStream = new FakeMediaStream([micAudioTrack]) as unknown as MediaStream;
    const canvasStream = new FakeMediaStream([outputVideoTrack]) as unknown as MediaStream;
    const videoElement = {
      srcObject: null as MediaStream | null,
      muted: false,
      videoWidth: 1280,
      videoHeight: 720,
      play: vi.fn(async () => undefined),
      remove: vi.fn(),
    } as unknown as HTMLVideoElement;
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      captureStream: vi.fn(() => canvasStream),
      remove: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const audioContext = new FakeAudioContext();
    const getDisplayMedia = vi.fn(async () => sourceStream);
    const requestAnimationFrame = vi.fn(() => 7);
    const cancelAnimationFrame = vi.fn();

    const session = await createClickCapCaptureStream({
      fps: 30,
      crop: { x: 10, y: 20, width: 640, height: 360 },
      includeSourceAudio: true,
      includeMicAudio: true,
      micStream,
      deps: {
        getDisplayMedia,
        createVideoElement: () => videoElement,
        createCanvasElement: () => canvas,
        createAudioContext: () => audioContext as unknown as AudioContext,
        requestAnimationFrame,
        cancelAnimationFrame,
      },
    });

    expect(getDisplayMedia).toHaveBeenCalledWith({ video: { cursor: 'always' }, audio: true });
    expect(videoElement.srcObject).toBe(sourceStream);
    expect(videoElement.play).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(canvas.captureStream).toHaveBeenCalledWith(30);
    expect(audioContext.createMediaStreamSource).toHaveBeenCalledTimes(2);
    expect(session.stream.getVideoTracks()).toEqual([outputVideoTrack]);
    expect(session.stream.getAudioTracks()).toEqual([audioContext.destinationTrack]);
    expect(session.metadata).toMatchObject({ sourceType: 'clickcap-crop', width: 640, height: 360, fps: 30, hasAudio: true });

    await session.cleanup();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(sourceVideoTrack.stop).toHaveBeenCalledTimes(1);
    expect(sourceAudioTrack.stop).toHaveBeenCalledTimes(1);
    expect(outputVideoTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioContext.close).toHaveBeenCalledTimes(1);
    expect(videoElement.srcObject).toBeNull();
  });

  it('creates a clickcap capture stream from a provided streamId using the id-based media source', async () => {
    const sourceVideoTrack = createTrack('video', { width: 1920, height: 1080 });
    const outputVideoTrack = createTrack('video');
    const sourceStream = new FakeMediaStream([sourceVideoTrack]) as unknown as MediaStream;
    const canvasStream = new FakeMediaStream([outputVideoTrack]) as unknown as MediaStream;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      captureStream: vi.fn(() => canvasStream),
      remove: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const videoElement = {
      srcObject: null as MediaStream | null,
      muted: false,
      videoWidth: 1920,
      videoHeight: 1080,
      play: vi.fn(async () => undefined),
      remove: vi.fn(),
    } as unknown as HTMLVideoElement;
    const audioContext = new FakeAudioContext();
    const getDisplayMediaById = vi.fn(async () => sourceStream);
    const requestAnimationFrame = vi.fn(() => 7);
    const cancelAnimationFrame = vi.fn();

    const session = await createClickCapCaptureStream({
      streamId: 'stream-abc',
      includeSourceAudio: false,
      includeMicAudio: false,
      fps: 20,
      deps: {
        getDisplayMediaById,
        createVideoElement: () => videoElement,
        createCanvasElement: () => canvas,
        createAudioContext: () => audioContext as unknown as AudioContext,
        requestAnimationFrame,
        cancelAnimationFrame,
      },
    });

    expect(getDisplayMediaById).toHaveBeenCalledWith('stream-abc');
    expect(session.stream.getVideoTracks()).toEqual([outputVideoTrack]);
    expect(session.metadata).toMatchObject({
      sourceType: 'clickcap-display',
      width: 1920,
      height: 1080,
      fps: 20,
      hasAudio: true,
    });

    await session.cleanup();

    expect(videoElement.srcObject).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(sourceVideoTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('applies ClickCap extension crop margins when source view context is provided', async () => {
    const sourceVideoTrack = createTrack('video', { width: 1920, height: 1080 });
    const outputVideoTrack = createTrack('video');
    const sourceStream = new FakeMediaStream([sourceVideoTrack]) as unknown as MediaStream;
    const canvasStream = new FakeMediaStream([outputVideoTrack]) as unknown as MediaStream;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      captureStream: vi.fn(() => canvasStream),
      remove: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const videoElement = {
      srcObject: null as MediaStream | null,
      muted: false,
      videoWidth: 1920,
      videoHeight: 1080,
      play: vi.fn(async () => undefined),
      remove: vi.fn(),
    } as unknown as HTMLVideoElement;
    const audioContext = new FakeAudioContext();

    const session = await createClickCapCaptureStream({
      streamId: 'stream-abc',
      crop: { x: 10, y: 20, width: 640, height: 360 },
      sourceView: { viewportWidth: 1280, viewportHeight: 720 },
      deps: {
        getDisplayMediaById: vi.fn(async () => sourceStream),
        createVideoElement: () => videoElement,
        createCanvasElement: () => canvas,
        createAudioContext: () => audioContext as unknown as AudioContext,
        requestAnimationFrame: vi.fn(() => 7),
        cancelAnimationFrame: vi.fn(),
      },
    });

    expect(canvas.width).toBe(634);
    expect(canvas.height).toBe(350);
    expect(session.metadata).toMatchObject({ sourceType: 'clickcap-crop', width: 634, height: 350 });

    await session.cleanup();
  });
});
