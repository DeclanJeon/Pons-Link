export type ClickCapCaptureOptions = {
  fps?: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  includeSourceAudio?: boolean;
  includeMicAudio?: boolean;
  micStream?: MediaStream | null;
  streamId?: string;
  deps?: Partial<ClickCapCaptureDeps>;
};

export type ClickCapCaptureSession = {
  stream: MediaStream;
  sourceStream: MediaStream;
  cleanup: () => Promise<void>;
  metadata: {
    sourceType: 'clickcap-crop' | 'clickcap-display';
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
  };
};

type ClickCapCaptureDeps = {
  getDisplayMedia: (constraints: DisplayMediaStreamOptions) => Promise<MediaStream>;
  getDisplayMediaById: (streamId: string) => Promise<MediaStream>;
  createVideoElement: () => HTMLVideoElement;
  createCanvasElement: () => HTMLCanvasElement;
  createAudioContext: () => AudioContext;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
};

const getDefaultDeps = (): ClickCapCaptureDeps => ({
  getDisplayMedia: (constraints) => navigator.mediaDevices.getDisplayMedia(constraints),
  getDisplayMediaById: (streamId) => {
    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    };
    return mediaDevices.getUserMedia({
      video: {
        // Chrome legacy constraint path for tab capture stream IDs.
        // Unsupported environments should fail fast via rejection.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
      } as MediaTrackConstraints,
      audio: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
      } as MediaTrackConstraints,
    });
  },
  createVideoElement: () => document.createElement('video'),
  createCanvasElement: () => document.createElement('canvas'),
  createAudioContext: () => new AudioContext(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
});

const stopLiveTracks = (stream: MediaStream, stoppedTracks = new Set<MediaStreamTrack>()) => {
  stream.getTracks().forEach((track) => {
    if (!stoppedTracks.has(track) && track.readyState === 'live') {
      stoppedTracks.add(track);
      track.stop();
    }
  });
};

export const createClickCapCaptureStream = async ({
  fps = 30,
  crop,
  includeSourceAudio = true,
  includeMicAudio = true,
  micStream = null,
  streamId,
  deps: providedDeps = {},
}: ClickCapCaptureOptions = {}): Promise<ClickCapCaptureSession> => {
  const deps = { ...getDefaultDeps(), ...providedDeps };
  const sourceStream = streamId
    ? await deps.getDisplayMediaById(streamId)
    : await deps.getDisplayMedia({ video: { cursor: 'always' }, audio: true } as DisplayMediaStreamOptions);
  const sourceVideoTrack = sourceStream.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    stopLiveTracks(sourceStream);
    throw new Error('ClickCap capture requires a video source.');
  }

  const settings = sourceVideoTrack.getSettings();
  const sourceWidth = settings.width || 1920;
  const sourceHeight = settings.height || 1080;
  const outputWidth = Math.max(1, Math.floor(crop?.width ?? sourceWidth));
  const outputHeight = Math.max(1, Math.floor(crop?.height ?? sourceHeight));
  const sx = Math.max(0, Math.floor(crop?.x ?? 0));
  const sy = Math.max(0, Math.floor(crop?.y ?? 0));
  const sw = Math.min(outputWidth, Math.max(1, sourceWidth - sx));
  const sh = Math.min(outputHeight, Math.max(1, sourceHeight - sy));

  const videoElement = deps.createVideoElement();
  videoElement.srcObject = sourceStream;
  videoElement.muted = true;
  videoElement.playsInline = true;
  await videoElement.play();

  const canvas = deps.createCanvasElement();
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stopLiveTracks(sourceStream);
    throw new Error('ClickCap capture canvas is not available.');
  }

  let animationFrameId: number | null = null;
  let stopped = false;
  const drawLoop = () => {
    if (stopped) return;
    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
    animationFrameId = deps.requestAnimationFrame(drawLoop);
  };

  const canvasStream = canvas.captureStream(fps);
  const audioContext = deps.createAudioContext();
  const destination = audioContext.createMediaStreamDestination();

  if (includeSourceAudio && sourceStream.getAudioTracks().length > 0) {
    audioContext.createMediaStreamSource(sourceStream).connect(destination);
  }

  if (includeMicAudio && micStream?.getAudioTracks().length) {
    audioContext.createMediaStreamSource(micStream).connect(destination);
  }

  const outputStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  animationFrameId = deps.requestAnimationFrame(drawLoop);

  const cleanup = async () => {
    if (stopped) return;
    stopped = true;
    if (animationFrameId !== null) {
      deps.cancelAnimationFrame(animationFrameId);
    }
    videoElement.srcObject = null;
    videoElement.remove?.();
    canvas.remove?.();
    const stoppedTracks = new Set<MediaStreamTrack>();
    stopLiveTracks(sourceStream, stoppedTracks);
    stopLiveTracks(canvasStream, stoppedTracks);
    stopLiveTracks(outputStream, stoppedTracks);
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
  };

  return {
    stream: outputStream,
    sourceStream,
    cleanup,
    metadata: {
      sourceType: crop ? 'clickcap-crop' : 'clickcap-display',
      width: outputWidth,
      height: outputHeight,
      fps,
      hasAudio: outputStream.getAudioTracks().length > 0,
    },
  };
};
