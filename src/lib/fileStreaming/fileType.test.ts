import { describe, expect, it } from 'vitest';
import { detectPonsCastFileType, isSupportedPonsCastFile } from './fileType';

const makeFile = (name: string, type = '') => new File(['x'], name, { type });

describe('detectPonsCastFileType', () => {
  it('detects video files by MIME type first', () => {
    expect(detectPonsCastFileType(makeFile('clip.bin', 'video/mp4'))).toMatchObject({ kind: 'video', mimeType: 'video/mp4' });
  });

  it('falls back to mobile/Safari extension-only video files', () => {
    expect(detectPonsCastFileType(makeFile('clip.MOV'))).toMatchObject({ kind: 'video', mimeType: 'video/quicktime' });
    expect(detectPonsCastFileType(makeFile('movie.webm'))).toMatchObject({ kind: 'video', mimeType: 'video/webm' });
    expect(detectPonsCastFileType(makeFile('presentation.m4v'))).toMatchObject({ kind: 'video', mimeType: 'video/mp4' });
  });

  it('falls back to extension-only PDF and image files', () => {
    expect(detectPonsCastFileType(makeFile('deck.PDF'))).toMatchObject({ kind: 'pdf', mimeType: 'application/pdf' });
    expect(detectPonsCastFileType(makeFile('photo.JPG'))).toMatchObject({ kind: 'image', mimeType: 'image/jpeg' });
    expect(detectPonsCastFileType(makeFile('capture.heic'))).toMatchObject({ kind: 'image', mimeType: 'image/heic' });
  });

  it('marks unknown files as unsupported but still keeps a best-effort MIME', () => {
    expect(detectPonsCastFileType(makeFile('archive.zip'))).toMatchObject({ kind: 'other', mimeType: 'application/octet-stream', supported: false });
    expect(isSupportedPonsCastFile(makeFile('archive.zip'))).toBe(false);
  });
});
