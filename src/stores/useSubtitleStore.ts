/**
 * @fileoverview 자막 Store - 로컬/리모트 자막 관리 및 동기화
 * @module stores/useSubtitleStore
 */

import { create } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';
import { SubtitleParser } from '@/lib/subtitle/parser';
import { usePeerConnectionStore } from './usePeerConnectionStore';

/**
 * 자막 큐
 */
export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  style?: {
    color?: string;
    fontSize?: string;
    position?: { x: number; y: number };
  };
}

/**
 * 자막 트랙
 */
export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  cues: SubtitleCue[];
  format: 'srt' | 'vtt' | 'ass' | 'ssa';
  isDefault?: boolean;
}

/**
 * 자막 스타일
 */
export interface SubtitleStyle {
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontWeight: 'normal' | 'bold';
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  edgeStyle: 'none' | 'dropshadow' | 'raised' | 'depressed' | 'uniform';
  edgeColor: string;
}

/**
 * Zustand Store State
 */
interface SubtitleState {
  // 로컬 자막
  tracks: Map<string, SubtitleTrack>;
  activeTrackId: string | null;
  currentCue: SubtitleCue | null;
  nextCue: SubtitleCue | null;
  
  // 리모트 자막
  remoteTracks: Map<string, SubtitleTrack>;
  remoteActiveTrackId: string | null;
  remoteSubtitleCue: SubtitleCue | null;
  isRemoteSubtitleEnabled: boolean;
  
  // 동기화 및 설정
  syncOffset: number;
  speedMultiplier: number;
  isEnabled: boolean;
  
  // UI 상태
  position: 'top' | 'bottom' | 'custom';
  customPosition: { x: number; y: number };
  style: SubtitleStyle;
  
  // 검색
  searchQuery: string;
  searchResults: Array<{ cue: SubtitleCue; trackId: string }>;
}

/**
 * Zustand Store Actions
 */
interface SubtitleActions {
  // 트랙 관리
  addTrack: (file: File) => Promise<void>;
  removeTrack: (trackId: string) => void;
  setActiveTrack: (trackId: string | null) => void;
  
  // 동기화
  syncWithVideo: (currentTime: number) => void;
  syncWithRemoteVideo: (currentTime: number) => void;
  receiveSubtitleSync: (currentTime: number, cueId: string | null, trackId: string | null) => void;
  setRemoteSubtitleCue: (cue: SubtitleCue | null) => void;
  
  // 설정
  adjustSyncOffset: (delta: number) => void;
  setSpeedMultiplier: (speed: number) => void;
  updateStyle: (style: Partial<SubtitleStyle>) => void;
  setPosition: (position: 'top' | 'bottom' | 'custom') => void;
  
  // 유틸리티
  searchInSubtitles: (query: string) => void;
  jumpToCue: (cue: SubtitleCue) => void;
  exportSubtitle: (trackId: string, format: 'srt' | 'vtt') => Blob;
  
  // P2P 통신
  broadcastTrack: (trackId: string) => void;
  receiveTrackChunk: (payload: any) => void;
  receiveTrackMeta: (payload: any) => void;
  receiveRemoteEnable: (payload: { trackId: string; enabled: boolean }) => void;
  broadcastSubtitleState: () => void;
  receiveSubtitleState: (state: Partial<SubtitleState>) => void;
  
  // 스토어 리셋
  reset: () => void;
}

/**
 * 자막 관리 Store
 */
