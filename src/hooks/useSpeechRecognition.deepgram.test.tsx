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
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event?: { code?: number; reason?: string; wasClean?: boolean }) => void) | null;
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
  resolveSpeechTokenApiUrl: (value: string | undefined) => (value?.trim() ? value.trim().replace(/\/+$/, '') : null),
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
            instance.onclose?.({ code: 1000, reason: 'Client closed', wasClean: true });
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

    expect(fetchDeepgramSpeechTokenMock).not.toHaveBeenCalled();
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(webSocketInstances[0].url).toContain('ws://localhost:6650/api/speech/deepgram-stream');
    const deepgramUrl = new URL(webSocketInstances[0].url);
    expect(deepgramUrl.searchParams.get('model')).toBe('nova-3');
    expect(deepgramUrl.searchParams.get('interim_results')).toBe('true');
    expect(deepgramUrl.searchParams.get('language')).toBe('multi');
    expect(deepgramUrl.searchParams.get('smart_format')).toBe('true');
    expect(deepgramUrl.searchParams.get('utterance_end_ms')).toBe('1000');
    expect(deepgramUrl.searchParams.get('vad_events')).toBe('true');
    expect(deepgramUrl.searchParams.has('endpointing')).toBe(false);
    expect(deepgramUrl.searchParams.has('detect_language')).toBe(false);
    expect(webSocketInstances[0].protocols).toBeUndefined();

    await act(async () => {
      webSocketInstances[0].readyState = 1;
      webSocketInstances[0].onopen?.();
    });

    expect(mediaRecorderStartMock).toHaveBeenCalledWith(100);
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

  it('maps Korean locale selection to Deepgram Korean language code used by the official live stream example', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult }));

    await act(async () => {
      await result.current.start();
    });

    const deepgramUrl = new URL(webSocketInstances[0].url);
    expect(deepgramUrl.searchParams.get('language')).toBe('ko');
    expect(deepgramUrl.searchParams.get('utterance_end_ms')).toBe('1000');
    expect(deepgramUrl.searchParams.get('vad_events')).toBe('true');
    expect(deepgramUrl.searchParams.has('endpointing')).toBe(false);
  });

  it('joins Deepgram punctuated words when Korean transcript has no spaces', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      webSocketInstances[0].onopen?.();
      webSocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: 'Results',
          is_final: true,
          channel: {
            alternatives: [{
              transcript: '상심하신다구요고맙구려.',
              words: [
                { word: '상심하신다구요', punctuated_word: '상심하신다구요', language: 'ko' },
                { word: '고맙구려', punctuated_word: '고맙구려.', language: 'ko' },
              ],
            }],
          },
        }),
      });
    });

    expect(onResult).toHaveBeenCalledWith('상심하신다구요 고맙구려.', true);
  });

  it('deduplicates repeated Deepgram final messages for the same utterance', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult }));

    await act(async () => {
      await result.current.start();
    });

    const message = {
      type: 'Results',
      is_final: true,
      speech_final: true,
      channel: { alternatives: [{ transcript: '안녕하세요', languages: ['ko'] }] },
    };

    act(() => {
      webSocketInstances[0].onopen?.();
      webSocketInstances[0].onmessage?.({ data: JSON.stringify(message) });
      webSocketInstances[0].onmessage?.({ data: JSON.stringify(message) });
    });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('안녕하세요', true);
  });

  it('ignores binary Blob messages from the Deepgram stream instead of parsing them as JSON', async () => {
    const onError = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'auto', onResult, onError }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      webSocketInstances[0].readyState = 1;
      webSocketInstances[0].onopen?.();
    });

    expect(() => {
      webSocketInstances[0].onmessage?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    }).not.toThrow();
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a Deepgram WebSocket error without falling back to Azure', async () => {
    const onError = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult, onError }));

    await act(async () => {
      await result.current.start();
    });

    expect(fetchDeepgramSpeechTokenMock).not.toHaveBeenCalled();
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();

    await act(async () => {
      webSocketInstances[0].onerror?.(new Event('error'));
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith({ error: 'Deepgram WebSocket error' });
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
  });

  it('reports an abnormal Deepgram close without falling back to Azure', async () => {
    const onError = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ provider: 'deepgram', lang: 'ko-KR', onResult, onError }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      webSocketInstances[0].readyState = 1;
      webSocketInstances[0].onopen?.();
    });

    expect(mediaRecorderStartMock).toHaveBeenCalledWith(100);

    await act(async () => {
      webSocketInstances[0].readyState = 3;
      webSocketInstances[0].onclose?.({ code: 1011, reason: 'Deepgram stream closed', wasClean: false });
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith({ error: 'Deepgram WebSocket closed abnormally: 1011 Deepgram stream closed' });
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
  });

  it('ignores stale Deepgram close events from a previous language session instead of falling back to Azure', async () => {
    const onError = vi.fn();
    const onResult = vi.fn();
    const { result, rerender } = renderHook(
      ({ lang }) => useSpeechRecognition({ provider: 'deepgram', lang, onResult, onError }),
      { initialProps: { lang: 'auto' } },
    );

    await act(async () => {
      await result.current.start();
    });

    const firstSocket = webSocketInstances[0];

    await act(async () => {
      firstSocket.readyState = 1;
      firstSocket.onopen?.();
    });

    await act(async () => {
      await result.current.stop();
      rerender({ lang: 'ko-KR' });
      await result.current.start();
    });

    expect(webSocketInstances).toHaveLength(2);

    await act(async () => {
      firstSocket.readyState = 3;
      firstSocket.onclose?.({ code: 1011, reason: 'stale Deepgram stream closed', wasClean: false });
      await Promise.resolve();
    });

    expect(onError).not.toHaveBeenCalledWith({ error: 'Deepgram WebSocket closed abnormally: 1011 stale Deepgram stream closed' });
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
  });

  it('reports unsupported Deepgram streaming without falling back to Azure or Web Speech', async () => {
    Object.defineProperty(globalThis, 'WebSocket', { value: undefined, configurable: true });
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

    expect(fetchDeepgramSpeechTokenMock).not.toHaveBeenCalled();
    expect(fetchAzureSpeechTokenMock).not.toHaveBeenCalled();
    expect(startContinuousRecognitionAsyncMock).not.toHaveBeenCalled();
    expect(browserStartMock).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ error: 'Deepgram streaming is not supported in this browser' });
  });
});
