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
  | { type: 'whiteboard-event'; payload: any }
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
  const { applyRemoteDrawEvent, reset: resetWhiteboard } = useWhiteboardStore();
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
              
          case 'whiteboard-event':
              applyRemoteDrawEvent(parsedData.payload);
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
              
              // UI 업데이트 (필요시 store에 저장)
              toast.info(`Presenter is sharing PDF: ${fileName} (Page ${currentPage}/${totalPages})`, {
                duration: 2000
              });
            }
            break;
          
          case 'pdf-page-change':
            {
              const { currentPage, totalPages, scale, rotation } = parsedData.payload;
              console.log(`[Orchestrator] PDF page changed: ${currentPage}/${totalPages}`);
              
              // 원격 참가자의 PDF 뷰어 동기화 (필요시 구현)
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
    applyRemoteDrawEvent,
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
   * Room 진입 및 시그널링 설정
   */
  useEffect(() => {
    if (!params) return;

    const { roomId, userId, nickname, localStream } = params;

    initPeerConnection(localStream, { onData: handleChannelMessage });

    const signalingEvents: SignalingEvents = {
      onConnect: () => console.log('[SIGNALING_CORE] 연결 성공.'),
      onDisconnect: () => console.log('[SIGNALING_CORE] 연결 끊김.'),
      onRoomUsers: (users) => {
        users.forEach(user => {
            if (user.id !== userId) {
              createPeer(user.id, user.nickname, true);
            }
        });
      },
      onUserJoined: (user) => {
        if (user.id !== userId) {
          createPeer(user.id, user.nickname, false);
        }
      },
      onUserLeft: (userId) => removePeer(userId),
      onSignal: ({ from, signal }) => {
        const peer = usePeerConnectionStore.getState().peers.get(from);
        receiveSignal(from, peer?.nickname || 'Unknown', signal);
      },
      onMediaState: ({ userId, kind, enabled }) => {
        updatePeerMediaState(userId, kind, enabled);
      },
      onChatMessage: (message) => addMessage(message),
      onData: (data) => {
        if (data.type === 'file-meta') {
          const sender = usePeerConnectionStore.getState().peers.get(data.from);
          const senderNickname = sender ? sender.nickname : 'Unknown';
          addFileMessage(data.from, senderNickname, data.payload, false);
        }
      },
    };

    connect(roomId, userId, nickname, signalingEvents);

    return () => {
      disconnect();
      cleanupPeerConnection();
      cleanupTranscription();
      resetWhiteboard();
    };
  }, [params]);
  
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
      
      sendToAllPeers(message);
    }
  }, [isLocalStreaming]);
};
