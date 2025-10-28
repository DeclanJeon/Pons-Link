// src/stores/useRelayStore.ts

import { create } from 'zustand';
import { produce } from 'immer';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useRelayManager } from '@/hooks/useRelayManager'; // WebRTC 관리자 import
import { toast } from 'sonner'; // sonner의 toast 직접 사용
import { RelayRequestToast } from '@/components/functions/relay/RelayRequestToast'; // 커스텀 Toast 컴포넌트
import React from 'react';

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
  incomingRequests: Map<string, RelayRequest>; // 수신된 요청 관리
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
};

type RelayActions = {
  requestRoomList: () => void;
  handleRoomList: (payload: { success: boolean; rooms?: RelayRoom[] }) => void;
  addRelaySession: (session: RelaySession) => void;
  updateRelaySession: (peerId: string, updates: Partial<RelaySession>) => void;
  removeRelaySession: (peerId: string) => void;
  handleIncomingRequest: (request: RelayRequest) => void;
  handleRelayResponse: (response: { fromUserId: string; response: 'accepted' | 'declined'; metadata: StreamMetadata }) => void;
  handleRelaySignal: (data: { fromUserId: string; signal: any }) => void;
  handleRelayTermination: (data: { fromUserId: string }) => void;
  sendRelayRequest: (targetUserId: string, streamMetadata: StreamMetadata) => void;
  acceptRequest: (fromUserId: string) => void;
  declineRequest: (fromUserId: string) => void;
  terminateRelay: (peerId: string) => void;
  clear: () => void;
};

export const useRelayStore = create<RelayState & RelayActions>((set, get) => ({
  availableRooms: [],
  relaySessions: [],
  incomingRequests: new Map(),
  loading: false,
  error: null,
  lastUpdated: null,

  requestRoomList: () => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) {
      set({ error: 'Socket not connected' });
      return;
    }
    set({ loading: true, error: null });
    
    // ✅ CHANGED: ack 콜백 없이, 단순히 이벤트만 전송합니다.
    // 응답은 useSignalingStore에 설정된 리스너가 처리합니다.
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
    console.log('[RelayStore] Incoming relay request:', data);
    
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

      toast.custom((t) =>
        React.createElement(RelayRequestToast, {
          toastId: t,
          request: request,
          onAccept: () => get().acceptRequest(request.fromUserId),
          onDecline: () => get().declineRequest(request.fromUserId)
        })
      , { duration: 30000 }); // 30초 후 자동 소멸
    } else {
      console.error('[RelayStore] Invalid relay request data:', data);
    }
  },
  
  acceptRequest: (fromUserId) => {
    const { socket } = useSignalingStore.getState();
    const request = get().incomingRequests.get(fromUserId);
    if (!socket || !request) return;

    // ✨ FIX: 서버로 응답을 보낼 때, 원래 요청의 메타데이터를 다시 포함시킵니다.
    socket.emit('relay:response', {
      toUserId: fromUserId,
      response: 'accepted',
      metadata: request.streamMetadata // 이 부분이 중요합니다.
    });
    
    // 수신자 측에서 PeerConnection 생성 (initiator: false)
    useRelayManager.getState().createRelayConnection(fromUserId, false, request.streamMetadata);
    
    set(state => produce(state, draft => {
      draft.incomingRequests.delete(fromUserId);
    }));
  },

  declineRequest: (fromUserId) => {
    const { socket } = useSignalingStore.getState();
    if (!socket) return;
    socket.emit('relay:response', { toUserId: fromUserId, response: 'declined' });
    set(state => produce(state, draft => {
      draft.incomingRequests.delete(fromUserId);
    }));
  },
  
  handleRelayResponse: (response) => {
    console.log('[RelayStore] Relay response received:', response);
    const { fromUserId, response: responseType } = response;
    
    if (responseType === 'accepted') {
      toast.success(`${fromUserId} accepted your relay request.`);
      // 요청자 측에서 PeerConnection 생성 (initiator: true)
      // 메타데이터는 incomingRequests에서 가져오거나 기본값 사용
      const request = get().incomingRequests.get(fromUserId);
      const metadata = request?.streamMetadata || {
        streamLabel: 'Unknown',
        streamType: 'video' as const,
        mediaInfo: {
          resolution: 'unknown',
          hasAudio: false,
        },
        userId: fromUserId,
      };
      useRelayManager.getState().createRelayConnection(fromUserId, true, metadata);
    } else {
      toast.info(`${fromUserId} declined your relay request.`);
    }
  },

  handleRelaySignal: (data) => {
    console.log('[RelayStore] Relay signal received:', data);
    const { fromUserId, signal } = data;
    useRelayManager.getState().signalPeer(fromUserId, signal);
  },

  handleRelayTermination: (data) => {
    console.log('[RelayStore] Relay termination received:', data);
    const { fromUserId } = data;
    toast.info(`Relay session with ${fromUserId} has ended.`);
    useRelayManager.getState().removeRelayConnection(fromUserId);
  },

  sendRelayRequest: (targetUserId, streamMetadata) => {
    const socket = useSignalingStore.getState().socket;
    if (!socket || !socket.connected) {
      console.error('[RelayStore] Cannot send relay request: socket not connected');
      return;
    }

    const { userId, nickname } = useSessionStore.getState();
    if (!userId || !nickname) {
      console.error('[RelayStore] Cannot send relay request: missing user info');
      return;
    }

    const request: RelayRequest = {
      fromNickname: nickname,
      fromUserId: userId,
      streamMetadata,
      timestamp: Date.now(),
    };

    console.log('[RelayStore] Sending relay request:', request);
    socket.emit('relay:initiate', {
      toUserId: targetUserId,
      streamMetadata, // 서버에서는 streamMetadata만 필요합니다.
    });
    toast.info(`Relay request sent to ${targetUserId}.`);
  },

  terminateRelay: (peerId) => {
    const { socket } = useSignalingStore.getState();
    if (socket) {
      socket.emit('relay:terminate', { peerId });
    }
    useRelayManager.getState().removeRelayConnection(peerId);
  },

  clear: () => set({ availableRooms: [], relaySessions: [], incomingRequests: new Map(), loading: false, error: null, lastUpdated: null }),
}));