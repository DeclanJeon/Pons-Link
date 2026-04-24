import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';

const fetchAzureSpeechTokenMock = vi.fn();
const startContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const stopContinuousRecognitionAsyncMock = vi.fn((success?: () => void) => success?.());
const closeMock = vi.fn();
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

vi.mock('@/features/speech/azureSpeechToken', () => ({
  fetchAzureSpeechToken: (...args: unknown[]) => fetchAzureSpeechTokenMock(...args),
}));

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: {
    fromAuthorizationToken: vi.fn(() => ({ speechRecognitionLanguage: '' })),
  },
  AudioConfig: {
    fromDefaultMicrophoneInput: vi.fn(() => ({ kind: 'mic' })),
  },
  SpeechRecognizer: vi.fn(function SpeechRecognizer() {
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
  ResultReason: {
    RecognizingSpeech: 2,
    RecognizedSpeech: 3,
  },
  CancellationReason: {
    Error: 1,
  },
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({ setDetectedLanguage: vi.fn() }),
}));

describe('useSpeechRecognition Azure provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recognizerInstances.length = 0;
    fetchAzureSpeechTokenMock.mockResolvedValue({
      status: 'available',
      token: 'issued-token',
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      expiresInSeconds: 600,
    });
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
});
