import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

export interface LiveAvatarVideoSession {
  stream: MediaStream;
  track: MediaStreamTrack;
  cleanup: () => void;
}

interface LiveAvatarVideoSessionOptions {
  sourceStream: MediaStream;
  avatarUrl?: string;
  nickname: string;
  width?: number;
  height?: number;
  frameRate?: number;
}

interface FaceMotionState {
  blinkLeft: number;
  blinkRight: number;
  jawOpen: number;
  smile: number;
  browUp: number;
  yaw: number;
  pitch: number;
}

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const blend = (current: number, next: number, amount = 0.32) => current + (next - current) * amount;

const createNeutralMotion = (): FaceMotionState => ({
  blinkLeft: 0,
  blinkRight: 0,
  jawOpen: 0,
  smile: 0,
  browUp: 0,
  yaw: 0,
  pitch: 0,
});

const getFaceLandmarker = async () => {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
  }

  return faceLandmarkerPromise;
};

const getBlendshapeScore = (result: FaceLandmarkerResult, name: string) => {
  const category = result.faceBlendshapes[0]?.categories.find((item) => item.categoryName === name);
  return category?.score ?? 0;
};

const getMotionFromResult = (result: FaceLandmarkerResult): FaceMotionState | null => {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) return null;

  const nose = landmarks[1];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const yawFromNose = clamp((nose.x - 0.5) * 3, -0.45, 0.45);
  const pitchFromFace = chin && forehead
    ? clamp(((chin.y + forehead.y) / 2 - 0.5) * 2.4, -0.35, 0.35)
    : 0;

  return {
    blinkLeft: clamp(getBlendshapeScore(result, 'eyeBlinkLeft') * 1.4),
    blinkRight: clamp(getBlendshapeScore(result, 'eyeBlinkRight') * 1.4),
    jawOpen: clamp(getBlendshapeScore(result, 'jawOpen') * 1.6),
    smile: clamp((getBlendshapeScore(result, 'mouthSmileLeft') + getBlendshapeScore(result, 'mouthSmileRight')) * 0.9),
    browUp: clamp((getBlendshapeScore(result, 'browOuterUpLeft') + getBlendshapeScore(result, 'browOuterUpRight')) * 0.8),
    yaw: yawFromNose,
    pitch: pitchFromFace,
  };
};

const loadAvatarImage = (avatarUrl?: string): Promise<HTMLImageElement | null> => {
  if (!avatarUrl) return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = avatarUrl;
  });
};

