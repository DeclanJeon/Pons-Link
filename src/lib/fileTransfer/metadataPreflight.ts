/**
 * 메타데이터 선전송
 * 파일 메타데이터와 첫 번째 청크를 함께 전송하여 초기 레이턴시를 제거합니다.
 */

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  checksum?: string;
  totalChunks: number;
  chunkSize: number;
}

export interface ChunkMetadata {
  index: number;
  data: ArrayBuffer;
  checksum: string;
  size: number;
}

export interface ThumbnailData {
  data: ArrayBuffer;
  width: number;
  height: number;
  type: string;
}

export interface PreflightPacket {
  transferId: string;
  metadata: FileMetadata;
  firstChunk?: ChunkMetadata;
  thumbnail?: ThumbnailData;
  timestamp: number;
}

export class MetadataPreflight {
  private chunkSize: number;
  
  constructor(chunkSize: number = 64 * 1024) {
    this.chunkSize = chunkSize;
  }
  
  /**
   * 전송 준비 패킷 생성
   */
  async prepareTransfer(file: File, transferId: string): Promise<PreflightPacket> {
    console.log(`[MetadataPreflight] Preparing transfer for ${file.name}`);
    
    // 병렬 작업 실행
    const [checksum, firstChunk, thumbnail] = await Promise.all([
      this.calculateFileChecksum(file),
      this.readFirstChunk(file),
      this.generateThumbnail(file)
    ]);
    
    // 메타데이터 생성
    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      checksum,
      totalChunks: Math.ceil(file.size / this.chunkSize),
      chunkSize: this.chunkSize
    };
    
    // 첫 번째 청크 메타데이터
    let firstChunkMetadata: ChunkMetadata | undefined;
    if (firstChunk) {
      firstChunkMetadata = {
        index: 0,
        data: firstChunk,
        checksum: await this.calculateChecksum(firstChunk),
        size: firstChunk.byteLength
      };
    }
    
    // 프리플라이트 패킷 생성
    const preflightPacket: PreflightPacket = {
      transferId,
      metadata,
      firstChunk: firstChunkMetadata,
      thumbnail,
      timestamp: Date.now()
    };
    
    console.log(`[MetadataPreflight] Preflight packet prepared:`, {
      transferId,
      fileName: file.name,
      fileSize: file.size,
      hasFirstChunk: !!firstChunkMetadata,
      hasThumbnail: !!thumbnail
    });
    
