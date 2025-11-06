import { create } from 'zustand';
import { SubtitleNode, SubtitleParser } from '@/lib/subtitle/parser';
import { subtitleTransport } from '@/services/subtitleTransport';

type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
type FontWeight = 'normal' | 'bold';
type EdgeStyle = 'none' | 'dropshadow' | 'raised' | 'depressed' | 'uniform';
type Position = 'top' | 'bottom' | 'center' | 'custom';

type SubtitleStyle = {
  fontFamily: string;
  fontSize: FontSize;
  fontWeight: FontWeight;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  edgeStyle: EdgeStyle;
  edgeColor: string;
};

type Track = {
  id: string;
  label: string;
  language: string;
  cues: SubtitleNode[];
  cueIndexById: Map<string, number>;
};

type IncomingAssembler = {
  trackId: string;
  label: string;
  language: string;
  totalBytes: number;
  totalChunks: number;
  received: number;
  chunks: string[];
  format: 'vtt' | 'srt';
};

type State = {
  tracks: Map<string, Track>;
  activeTrackId: string | null;
  isEnabled: boolean;
  isRemoteSubtitleEnabled: boolean;
  currentCue: SubtitleNode | null;
  remoteSubtitleCue: SubtitleNode | null;
  position: Position;
  customPosition: { x: number; y: number };
  style: SubtitleStyle;
  syncOffset: number;
  speedMultiplier: number;
  incoming: Map<string, IncomingAssembler>;
  addTrack: (file: File) => Promise<void>;
  setActiveTrack: (id: string | null) => void;
  adjustSyncOffset: (deltaMs: number) => void;
  setSpeedMultiplier: (v: number) => void;
  setPosition: (p: Position) => void;
  updateStyle: (s: Partial<SubtitleStyle>) => void;
  broadcastTrack: (trackId: string) => void;
  broadcastSubtitleState: () => void;
  syncWithVideo: (currentTimeMs: number) => void;
  syncWithRemoteVideo: (currentTimeMs: number) => void;
  receiveSubtitleSync: (currentTimeMs: number, cueId: string | null, activeTrackId: string | null) => void;
  receiveSubtitleState: (state: any) => void;
  receiveRemoteEnable: (payload: { trackId: string; enabled: boolean }) => void;
  receiveTrackMeta: (meta: { trackId: string; label: string; language: string; totalBytes: number; totalChunks: number; format: 'vtt' | 'srt' }) => void;
  receiveTrackChunk: (chunk: { trackId: string; index: number; data: string }) => void;
};

const defaultStyle: SubtitleStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 'medium',
  fontWeight: 'normal',
  color: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  edgeStyle: 'dropshadow',
  edgeColor: '#000000'
};

const binarySearchCue = (cues: SubtitleNode[], t: number) => {
  let l = 0, r = cues.length - 1, ans = -1;
  while (l <= r) {
    const m = (l + r) >> 1;
    if (cues[m].startTime <= t && t < cues[m].endTime) return m;
    if (cues[m].endTime <= t) l = m + 1; else r = m - 1;
  }
  return ans;
};

