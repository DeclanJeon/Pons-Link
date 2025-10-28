// src/hooks/useParticipants.ts

import { useMemo } from 'react';
import { usePeerConnectionStore, PeerState } from '@/stores/usePeerConnectionStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
// ✨ 1. useRelayStore를 import 합니다.
import { useRelayStore } from '@/stores/useRelayStore';

export interface Participant extends PeerState {
  isLocal: boolean;
  stream: MediaStream | null;
  isRelay?: boolean; // ✨ 릴레이 스트림인지 구분하기 위한 플래그 추가 (선택적)
}

export const useParticipants = (): Participant[] => {
  const peers = usePeerConnectionStore(state => state.peers);
  const { localStream, isVideoEnabled, isAudioEnabled, isSharingScreen } = useMediaDeviceStore();
  const { getSessionInfo } = useSessionStore();
  const { isStreaming: isFileStreaming } = useFileStreamingStore();
  const { localTranscript, transcriptionLanguage } = useTranscriptionStore();
  // ✨ 2. useRelayStore에서 활성 릴레이 세션 목록을 가져옵니다.
  const { relaySessions } = useRelayStore();

  const sessionInfo = getSessionInfo();
  const localUserId = sessionInfo?.userId || 'local';
  const localNickname = sessionInfo?.nickname || 'You';

  const participants = useMemo<Participant[]>(() => {
    const localParticipant: Participant = {
      userId: localUserId,
      nickname: localNickname,
      stream: localStream,
      isLocal: true,
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
      isSharingScreen: isSharingScreen,
      connectionState: 'connected',
      transcript: localTranscript ? { ...localTranscript, lang: transcriptionLanguage } : undefined,
      isStreamingFile: isFileStreaming,
    };

    const remoteParticipants: Participant[] = Array.from(peers.values()).map(peer => ({
      ...peer,
      isLocal: false,
      stream: peer.stream || null,
    }));

    // ✨ 3. 릴레이 세션을 Participant 객체로 변환합니다.
    const relayParticipants: Participant[] = Array.from(relaySessions.values())
      .filter(session => session.status === 'connected' && session.stream) // 연결 완료 및 스트림 존재 여부 확인
      .map(session => ({
        userId: session.peerId, // 고유 ID로 peerId 사용
        nickname: `${session.nickname} (Relay)`, // 릴레이임을 명시
        stream: session.stream,
        isLocal: false,
        isRelay: true, // 릴레이 플래그 설정
        audioEnabled: session.stream!.getAudioTracks().some(track => track.enabled),
        videoEnabled: session.stream!.getVideoTracks().some(track => track.enabled),
        isSharingScreen: session.metadata.streamType === 'screen', // 메타데이터 기반으로 화면 공유 여부 설정
        connectionState: 'connected',
        isStreamingFile: false, // 릴레이는 파일 스트리밍과 별개로 처리
      }));

    // ✨ 4. 모든 참가자(로컬, 일반 원격, 릴레이 원격)를 하나의 배열로 합칩니다.
    return [localParticipant, ...remoteParticipants, ...relayParticipants];
  }, [
    peers,
    localStream,
    isVideoEnabled,
    isAudioEnabled,
    isSharingScreen,
    localUserId,
    localNickname,
    isFileStreaming,
    localTranscript,
    transcriptionLanguage,
    relaySessions, // ✨ 5. 의존성 배열에 relaySessions 추가
  ]);

  return participants;
};