const drawEye = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  blink: number,
  lookX: number,
  browUp: number,
) => {
  const openHeight = 26 * (1 - clamp(blink, 0, 0.92));
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(x, y, 34, Math.max(openHeight, 4), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(x + lookX * 10, y, Math.max(7, 12 * (1 - blink)), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 45 - browUp * 12);
  ctx.quadraticCurveTo(x, y - 57 - browUp * 18, x + 34, y - 45 - browUp * 12);
  ctx.stroke();
};

const drawLiveAvatar = (
  ctx: CanvasRenderingContext2D,
  motion: FaceMotionState,
  options: { width: number; height: number; nickname: string; avatarImage: HTMLImageElement | null; frame: number },
) => {
  const { width, height, nickname, avatarImage, frame } = options;
  const centerX = width / 2;
  const centerY = height * 0.46;
  const faceRadius = Math.min(width, height) * 0.24;
  const bob = Math.sin(frame / 24) * 4;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#10131f');
  gradient.addColorStop(0.58, '#162036');
  gradient.addColorStop(1, '#080b11');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
  ctx.beginPath();
  ctx.arc(centerX + motion.yaw * 90, centerY + motion.pitch * 60, faceRadius * 1.85, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(centerX + motion.yaw * 56, centerY + motion.pitch * 52 + bob);
  ctx.rotate(motion.yaw * 0.16);

  if (avatarImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, faceRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.34;
    ctx.drawImage(avatarImage, -faceRadius, -faceRadius, faceRadius * 2, faceRadius * 2);
    ctx.restore();
  }

  const faceGradient = ctx.createRadialGradient(-faceRadius * 0.3, -faceRadius * 0.4, faceRadius * 0.2, 0, 0, faceRadius);
  faceGradient.addColorStop(0, '#818cf8');
  faceGradient.addColorStop(1, '#4f46e5');
  ctx.fillStyle = faceGradient;
  ctx.beginPath();
  ctx.arc(0, 0, faceRadius, 0, Math.PI * 2);
  ctx.fill();

  drawEye(ctx, -faceRadius * 0.36, -faceRadius * 0.16, motion.blinkLeft, motion.yaw, motion.browUp);
  drawEye(ctx, faceRadius * 0.36, -faceRadius * 0.16, motion.blinkRight, motion.yaw, motion.browUp);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const mouthWidth = faceRadius * (0.32 + motion.smile * 0.35);
  const mouthY = faceRadius * 0.33;
  const mouthCurve = faceRadius * (0.08 + motion.smile * 0.3 + motion.jawOpen * 0.16);
  ctx.moveTo(-mouthWidth, mouthY);
  ctx.quadraticCurveTo(0, mouthY + mouthCurve, mouthWidth, mouthY);
  ctx.stroke();

  if (motion.jawOpen > 0.16) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.beginPath();
    ctx.ellipse(0, mouthY + mouthCurve * 0.64, mouthWidth * 0.42, faceRadius * motion.jawOpen * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
  ctx.font = `600 ${Math.floor(height * 0.044)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname, centerX, height * 0.76);

  ctx.fillStyle = 'rgba(199, 210, 254, 0.76)';
  ctx.font = `500 ${Math.floor(height * 0.026)}px Inter, Arial, sans-serif`;
  ctx.fillText('Live Avatar', centerX, height * 0.815);
};

export const createLiveAvatarVideoSession = async ({
  sourceStream,
  avatarUrl,
  nickname,
  width = 1280,
  height = 720,
  frameRate = 15,
}: LiveAvatarVideoSessionOptions): Promise<LiveAvatarVideoSession> => {
  const sourceVideoTrack = sourceStream.getVideoTracks()[0];
  if (!sourceVideoTrack) throw new Error('Live Avatar requires a camera video track.');

  const video = document.createElement('video');
  video.srcObject = new MediaStream([sourceVideoTrack]);
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create live avatar canvas.');

  const [faceLandmarker, avatarImage] = await Promise.all([
    getFaceLandmarker(),
    loadAvatarImage(avatarUrl),
  ]);

  let disposed = false;
  let animationFrameId = 0;
  let frame = 0;
  let motion = createNeutralMotion();

  const render = () => {
    if (disposed) return;
    frame += 1;

    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const result = faceLandmarker.detectForVideo(video, performance.now());
        const nextMotion = getMotionFromResult(result);
        if (nextMotion) {
          motion = {
            blinkLeft: blend(motion.blinkLeft, nextMotion.blinkLeft),
            blinkRight: blend(motion.blinkRight, nextMotion.blinkRight),
            jawOpen: blend(motion.jawOpen, nextMotion.jawOpen),
            smile: blend(motion.smile, nextMotion.smile),
            browUp: blend(motion.browUp, nextMotion.browUp),
            yaw: blend(motion.yaw, nextMotion.yaw),
            pitch: blend(motion.pitch, nextMotion.pitch),
          };
        }
      }
    } catch (error) {
      console.warn('[LiveAvatar] Face tracking frame failed:', error);
    }

    drawLiveAvatar(ctx, motion, { width, height, nickname, avatarImage, frame });
    animationFrameId = window.requestAnimationFrame(render);
  };

  render();
  const stream = canvas.captureStream(frameRate);
  const track = stream.getVideoTracks()[0];
  track.contentHint = 'detail';

  return {
    stream,
    track,
    cleanup: () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      video.pause();
      video.srcObject = null;
      stream.getTracks().forEach((streamTrack) => streamTrack.stop());
    },
  };
};
