/**
 * @fileoverview Lobby 상태 관리 (개선판)
 * @module stores/useLobbyStore
 */

import { create } from 'zustand';
import { useMediaDeviceStore } from './useMediaDeviceStore';
import { deviceManager } from '@/services/deviceManager';
import nicknamesData from '@/data/nicknames.json';
import { toast } from 'sonner';

interface ConnectionDetails {
  roomTitle: string;
  nickname: string;
}

interface LobbyState {
  connectionDetails: ConnectionDetails | null;
  isInitialized: boolean;
  isNavigatingToRoom: boolean; // 추가: Room으로 정상 이동 중인지 추적
}

interface LobbyActions {
  initialize: (roomTitle: string, nickname: string) => Promise<void>;
  cleanup: () => void;
  setNavigatingToRoom: (isNavigating: boolean) => void; // 추가
  updateNickname: (nickname: string) => void; // 닉네임 변경 액션 추가
}

/**
 * 랜덤 닉네임 생성
 */
const generateRandomNickname = (): string => {
  const { adjectives, animals } = nicknamesData;
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  return `${randomAdjective} ${randomAnimal}`;
};

export const useLobbyStore = create<LobbyState & LobbyActions>((set, get) => ({
  connectionDetails: null,
  isInitialized: false,
  isNavigatingToRoom: false,

  /**
   * 초기화
   */
  initialize: async (roomTitle: string, nickname: string) => {
    console.log('[LobbyStore] Initializing...');

    try {
      // 1. 닉네임 설정
      const finalNickname = nickname || generateRandomNickname();
      
      set({
        connectionDetails: {
          roomTitle: decodeURIComponent(roomTitle),
          nickname: finalNickname
        }
      });

      // 2. MediaDeviceStore 초기화
      await useMediaDeviceStore.getState().initialize();

      set({ isInitialized: true });

      console.log('[LobbyStore] Initialized successfully');
      toast.success('Ready!');
    } catch (error) {
      console.error('[LobbyStore] Initialization failed:', error);
      toast.error('Initialization failed.');
    }
  },

  /**
   * 닉네임 변경
   */
  updateNickname: (nickname: string) => {
    set(state => ({
      connectionDetails: state.connectionDetails
        ? { ...state.connectionDetails, nickname }
        : null
    }));
  },

  /**
   * Room으로 이동 중임을 표시
   */
  setNavigatingToRoom: (isNavigating: boolean) => {
    set({ isNavigatingToRoom: isNavigating });
    console.log(`[LobbyStore] Navigating to room: ${isNavigating}`);
  },

  /**
   * 정리 (Room으로 정상 이동하는 경우 스트림 유지)
   */
  cleanup: () => {
    const { isNavigatingToRoom } = get();
    
    console.log(`[LobbyStore] Cleanup called (navigatingToRoom: ${isNavigatingToRoom})`);
    
    // Room으로 정상 이동하는 경우 미디어 스트림을 정리하지 않음
    if (!isNavigatingToRoom) {
      console.log('[LobbyStore] Abnormal exit detected, cleaning up media devices');
      useMediaDeviceStore.getState().cleanup();
    } else {
      console.log('[LobbyStore] Normal navigation to Room, keeping media stream alive');
    }
    
    // Store 상태만 초기화
    set({
      connectionDetails: null,
      isInitialized: false,
      isNavigatingToRoom: false
    });

    console.log('[LobbyStore] Cleaned up');
  }
}));
