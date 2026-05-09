import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface CameraReframePosition {
  x: number;
  y: number;
}

export const DEFAULT_CAMERA_REFRAME_POSITION: CameraReframePosition = { x: 50, y: 44 };

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getFaceLandmarker = async () => {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = import('@mediapipe/tasks-vision').then(({ FaceLandmarker, FilesetResolver }) =>
      FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
      ),
    );
  }

  return faceLandmarkerPromise;
};

export const mapFaceLandmarksToReframePosition = (
  result: FaceLandmarkerResult,
): CameraReframePosition | null => {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks?.length) return null;

  const faceCenter = landmarks.reduce(
    (acc, landmark) => ({
      x: acc.x + landmark.x,
      y: acc.y + landmark.y,
    }),
    { x: 0, y: 0 },
  );
  faceCenter.x /= landmarks.length;
  faceCenter.y /= landmarks.length;

  return {
    x: Math.round(clamp(faceCenter.x * 100, 28, 72)),
    y: Math.round(clamp((faceCenter.y - 0.08) * 100, 24, 64)),
  };
};

export const blendReframePosition = (
  current: CameraReframePosition,
  next: CameraReframePosition,
  amount = 0.28,
): CameraReframePosition => ({
  x: Math.round(current.x + (next.x - current.x) * amount),
  y: Math.round(current.y + (next.y - current.y) * amount),
});

export const detectCameraReframePosition = async (
  video: HTMLVideoElement,
  timestamp = performance.now(),
): Promise<CameraReframePosition | null> => {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }

  const faceLandmarker = await getFaceLandmarker();
  return mapFaceLandmarksToReframePosition(faceLandmarker.detectForVideo(video, timestamp));
};
