import { useEffect, useCallback } from 'react';
import { useFullscreenStore, FullscreenContext } from '@/stores/useFullscreenStore';
import type Player from 'video.js/dist/types/player';

/**
 * video.js 플레이어와 전역 상태(useFullscreenStore)를 연결하는 어댑터 Hook.
 * 이 Hook은 video.js 플레이어의 전체 화면 제어권을 존중하고,
 * React 상태를 플레이어의 실제 상태와 동기화하는 역할을 합니다.
 * 
 * @param player - video.js 플레이어 인스턴스. null일 수 있습니다.
 * @param context - 현재 전체 화면 컨텍스트 (예: 'fileStreaming').
 * @returns {object} toggleFullscreen 함수를 포함하는 객체.
 */
export const useFullscreen = (player: Player | null, context: FullscreenContext) => {
  const { setFullscreenState } = useFullscreenStore();

  // video.js의 'fullscreenchange' 이벤트를 감지하여 전역 스토어 상태를 업데이트
  useEffect(() => {
    if (!player) return;

    const handleFullscreenChange = () => {
      const isPlayerFullscreen = player.isFullscreen();
      // video.js의 실제 상태를 전역 스토어에 반영
      setFullscreenState(isPlayerFullscreen, isPlayerFullscreen ? context : null);
    };

    // 이벤트 리스너 등록
    player.on('fullscreenchange', handleFullscreenChange);
    
    // 컴포넌트 마운트 시 초기 상태 동기화
    handleFullscreenChange();

    // 클린업 함수: 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      // player.off()가 존재하는지 확인하여 오류 방지
      if (player && typeof player.off === 'function') {
        player.off('fullscreenchange', handleFullscreenChange);
      }
    };
  }, [player, context, setFullscreenState]);

  /**
   * UI에서 전체 화면 전환을 '요청'하는 함수.
   * 실제 동작은 video.js 플레이어가 수행합니다.
   */
  const toggleFullscreen = useCallback(() => {
    if (!player) return;
    
    if (player.isFullscreen()) {
      player.exitFullscreen();
    } else {
      player.requestFullscreen();
    }
  }, [player]);

  return { toggleFullscreen };
};
