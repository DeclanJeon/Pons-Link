import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { SubtitleParser, SubtitleNode } from '@/lib/subtitle/parser';
import { MAX_MESSAGE_SIZE } from '@/lib/fileTransfer/fileTransferUtils';

type TrackPayload = {
  trackId: string;
  label: string;
  language: string;
  cues: SubtitleNode[];
  format?: 'vtt' | 'srt';
};

type SubtitleSyncPayload = {
  currentTime: number;
  cueId: string | null;
  activeTrackId: string | null;
  text?: string;
};

type SubtitleStatePayload = {
  activeTrackId?: string | null;
  position?: 'top' | 'bottom' | 'custom';
  style?: any;
};

const CHUNK_SIZE = 12 * 1024;

const encodeUTF8 = (text: string): Uint8Array => {
  return new TextEncoder().encode(text);
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const subtitleTransport = {
  async sendTrack(payload: TrackPayload) {
    const vtt = SubtitleParser.stringify(payload.cues, payload.format === 'srt' ? 'srt' : 'vtt');
    const bytes = encodeUTF8(vtt);
    const totalBytes = bytes.byteLength;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    const meta = {
      trackId: payload.trackId,
      label: payload.label,
      language: payload.language,
      totalBytes,
      totalChunks,
      format: 'vtt'
    };
    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify({ type: 'subtitle-track-meta', payload: meta }));
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const slice = bytes.subarray(start, end);
      const chunk = {
        trackId: payload.trackId,
        index: i,
        data: toBase64(slice)
      };
      usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify({ type: 'subtitle-track-chunk', payload: chunk }));
    }
  },
  sendState(state: any) {
    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify({ type: 'subtitle-state', payload: state }));
  },
  sendSync(currentTime: number, cueId: string | null, activeTrackId: string | null) {
    const text = useSubtitleStore.getState().currentCue?.text || '';
    usePeerConnectionStore.getState().sendToAllPeers(
      JSON.stringify({
        type: 'subtitle-sync',
        payload: { currentTime, cueId, activeTrackId, text }
      })
    );
  },
  sendRemoteEnable(trackId: string | null, enabled: boolean) {
    usePeerConnectionStore.getState().sendToAllPeers(
      JSON.stringify({
        type: 'subtitle-remote-enable',
        payload: { trackId, enabled }
      })
    );
  },
  receive(type: string, payload: any) {
    if (type === 'subtitle-sync') {
      const p = payload as SubtitleSyncPayload;
      const text = p.text || '';
      if (text) {
        useSubtitleStore.setState({
          remoteSubtitleCue: {
            id: p.cueId ?? 'remote-' + Date.now(),
            text,
            startTime: p.currentTime,
            endTime: p.currentTime + 3000 // 3초 기본 지속 시간
          }
        });
      } else if (p.activeTrackId) {
        const track = useSubtitleStore.getState().tracks.get(p.activeTrackId);
        if (track) {
          const t = p.currentTime;
          const cue = track.cues.find(c => t >= c.startTime && t <= c.endTime);
          if (cue) {
            useSubtitleStore.setState({ remoteSubtitleCue: cue });
          }
        }
      }
    } else if (type === 'subtitle-remote-enable') {
      const enabled = !!payload.enabled;
      useSubtitleStore.setState({ isRemoteSubtitleEnabled: enabled });
      if (!enabled) {
        useSubtitleStore.setState({ remoteSubtitleCue: null });
      }
    } else if (type === 'subtitle-state') {
      if (typeof payload.position !== 'undefined') {
        useSubtitleStore.setState({ position: payload.position });
      }
      if (payload.style) {
        const prev = useSubtitleStore.getState().style;
        useSubtitleStore.setState({ style: { ...prev, ...payload.style } });
      }
    } else if (type === 'subtitle-track-meta') {
      const incoming = new Map(useSubtitleStore.getState().incoming);
      incoming.set(payload.trackId, {
        trackId: payload.trackId,
        label: payload.label,
        language: payload.language,
        totalBytes: payload.totalBytes,
        totalChunks: payload.totalChunks,
        received: 0,
        chunks: new Array(payload.totalChunks).fill(''),
        format: payload.format || 'vtt'
      });
      useSubtitleStore.setState({ incoming });
      console.log(`[SubtitleTransport] Received track meta: ${payload.label} (${payload.totalChunks} chunks)`);
    } else if (type === 'subtitle-track-chunk') {
      const state = useSubtitleStore.getState();
      const incoming = new Map(state.incoming);
      const entry = incoming.get(payload.trackId);
      if (!entry) {
        console.warn(`[SubtitleTransport] Received chunk for unknown track: ${payload.trackId}`);
        return;
      }
      
      // 청크가 이미 수신되었는지 확인
      if (entry.chunks[payload.index] !== '') {
        console.log(`[SubtitleTransport] Duplicate chunk received: ${payload.trackId}[${payload.index}]`);
        return;
      }
      
      // 청크 저장
      entry.chunks[payload.index] = payload.data;
      entry.received += 1;
      
      console.log(`[SubtitleTransport] Received chunk ${payload.trackId}[${payload.index}/${entry.totalChunks}] (${entry.received}/${entry.totalChunks})`);
      
      // 모든 청크가 수신되었는지 확인
      if (entry.received >= entry.totalChunks) {
        try {
          console.log(`[SubtitleTransport] All chunks received for track ${payload.trackId}, assembling...`);
          
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
          
          const track = {
            id: entry.trackId,
            label: entry.label,
            language: entry.language,
            cues,
            cueIndexById
          };
          
          const tracks = new Map(state.tracks);
          tracks.set(track.id, track);
          incoming.delete(entry.trackId);
          
          useSubtitleStore.setState({ tracks, incoming });
          
          // 활성 트랙이 없으면 새로 수신된 트랙을 활성화
          if (!useSubtitleStore.getState().activeTrackId) {
            useSubtitleStore.setState({ activeTrackId: track.id });
            console.log(`[SubtitleTransport] Activated received track: ${track.label} (${track.cues.length} cues)`);
          }
          
          console.log(`[SubtitleTransport] Track assembled successfully: ${track.label} (${track.cues.length} cues)`);
        } catch (error) {
          console.error(`[SubtitleTransport] Failed to assemble track ${payload.trackId}:`, error);
          incoming.delete(entry.trackId);
          useSubtitleStore.setState({ incoming });
        }
      } else {
        incoming.set(payload.trackId, entry);
        useSubtitleStore.setState({ incoming });
      }
    }
  }
};