export const PONSCAST_BINARY_TYPE = 9;
export const PONSCAST_FRAME_HEADER_BYTES = 13;
export const PONSCAST_METADATA_EVENT = 'ponscast-metadata';
export const PONSCAST_BINARY_EVENT = 'ponscast-binary-data';
export const PONSCAST_STREAM_END_EVENT = 'ponscast-stream-end';

export interface PonsCastFrame {
  seq: number;
  timestamp: number;
  payload: ArrayBuffer;
}

export interface PonsCastStreamMetadata {
  senderId?: string;
  streamId: string;
  mimeType: string;
  fileType: string;
  fileName?: string;
  fileSize?: number;
  strategy?: string;
  startedAt: number;
}

export const createPonsCastFrame = (seq: number, payload: ArrayBuffer, timestamp = Date.now()): ArrayBuffer => {
  const header = new ArrayBuffer(PONSCAST_FRAME_HEADER_BYTES);
  const view = new DataView(header);
  view.setUint8(0, PONSCAST_BINARY_TYPE);
  view.setUint32(1, seq);
  view.setFloat64(5, timestamp);
  const out = new Uint8Array(header.byteLength + payload.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(new Uint8Array(payload), header.byteLength);
  return out.buffer;
};

export const parsePonsCastFrame = (data: ArrayBuffer): PonsCastFrame | null => {
  if (data.byteLength < PONSCAST_FRAME_HEADER_BYTES) return null;
  const view = new DataView(data);
  if (view.getUint8(0) !== PONSCAST_BINARY_TYPE) return null;
  return {
    seq: view.getUint32(1),
    timestamp: view.getFloat64(5),
    payload: data.slice(PONSCAST_FRAME_HEADER_BYTES),
  };
};

export const getSafePonsCastMimeType = (requested?: string | null) => {
  const candidates = [
    requested,
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/mp4',
  ].filter(Boolean) as string[];

  const mediaSource = typeof MediaSource !== 'undefined' ? MediaSource : null;
  if (!mediaSource || typeof mediaSource.isTypeSupported !== 'function') {
    return requested || 'video/webm';
  }

  return candidates.find(candidate => mediaSource.isTypeSupported(candidate)) || requested || 'video/webm';
};
