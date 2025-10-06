import { create } from 'zustand';

/**
 * 전체 화면 컨텍스트 (어디서 전체 화면이 시작되었는지)
 */
export type FullscreenContext = 'fileStreaming' | 'videoPreview' | null;

interface FullscreenState {
  /** 현재 전체 화면 상태인지 여부 */
  isFullscreen: boolean;
  
  /** 전체 화면이 시작된 컨텍스트 */
  context: FullscreenContext;
}

interface FullscreenActions {
  /**
   * 외부(useFullscreen hook)에서 호출되어 스토어의 상태를 동기화합니다.
   * @param isFullscreen - 실제 전체 화면 상태
   * @param context - 전체 화면이 활성화된 경우의 컨텍스트
   */
  setFullscreenState: (isFullscreen: boolean, context: FullscreenContext) => void;
  
  /** DOM의 전체 화면 상태를 확인하고 스토어 상태와 동기화합니다. */
  syncStateWithDOM: () => void;
  
  /**
   * 전체 화면 상태를 토글합니다.
   * @param context - 전체 화면 컨텍스트 (기본값: 'fileStreaming')
   * @param player - video.js 플레이어 인스턴스 (선택적, video.js 사용 시)
   */
  toggleFullscreen: (context?: FullscreenContext, player?: any) => Promise<void>;
  
  /** 스토어 상태를 초기화합니다. */
  reset: () => void;
}

export const useFullscreenStore = create<FullscreenState & FullscreenActions>((set) => ({
  // 상태
  isFullscreen: false,
  context: null,

  // 액션
  setFullscreenState: (isFullscreen: boolean, context: FullscreenContext) => {
    set({ isFullscreen, context });
  },

  syncStateWithDOM: () => {
    // 현재 DOM의 전체 화면 상태를 확인하고 스토어와 동기화
    const isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    
    // 현재 전체 화면 상태가 true인 경우, 기존 context를 유지하거나 기본값을 설정
    // 현재는 파일 스트리밍 관련 전체화면일 가능성이 높으므로 'fileStreaming'으로 설정
    // 실제 컨텍스트는 다른 방식으로 관리되어야 하지만, 현재 상태에서는 추론이 어려움
    set({ isFullscreen, context: isFullscreen ? 'fileStreaming' : null });
  },

  toggleFullscreen: async (context: FullscreenContext = 'fileStreaming', player?: any) => {
    if (player) {
      // video.js 플레이어가 제공된 경우, 플레이어의 전체 화면 기능 사용
      if (player.isFullscreen()) {
        await player.exitFullscreen();
      } else {
        await player.requestFullscreen();
      }
    } else {
      // 일반 DOM 요소의 전체 화면 기능 사용
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // 기본적으로 body를 전체 화면으로 전환
        await document.body.requestFullscreen();
      }
    }
  },

  reset: () => {
    set({
      isFullscreen: false,
      context: null,
    });
  },
}));