export const useSubtitleStore = create<State>((set, get) => ({
  tracks: new Map(),
  activeTrackId: null,
  isEnabled: true,
  isRemoteSubtitleEnabled: false,
  currentCue: null,
  remoteSubtitleCue: null,
  position: 'bottom',
  customPosition: { x: 50, y: 85 },
  style: defaultStyle,
  syncOffset: 0,
  speedMultiplier: 1,
  incoming: new Map(),
  async addTrack(file: File) {
    const text = await file.text();
    const ext = file.name.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt';
    const cues = SubtitleParser.parse(text, ext);
    const id = `${ext}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const label = file.name;
    const language = 'und';
    const cueIndexById = new Map<string, number>();
    cues.forEach((c, i) => cueIndexById.set(c.id, i));
    const track: Track = { id, label, language, cues, cueIndexById };
    const tracks = new Map(get().tracks);
    tracks.set(id, track);
    set({ tracks, activeTrackId: id });
  },
  setActiveTrack(id) {
    set({ activeTrackId: id });
    get().broadcastSubtitleState();
  },
  adjustSyncOffset(deltaMs) {
    set({ syncOffset: get().syncOffset + deltaMs });
    get().broadcastSubtitleState();
  },
  setSpeedMultiplier(v) {
    set({ speedMultiplier: Math.max(0.5, Math.min(2, v)) });
    get().broadcastSubtitleState();
  },
  setPosition(p) {
    set({ position: p });
    get().broadcastSubtitleState();
  },
  updateStyle(s) {
    set({ style: { ...get().style, ...s } });
    get().broadcastSubtitleState();
  },
  broadcastTrack(trackId) {
    const t = get().tracks.get(trackId || '');
    if (!t) return;
    subtitleTransport.sendTrack({
      trackId: t.id,
      label: t.label,
      language: t.language,
      cues: t.cues,
      format: 'vtt'
    });
  },
  broadcastSubtitleState() {
    const state = {
      isEnabled: get().isEnabled,
      position: get().position,
      customPosition: get().customPosition,
      style: get().style,
      syncOffset: get().syncOffset,
      speedMultiplier: get().speedMultiplier,
      activeTrackId: get().activeTrackId
    };
    subtitleTransport.sendState(state);
  },
  syncWithVideo(currentTimeMs) {
    const { activeTrackId, tracks, syncOffset, speedMultiplier } = get();
    if (!activeTrackId) {
      set({ currentCue: null });
      return;
    }
    const t = tracks.get(activeTrackId);
    if (!t || t.cues.length === 0) {
      set({ currentCue: null });
      return;
    }
    const adj = currentTimeMs * speedMultiplier + syncOffset;
    const idx = binarySearchCue(t.cues, adj);
    set({ currentCue: idx >= 0 ? t.cues[idx] : null });
  },
  syncWithRemoteVideo(currentTimeMs) {
    const { activeTrackId, tracks, syncOffset, speedMultiplier } = get();
    if (!activeTrackId) return;
    const t = tracks.get(activeTrackId);
    if (!t || t.cues.length === 0) return;
    const adj = currentTimeMs * speedMultiplier + syncOffset;
    const idx = binarySearchCue(t.cues, adj);
    set({ remoteSubtitleCue: idx >= 0 ? t.cues[idx] : null });
  },
  receiveSubtitleSync(currentTimeMs, cueId, activeTrackId) {
    if (activeTrackId) {
      const s = get();
      if (s.activeTrackId !== activeTrackId) set({ activeTrackId });
    }
    if (cueId) {
      const { tracks, activeTrackId: id } = get();
      const t = id ? tracks.get(id) : null;
      if (t && t.cueIndexById.has(cueId)) {
        const idx = t.cueIndexById.get(cueId)!;
        set({ remoteSubtitleCue: t.cues[idx] });
        return;
      }
    }
    // activeTrackId가 있을 때만 syncWithRemoteVideo 호출
    const { activeTrackId: currentId } = get();
    if (currentId) {
      get().syncWithRemoteVideo(currentTimeMs);
    }
  },
  receiveSubtitleState(state) {
    if (typeof state.isEnabled === 'boolean') set({ isRemoteSubtitleEnabled: state.isEnabled });
    if (typeof state.position !== 'undefined') set({ position: state.position });
    if (state.customPosition) set({ customPosition: state.customPosition });
    if (state.style) {
      const prev = get().style;
      set({ style: { ...prev, ...state.style } });
    }
  },
  receiveRemoteEnable(payload) {
    set({ isRemoteSubtitleEnabled: !!payload.enabled });
    if (payload.trackId) set({ activeTrackId: payload.trackId });
  },
  receiveTrackMeta(meta) {
    const incoming = new Map(get().incoming);
    incoming.set(meta.trackId, {
      trackId: meta.trackId,
      label: meta.label,
      language: meta.language,
      totalBytes: meta.totalBytes,
      totalChunks: meta.totalChunks,
      received: 0,
      chunks: new Array(meta.totalChunks).fill(''),
      format: meta.format || 'vtt'
    });
    set({ incoming });
    console.log(`[SubtitleStore] Received track meta: ${meta.label} (${meta.totalChunks} chunks)`);
  },
  receiveTrackChunk(chunk) {
    const incoming = new Map(get().incoming);
    const entry = incoming.get(chunk.trackId);
    if (!entry) {
      console.warn(`[SubtitleStore] Received chunk for unknown track: ${chunk.trackId}`);
      return;
    }
    
    // 청크가 이미 수신되었는지 확인
    if (entry.chunks[chunk.index] !== '') {
      console.log(`[SubtitleStore] Duplicate chunk received: ${chunk.trackId}[${chunk.index}]`);
      return;
    }
    
    // 청크 저장
    entry.chunks[chunk.index] = chunk.data;
    entry.received += 1;
    
    console.log(`[SubtitleStore] Received chunk ${chunk.trackId}[${chunk.index}/${entry.totalChunks}] (${entry.received}/${entry.totalChunks})`);
    
    // 모든 청크가 수신되었는지 확인
    if (entry.received >= entry.totalChunks) {
      try {
        console.log(`[SubtitleStore] All chunks received for track ${chunk.trackId}, assembling...`);
        
        // 청크 조립
        const base64 = entry.chunks.join('');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const text = new TextDecoder().decode(bytes);
        
        // 자막 파싱
        const cues = SubtitleParser.parse(text, entry.format);
        const cueIndexById = new Map<string, number>();
        cues.forEach((c, i) => cueIndexById.set(c.id, i));
        
        const track: Track = {
          id: entry.trackId,
          label: entry.label,
          language: entry.language,
          cues,
          cueIndexById
        };
        
        const tracks = new Map(get().tracks);
        tracks.set(track.id, track);
        incoming.delete(entry.trackId);
        
        set({ tracks, incoming });
        
        // 활성 트랙이 없으면 새로 수신된 트랙을 활성화
        if (!get().activeTrackId) {
          set({ activeTrackId: track.id });
          console.log(`[SubtitleStore] Activated received track: ${track.label} (${track.cues.length} cues)`);
        }
        
        console.log(`[SubtitleStore] Track assembled successfully: ${track.label} (${track.cues.length} cues)`);
      } catch (error) {
        console.error(`[SubtitleStore] Failed to assemble track ${chunk.trackId}:`, error);
        incoming.delete(entry.trackId);
        set({ incoming });
      }
    } else {
      incoming.set(chunk.trackId, entry);
      set({ incoming });
    }
  }
}));
