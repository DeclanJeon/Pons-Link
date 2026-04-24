export type PonsCastFileKind = 'video' | 'pdf' | 'image' | 'other';

export interface PonsCastFileDetection {
  kind: PonsCastFileKind;
  mimeType: string;
  extension: string;
  supported: boolean;
}

const VIDEO_EXTENSIONS: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
};

const getExtension = (name: string) => {
  const cleanName = name.toLowerCase().split(/[?#]/)[0];
  const lastDot = cleanName.lastIndexOf('.');
  return lastDot >= 0 ? cleanName.slice(lastDot + 1) : '';
};

export const detectPonsCastFileType = (file: Pick<File, 'name' | 'type'>): PonsCastFileDetection => {
  const type = file.type?.trim().toLowerCase() || '';
  const extension = getExtension(file.name || '');

  if (type.startsWith('video/')) {
    return { kind: 'video', mimeType: type, extension, supported: true };
  }

  if (type === 'application/pdf') {
    return { kind: 'pdf', mimeType: type, extension, supported: true };
  }

  if (type.startsWith('image/')) {
    return { kind: 'image', mimeType: type, extension, supported: true };
  }

  if (extension === 'pdf') {
    return { kind: 'pdf', mimeType: 'application/pdf', extension, supported: true };
  }

  if (VIDEO_EXTENSIONS[extension]) {
    return { kind: 'video', mimeType: VIDEO_EXTENSIONS[extension], extension, supported: true };
  }

  if (IMAGE_EXTENSIONS[extension]) {
    return { kind: 'image', mimeType: IMAGE_EXTENSIONS[extension], extension, supported: true };
  }

  if (type.startsWith('text/')) {
    return { kind: 'other', mimeType: type, extension, supported: true };
  }

  return { kind: 'other', mimeType: type || 'application/octet-stream', extension, supported: false };
};

export const isSupportedPonsCastFile = (file: Pick<File, 'name' | 'type'>) => detectPonsCastFileType(file).supported;
