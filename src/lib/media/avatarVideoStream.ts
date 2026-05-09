export interface AvatarVideoSession {
  stream: MediaStream;
  track: MediaStreamTrack;
  cleanup: () => void;
}

interface AvatarVideoSessionOptions {
  avatarUrl?: string;
  nickname: string;
  width?: number;
  height?: number;
  frameRate?: number;
}

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

const drawCenteredImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  size: number,
) => {
  const radius = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, centerX - radius, centerY - radius, size, size);
  ctx.restore();
};

export const createAvatarVideoSession = async ({
  avatarUrl,
  nickname,
  width = 1280,
  height = 720,
  frameRate = 15,
}: AvatarVideoSessionOptions): Promise<AvatarVideoSession> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create avatar video canvas.');

  const image = await loadAvatarImage(avatarUrl);
  const initial = (nickname.trim()[0] || 'P').toUpperCase();
  let frame = 0;

  const draw = () => {
    frame += 1;
    const pulse = 0.5 + Math.sin(frame / 18) * 0.08;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#10131f');
    gradient.addColorStop(0.52, '#152033');
    gradient.addColorStop(1, '#0d111a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = `rgba(99, 102, 241, ${0.14 + pulse * 0.08})`;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.45, Math.min(width, height) * 0.38, 0, Math.PI * 2);
    ctx.fill();

    const avatarSize = Math.min(width, height) * 0.34;
    const centerX = width / 2;
    const centerY = height * 0.44;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (image) {
      drawCenteredImage(ctx, image, centerX, centerY, avatarSize);
    } else {
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 ${Math.floor(avatarSize * 0.42)}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, centerX, centerY + avatarSize * 0.02);
    }

    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.font = `600 ${Math.floor(height * 0.045)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nickname, centerX, height * 0.72);

    ctx.fillStyle = 'rgba(199, 210, 254, 0.72)';
    ctx.font = `500 ${Math.floor(height * 0.026)}px Inter, Arial, sans-serif`;
    ctx.fillText('Avatar camera', centerX, height * 0.78);
  };

  draw();
  const timer = window.setInterval(draw, Math.max(1000 / frameRate, 80));
  const stream = canvas.captureStream(frameRate);
  const track = stream.getVideoTracks()[0];
  track.contentHint = 'detail';

  return {
    stream,
    track,
    cleanup: () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((streamTrack) => streamTrack.stop());
    },
  };
};
