import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';

const fetchAzureSpeechTokenMock = vi.fn();
const startContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const stopContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const closeMock = vi.fn();
const setDetectedLanguageMock = vi.fn();
const fromLanguagesMock = vi.fn((languages: string[]) => ({ languages }));
const autoDetectSourceLanguageFromResultMock = vi.fn(() => ({ language: 'en-US' }));
type MockAzureRecognizer = {
  recognizing?: (_sender: unknown, event: { result?: { reason?: number; text?: string } }) => void;
  recognized?: (_sender: unknown, event: { result?: { reason?: number; text?: string } }) => void;
  canceled?: (_sender: unknown, event: { errorDetails?: string }) => void;
  sessionStopped?: () => void;
  startContinuousRecognitionAsync: (success?: () => void) => void;
  stopContinuousRecognitionAsync: (success?: () => void) => void;
  close: () => void;
};

const recognizerInstances: MockAzureRecognizer[] = [];
const browserStartMock = vi.fn();
const browserStopMock = vi.fn();
type MockBrowserRecognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
const browserRecognizerInstances: MockBrowserRecognizer[] = [];

vi.mock('@/features/speech/azureSpeechToken', () => ({
  fetchAzureSpeechToken: (...args: unknown[]) => fetchAzureSpeechTokenMock(...args),
}));

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  AutoDetectSourceLanguageConfig: {
    fromLanguages: fromLanguagesMock,
  },
  AutoDetectSourceLanguageResult: {
    fromResult: autoDetectSourceLanguageFromResultMock,
  },
  SpeechConfig: {
    fromAuthorizationToken: vi.fn(() => ({ speechRecognitionLanguage: '' })),
  },
  AudioConfig: {
    fromDefaultMicrophoneInput: vi.fn(() => ({ kind: 'mic' })),
  },
  SpeechRecognizer: Object.assign(vi.fn(function SpeechRecognizer() {
    const instance = {
      recognizing: undefined,
      recognized: undefined,
      canceled: undefined,
      sessionStopped: undefined,
      startContinuousRecognitionAsync: startContinuousRecognitionAsyncMock,
      stopContinuousRecognitionAsync: stopContinuousRecognitionAsyncMock,
      close: closeMock,
    };
    recognizerInstances.push(instance);
    return instance;
  }), {
    FromConfig: vi.fn(function SpeechRecognizerFromConfig() {
      const instance = {
        recognizing: undefined,
        recognized: undefined,
        canceled: undefined,
        sessionStopped: undefined,
        startContinuousRecognitionAsync: startContinuousRecognitionAsyncMock,
        stopContinuousRecognitionAsync: stopContinuousRecognitionAsyncMock,
        close: closeMock,
      };
      recognizerInstances.push(instance);
      return instance;
    }),
  }),
  ResultReason: {
    RecognizingSpeech: 2,
    RecognizedSpeech: 3,
  },
  CancellationReason: {
    Error: 1,
  },
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'auto', name: 'Auto Detect (자동 감지)', flag: '🌐' },
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
  ],
  useTranscriptionStore: () => ({ setDetectedLanguage: setDetectedLanguageMock }),
}));

describe('useSpeechRecognition Azure provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recognizerInstances.length = 0;
    browserRecognizerInstances.length = 0;
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    fetchAzureSpeechTokenMock.mockResolvedValue({
      status: 'available',
      token: 'issued-token',
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      expiresInSeconds: 600,
    });
  });



  it('uses Azure source-language auto detection when language is auto', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'azure', lang: 'auto', onResult }));

    await act(async () => {
      await result.current.start();
    });

    expect(fromLanguagesMock).toHaveBeenCalledWith(expect.arrayContaining(['ko-KR', 'en-US', 'ja-JP', 'zh-CN']));
    expect((await import('microsoft-cognitiveservices-speech-sdk')).SpeechRecognizer.FromConfig).toHaveBeenCalledTimes(1);

    act(() => {
      recognizerInstances[0].recognized?.(undefined, { result: { reason: 3, text: 'Hello there' } });
    });

    expect(autoDetectSourceLanguageFromResultMock).toHaveBeenCalledWith({ reason: 3, text: 'Hello there' });
    expect(setDetectedLanguageMock).toHaveBeenCalledWith('en-US');
    expect(onResult).toHaveBeenCalledWith('Hello there', true);
  });

  it('starts Azure continuous recognition and emits interim/final transcripts', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'azure', lang: 'ko-KR', onResult }));

    await act(async () => {
      await result.current.start();
    });

    expect(fetchAzureSpeechTokenMock).toHaveBeenCalledTimes(1);
    expect(startContinuousRecognitionAsyncMock).toHaveBeenCalledTimes(1);

    act(() => {
      recognizerInstances[0].recognizing?.(undefined, { result: { reason: 2, text: '안녕' } });
      recognizerInstances[0].recognized?.(undefined, { result: { reason: 3, text: '안녕하세요' } });
    });

    expect(onResult).toHaveBeenCalledWith('안녕', false);
    expect(onResult).toHaveBeenCalledWith('안녕하세요', true);
  });

  it('does not reissue Azure tokens on ordinary callback rerenders while listening', async () => {
    const onResult = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useSpeechRecognition({ provider: 'azure', lang: 'ko-KR', onResult: callback }),
      { initialProps: { callback: onResult } },
    );

    await act(async () => {
      await result.current.start();
    });

    rerender({ callback: vi.fn() });
    rerender({ callback: vi.fn() });

    expect(fetchAzureSpeechTokenMock).toHaveBeenCalledTimes(1);
    expect(startContinuousRecognitionAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to browser speech recognition when Azure token is unavailable', async () => {
    fetchAzureSpeechTokenMock.mockResolvedValue({ status: 'unavailable', error: 'token api unavailable' });
    (window as unknown as { webkitSpeechRecognition: new () => MockBrowserRecognizer }).webkitSpeechRecognition = vi.fn(function BrowserSpeechRecognition() {
      const instance: MockBrowserRecognizer = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 0,
        onresult: null,
        onerror: null,
        onend: null,
        start: browserStartMock,
        stop: browserStopMock,
      };
      browserRecognizerInstances.push(instance);
      return instance;
    }) as unknown as new () => MockBrowserRecognizer;

    const onResult = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'azure', lang: 'ko-KR', onResult, onError }));

    await act(async () => {
      await result.current.start();
    });

    expect(onError).toHaveBeenCalledWith({ error: 'token api unavailable' });
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
    expect(browserStartMock).toHaveBeenCalledTimes(1);
    expect(browserRecognizerInstances[0].lang).toBe('ko-KR');

    act(() => {
      browserRecognizerInstances[0].onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: '브라우저 자막' } }],
      });
    });

    expect(onResult).toHaveBeenCalledWith('브라우저 자막', true);
  });
});