    return preflightPacket;
  }
  
  /**
   * 파일 체크섬 계산
   */
  private async calculateFileChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * 첫 번째 청크 읽기
   */
  private async readFirstChunk(file: File): Promise<ArrayBuffer | null> {
    if (file.size === 0) return null;
    
    try {
      const chunkSize = Math.min(this.chunkSize, file.size);
      const blob = file.slice(0, chunkSize);
      return await blob.arrayBuffer();
    } catch (error) {
      console.error('[MetadataPreflight] Failed to read first chunk:', error);
      return null;
    }
  }
  
  /**
   * 체크섬 계산
   */
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * 썸네일 생성
   */
  private async generateThumbnail(file: File): Promise<ThumbnailData | null> {
    if (!file.type.startsWith('image/')) {
      return null;
    }
    
    try {
      // 이미지 로드
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      
      // OffscreenCanvas로 썸네일 생성
      const canvas = new OffscreenCanvas(200, 200);
      const ctx = canvas.getContext('2d')!;
      
      // 비율 유지하며 리사이즈
      const scale = Math.min(200 / img.width, 200 / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      
      // 캔버스 크기 조정
      const resizedCanvas = new OffscreenCanvas(width, height);
      const resizedCtx = resizedCanvas.getContext('2d')!;
      resizedCtx.drawImage(img, 0, 0, width, height);
      
      // 200x200 캔버스에 중앙 배치
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 200, 200);
      const x = (200 - width) / 2;
      const y = (200 - height) / 2;
      ctx.drawImage(resizedCanvas, x, y);
      
      // JPEG으로 변환 (압축률 70%)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      const arrayBuffer = await blob!.arrayBuffer();
      
      // 정리
      URL.revokeObjectURL(img.src);
      
      return {
        data: arrayBuffer,
        width: 200,
        height: 200,
        type: 'image/jpeg'
      };
    } catch (error) {
      console.error('[MetadataPreflight] Failed to generate thumbnail:', error);
      return null;
    }
  }
  
  /**
   * 프리플라이트 패킷 직렬화
   */
  static serializePacket(packet: PreflightPacket): ArrayBuffer {
    // 메타데이터 직렬화
    const metadataJson = JSON.stringify(packet.metadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);
    
    // 첫 번째 청크 직렬화
    let firstChunkBytes: Uint8Array | null = null;
    if (packet.firstChunk) {
      const chunkJson = JSON.stringify({
        index: packet.firstChunk.index,
        checksum: packet.firstChunk.checksum,
        size: packet.firstChunk.size
      });
      firstChunkBytes = new TextEncoder().encode(chunkJson);
    }
    
    // 썸네일 직렬화
    let thumbnailBytes: Uint8Array | null = null;
    if (packet.thumbnail) {
      const thumbnailJson = JSON.stringify({
        width: packet.thumbnail.width,
        height: packet.thumbnail.height,
        type: packet.thumbnail.type
      });
      thumbnailBytes = new TextEncoder().encode(thumbnailJson);
    }
    
    // 전체 크기 계산
    let totalSize = 0;
    totalSize += 4; // transferId 길이
    totalSize += packet.transferId.length; // transferId
    totalSize += 4; // metadata 길이
    totalSize += metadataBytes.length; // metadata
    totalSize += 1; // 첫 번째 청크 존재 여부
    if (firstChunkBytes) {
      totalSize += 4; // 청크 메타데이터 길이
      totalSize += firstChunkBytes.length; // 청크 메타데이터
      totalSize += 4; // 청크 데이터 길이
      totalSize += packet.firstChunk.data.byteLength; // 청크 데이터
    }
    totalSize += 1; // 썸네일 존재 여부
    if (thumbnailBytes) {
      totalSize += 4; // 썸네일 메타데이터 길이
      totalSize += thumbnailBytes.length; // 썸네일 메타데이터
      totalSize += 4; // 썸네일 데이터 길이
      totalSize += packet.thumbnail.data.byteLength; // 썸네일 데이터
    }
    totalSize += 8; // timestamp
    
    // 버퍼 생성
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // transferId
    view.setUint32(offset, packet.transferId.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, packet.transferId.length).set(new TextEncoder().encode(packet.transferId));
    offset += packet.transferId.length;
    
    // metadata
    view.setUint32(offset, metadataBytes.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, metadataBytes.length).set(metadataBytes);
    offset += metadataBytes.length;
    
    // 첫 번째 청크
    view.setUint8(offset, packet.firstChunk ? 1 : 0);
    offset += 1;
    if (packet.firstChunk && firstChunkBytes) {
      view.setUint32(offset, firstChunkBytes.length, false);
      offset += 4;
      new Uint8Array(buffer, offset, firstChunkBytes.length).set(firstChunkBytes);
      offset += firstChunkBytes.length;
      
      view.setUint32(offset, packet.firstChunk.data.byteLength, false);
      offset += 4;
      new Uint8Array(buffer, offset, packet.firstChunk.data.byteLength).set(new Uint8Array(packet.firstChunk.data));
      offset += packet.firstChunk.data.byteLength;
    }
    
    // 썸네일
    view.setUint8(offset, packet.thumbnail ? 1 : 0);
    offset += 1;
    if (packet.thumbnail && thumbnailBytes) {
      view.setUint32(offset, thumbnailBytes.length, false);
      offset += 4;
      new Uint8Array(buffer, offset, thumbnailBytes.length).set(thumbnailBytes);
      offset += thumbnailBytes.length;
      
      view.setUint32(offset, packet.thumbnail.data.byteLength, false);
      offset += 4;
      new Uint8Array(buffer, offset, packet.thumbnail.data.byteLength).set(new Uint8Array(packet.thumbnail.data));
      offset += packet.thumbnail.data.byteLength;
    }
    
    // timestamp
    view.setBigUint64(offset, BigInt(packet.timestamp), false);
    
    return buffer;
  }
  
  /**
   * 프리플라이트 패킷 역직렬화
   */
  static deserializePacket(buffer: ArrayBuffer): PreflightPacket {
    const view = new DataView(buffer);
    let offset = 0;
    
    // transferId
    const transferIdLength = view.getUint32(offset, false);
    offset += 4;
    const transferIdBytes = new Uint8Array(buffer, offset, transferIdLength);
    const transferId = new TextDecoder().decode(transferIdBytes);
    offset += transferIdLength;
    
    // metadata
    const metadataLength = view.getUint32(offset, false);
    offset += 4;
    const metadataBytes = new Uint8Array(buffer, offset, metadataLength);
    const metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as FileMetadata;
    offset += metadataLength;
    
    // 첫 번째 청크
    const hasFirstChunk = view.getUint8(offset) === 1;
    offset += 1;
    let firstChunk: ChunkMetadata | undefined;
    if (hasFirstChunk) {
      const chunkMetaLength = view.getUint32(offset, false);
      offset += 4;
      const chunkMetaBytes = new Uint8Array(buffer, offset, chunkMetaLength);
      const chunkMeta = JSON.parse(new TextDecoder().decode(chunkMetaBytes));
      offset += chunkMetaLength;
      
      const chunkDataLength = view.getUint32(offset, false);
      offset += 4;
      const chunkData = buffer.slice(offset, offset + chunkDataLength);
      offset += chunkDataLength;
      
      firstChunk = {
        index: chunkMeta.index,
        checksum: chunkMeta.checksum,
        size: chunkMeta.size,
        data: chunkData
      };
    }
    
    // 썸네일
    const hasThumbnail = view.getUint8(offset) === 1;
    offset += 1;
    let thumbnail: ThumbnailData | undefined;
    if (hasThumbnail) {
      const thumbnailMetaLength = view.getUint32(offset, false);
      offset += 4;
      const thumbnailMetaBytes = new Uint8Array(buffer, offset, thumbnailMetaLength);
      const thumbnailMeta = JSON.parse(new TextDecoder().decode(thumbnailMetaBytes));
      offset += thumbnailMetaLength;
      
      const thumbnailDataLength = view.getUint32(offset, false);
      offset += 4;
      const thumbnailData = buffer.slice(offset, offset + thumbnailDataLength);
      offset += thumbnailDataLength;
      
      thumbnail = {
        width: thumbnailMeta.width,
        height: thumbnailMeta.height,
        type: thumbnailMeta.type,
        data: thumbnailData
      };
    }
    
    // timestamp
    const timestamp = Number(view.getBigUint64(offset, false));
    
    return {
      transferId,
      metadata,
      firstChunk,
      thumbnail,
      timestamp
    };
  }
  
  /**
   * 썸네일 URL 생성
   */
  static createThumbnailURL(thumbnail: ThumbnailData): string {
    const blob = new Blob([thumbnail.data], { type: thumbnail.type });
    return URL.createObjectURL(blob);
  }
  
  /**
   * 썸네일 URL 정리
   */
  static revokeThumbnailURL(url: string): void {
    URL.revokeObjectURL(url);
  }
}