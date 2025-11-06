/**
 * @fileoverview 자막 동기화 Hook - 비디오 자막 동기화
 * @module hooks/useSubtitleSync
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { subtitleTransport } from '@/services/subtitleTransport';
import { throttle } from 'lodash';

/**
 * 자막 동기화 Hook
 * 비디오 재생과 자막을 동기화하고 P2P로 브로드캐스트
 * 
 * @param videoRef - 비디오 엘리먼트 ref
 * @param isStreaming - 파일 스트리밍 여부
 */
export const useSubtitleSync = (
  videoRef: React.RefObject<HTMLVideoElement>,
  isStreaming: boolean
): void => {
  const {
    syncWithVideo,
    broadcastSubtitleState,
    activeTrackId,
    tracks,
    currentCue
  } = useSubtitleStore();
  const { sendToAllPeers } = usePeerConnectionStore();
  const { fileType } = useFileStreamingStore();
  
  const animationIdRef = useRef<number>();
  const lastBroadcastTime = useRef<number>(0);
  const lastCueId = useRef<string | null>(null);
  
  /**
   * P2P 자막 동기화 브로드캐스트 (throttled)
   */
  const broadcastSync = useCallback(
    throttle((_currentTime: number, _cueId: string | null) => {}, 100),
    []
  );
  
  /**
   * 동기화 루프
   */
  const syncLoop = useCallback((): void => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime * 1000;
    
    // 항상 로컬 자막 동기화 실행 (스트리밍 여부 무관)
    syncWithVideo(currentTime);
    
    // 스트리밍 중일 때만 리모트에 브로드캐스트
    if (isStreaming && fileType === 'video' && activeTrackId) {
      const { currentCue } = useSubtitleStore.getState();
      
      // 자막이 변경되었을 때만 브로드캐스트
      if (currentCue?.id !== lastCueId.current) {
        broadcastSync(currentTime, currentCue?.id || null);
        lastCueId.current = currentCue?.id || null;
      }
    }
    
    animationIdRef.current = requestAnimationFrame(syncLoop);
  }, [videoRef, isStreaming, fileType, activeTrackId, syncWithVideo, broadcastSync]);
  
  /**
   * 비디오 재생 시작
   */
  const handlePlay = useCallback((): void => {
    console.log('[SubtitleSync] Video play started');
    syncLoop();
  }, [syncLoop]);
  
  /**
   * 비디오 일시정지
   */
  const handlePause = useCallback((): void => {
    console.log('[SubtitleSync] Video paused');
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
  }, []);
  
  /**
   * 비디오 시크
   */
  const handleSeeked = useCallback((): void => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime * 1000;
    
    // 로컬 자막도 즉시 업데이트
    syncWithVideo(currentTime);
  }, [videoRef, syncWithVideo]);
  
  /**
   * 시간 업데이트 (일시정지 상태에서)
   */
  const handleTimeUpdate = useCallback((): void => {
    if (!videoRef.current || !videoRef.current.paused) return;
    
    const currentTime = videoRef.current.currentTime * 1000;
    
    // 일시정지 중에도 로컬 자막 동기화
    syncWithVideo(currentTime);
  }, [videoRef, syncWithVideo]);
  
  /**
   * 자막 점프 이벤트 핸들러
   */
  const handleSubtitleJump = useCallback((event: CustomEvent): void => {
    if (!videoRef.current) return;
    
    const { time } = event.detail;
    videoRef.current.currentTime = time;
    
    console.log(`[SubtitleSync] Jumped to subtitle at ${time}s`);
  }, [videoRef]);
  
  /**
   * 자막 트랙 변경 시 브로드캐스트
   */
  useEffect(() => {
    // No-op - 자막 트랙 변경 시 네트워크 전송 제거
  }, []);

  /**
   * 비디오 이벤트 리스너 등록/해제
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // 이벤트 리스너 등록
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    // 커스텀 자막 점프 이벤트
    window.addEventListener('subtitle-jump', handleSubtitleJump as any);
    
    // 재생 중이 아니어도 초기 동기화 실행
    if (video.paused) {
      const currentTime = video.currentTime * 100;
      syncWithVideo(currentTime);
    } else {
      syncLoop();
    }
    
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      
      window.removeEventListener('subtitle-jump', handleSubtitleJump as any);
    };
  }, [
    videoRef,
    handlePlay,
    handlePause,
    handleSeeked,
    handleTimeUpdate,
    handleSubtitleJump,
    syncLoop
  ]);
  
  /**
   * 스트리밍 상태 변경 시 처리
   */
  useEffect(() => {
    if (!isStreaming) {
      // 스트리밍 종료 시 동기화 정지
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      lastCueId.current = null;
    }
  }, [isStreaming]);
};