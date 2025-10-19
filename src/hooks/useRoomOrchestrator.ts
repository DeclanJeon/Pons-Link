/**
 * @fileoverview Room Orchestrator Hook - WebRTC, 시그널링, 데이터 채널을 총괄
 * @module hooks/useRoomOrchestrator
 * @description 방의 모든 상호작용을 오케스트레이션합니다.
 */

import { useEffect, useCallback } from 'react';
import { produce } from 'immer';
import { useSignalingStore, SignalingEvents } from '@/stores/useSignalingStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useChatStore, ChatMessage } from '@/stores/useChatStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { toast } from 'sonner';

interface RoomParams {
  roomId: string;
  userId: string;
  nickname: string;
  localStream: MediaStream;
}

type ChannelMessage =
  | { type: 'chat'; payload: any }
  | { type: 'typing-state'; payload: { isTyping: boolean } }
  | { type: 'whiteboard-operation'; payload: any }
  | { type: 'whiteboard-cursor'; payload: any }
  | { type: 'whiteboard-clear'; payload: any }
  | { type: 'whiteboard-delete'; payload: { operationIds: string[] }; }
  | { type: 'whiteboard-update'; payload: any }
  | { type: 'whiteboard-background'; payload: any }
  | { type: 'file-meta'; payload: any }
  | { type: 'file-ack'; payload: { transferId: string; chunkIndex: number } }
  | { type: 'transcription'; payload: { text: string; isFinal: boolean; lang: string } }
  | { type: 'subtitle-sync'; payload: { currentTime: number; cueId: string | null; activeTrackId: string | null; timestamp: number } }
  | { type: 'subtitle-seek'; payload: { currentTime: number; timestamp: number } }
  | { type: 'subtitle-state'; payload: any }
  | { type: 'subtitle-track-meta'; payload: any }
  | { type: 'subtitle-track-chunk'; payload: any }
  | { type: 'subtitle-remote-enable'; payload: any }
  | { type: 'file-streaming-state'; payload: { isStreaming: boolean; fileType: string } }
  | { type: 'screen-share-state'; payload: { isSharing: boolean } }
  | { type: 'pdf-metadata'; payload: { currentPage: number; totalPages: number; fileName: string } }
  | { type: 'pdf-page-change'; payload: { currentPage: number; totalPages: number; scale: number; rotation: number } };

function isChannelMessage(obj: any): obj is ChannelMessage {
    return obj && typeof obj.type === 'string' && 'payload' in obj;
}

