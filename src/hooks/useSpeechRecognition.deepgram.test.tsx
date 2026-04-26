import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';

const fetchDeepgramSpeechTokenMock = vi.fn();
const fetchAzureSpeechTokenMock = vi.fn();
const startContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const stopContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const closeAzureMock = vi.fn();
const setDetectedLanguageMock = vi.fn();
const browserStartMock = vi.fn();
const browserStopMock = vi.fn();
const mediaRecorderStartMock = vi.fn();
const mediaRecorderStopMock = vi.fn();
const mediaRecorderInstances: MockMediaRecorder[] = [];
const webSocketInstances: MockWebSocket[] = [];
const browserRecognizerInstances: MockBrowserRecognizer[] = [];
const azureRecognizerInstances: MockAzureRecognizer[] = [];

class MockBlob {
  readonly parts: unknown[];
  readonly type: string;

  constructor(parts: unknown[] = [], options: { type?: string } = {}) {
    this.parts = parts;
    this.type = options.type ?? '';
  }
}

type MockMediaRecorder = {
  state: 'inactive' | 'recording';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onerror: ((event: { error?: Error }) => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
};

type MockWebSocket = {
  url: string;
  protocols?: string | string[];
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: (() => void) | null;
  send: (payload: unknown) => void;
  close: () => void;
};

type MockAzureRecognizer = {
  startContinuousRecognitionAsync: (success?: () => void) => void;
  stopContinuousRecognitionAsync: (success?: () => void) => void;
  close: () => void;
};

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

vi.mock('@/features/speech/deepgramSpeechToken', () => ({
  fetchDeepgramSpeechToken: (...args: unknown[]) => fetchDeepgramSpeechTokenMock(...args),
}));

vi.mock('@/features/speech/azureSpeechToken', () => ({
  fetchAzureSpeechToken: (...args: unknown[]) => fetchAzureSpeechTokenMock(...args),
}));

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  AutoDetectSourceLanguageConfig: { fromLanguages: vi.fn((languages: string[]) => ({ languages })) },
  AutoDetectSourceLanguageResult: { fromResult: vi.fn(() => ({ language: 'en-US' })) },
  SpeechConfig: { fromAuthorizationToken: vi.fn(() => ({ speechRecognitionLanguage: '' })) },
  AudioConfig: { fromDefaultMicrophoneInput: vi.fn(() => ({ kind: 'mic' })) },
  SpeechRecognizer: vi.fn(function SpeechRecognizer() {
    const instance: MockAzureRecognizer = {
      startContinuousRecognitionAsync: startContinuousRecognitionAsyncMock,
      stopContinuousRecognitionAsync: stopContinuousRecognitionAsyncMock,
      close: closeAzureMock,
    };
    azureRecognizerInstances.push(instance);
    return instance;
  }),
  ResultReason: { RecognizingSpeech: 2, RecognizedSpeech: 3 },
  CancellationReason: { Error: 1 },
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'auto', name: 'Auto Detect (자동 감지)', flag: '🌐' },
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  ],
  useTranscriptionStore: () => ({ setDetectedLanguage: setDetectedLanguageMock }),
}));

describe('useSpeechRecognition Deepgram provider priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaRecorderInstances.length = 0;
    webSocketInstances.length = 0;
    browserRecognizerInstances.length = 0;
    azureRecognizerInstances.length = 0;
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    fetchDeepgramSpeechTokenMock.mockResolvedValue({
      status: 'available',
      token: 'issued-deepgram-token',
      expiresInSeconds: 30,
    });
    fetchAzureSpeechTokenMock.mockResolvedValue({
      status: 'available',
      token: 'issued-azure-token',
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      expiresInSeconds: 600,
    });

    Object.defineProperty(globalThis, 'Blob', { value: MockBlob, configurable: true });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: vi.fn(function MediaRecorder(_stream: MediaStream, options?: { mimeType?: string }) {
        const instance: MockMediaRecorder = {
          state: 'inactive',
          mimeType: options?.mimeType ?? 'audio/webm;codecs=opus',
          ondataavailable: null,
          onerror: null,
          start: vi.fn((timeslice?: number) => {
            mediaRecorderStartMock(timeslice);
            instance.state = 'recording';
          }),
          stop: vi.fn(() => {
            mediaRecorderStopMock();
            instance.state = 'inactive';
          }),
        };
        mediaRecorderInstances.push(instance);
        return instance;
      }),
      configurable: true,
    });
    Object.defineProperty(globalThis.MediaRecorder, 'isTypeSupported', {
      value: vi.fn((mimeType: string) => mimeType === 'audio/webm;codecs=opus'),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'WebSocket', {
      value: vi.fn(function WebSocket(url: string, protocols?: string | string[]) {
        const instance: MockWebSocket = {
          url,
          protocols,
          readyState: 0,
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          send: vi.fn(),
          close: vi.fn(() => {
            instance.readyState = 3;
            instance.onclose?.();
          }),
        };
        webSocketInstances.push(instance);
        return instance;
      }),
      configurable: true,
    });
  });

  it('uses Deepgram first, streams microphone audio, and emits interim/final captions', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'auto', onResult }));

    await act(async () => {
      await result.current.start();
    });

    expect(fetchDeepgramSpeechTokenMock).toHaveBeenCalledTimes(1);
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(webSocketInstances[0].url).toContain('wss://api.deepgram.com/v1/listen');
    expect(webSocketInstances[0].url).toContain('model=nova-3');
    expect(webSocketInstances[0].url).toContain('interim_results=true');
    expect(webSocketInstances[0].url).toContain('detect_language=true');
    expect(webSocketInstances[0].protocols).toEqual(['token', 'issued-deepgram-token']);

    await act(async () => {
      webSocketInstances[0].readyState = 1;
      webSocketInstances[0].onopen?.();
    });

    expect(mediaRecorderStartMock).toHaveBeenCalledWith(250);
    act(() => {
      mediaRecorderInstances[0].ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      webSocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: 'Results',
          is_final: false,
          channel: { alternatives: [{ transcript: 'hello', languages: ['en-US'] }] },
        }),
      });
      webSocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: 'Results',
          is_final: true,
          channel: { alternatives: [{ transcript: 'hello world', languages: ['en-US'] }] },
        }),
      });
    });

    expect(webSocketInstances[0].send).toHaveBeenCalledWith(expect.any(Blob));
    expect(setDetectedLanguageMock).toHaveBeenCalledWith('en-US');
    expect(onResult).toHaveBeenCalledWith('hello', false);
    expect(onResult).toHaveBeenCalledWith('hello world', true);
  });

  it('falls back Deepgram token failure to Azure, then to Web Speech if Azure is unavailable', async () => {
    fetchDeepgramSpeechTokenMock.mockResolvedValue({ status: 'unavailable', error: 'Deepgram token unavailable' });
    fetchAzureSpeechTokenMock.mockResolvedValue({ status: 'unavailable', error: 'Azure token unavailable' });
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

    const onError = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult, onError }));

    await act(async () => {
      await result.current.start();
    });

    expect(fetchDeepgramSpeechTokenMock).toHaveBeenCalledTimes(1);
    expect(fetchAzureSpeechTokenMock).toHaveBeenCalledTimes(1);
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
    expect(browserStartMock).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ error: 'Deepgram token unavailable' });
    expect(onError).toHaveBeenCalledWith({ error: 'Azure token unavailable' });
  });
});
