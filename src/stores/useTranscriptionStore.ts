// frontend/src/stores/useTranscriptionStore.ts

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { translationService } from '@/lib/translationService';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useSessionStore } from './useSessionStore';
import type { MeetingMinutesStatePayload } from '@/types/chat.types';

export const TRANSCRIPTION_SETTINGS_STORAGE_KEY = 'pons-link-transcription-settings';

/**
 * 지원 언어 목록 (확장)
 */
export const SUPPORTED_LANGUAGES = [
  // 주요 언어
  { code: 'auto', name: 'Auto Detect', flag: '🌐' },
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
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

export const DEEPGRAM_TRANSCRIPTION_LANGUAGE_CODES = new Set([
  'auto',
  'en-US',
  'en-GB',
  'ko-KR',
  'ja-JP',
  'zh-CN',
  'zh-TW',
  'es-ES',
  'fr-FR',
  'de-DE',
  'it-IT',
  'pt-BR',
  'ru-RU',
  'nl-NL',
  'pl-PL',
  'th-TH',
  'vi-VN',
  'id-ID',
  'hi-IN',
  'tr-TR',
]);

export const AZURE_TRANSCRIPTION_LANGUAGE_CODES = new Set(
  SUPPORTED_LANGUAGES.map((language) => language.code),
);

const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = 'azure';
const DEFAULT_TRANSCRIPTION_LANGUAGE = 'ko-KR';
const SUPPORTED_TRANSCRIPTION_LANGUAGE_CODES = SUPPORTED_LANGUAGES
  .map((language) => language.code)
  .filter((code) => code !== 'auto');

const getNavigatorLanguageCandidates = (): string[] => {
  if (typeof navigator === 'undefined') return [];

  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  return [
    ...languages,
    navigator.language,
  ].filter((language): language is string => typeof language === 'string' && language.trim().length > 0);
};

export const resolveDefaultTranscriptionLanguage = (
  languageCandidates: readonly string[] = getNavigatorLanguageCandidates(),
): string => {
  for (const candidate of languageCandidates) {
    const normalized = candidate.trim();
    if (!normalized) continue;

    const exactMatch = SUPPORTED_TRANSCRIPTION_LANGUAGE_CODES.find(
      (code) => code.toLowerCase() === normalized.toLowerCase(),
    );
    if (exactMatch) return exactMatch;

    const primaryLanguage = normalized.split('-')[0]?.toLowerCase();
    if (!primaryLanguage) continue;

    const primaryMatch = SUPPORTED_TRANSCRIPTION_LANGUAGE_CODES.find(
      (code) => code.toLowerCase().split('-')[0] === primaryLanguage,
    );
    if (primaryMatch) return primaryMatch;
  }

  return DEFAULT_TRANSCRIPTION_LANGUAGE;
};

/**
 * 번역 대상 언어 목록
 */
export const TRANSLATION_LANGUAGES = [
  { code: 'none', name: 'Disabled (translation disabled)' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
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

export type TranscriptionProvider = 'deepgram' | 'azure' | 'browser';
export type TranscriptionRuntimeStatus = 'off' | 'starting' | 'live' | 'fallback' | 'error';

export type TranscriptionPayload = {
  text: string;
  isFinal: boolean;
  lang: string;
  provider?: TranscriptionProvider;
  translatedText?: string;
  translatedLang?: string;
};

type DataChannelMessage = {
  type: 'transcription';
  payload: TranscriptionPayload & { provider: TranscriptionProvider };
};

type MeetingMinutesStateMessage = {
  type: 'meeting-minutes-state';
  payload: MeetingMinutesStatePayload;
};

type PersistedTranscriptionSettings = Partial<Pick<
  TranscriptionState,
  'transcriptionProvider' | 'transcriptionLanguage' | 'translationTargetLanguage'
>>;

export const migrateTranscriptionSettings = (persisted: unknown): unknown => {
  if (!persisted || typeof persisted !== 'object') {
    return persisted;
  }

  const settings = persisted as PersistedTranscriptionSettings;
  return {
    ...settings,
    transcriptionProvider: settings.transcriptionProvider === 'deepgram'
      ? DEFAULT_TRANSCRIPTION_PROVIDER
      : (settings.transcriptionProvider ?? DEFAULT_TRANSCRIPTION_PROVIDER),
    transcriptionLanguage: !settings.transcriptionLanguage || settings.transcriptionLanguage === 'auto'
      ? resolveDefaultTranscriptionLanguage()
      : settings.transcriptionLanguage,
  };
};

interface TranscriptionState {
  isTranscriptionEnabled: boolean;
  transcriptionStatus: TranscriptionRuntimeStatus;
  transcriptionProvider: TranscriptionProvider;
  transcriptionLanguage: string;
  translationTargetLanguage: string;
  localTranscript: Omit<TranscriptionPayload, 'lang' | 'provider'>;
  detectedLanguage: string | null; // 자동 감지된 언어
  meetingMinutesEnabled: boolean;
  meetingMinutesOwnerId: string | null;
  meetingMinutesOwnerNickname: string | null;
  meetingMinutesStartedAt: number | null;
}

interface TranscriptionActions {
  toggleTranscription: () => void;
  setTranscriptionStatus: (status: TranscriptionRuntimeStatus) => void;
  setTranscriptionProvider: (provider: TranscriptionProvider) => void;
  setTranscriptionLanguage: (lang: string) => void;
  setTranslationTargetLanguage: (lang: string) => void;
  setLocalTranscript: (transcript: Omit<TranscriptionPayload, 'lang' | 'provider'>) => void;
  sendTranscription: (text: string, isFinal: boolean) => Promise<void>;
  handleIncomingTranscription: (peerId: string, payload: TranscriptionPayload) => void;
  setDetectedLanguage: (lang: string) => void;
  setMeetingMinutesEnabled: (enabled: boolean) => void;
  receiveMeetingMinutesState: (payload: MeetingMinutesStatePayload) => void;
  cleanup: () => void;
}

export const useTranscriptionStore = create<TranscriptionState & TranscriptionActions>()(persist((set, get) => ({
  isTranscriptionEnabled: false,
  transcriptionStatus: 'off',
  transcriptionProvider: DEFAULT_TRANSCRIPTION_PROVIDER,
  transcriptionLanguage: resolveDefaultTranscriptionLanguage(),
  translationTargetLanguage: 'none',
  localTranscript: { text: '', isFinal: false },
  detectedLanguage: null,
  meetingMinutesEnabled: false,
  meetingMinutesOwnerId: null,
  meetingMinutesOwnerNickname: null,
  meetingMinutesStartedAt: null,

  toggleTranscription: () => set((state) => {
    const isTranscriptionEnabled = !state.isTranscriptionEnabled;
    return {
      isTranscriptionEnabled,
      transcriptionStatus: isTranscriptionEnabled ? 'starting' : 'off',
    };
  }),
  setTranscriptionStatus: (status) => set({ transcriptionStatus: status }),
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

  setMeetingMinutesEnabled: (enabled) => {
    const session = useSessionStore.getState();
    const sessionInfo = session.getSessionInfo();
    const ownerId = sessionInfo?.userId || session.userId || 'local';
    const ownerNickname = sessionInfo?.nickname || session.nickname || 'Unknown';
    const timestamp = Date.now();
    const payload: MeetingMinutesStatePayload = {
      enabled,
      ownerId,
      ownerNickname,
      startedAt: enabled ? timestamp : get().meetingMinutesStartedAt ?? timestamp,
      stoppedAt: enabled ? undefined : timestamp,
      version: 1,
    };

    set({
      meetingMinutesEnabled: enabled,
      meetingMinutesOwnerId: enabled ? ownerId : null,
      meetingMinutesOwnerNickname: enabled ? ownerNickname : null,
      meetingMinutesStartedAt: enabled ? payload.startedAt ?? timestamp : null,
    });

    const message: MeetingMinutesStateMessage = {
      type: 'meeting-minutes-state',
      payload,
    };
    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
  },

  receiveMeetingMinutesState: (payload) => {
    set({
      meetingMinutesEnabled: payload.enabled,
      meetingMinutesOwnerId: payload.enabled ? payload.ownerId : null,
      meetingMinutesOwnerNickname: payload.enabled ? payload.ownerNickname : null,
      meetingMinutesStartedAt: payload.enabled ? payload.startedAt ?? Date.now() : null,
    });
  },
  
  sendTranscription: async (text, isFinal) => {
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    const {
      transcriptionLanguage,
      detectedLanguage,
      transcriptionProvider,
      translationTargetLanguage,
    } = get();
    
    // 실제 STT 원본 언어 결정: 자동 감지 전에는 auto를 그대로 유지한다.
    const actualLang = transcriptionLanguage === 'auto'
      ? (detectedLanguage || 'auto')
      : transcriptionLanguage;

    const payload: DataChannelMessage['payload'] = {
      text,
      isFinal,
      lang: actualLang,
      provider: transcriptionProvider,
    };

    // 송출 자막 번역은 final 문장에만 적용한다. interim 조각은 불안정해서 번역 지연/오역이 크다.
    if (isFinal && translationTargetLanguage !== 'none') {
      try {
        const translation = await translationService.translate(text, actualLang, translationTargetLanguage);
        if (translation.engine !== 'none') {
          payload.translatedText = translation.text;
          payload.translatedLang = translationService.normalizeLanguageCode(translationTargetLanguage);
          set((state) => (
            state.localTranscript.text === text && state.localTranscript.isFinal === isFinal
              ? { localTranscript: { ...state.localTranscript, translatedText: translation.text, translatedLang: payload.translatedLang } }
              : state
          ));
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[Transcription] Failed to translate outgoing caption; sending raw text instead.', error);
        }
      }
    }
    
    const data: DataChannelMessage = {
      type: 'transcription',
      payload,
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
      transcriptionStatus: 'off',
      localTranscript: { text: '', isFinal: false },
      detectedLanguage: null,
      meetingMinutesEnabled: false,
      meetingMinutesOwnerId: null,
      meetingMinutesOwnerNickname: null,
      meetingMinutesStartedAt: null,
    });
  },
}), {
  name: TRANSCRIPTION_SETTINGS_STORAGE_KEY,
  version: 2,
  migrate: migrateTranscriptionSettings,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    transcriptionProvider: state.transcriptionProvider,
    transcriptionLanguage: state.transcriptionLanguage,
    translationTargetLanguage: state.translationTargetLanguage,
  }),
}));
