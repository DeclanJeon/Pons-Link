// frontend/src/stores/useRelayStore.ts
import { create } from 'zustand';
import { produce } from 'immer';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useRelayManager } from '@/hooks/useRelayManager';
import { toast } from 'sonner';
import React from 'react';
import { RelayRequestToast } from '@/components/functions/relay/RelayRequestToast';

export type RelayPeer = {
  userId: string;
  nickname: string;
  streamCount: number;
  streamLimit: number;
};

export type RelayRoom = {
  id: string;
  peers: RelayPeer[];
};

export type StreamMetadata = {
  streamLabel: string;
  streamType: 'video' | 'audio' | 'screen';
  mediaInfo: {
    resolution?: string;
    hasAudio?: boolean;
  };
  userId: string;
  sourcePeerId?: string;
};

export type RelaySession = {
  peerId: string;
  nickname: string;
  stream: MediaStream | null;
  metadata: StreamMetadata;
  isInitiator: boolean;
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
};

export type RelayRequest = {
  fromNickname: string;
  fromUserId: string;
  streamMetadata: StreamMetadata;
  timestamp: number;
};

type RelayState = {
  availableRooms: RelayRoom[];
  relaySessions: RelaySession[];
  incomingRequests: Map<string, RelayRequest>;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  takeoverMode: boolean;
  takeoverPeerId: string | null;
  takeoverSourceNickname: string | null;
};

type RelayActions = {
  requestRoomList: () => void;
  handleRoomList: (payload: { success: boolean; rooms?: RelayRoom[] }) => void;
  addRelaySession: (session: RelaySession) => void;
  updateRelaySession: (peerId: string, updates: Partial<RelaySession>) => void;
  removeRelaySession: (peerId: string) => void;
  handleIncomingRequest: (request: RelayRequest) => void;
  acceptRequestViewOnly: (fromUserId: string) => void;
  acceptRequestTakeover: (fromUserId: string, fromNickname: string) => void;
  handleRelayResponse: (response: { fromUserId: string; fromNickname?: string; response: 'accepted' | 'declined'; metadata: StreamMetadata }) => void;
  handleRelaySignal: (data: { fromUserId: string; signal: any }) => void;
  handleRelayTermination: (data: { fromUserId: string }) => void;
  handleFeedback: (data: { fromUserId: string; message: string; timestamp: number }) => void;
  handleRetransmitRequest: (data: { fromUserId: string; reason?: string; preference?: any; timestamp: number }) => void;
  handleRetransmitResponse: (data: { fromUserId: string; response: 'accepted' | 'declined'; message?: string; metadata?: any; timestamp: number }) => void;
  sendFeedback: (toUserId: string, message: string) => void;
  requestRetransmit: (toUserId: string, preference: any, reason?: string) => void;
  sendRelayRequest: (targetUserId: string, streamMetadata: StreamMetadata) => void;
  brokerRequestDirect: (sourceUserId: string, targetUserId: string, streamMetadata: StreamMetadata) => void;
  handleBrokerRequestDirect: (payload: { fromUserId: string; targetUserId: string; streamMetadata: StreamMetadata }) => void;
  terminateRelay: (peerId: string) => void;
  enableTakeover: (peerId: string, sourceNickname: string) => void;
  disableTakeover: () => Promise<void>;
  onRelayStream: (peerId: string, stream: MediaStream) => Promise<void>;
  clear: () => void;
};

