// src/lib/compressionTransfer.ts

import pako from 'pako';

export class CompressionTransfer {
  private readonly COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB 이상만 압축

  shouldCompress(file: File): boolean {
    // 이미 압축된 파일 형식 제외
    const compressedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/',
      'audio/',
      '.zip',
      '.gz',
      '.7z',
      '.rar',
    ];

    const isCompressed = compressedTypes.some(type =>
      file.type.includes(type) || file.name.toLowerCase().endsWith(type)
    );

    return !isCompressed && file.size >= this.COMPRESSION_THRESHOLD;
  }

  async compressChunk(data: ArrayBuffer): Promise<ArrayBuffer> {
    const compressed = pako.deflate(new Uint8Array(data));
    return compressed.buffer;
  }

  async decompressChunk(data: ArrayBuffer): Promise<ArrayBuffer> {
    const decompressed = pako.inflate(new Uint8Array(data));
    return decompressed.buffer;
  }

  calculateCompressionRatio(original: number, compressed: number): number {
    return ((original - compressed) / original) * 100;
  }
}