import { create } from 'zustand';
import { produce } from 'immer';
import Peer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance } from 'simple-peer';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useRelayStore, RelaySession, StreamMetadata } from '@/stores/useRelayStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { toast } from 'sonner';

interface RelayManagerSate {
  connections: Map<string, PeerInstance>;
  createRelayConnection: (peerId: string, initiator: boolean, metadata: StreamMetadata, peerNickname?: string, streamOverride?: MediaStream) => void;
  signalPeer: (peerId: string, signal: any) => void;
  removeRelayConnection: (peerId: string) => void;
}

export const useRelayManager = create<RelayManagerSate>((set, get) => ({
  connections: new Map(),

  createRelayConnection: (peerId, initiator, metadata, peerNickname, streamOverride) => {
    if (get().connections.has(peerId)) return;

    const { localStream } = useMediaDeviceStore.getState();
    const { iceServers } = useSignalingStore.getState();
    const { addRelaySession, updateRelaySession } = useRelayStore.getState();

    const peerOptions: Peer.Options = {
      initiator,
      trickle: true,
      config: { iceServers: iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: true }
    };

    if (initiator) {
      const isFileStreaming = useFileStreamingStore.getState().isStreaming
      const el = useFileStreamingStore.getState().presentationVideoEl
      let combined: MediaStream | null = null

      if (isFileStreaming && el) {
        console.log('[RelayManager] 🎥 Creating relay stream from file streaming', {
          videoElement: !!el,
          muted: el.muted,
          readyState: el.readyState,
          currentTime: el.currentTime
        })

        // ✅ 비디오 스트림 캡처
        let videoStream: MediaStream | null = null
        try {
          if (typeof (el as any).captureStream === 'function') {
            videoStream = (el as any).captureStream(30)
          } else if (typeof (el as any).mozCaptureStream === 'function') {
            videoStream = (el as any).mozCaptureStream(30)
          }
          console.log('[RelayManager] ✅ Video stream captured:', !!videoStream)
        } catch (e) {
          console.error('[RelayManager] Video capture failed:', e)
        }

        const s = new MediaStream()

        // ✅ 비디오 트랙 추가
        const videoTrack = videoStream?.getVideoTracks()[0] || null
        if (videoTrack) {
          s.addTrack(videoTrack.clone())
          console.log('[RelayManager] ✅ Video track added:', {
            id: videoTrack.id,
            enabled: videoTrack.enabled,
            muted: videoTrack.muted,
            readyState: videoTrack.readyState
          })
        } else {
          console.warn('[RelayManager] ❌ No video track available')
        }

        // ✅ 오디오 트랙 캡처 (개선된 방식)
        let audioTrack: MediaStreamTrack | null = null

        // 1. captureStream의 오디오 트랙 시도
        audioTrack = videoStream?.getAudioTracks()[0] || null
        if (audioTrack) {
          console.log('[RelayManager] ✅ Audio track from captureStream')
        }

        // 2. VideoJsPlayer에서 미리 준비된 AudioContext 사용
        if (!audioTrack && (el as any)._audioDestination) {
          try {
            const dest = (el as any)._audioDestination
            audioTrack = dest.stream.getAudioTracks()[0] || null
            if (audioTrack) {
              console.log('[RelayManager] ✅ Audio track from prepared AudioContext')
            }
          } catch (e) {
            console.error('[RelayManager] Prepared AudioContext failed:', e)
          }
        }

        // 3. AudioContext를 사용한 캡처 (Fallback)
        if (!audioTrack && !el.muted) {
          try {
            const ctx = new AudioContext()
            const src = ctx.createMediaElementSource(el)
            const dest = ctx.createMediaStreamDestination()

            // ✅ 게인 노드 추가 (볼륨 조절 가능)
            const gainNode = ctx.createGain()
            gainNode.gain.value = 1.0

            src.connect(gainNode)
            gainNode.connect(dest)

            audioTrack = dest.stream.getAudioTracks()[0] || null
            console.log('[RelayManager] ✅ Audio captured via AudioContext')

            // ✅ 정리 함수 저장
            (s as any)._audioContext = ctx
          } catch (e) {
            console.error('[RelayManager] AudioContext capture failed:', e)
          }
        }

        // 4. 로컬 스트림의 오디오 트랙 사용 (Last Resort)
        if (!audioTrack) {
          const base = streamOverride || localStream || null
          const localA = base?.getAudioTracks()[0] || null
          if (localA) {
            audioTrack = localA.clone()
            console.log('[RelayManager] ⚠️ Using local audio (microphone) as fallback')
          }
        }

        if (audioTrack) {
          s.addTrack(audioTrack)
          console.log('[RelayManager] ✅ Audio track added:', {
            id: audioTrack.id,
            enabled: audioTrack.enabled,
            muted: audioTrack.muted,
            readyState: audioTrack.readyState
          })
        } else {
          console.warn('[RelayManager] ❌ No audio track available')
        }

        combined = s

        console.log('[RelayManager] 🎯 Combined stream created:', {
          videoTracks: combined.getVideoTracks().length,
          audioTracks: combined.getAudioTracks().length,
          totalTracks: combined.getTracks().length
        })
      }

      if (!combined) {
        const base = streamOverride || localStream || null
        if (!base) {
          toast.error('Stream to relay is not available.')
          return
        }
        const v = base.getVideoTracks()[0] || null
        const s = new MediaStream()
        if (v) s.addTrack(v.clone())
        combined = s
        console.log('[RelayManager] ⚠️ Using fallback stream (local video only)')
      }
      peerOptions.stream = combined;
    }

    const peer = new Peer(peerOptions);

    peer.on('signal', (signal) => {
      useSignalingStore.getState().emit('relay:signal', { toUserId: peerId, signal });
    });

    peer.on('stream', (stream) => {
      updateRelaySession(peerId, { stream, status: 'connected' });
      useRelayStore.getState().onRelayStream(peerId, stream);
    });

    peer.on('connect', () => {
      updateRelaySession(peerId, { status: 'connected' });
    });

    peer.on('close', () => {
      get().removeRelayConnection(peerId);
    });

    peer.on('error', () => {
      updateRelaySession(peerId, { status: 'failed' });
      get().removeRelayConnection(peerId);
    });

    set(produce((state) => {
      state.connections.set(peerId, peer);
    }));

    const peerInfo = useRelayStore.getState().availableRooms
      .flatMap(r => r.peers)
      .find(p => p.userId === peerId);

    const newSession: RelaySession = {
      peerId,
      nickname: peerNickname || peerInfo?.nickname || 'Unknown',
      stream: null,
      metadata,
      isInitiator: initiator,
      status: 'connecting',
    };
    addRelaySession(newSession);
  },

  signalPeer: (peerId, signal) => {
    const peer = get().connections.get(peerId);
    if (peer && !peer.destroyed) peer.signal(signal);
  },

  removeRelayConnection: (peerId) => {
    set(produce((state) => {
      const peer = state.connections.get(peerId);
      if (peer && !peer.destroyed) peer.destroy();
      state.connections.delete(peerId);
    }));
    const relay = useRelayStore.getState();
    if (relay.takeoverMode && relay.takeoverPeerId === peerId) {
      relay.disableTakeover();
    }
    useRelayStore.getState().removeRelaySession(peerId);
  },
}));
