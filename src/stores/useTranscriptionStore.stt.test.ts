import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  migrateTranscriptionSettings,
  resolveDefaultTranscriptionLanguage,
  TRANSCRIPTION_SETTINGS_STORAGE_KEY,
  useTranscriptionStore,
} from './useTranscriptionStore';

const { sendToAllPeersMock, setPeerConnectionStateMock, translateMock } = vi.hoisted(() => ({
  sendToAllPeersMock: vi.fn(),
  setPeerConnectionStateMock: vi.fn(),
  translateMock: vi.fn(),
}));

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({ sendToAllPeers: sendToAllPeersMock }),
    setState: (...args: unknown[]) => setPeerConnectionStateMock(...args),
  },
}));

vi.mock('./useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      userId: 'local-user',
      nickname: 'Local User',
      getSessionInfo: () => ({ userId: 'local-user', nickname: 'Local User' }),
    }),
  },
}));

vi.mock('@/lib/translationService', () => ({
  translationService: {
    normalizeLanguageCode: (code: string) => {
      const normalized = code.trim().toLowerCase();
      if (normalized === 'zh-tw' || normalized === 'zh-hant') return 'zh-TW';
      if (normalized === 'zh-cn' || normalized === 'zh-hans' || normalized === 'zh') return 'zh-CN';
      return normalized.split('-')[0];
    },
    translate: translateMock,
  },
}));

