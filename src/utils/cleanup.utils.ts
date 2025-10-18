/**
 * @fileoverview 전역 정리 유틸리티
 * @module utils/cleanup.utils
 */

import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

/**
 * 모든 미디어 리소스를 정리하는 전역 함수
 */
export const cleanupAllMediaResources = (): void => {
  console.log('[CleanupUtils] Starting global cleanup...');
  
  try {
    // 1. MediaDeviceStore 정리
    const mediaDeviceStore = useMediaDeviceStore.getState();
    if (mediaDeviceStore.cleanup) {
      mediaDeviceStore.cleanup();
    }
    
    // 2. PeerConnectionStore 정리
    const peerConnectionStore = usePeerConnectionStore.getState();
    if (peerConnectionStore.cleanup) {
      peerConnectionStore.cleanup();
    }
    
    // 3. 세션 정리
    const sessionStore = useSessionStore.getState();
    if (sessionStore.clearSession) {
      sessionStore.clearSession();
    }
    
    // 4. UI 상태 초기화
    const uiStore = useUIManagementStore.getState();
    if (uiStore.reset) {
      uiStore.reset();
    }
    
    console.log('[CleanupUtils] Global cleanup completed');
  } catch (error) {
    console.error('[CleanupUtils] Error during cleanup:', error);
  }
};

/**
 * 브라우저 이벤트 핸들러 설정
 */
export const setupBrowserCleanupHandlers = (): (() => void) => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    cleanupAllMediaResources();
  };

  const handlePageHide = () => {
    cleanupAllMediaResources();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);

  // 정리 함수 반환
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
  };
};
