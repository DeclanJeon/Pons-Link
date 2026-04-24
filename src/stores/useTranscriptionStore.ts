// frontend/src/stores/useTranscriptionStore.ts

import { create } from 'zustand';
import { usePeerConnectionStore } from './usePeerConnectionStore';

/**
 * 지원 언어 목록 (확장)
 */
export const SUPPORTED_LANGUAGES = [
  // 주요 언어
  { code: 'auto', name: 'Auto Detect (자동 감지)', flag: '🌐' },
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '中文 (繁體)', flag: '🇹🇼' },
  
  // 유럽 언어
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
  { code: 'nl-NL', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl-PL', name: 'Polski', flag: '🇵🇱' },
  
  // 아시아 언어
  { code: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷' },
] as const;

/**
 * 번역 대상 언어 목록
 */
export const TRANSLATION_LANGUAGES = [
  { code: 'none', name: 'Disabled (translation disabled)' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ar', name: 'العربية' },
  { code: 'tr', name: 'Türkçe' },
] as const;

export type TranscriptionProvider = 'azure' | 'browser';

type DataChannelMessage = {
  type: 'transcription';
  payload: { text: string; isFinal: boolean; lang: string; provider: TranscriptionProvider };
};

interface TranscriptionState {
  isTranscriptionEnabled: boolean;
  transcriptionProvider: TranscriptionProvider;
  transcriptionLanguage: string;
  translationTargetLanguage: string;
  localTranscript: { text: string; isFinal: boolean };
  detectedLanguage: string | null; // 자동 감지된 언어
}

interface TranscriptionActions {
  toggleTranscription: () => void;
  setTranscriptionProvider: (provider: TranscriptionProvider) => void;
  setTranscriptionLanguage: (lang: string) => void;
  setTranslationTargetLanguage: (lang: string) => void;
  setLocalTranscript: (transcript: { text: string; isFinal: boolean }) => void;
  sendTranscription: (text: string, isFinal: boolean) => void;
  handleIncomingTranscription: (peerId: string, payload: { text: string; isFinal: boolean; lang: string }) => void;
  setDetectedLanguage: (lang: string) => void;
  cleanup: () => void;
}

export const useTranscriptionStore = create<TranscriptionState & TranscriptionActions>((set, get) => ({
  isTranscriptionEnabled: false,
  transcriptionProvider: 'azure',
  transcriptionLanguage: 'ko-KR',
  translationTargetLanguage: 'none',
  localTranscript: { text: '', isFinal: false },
  detectedLanguage: null,

  toggleTranscription: () => set((state) => ({ 
    isTranscriptionEnabled: !state.isTranscriptionEnabled 
  })),
  setTranscriptionProvider: (provider) => set({ transcriptionProvider: provider }),

  setTranscriptionLanguage: (lang) => {
    set({ transcriptionLanguage: lang });
    
    // 자동 감지가 아닌 경우 감지된 언어 초기화
    if (lang !== 'auto') {
      set({ detectedLanguage: null });
    }
  },
  
  setTranslationTargetLanguage: (lang) => set({ translationTargetLanguage: lang }),
  
  setLocalTranscript: (transcript) => set({ localTranscript: transcript }),
  
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  
  sendTranscription: (text, isFinal) => {
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    const { transcriptionLanguage, detectedLanguage, transcriptionProvider } = get();
    
    // 실제 사용 언어 결정 (자동 감지 시 감지된 언어 사용)
    const actualLang = transcriptionLanguage === 'auto' 
      ? (detectedLanguage || 'ko-KR')
      : transcriptionLanguage;
    
    const data: DataChannelMessage = {
      type: 'transcription',
      payload: { text, isFinal, lang: actualLang, provider: transcriptionProvider },
    };
    sendToAllPeers(JSON.stringify(data));
  },

  handleIncomingTranscription: (peerId, payload) => {
    usePeerConnectionStore.setState((state) => {
      const peer = state.peers.get(peerId);
      if (!peer) return state;

      const peers = new Map(state.peers);
      peers.set(peerId, { ...peer, transcript: payload });
      return { peers };
    });
  },

  cleanup: () => {
    set({
      isTranscriptionEnabled: false,
      localTranscript: { text: '', isFinal: false },
      detectedLanguage: null,
    });
  },
}));