export const useRelayStore = create<RelayState & RelayActions>((set, get) => ({
  availableRooms: [],
  relaySessions: [],
  incomingRequests: new Map(),
  loading: false,
  error: null,
  lastUpdated: null,
  takeoverMode: false,
  takeoverPeerId: null,
  takeoverSourceNickname: null,

  requestRoomList: () => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) {
      set({ error: 'Socket not connected' });
      return;
    }
    set({ loading: true, error: null });
    socket.emit('relay:request_list');
  },

  handleRoomList: (payload) => {
    if (!payload?.success) {
      set({ loading: false, error: 'Failed to fetch rooms' });
      return;
    }
    const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
    set({
      availableRooms: rooms,
      loading: false,
      error: null,
      lastUpdated: Date.now(),
    });
  },

  addRelaySession: (session) => set(state => ({ relaySessions: [...state.relaySessions, session] })),

  updateRelaySession: (peerId, updates) => set(state => ({
    relaySessions: state.relaySessions.map(session =>
      session.peerId === peerId ? { ...session, ...updates } : session
    ),
  })),

  removeRelaySession: (peerId) => set(state => ({
    relaySessions: state.relaySessions.filter(session => session.peerId !== peerId),
  })),

  handleIncomingRequest: (data) => {
    if (data && data.fromNickname && data.streamMetadata) {
      const request: RelayRequest = {
        fromNickname: data.fromNickname,
        fromUserId: data.fromUserId,
        streamMetadata: data.streamMetadata,
        timestamp: data.timestamp || Date.now(),
      };
      set(state => produce(state, draft => {
        draft.incomingRequests.set(request.fromUserId, request);
      }));
      toast.custom((t: string | number) =>
        React.createElement(RelayRequestToast, { toastId: t, request })
      , { duration: 30000 });
    }
  },

  acceptRequestViewOnly: (fromUserId) => {
    const { socket } = useSignalingStore.getState();
    const request = get().incomingRequests.get(fromUserId);
    if (!socket || !request) return;
    socket.emit('relay:response', {
      toUserId: fromUserId,
      response: 'accepted',
      metadata: request.streamMetadata
    });
    useRelayManager.getState().createRelayConnection(fromUserId, false, request.streamMetadata, request.fromNickname);
    set(state => produce(state, draft => {
      draft.incomingRequests.delete(fromUserId);
    }));
  },

  acceptRequestTakeover: (fromUserId, fromNickname) => {
    const { socket } = useSignalingStore.getState();
    const request = get().incomingRequests.get(fromUserId);
    if (!socket || !request) return;
    socket.emit('relay:response', {
      toUserId: fromUserId,
      response: 'accepted',
      metadata: request.streamMetadata
    });
    useRelayManager.getState().createRelayConnection(fromUserId, false, request.streamMetadata, request.fromNickname);
    set(state => produce(state, draft => {
      draft.incomingRequests.delete(fromUserId);
      draft.takeoverMode = true;
      draft.takeoverPeerId = fromUserId;
      draft.takeoverSourceNickname = fromNickname || request.fromNickname;
    }));
  },

  handleRelayResponse: (payload) => {
    const { fromUserId, response, metadata } = payload as any;
    if (response === 'accepted') {
      const nickname = (payload as any).fromNickname || 'Unknown';
      const meta = metadata || {
        streamLabel: 'Unknown',
        streamType: 'video' as const,
        mediaInfo: {},
        userId: fromUserId,
      };
      useRelayManager.getState().createRelayConnection(fromUserId, true, meta, nickname);
    } else {
      toast.info(`${fromUserId} declined your relay request.`);
    }
  },

  handleRelaySignal: (data) => {
    const { fromUserId, signal } = data;
    useRelayManager.getState().signalPeer(fromUserId, signal);
  },

  handleRelayTermination: (data) => {
    const { fromUserId } = data;
    useRelayManager.getState().removeRelayConnection(fromUserId);
    const s = get();
    if (s.takeoverMode && s.takeoverPeerId === fromUserId) {
      get().disableTakeover();
    }
  },

  handleFeedback: (data) => {
    const { fromUserId, message } = data;
    toast(`Feedback from ${fromUserId}: ${message}`);
  },

  handleRetransmitRequest: (data) => {
    const { fromUserId, reason } = data;
    toast.info(`${fromUserId} requested retransmission: ${reason || 'No reason provided'}`);
  },

  handleRetransmitResponse: (data) => {
    const { fromUserId, response, message } = data;
    if (response === 'accepted') {
      toast.success(`${fromUserId} accepted retransmission request`);
    } else {
      toast.info(`${fromUserId} declined retransmission request: ${message || 'No reason provided'}`);
    }
  },

  sendFeedback: (toUserId, message) => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) return;
    const { userId } = useSessionStore.getState();
    if (!userId) return;
    socket.emit('relay:feedback', {
      toUserId,
      message
    });
  },

  requestRetransmit: (toUserId, preference, reason) => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) return;
    const { userId } = useSessionStore.getState();
    if (!userId) return;
    socket.emit('relay:restart_request', {
      toUserId,
      reason,
      preference
    });
  },

  sendRelayRequest: (targetUserId, streamMetadata) => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) return;
    const { userId, nickname } = useSessionStore.getState();
    if (!userId || !nickname) return;
    socket.emit('relay:initiate', {
      toUserId: targetUserId,
      streamMetadata,
    });
    toast.info(`Relay request sent to ${targetUserId}.`);
  },

  brokerRequestDirect: (sourceUserId, targetUserId, streamMetadata) => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) return;
    const { userId } = useSessionStore.getState();
    if (!userId) return;
    socket.emit('broker:request_direct', {
      sourceUserId,
      targetUserId,
      streamMetadata
    });
    toast.info(`Requested direct relay from ${sourceUserId} to ${targetUserId}.`);
  },

  handleBrokerRequestDirect: (payload) => {
    const { targetUserId, streamMetadata } = payload as any;
    get().sendRelayRequest(targetUserId, streamMetadata);
  },

  terminateRelay: (peerId) => {
    const { socket } = useSignalingStore.getState();
    if (socket) {
      socket.emit('relay:terminate', { peerId });
    }
    useRelayManager.getState().removeRelayConnection(peerId);
  },

  enableTakeover: (peerId, sourceNickname) => {
    set({ takeoverMode: true, takeoverPeerId: peerId, takeoverSourceNickname: sourceNickname });
  },

  disableTakeover: async () => {
    const ok = await import('@/stores/useMediaDeviceStore').then(m => m.useMediaDeviceStore.getState().restoreOriginalMediaState());
    if (ok) {
      import('@/stores/useMediaDeviceStore').then(m => m.useMediaDeviceStore.setState({ localDisplayOverride: null } as any));
      set({ takeoverMode: false, takeoverPeerId: null, takeoverSourceNickname: null });
    }
  },

  onRelayStream: async (peerId, stream) => {
    const s = get();

    // ✅ 디버깅 로그 추가
    console.log('[RelayStore] 🎯 Relay stream received:', {
      peerId,
      takeoverMode: s.takeoverMode,
      takeoverPeerId: s.takeoverPeerId,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      totalTracks: stream.getTracks().length,
      streamActive: stream.active,
      streamId: stream.id
    });

    if (!s.takeoverMode || s.takeoverPeerId !== peerId) return;

    const v = stream.getVideoTracks()[0];
    if (!v) {
      console.warn('[RelayStore] ❌ No video track in relay stream');
      return;
    }

    console.log('[RelayStore] ✅ Video track found:', {
      id: v.id,
      enabled: v.enabled,
      muted: v.muted,
      readyState: v.readyState,
      label: v.label
    });

    const mediaStore = (await import('@/stores/useMediaDeviceStore')).useMediaDeviceStore.getState();
    await mediaStore.saveOriginalMediaState();
    const cloneV = v.clone();
    const remoteA = stream.getAudioTracks()[0];
    let cloneA: MediaStreamTrack | null = null;

    if (remoteA) {
      cloneA = remoteA.clone();
      console.log('[RelayStore] ✅ Remote audio track found:', {
        id: remoteA.id,
        enabled: remoteA.enabled,
        muted: remoteA.muted,
        readyState: remoteA.readyState
      });
    } else {
      console.log('[RelayStore] ⚠️ No remote audio track, using fallback');

      // ✅ 파일 스트리밍 중인지 확인
      const fileStreamingStore = (await import('@/stores/useFileStreamingStore')).useFileStreamingStore.getState();
      if (fileStreamingStore.isStreaming && fileStreamingStore.presentationVideoEl) {
        const videoEl = fileStreamingStore.presentationVideoEl;

        // VideoJsPlayer에서 준비된 오디오 컨텍스트 사용
        if ((videoEl as any)._audioDestination) {
          try {
            const dest = (videoEl as any)._audioDestination;
            const fileAudioTrack = dest.stream.getAudioTracks()[0];
            if (fileAudioTrack) {
              cloneA = fileAudioTrack.clone();
              console.log('[RelayStore] ✅ Using file streaming audio track');
            }
          } catch (e) {
            console.error('[RelayStore] File audio capture failed:', e);
          }
        }
      }

      // 마지막 수단: 로컬 마이크 또는 silent 오디오
      if (!cloneA) {
        const localA = mediaStore.localStream?.getAudioTracks()[0] || null;
        if (localA) {
          cloneA = localA.clone();
          console.log('[RelayStore] ⚠️ Using local microphone audio as fallback');
        } else {
          cloneA = await createSilentAudioTrack();
          console.log('[RelayStore] ⚠️ Using silent audio track as last resort');
        }
      }
    }

    const relayLocalStream = new MediaStream();
    relayLocalStream.addTrack(cloneV);
    if (cloneA) relayLocalStream.addTrack(cloneA);

    console.log('[RelayStore] 🎯 Relay local stream created:', {
      streamId: relayLocalStream.id,
      videoTracks: relayLocalStream.getVideoTracks().length,
      audioTracks: relayLocalStream.getAudioTracks().length,
      totalTracks: relayLocalStream.getTracks().length
    });
    const { webRTCManager } = (await import('@/stores/usePeerConnectionStore')).usePeerConnectionStore.getState();
    if (webRTCManager) {
      await webRTCManager.replaceLocalStream(relayLocalStream);
    }
    mediaStore.localStream?.getVideoTracks().forEach(t => t.stop());
    (await import('@/stores/useMediaDeviceStore')).useMediaDeviceStore.setState({
      localStream: relayLocalStream,
      localDisplayOverride: stream,
      isVideoEnabled: true,
      isAudioEnabled: !!cloneA
    } as any);
  },

  clear: () => set({ availableRooms: [], relaySessions: [], incomingRequests: new Map(), loading: false, error: null, lastUpdated: null, takeoverMode: false, takeoverPeerId: null, takeoverSourceNickname: null }),
}));

async function createSilentAudioTrack(): Promise<MediaStreamTrack> {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  oscillator.connect(gain);
  const dest = ctx.createMediaStreamDestination();
  gain.connect(dest);
  oscillator.start();
  const track = dest.stream.getAudioTracks()[0];
  return track;
}