describe('useTranscriptionStore STT integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem(TRANSCRIPTION_SETTINGS_STORAGE_KEY);
    useTranscriptionStore.setState({
      isTranscriptionEnabled: false,
      transcriptionStatus: 'off',
      transcriptionProvider: 'azure',
      transcriptionLanguage: 'auto',
      translationTargetLanguage: 'none',
      localTranscript: { text: '', isFinal: false },
      detectedLanguage: null,
      meetingMinutesEnabled: false,
      meetingMinutesConsent: 'idle',
      meetingMinutesOwnerId: null,
      meetingMinutesOwnerNickname: null,
      meetingMinutesStartedAt: null,
    });
  });

  it('initial store defaults voice recognition to Azure with browser language detection', () => {
    expect(useTranscriptionStore.getInitialState().transcriptionProvider).toBe('azure');
    expect(useTranscriptionStore.getInitialState().transcriptionLanguage).toBe(resolveDefaultTranscriptionLanguage());
  });

  it('resolves the default voice language from browser language candidates', () => {
    expect(resolveDefaultTranscriptionLanguage(['ko'])).toBe('ko-KR');
    expect(resolveDefaultTranscriptionLanguage(['ko-KR'])).toBe('ko-KR');
    expect(resolveDefaultTranscriptionLanguage(['en'])).toBe('en-US');
    expect(resolveDefaultTranscriptionLanguage(['fr-CA'])).toBe('fr-FR');
    expect(resolveDefaultTranscriptionLanguage(['unsupported'])).toBe('ko-KR');
  });

  it('migrates legacy Deepgram auto settings to Azure and browser language default', () => {
    expect(migrateTranscriptionSettings({
      transcriptionProvider: 'deepgram',
      transcriptionLanguage: 'auto',
      translationTargetLanguage: 'en',
    })).toMatchObject({
      transcriptionProvider: 'azure',
      transcriptionLanguage: resolveDefaultTranscriptionLanguage(),
      translationTargetLanguage: 'en',
    });
  });

  it('moves captions into a starting state immediately when the user enables them', () => {
    useTranscriptionStore.getState().toggleTranscription();

    expect(useTranscriptionStore.getState().isTranscriptionEnabled).toBe(true);
    expect(useTranscriptionStore.getState().transcriptionStatus).toBe('starting');
  });

  it('clears the caption runtime status when the user disables captions', () => {
    useTranscriptionStore.getState().toggleTranscription();
    useTranscriptionStore.getState().setTranscriptionStatus('live');
    useTranscriptionStore.getState().toggleTranscription();

    expect(useTranscriptionStore.getState().isTranscriptionEnabled).toBe(false);
    expect(useTranscriptionStore.getState().transcriptionStatus).toBe('off');
  });

  it('keeps outgoing caption language as auto until recognition identifies the speaker language', () => {
    useTranscriptionStore.getState().setTranscriptionLanguage('auto');

    useTranscriptionStore.getState().sendTranscription('hello', false);

    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: 'hello',
        isFinal: false,
        lang: 'auto',
        provider: 'azure',
      },
    }));
  });

  it('sends auto-detected language once recognition has identified it', () => {
    useTranscriptionStore.getState().setTranscriptionLanguage('auto');
    useTranscriptionStore.getState().setDetectedLanguage('en-US');

    useTranscriptionStore.getState().sendTranscription('hello', true);

    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: 'hello',
        isFinal: true,
        lang: 'en-US',
        provider: 'azure',
      },
    }));
  });

  it('sends transcription data with the selected provider and language', () => {
    useTranscriptionStore.getState().setTranscriptionProvider('azure');
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');

    useTranscriptionStore.getState().sendTranscription('안녕하세요', true);

    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕하세요',
        isFinal: true,
        lang: 'ko-KR',
        provider: 'azure',
      },
    }));
  });

  it('broadcasts meeting minutes state when a user enables room recording', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T01:00:00.000Z'));

    useTranscriptionStore.getState().setMeetingMinutesEnabled(true);

    expect(useTranscriptionStore.getState()).toMatchObject({
      meetingMinutesEnabled: true,
      meetingMinutesConsent: 'granted',
      meetingMinutesOwnerId: 'local-user',
      meetingMinutesOwnerNickname: 'Local User',
      meetingMinutesStartedAt: Date.parse('2026-05-02T01:00:00.000Z'),
    });
    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'meeting-minutes-state',
      payload: {
        enabled: true,
        ownerId: 'local-user',
        ownerNickname: 'Local User',
        startedAt: Date.parse('2026-05-02T01:00:00.000Z'),
        version: 1,
      },
    }));

    vi.useRealTimers();
  });

  it('applies remote meeting minutes state without rebroadcasting', () => {
    useTranscriptionStore.getState().receiveMeetingMinutesState({
      enabled: true,
      ownerId: 'remote-user',
      ownerNickname: 'Remote User',
      startedAt: 1777683600000,
      version: 1,
    });

    expect(useTranscriptionStore.getState()).toMatchObject({
      meetingMinutesEnabled: true,
      meetingMinutesConsent: 'pending',
      meetingMinutesOwnerId: 'remote-user',
      meetingMinutesOwnerNickname: 'Remote User',
      meetingMinutesStartedAt: 1777683600000,
    });
    expect(sendToAllPeersMock).not.toHaveBeenCalled();
  });

  it('lets the local participant accept or decline remote meeting minutes consent', () => {
    useTranscriptionStore.getState().receiveMeetingMinutesState({
      enabled: true,
      ownerId: 'remote-user',
      ownerNickname: 'Remote User',
      startedAt: 1777683600000,
      version: 1,
    });

    useTranscriptionStore.getState().acceptMeetingMinutesConsent();
    expect(useTranscriptionStore.getState().meetingMinutesConsent).toBe('granted');

    useTranscriptionStore.getState().declineMeetingMinutesConsent();
    expect(useTranscriptionStore.getState().meetingMinutesConsent).toBe('declined');
  });

  it('resets local meeting minutes consent when room recording stops', () => {
    useTranscriptionStore.setState({
      meetingMinutesEnabled: true,
      meetingMinutesConsent: 'declined',
      meetingMinutesOwnerId: 'remote-user',
      meetingMinutesOwnerNickname: 'Remote User',
      meetingMinutesStartedAt: 1777683600000,
    });

    useTranscriptionStore.getState().receiveMeetingMinutesState({
      enabled: false,
      ownerId: 'remote-user',
      ownerNickname: 'Remote User',
      stoppedAt: 1777687200000,
      version: 1,
    });

    expect(useTranscriptionStore.getState()).toMatchObject({
      meetingMinutesEnabled: false,
      meetingMinutesConsent: 'idle',
      meetingMinutesOwnerId: null,
      meetingMinutesOwnerNickname: null,
      meetingMinutesStartedAt: null,
    });
  });

  it('persists selected STT provider and voice language so room reloads do not fall back to auto', () => {
    useTranscriptionStore.getState().setTranscriptionProvider('deepgram');
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');
    useTranscriptionStore.getState().setTranslationTargetLanguage('en');

    const storedSettings = window.localStorage.getItem(TRANSCRIPTION_SETTINGS_STORAGE_KEY);
    expect(storedSettings).toContain('ko-KR');
    expect(storedSettings).toContain('deepgram');
    expect(storedSettings).toContain('en');
  });

  it('sends original and translated final captions to the selected Translation language', async () => {
    translateMock.mockResolvedValue({ text: 'hello', engine: 'azure' });
    useTranscriptionStore.getState().setTranscriptionProvider('azure');
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');
    useTranscriptionStore.getState().setTranslationTargetLanguage('en');
    useTranscriptionStore.getState().setLocalTranscript({ text: '안녕하세요', isFinal: true });

    await useTranscriptionStore.getState().sendTranscription('안녕하세요', true);

    expect(translateMock).toHaveBeenCalledWith('안녕하세요', 'ko-KR', 'en');
    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕하세요',
        isFinal: true,
        lang: 'ko-KR',
        provider: 'azure',
        translatedText: 'hello',
        translatedLang: 'en',
      },
    }));
    expect(useTranscriptionStore.getState().localTranscript).toEqual({
      text: '안녕하세요',
      isFinal: true,
      translatedText: 'hello',
      translatedLang: 'en',
    });
  });

  it('keeps interim outgoing captions raw to avoid translating unstable speech fragments', async () => {
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');
    useTranscriptionStore.getState().setTranslationTargetLanguage('en');

    await useTranscriptionStore.getState().sendTranscription('안녕', false);

    expect(translateMock).not.toHaveBeenCalled();
    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕',
        isFinal: false,
        lang: 'ko-KR',
        provider: 'azure',
      },
    }));
  });

  it('falls back to raw outgoing captions when translation fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    translateMock.mockRejectedValue(new Error('translation unavailable'));
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');
    useTranscriptionStore.getState().setTranslationTargetLanguage('en');

    await useTranscriptionStore.getState().sendTranscription('안녕하세요', true);

    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕하세요',
        isFinal: true,
        lang: 'ko-KR',
        provider: 'azure',
      },
    }));
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('does not call translation when target language is disabled', async () => {
    useTranscriptionStore.getState().setTranscriptionLanguage('ko-KR');
    useTranscriptionStore.getState().setTranslationTargetLanguage('none');

    await useTranscriptionStore.getState().sendTranscription('안녕하세요', true);

    expect(translateMock).not.toHaveBeenCalled();
    expect(sendToAllPeersMock).toHaveBeenCalledWith(JSON.stringify({
      type: 'transcription',
      payload: {
        text: '안녕하세요',
        isFinal: true,
        lang: 'ko-KR',
        provider: 'azure',
      },
    }));
  });

  it('routes incoming transcription through the peer transcript state path with translated text', () => {
    useTranscriptionStore.getState().handleIncomingTranscription('peer-1', {
      text: 'remote hello',
      isFinal: false,
      lang: 'en-US',
      translatedText: '원격 안녕',
      translatedLang: 'ko',
    });

    expect(setPeerConnectionStateMock).toHaveBeenCalledTimes(1);
    const updater = setPeerConnectionStateMock.mock.calls[0][0] as (state: { peers: Map<string, { transcript?: unknown }> }) => { peers: Map<string, { transcript?: unknown }> };
    const state = { peers: new Map([['peer-1', { transcript: undefined }]]) };

    const nextState = updater(state);

    expect(nextState.peers.get('peer-1')?.transcript).toEqual({
      text: 'remote hello',
      isFinal: false,
      lang: 'en-US',
      translatedText: '원격 안녕',
      translatedLang: 'ko',
    });
  });
});