export const useRoomOrchestrator = (params: RoomParams | null) => {
  const { connect, disconnect } = useSignalingStore();
  
  const { 
    initialize: initPeerConnection, 
    cleanup: cleanupPeerConnection,
    createPeer, 
    receiveSignal, 
    removePeer, 
    updatePeerMediaState, 
    updatePeerStreamingState,
    updatePeerScreenShareState
  } = usePeerConnectionStore();
  
  const { addMessage, setTypingState, handleIncomingChunk, addFileMessage } = useChatStore();
  const { incrementUnreadMessageCount, setMainContentParticipant } = useUIManagementStore();
  
  // ✅ Whiteboard Store 액션 추가 (수정됨)
  // 기존 handleRemoteOperation, handleRemoteClear 대신 직접 getState() 사용
  
  const { cleanup: cleanupTranscription } = useTranscriptionStore();
  const { 
    receiveSubtitleState, 
    receiveSubtitleSync,
    setRemoteSubtitleCue,
    receiveRemoteEnable
  } = useSubtitleStore();
  const { isStreaming: isLocalStreaming } = useFileStreamingStore();

  /**
   * 데이터 채널 메시지 처리
   */
  const handleChannelMessage = useCallback((peerId: string, data: any) => {
    try {
        const parsedData = JSON.parse(data.toString());
        if (!isChannelMessage(parsedData)) return;
      
        const sender = usePeerConnectionStore.getState().peers.get(peerId);
        const senderNickname = sender ? sender.nickname : 'Unknown';

        switch (parsedData.type) {
          case 'chat':
              addMessage(parsedData.payload);
              if (useUIManagementStore.getState().activePanel !== 'chat') {
                  incrementUnreadMessageCount();
              }
              break;
              
          case 'typing-state':
              if (sender) setTypingState(peerId, sender.nickname, parsedData.payload.isTyping);
              break;
              
          // ✅ Whiteboard 메시지 처리 (수정됨)
          case 'whiteboard-operation':
              console.log(`[Orchestrator] Received whiteboard-operation from ${senderNickname}:`, parsedData.payload.id);
              useWhiteboardStore.getState().addOperation(parsedData.payload);
              break;

          case 'whiteboard-cursor':
              console.log('[Orchestrator] Received whiteboard cursor from', senderNickname);
              useWhiteboardStore.getState().updateRemoteCursor(parsedData.payload);
              break;
      
          case 'whiteboard-clear':
              console.log(`[Orchestrator] Received whiteboard-clear from ${senderNickname}`);
              useWhiteboardStore.getState().clearOperations();
              break;
              
          case 'whiteboard-delete':
              console.log('[Orchestrator] Received whiteboard delete from', senderNickname);
              parsedData.payload.operationIds.forEach((id: string) => {
                useWhiteboardStore.getState().removeOperation(id);
              });
              break;
              
          case 'whiteboard-update':
              console.log('[Orchestrator] Received whiteboard update from', senderNickname);
              useWhiteboardStore.getState().addOperation(parsedData.payload);
              break;
              
          case 'whiteboard-background':
              console.log('[Orchestrator] Received whiteboard background from', senderNickname);
              useWhiteboardStore.getState().setBackground(parsedData.payload);
              break;
              
          case 'file-meta':
              addFileMessage(peerId, senderNickname, parsedData.payload, false);
              break;
              
          case 'transcription':
              usePeerConnectionStore.setState(
                  produce(state => {
                      const peer = state.peers.get(peerId);
                      if (peer) peer.transcript = parsedData.payload;
                  })
              );
              break;
          
          case 'file-streaming-state':
              {
                  const { isStreaming, fileType } = parsedData.payload;
                  updatePeerStreamingState(peerId, isStreaming);
                  
                  if (isStreaming && fileType === 'video') {
                      useSubtitleStore.setState({ isRemoteSubtitleEnabled: true });
                  } else if (!isStreaming) {
                      useSubtitleStore.setState({
                          isRemoteSubtitleEnabled: false,
                          remoteSubtitleCue: null
                      });
                  }
              }
              break;
          
          case 'screen-share-state':
              updatePeerScreenShareState(peerId, parsedData.payload.isSharing);
              if (parsedData.payload.isSharing) {
                  setMainContentParticipant(peerId);
              } else {
                  if (useUIManagementStore.getState().mainContentParticipantId === peerId) {
                      setMainContentParticipant(null);
                  }
              }
              break;
      
          case 'subtitle-sync':
              {
                  const peer = usePeerConnectionStore.getState().peers.get(peerId);
                  if (peer?.isStreamingFile) {
                      receiveSubtitleSync(
                        parsedData.payload.currentTime,
                        parsedData.payload.cueId,
                        parsedData.payload.activeTrackId
                      );
                  }
              }
              break;
        
          case 'subtitle-seek':
              {
                  const { currentTime } = parsedData.payload;
                  useSubtitleStore.getState().syncWithRemoteVideo(currentTime);
              }
              break;
        
          case 'subtitle-state':
              receiveSubtitleState(parsedData.payload);
              break;

          case 'subtitle-track-meta':
            useSubtitleStore.getState().receiveTrackMeta(parsedData.payload);
            break;
          
          case 'subtitle-track-chunk':
            useSubtitleStore.getState().receiveTrackChunk(parsedData.payload);
            break;
            
          case 'subtitle-remote-enable':
            receiveRemoteEnable(parsedData.payload);
            break;

          case 'pdf-metadata':
            {
              const { currentPage, totalPages, fileName } = parsedData.payload;
              console.log(`[Orchestrator] Received PDF metadata: ${fileName}, page ${currentPage}/${totalPages}`);
              
              toast.info(`Presenter is sharing PDF: ${fileName} (Page ${currentPage}/${totalPages})`, {
                duration: 2000
              });
            }
            break;
          
          case 'pdf-page-change':
            {
              const { currentPage, totalPages, scale, rotation } = parsedData.payload;
              console.log(`[Orchestrator] PDF page changed: ${currentPage}/${totalPages}`);
              
              toast.info(`Page ${currentPage}/${totalPages}`, {
                duration: 800,
                position: 'top-center'
              });
            }
            break;
        
          default:
              console.warn(`[Orchestrator] Unknown JSON message type: ${parsedData.type}`);
        }
    } catch (error) {
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            handleIncomingChunk(peerId, data);
        } else {
            console.error("Failed to process DataChannel message:", error, "Raw data:", data.toString());
        }
    }
  }, [
    addMessage,
    setTypingState,
    incrementUnreadMessageCount,
    handleIncomingChunk,
    addFileMessage,
    receiveSubtitleState,
    receiveSubtitleSync,
    setRemoteSubtitleCue,
    receiveRemoteEnable,
    updatePeerStreamingState,
    updatePeerScreenShareState,
    setMainContentParticipant
  ]);

  /**
   * Room 진입 및 시그널링 설정 (초기 연결 설정)
   */
  useEffect(() => {
    if (!params) return;

    const { roomId, userId, nickname, localStream } = params;

    console.log('[Orchestrator] Initializing PeerConnection with localStream');
    initPeerConnection(localStream, { onData: handleChannelMessage });

    const signalingEvents: SignalingEvents = {
      onConnect: () => {
        console.log('[Orchestrator] Signaling connected');
        toast.success('서버에 연결되었습니다');
      },
      onDisconnect: () => {
        console.log('[Orchestrator] Signaling disconnected');
        toast.error('서버 연결이 끊어졌습니다');
      },
      onRoomUsers: (users) => {
        console.log('[Orchestrator] Room users:', users);
        users.forEach(user => {
            if (user.id !== userId) {
              console.log(`[Orchestrator] Creating peer for existing user: ${user.nickname} (initiator=true)`);
              createPeer(user.id, user.nickname, true);
            }
        });
      },
      onUserJoined: (user) => {
        console.log('[Orchestrator] User joined:', user.nickname);
        toast.info(`${user.nickname}님이 입장했습니다`);
        
        if (user.id !== userId) {
          console.log(`[Orchestrator] Creating peer for new user: ${user.nickname} (initiator=false)`);
          createPeer(user.id, user.nickname, false);
        }
      },
      onUserLeft: (leftUserId) => {
        const peer = usePeerConnectionStore.getState().peers.get(leftUserId);
        const nickname = peer?.nickname || 'Unknown';
        
        console.log('[Orchestrator] User left:', nickname);
        toast.info(`${nickname}님이 퇴장했습니다`);
        
        removePeer(leftUserId);
        
        // 메인 콘텐츠가 떠난 사용자였다면 초기화
        if (useUIManagementStore.getState().mainContentParticipantId === leftUserId) {
          setMainContentParticipant(null);
        }
      },
      onSignal: ({ from, signal }) => {
        const peer = usePeerConnectionStore.getState().peers.get(from);
        const nickname = peer?.nickname || 'Unknown';
        
        console.log(`[Orchestrator] Signal received from ${nickname}`);
        receiveSignal(from, nickname, signal);
      },
      onRoomFull: (roomId) => {
        const [result] = Object.values(roomId);
        console.log('[Orchestrator] Room full:', result);
        toast.error(`${result} 방의 정원이 초과 되었습니다. 다른 방을 이용해주세요.`);
        setTimeout(() => {
          location.assign('/');
        }, 3000);
      },
      onMediaState: ({ userId, kind, enabled }) => {
        console.log(`[Orchestrator] Media state update: ${userId} ${kind}=${enabled}`);
        updatePeerMediaState(userId, kind, enabled);
      },
      onChatMessage: (message) => {
        console.log('[Orchestrator] Chat message received');
        addMessage(message);
      },
      onData: (data) => {
        if (data.type === 'file-meta') {
          const sender = usePeerConnectionStore.getState().peers.get(data.from);
          const senderNickname = sender ? sender.nickname : 'Unknown';
          addFileMessage(data.from, senderNickname, data.payload, false);
        }
      },
    };

    console.log('[Orchestrator] Connecting to signaling server...');
    connect(roomId, userId, nickname, signalingEvents);

    return () => {
      console.log('[Orchestrator] Cleanup: disconnecting and cleaning up resources');
      disconnect();
      cleanupPeerConnection();
      cleanupTranscription();
    };
  }, [params?.roomId, params?.userId, params?.nickname, initPeerConnection, handleChannelMessage, connect, disconnect, cleanupPeerConnection, cleanupTranscription, createPeer, receiveSignal, removePeer, updatePeerMediaState, addMessage, addFileMessage, setMainContentParticipant]);

  /**
   * 로컬 스트림 변경 감지 및 WebRTC 트랙 업데이트 (전체 연결 재설정 없이)
   */
  useEffect(() => {
    if (!params?.localStream) return;

    const updateLocalStream = async () => {
      const { webRTCManager } = usePeerConnectionStore.getState();
      if (!webRTCManager) return;

      console.log('[Orchestrator] Local stream updated, replacing in WebRTC manager');
      
      // 새 스트림의 트랙들을 교체
      const newVideoTrack = params.localStream.getVideoTracks()[0];
      const newAudioTrack = params.localStream.getAudioTracks()[0];

      if (newVideoTrack) {
        await webRTCManager.replaceSenderTrack('video', newVideoTrack);
        console.log('[Orchestrator] Video track updated');
      }
      
      if (newAudioTrack) {
        await webRTCManager.replaceSenderTrack('audio', newAudioTrack);
        console.log('[Orchestrator] Audio track updated');
      }
    };

    updateLocalStream();
  }, [params?.localStream]);
  
  /**
   * 파일 스트리밍 상태 변경 시 브로드캐스트
   */
  useEffect(() => {
    if (isLocalStreaming !== undefined) {
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      const { fileType } = useFileStreamingStore.getState();
      
      const message = JSON.stringify({
        type: 'file-streaming-state',
        payload: { isStreaming: isLocalStreaming, fileType }
      });
      
      console.log('[Orchestrator] Broadcasting file streaming state:', isLocalStreaming);
      sendToAllPeers(message);
    }
  }, [isLocalStreaming]);
};
