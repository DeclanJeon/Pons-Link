// src/hooks/useRelayManager.ts

import { create } from 'zustand';
import { produce } from 'immer';
// ✨ --- START OF FIX --- ✨
// 1. 라이브러리 임포트 방식을 'simple-peer/simplepeer.min.js'로 변경하여 호환성 문제를 해결합니다.
import Peer from 'simple-peer/simplepeer.min.js';
// 2. 타입 정보는 'import type'을 사용하여 안전하게 가져옵니다.
import type { Instance as PeerInstance } from 'simple-peer';
// ✨ --- END OF FIX --- ✨
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useRelayStore, RelaySession, StreamMetadata } from '@/stores/useRelayStore';
import { toast } from 'sonner';


interface RelayManagerSate {
    connections: Map<string, PeerInstance>;
    createRelayConnection: (peerId: string, initiator: boolean, metadata: StreamMetadata) => void;
    signalPeer: (peerId: string, signal: any) => void;
    removeRelayConnection: (peerId: string) => void;
}

export const useRelayManager = create<RelayManagerSate>((set, get) => ({
    connections: new Map(),

    createRelayConnection: (peerId, initiator, metadata) => {
        if (get().connections.has(peerId)) {
            console.warn(`[RelayManager] Connection with ${peerId} already exists.`);
            return;
        }

        const { localStream, isSharingScreen } = useMediaDeviceStore.getState();
        const { iceServers } = useSignalingStore.getState();
        const { addRelaySession, updateRelaySession } = useRelayStore.getState();

        const peerOptions: Peer.Options = {
            initiator,
            trickle: true,
            config: { iceServers: iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] },
        };

        if (initiator) {
            const streamToRelay = metadata.streamType === 'screen' && isSharingScreen ?
                localStream :
                localStream;
            
            if (streamToRelay) {
                peerOptions.stream = streamToRelay;
            } else {
                console.error("[RelayManager] Initiator has no stream to relay!");
                toast.error("Stream to relay is not available.");
                return;
            }
        }
        
        // 이 부분에서 발생하는 에러였습니다. 이제 Peer 생성자가 올바르게 로드되어 해결됩니다.
        const peer = new Peer(peerOptions);

        peer.on('signal', (signal) => {
            useSignalingStore.getState().emit('relay:signal', { toUserId: peerId, signal });
        });

        peer.on('stream', (stream) => {
            console.log(`[RelayManager] Stream received from ${peerId}`);
            updateRelaySession(peerId, { stream, status: 'connected' });
        });

        peer.on('connect', () => {
            console.log(`[RelayManager] Connected to ${peerId}`);
            updateRelaySession(peerId, { status: 'connected' });
        });

        peer.on('close', () => {
            console.log(`[RelayManager] Connection closed with ${peerId}`);
            get().removeRelayConnection(peerId);
        });

        peer.on('error', (err) => {
            console.error(`[RelayManager] Error with peer ${peerId}:`, err);
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
            nickname: peerInfo?.nickname || 'Unknown',
            stream: null,
            metadata,
            isInitiator: initiator,
            status: 'connecting',
        };
        addRelaySession(newSession);
    },

    signalPeer: (peerId, signal) => {
        const peer = get().connections.get(peerId);
        if (peer && !peer.destroyed) {
            peer.signal(signal);
        } else {
            console.warn(`[RelayManager] Peer ${peerId} not found or destroyed. Cannot signal.`);
        }
    },

    removeRelayConnection: (peerId) => {
        set(produce((state) => {
            const peer = state.connections.get(peerId);
            if (peer) {
                if (!peer.destroyed) {
                    peer.destroy();
                }
                state.connections.delete(peerId);
            }
        }));
        useRelayStore.getState().removeRelaySession(peerId);
    },
}));