export const useSubtitleStore = create<SubtitleState & SubtitleActions>((set, get) => ({
  // 초기 상태
  tracks: new Map(),
  activeTrackId: null,
  currentCue: null,
  nextCue: null,
  
  remoteTracks: new Map(),
  remoteActiveTrackId: null,
  remoteSubtitleCue: null,
  isRemoteSubtitleEnabled: false,
  
  syncOffset: 0,
  speedMultiplier: 1.0,
  isEnabled: true,
  position: 'bottom',
  customPosition: { x: 50, y: 90 },
  style: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 'medium',
    fontWeight: 'normal',
    color: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    edgeStyle: 'dropshadow',
    edgeColor: '#000000'
  },
  searchQuery: '',
  searchResults: [],

  /**
   * 자막 파일 추가 (Web Worker 사용)
   */
  addTrack: async (file: File): Promise<void> => {
    try {
      if (!validateSubtitleFile(file)) {
        return;
      }

      const worker = new Worker(
        new URL('../workers/subtitle.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.postMessage({ type: 'parse', file });

      worker.onmessage = (event) => {
        const { type, payload } = event.data;
        
        if (type === 'parsed') {
          set(produce((state: SubtitleState) => {
            state.tracks.set(payload.track.id, payload.track);
            
            if (!state.activeTrackId) {
              state.activeTrackId = payload.track.id;
            }
          }));
          
          worker.terminate();
        } else if (type === 'error') {
          toast.error(`Failed to parse subtitle: ${payload.error}`);
          worker.terminate();
        }
      };

      worker.onerror = (error) => {
        console.error('[SubtitleStore] Worker error:', error);
        toast.error('Failed to load subtitle file');
        worker.terminate();
      };
    } catch (error) {
      console.error('[SubtitleStore] Failed to add track:', error);
      toast.error('Failed to add subtitle track');
    }
  },

  /**
   * 자막 트랙 제거
   */
  removeTrack: (trackId: string): void => {
    set(produce((state: SubtitleState) => {
      state.tracks.delete(trackId);
      
      if (state.activeTrackId === trackId) {
        state.activeTrackId = null;
        state.currentCue = null;
        state.nextCue = null;
      }
    }));
  },

  /**
   * 활성 자막 트랙 설정
   */
  setActiveTrack: (trackId: string | null): void => {
    set(produce((state: SubtitleState) => {
      state.activeTrackId = trackId;
      state.currentCue = null;
      state.nextCue = null;
    }));
    
    get().broadcastSubtitleState();
  },

  /**
   * 로컬 비디오와 자막 동기화
   */
  syncWithVideo: (currentTime: number): void => {
    const { tracks, activeTrackId, syncOffset, speedMultiplier } = get();
    
    if (!activeTrackId) return;
    
    const track = tracks.get(activeTrackId);
    if (!track) return;
    
    const adjustedTime = currentTime + syncOffset;
    const scaledTime = adjustedTime * speedMultiplier;
    
    const currentCue = binarySearchCue(track.cues, scaledTime);
    const nextCue = findNextCue(track.cues, scaledTime);
    
    set({ currentCue, nextCue });
  },
  
  /**
   * 리모트 비디오와 자막 동기화
   */
  syncWithRemoteVideo: (currentTime: number): void => {
    const { remoteTracks, remoteActiveTrackId, syncOffset, speedMultiplier } = get();
    
    if (!remoteActiveTrackId) return;
    
    const track = remoteTracks.get(remoteActiveTrackId);
    if (!track) return;
    
    const adjustedTime = currentTime + syncOffset;
    const scaledTime = adjustedTime * speedMultiplier;
    
    const cue = binarySearchCue(track.cues, scaledTime);
    
    set({ remoteSubtitleCue: cue });
  },
  
  /**
   * 리모트 자막 동기화 수신
   */
  receiveSubtitleSync: (currentTime: number, cueId: string | null, trackId: string | null): void => {
    const { remoteTracks, syncOffset, speedMultiplier } = get();
    
    if (trackId && trackId !== get().remoteActiveTrackId) {
      set({ remoteActiveTrackId: trackId });
    }
    
    const track = remoteTracks.get(get().remoteActiveTrackId || '');
    if (!track) {
      if (cueId) {
        set({ remoteSubtitleCue: { id: cueId, text: '', startTime: 0, endTime: 0 } });
      } else {
        set({ remoteSubtitleCue: null });
      }
      return;
    }
    
    const adjustedTime = currentTime + syncOffset;
    const scaledTime = adjustedTime * speedMultiplier;
    const cue = binarySearchCue(track.cues, scaledTime);
    
    set({ remoteSubtitleCue: cue });
  },
  
  /**
   * 리모트 큐 직접 설정
   */
  setRemoteSubtitleCue: (cue: SubtitleCue | null): void => {
    set({ remoteSubtitleCue: cue });
  },

  /**
   * 동기화 오프셋 조정
   */
  adjustSyncOffset: (delta: number): void => {
    set(produce((state: SubtitleState) => {
      state.syncOffset += delta;
      state.syncOffset = Math.max(-10000, Math.min(10000, state.syncOffset));
    }));
    
    const offset = get().syncOffset;
    toast.info(
      `Subtitle delay: ${offset > 0 ? '+' : ''}${(offset / 1000).toFixed(2)}s`,
      { duration: 1000 }
    );
    
    get().broadcastSubtitleState();
  },

  /**
   * 속도 배율 설정
   */
  setSpeedMultiplier: (speed: number): void => {
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    set({ speedMultiplier: clampedSpeed });
    get().broadcastSubtitleState();
  },

  /**
   * 스타일 업데이트
   */
  updateStyle: (style: Partial<SubtitleStyle>): void => {
    set(produce((state: SubtitleState) => {
      state.style = { ...state.style, ...style };
    }));
  },

  /**
   * 위치 설정
   */
  setPosition: (position: 'top' | 'bottom' | 'custom'): void => {
    set({ position });
  },

  /**
   * 자막 내 검색
   */
  searchInSubtitles: (query: string): void => {
    if (!query.trim()) {
      set({ searchQuery: '', searchResults: [] });
      return;
    }
    
    const { tracks } = get();
    const results: Array<{ cue: SubtitleCue; trackId: string }> = [];
    
    tracks.forEach((track, trackId) => {
      track.cues.forEach(cue => {
        if (cue.text.toLowerCase().includes(query.toLowerCase())) {
          results.push({ cue, trackId });
        }
      });
    });
    
    set({ searchQuery: query, searchResults: results });
  },

  /**
   * 큐로 이동
   */
  jumpToCue: (cue: SubtitleCue): void => {
    const event = new CustomEvent('subtitle-jump', {
      detail: { time: cue.startTime / 1000 }
    });
    window.dispatchEvent(event);
  },

  /**
   * 자막 내보내기
   */
  exportSubtitle: (trackId: string, format: 'srt' | 'vtt'): Blob => {
    const track = get().tracks.get(trackId);
    if (!track) {
      throw new Error('Track not found');
    }
    
    const nodes = track.cues.map(cue => ({
      id: cue.id,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text
    }));
    
    const content = SubtitleParser.stringify(nodes, format);
    return new Blob([content], { type: 'text/plain' });
  },

  /**
   * 자막 트랙 브로드캐스트 (Host → Remote)
   */
  broadcastTrack: (trackId: string): void => {
    const track = get().tracks.get(trackId);
    if (!track) return;
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    
    const CHUNK_SIZE = 50;
    const totalChunks = Math.ceil(track.cues.length / CHUNK_SIZE);
    
    const metaPacket = {
      type: 'subtitle-track-meta',
      payload: {
        trackId: track.id,
        label: track.label,
        language: track.language,
        format: track.format,
        totalCues: track.cues.length,
        totalChunks
      }
    };
    
    sendToAllPeers(JSON.stringify(metaPacket));
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, track.cues.length);
      const cueChunk = track.cues.slice(start, end);
      
      const chunkPacket = {
        type: 'subtitle-track-chunk',
        payload: {
          trackId: track.id,
          chunkIndex: i,
          totalChunks,
          cues: cueChunk
        }
      };
      
      sendToAllPeers(JSON.stringify(chunkPacket));
    }
    
    console.log(`[SubtitleStore] Broadcasting subtitle track to peers (${totalChunks} chunks)`);
  },

  /**
   * 자막 트랙 청크 수신
   */
  receiveTrackChunk: (payload: any): void => {
    const { trackId, chunkIndex, totalChunks, cues } = payload;
    
    set(produce((state: SubtitleState) => {
      let track = state.remoteTracks.get(trackId);
      
      if (!track) {
        track = {
          id: trackId,
          label: '',
          language: '',
          cues: [],
          format: 'srt'
        };
        state.remoteTracks.set(trackId, track);
      }
      
      track.cues.push(...cues);
      
      if (track.cues.length >= totalChunks * 50) {
        track.cues.sort((a, b) => a.startTime - b.startTime);
        console.log(`[SubtitleStore] Subtitle track fully received: ${track.label}`);
      }
    }));
  },

  /**
   * 자막 트랙 메타데이터 수신
   */
  receiveTrackMeta: (payload: any): void => {
    const { trackId, label, language, format, totalCues, totalChunks } = payload;
    
    set(produce((state: SubtitleState) => {
      state.remoteTracks.set(trackId, {
        id: trackId,
        label,
        language,
        format,
        cues: []
      });
      
      if (!state.remoteActiveTrackId) {
        state.remoteActiveTrackId = trackId;
      }
    }));
    
    console.log(`[SubtitleStore] Receiving subtitle track: ${label} (${totalCues} cues, ${totalChunks} chunks)`);
  },
  
  /**
   * 리모트 자막 활성화 수신
   */
  receiveRemoteEnable: (payload: { trackId: string; enabled: boolean }): void => {
    set(produce((state: SubtitleState) => {
      state.isRemoteSubtitleEnabled = payload.enabled;
      if (payload.enabled && payload.trackId) {
        state.remoteActiveTrackId = payload.trackId;
        console.log(`[SubtitleStore] Remote subtitle enabled for track: ${payload.trackId}`);
      } else {
        console.log('[SubtitleStore] Remote subtitle disabled');
      }
    }));
  },

  /**
   * 자막 상태 브로드캐스트
   */
  broadcastSubtitleState: (): void => {
    const { activeTrackId, syncOffset, speedMultiplier, isEnabled } = get();
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    
    const packet = {
      type: 'subtitle-state',
      payload: {
        activeTrackId,
        syncOffset,
        speedMultiplier,
        isEnabled,
        timestamp: Date.now()
      }
    };
    
    sendToAllPeers(JSON.stringify(packet));
  },

  /**
   * 자막 상태 수신
   */
  receiveSubtitleState: (state: Partial<SubtitleState>): void => {
    set(produce((draft: SubtitleState) => {
      Object.assign(draft, state);
    }));
  },

  /**
   * 스토어 리셋
   */
  reset: (): void => {
    set({
      tracks: new Map(),
      activeTrackId: null,
      currentCue: null,
      nextCue: null,
      remoteTracks: new Map(),
      remoteActiveTrackId: null,
      remoteSubtitleCue: null,
      isRemoteSubtitleEnabled: false,
      syncOffset: 0,
      speedMultiplier: 1.0,
      isEnabled: true,
      position: 'bottom',
      customPosition: { x: 50, y: 90 },
      searchQuery: '',
      searchResults: []
    });
  }
}));

/**
 * 이진 탐색으로 현재 큐 찾기
 */
function binarySearchCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  let left = 0;
  let right = cues.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cue = cues[mid];
    
    if (time >= cue.startTime && time <= cue.endTime) {
      return cue;
    }
    
    if (time < cue.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return null;
}

/**
 * 다음 큐 찾기
 */
function findNextCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  for (const cue of cues) {
    if (cue.startTime > time) {
      return cue;
    }
  }
  return null;
}

/**
 * 자막 파일 유효성 검사
 */
function validateSubtitleFile(file: File): boolean {
  const validExtensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  
  if (!validExtensions.includes(ext)) {
    toast.error('Unsupported subtitle format');
    return false;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    toast.error('Subtitle file too large (max 10MB)');
    return false;
  }
  
  return true;
}
