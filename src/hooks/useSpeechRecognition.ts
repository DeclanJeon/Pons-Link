// frontend/src/hooks/useSpeechRecognition.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchAzureSpeechToken, resolveSpeechTokenApiUrl } from '@/features/speech/azureSpeechToken';
import { SUPPORTED_LANGUAGES, useTranscriptionStore, type TranscriptionProvider } from '@/stores/useTranscriptionStore';

interface SpeechRecognitionOptions {
  provider?: TranscriptionProvider;
  lang: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (event: SpeechRecognitionErrorEvent | { error: string }) => void;
}

type BrowserSpeechRecognitionConstructor = typeof window.SpeechRecognition;
type BrowserSpeechRecognitionInstance = InstanceType<BrowserSpeechRecognitionConstructor>;

type AzureRecognizer = {
  recognizing?: (_sender: unknown, event: { result?: { reason?: number; text?: string } }) => void;
  recognized?: (_sender: unknown, event: { result?: { reason?: number; text?: string } }) => void;
  canceled?: (_sender: unknown, event: { errorDetails?: string }) => void;
  sessionStopped?: () => void;
  startContinuousRecognitionAsync: (success?: () => void, error?: (error: string) => void) => void;
  stopContinuousRecognitionAsync: (success?: () => void, error?: (error: string) => void) => void;
  close: () => void;
};

type DeepgramAlternative = {
  transcript?: string;
  words?: Array<{ language?: string }>;
  languages?: Array<string | { language?: string }>;
};

type DeepgramResultMessage = {
  channel?: {
    alternatives?: DeepgramAlternative[];
  };
  is_final?: boolean;
  speech_final?: boolean;
};

const DEFAULT_BACKEND_API_URL = 'http://localhost:6650';
const DEEPGRAM_PROXY_PATH = '/api/speech/deepgram-stream';
const DEEPGRAM_MEDIA_TIMESLICE_MS = 250;
const WEB_SOCKET_OPEN = 1;

const getBrowserSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const getBrowserLanguage = (lang: string) => (lang === 'auto' ? 'ko-KR' : lang);
const AZURE_AUTO_DETECT_LANGUAGES = SUPPORTED_LANGUAGES
  .map(({ code }) => code)
  .filter((code) => code !== 'auto')
  .slice(0, 10);

type AzureSpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');

const getAzureDetectedLanguage = (sdk: AzureSpeechSdk, result: unknown) => {
  try {
    return sdk.AutoDetectSourceLanguageResult.fromResult(result as never).language || null;
  } catch {
    return null;
  }
};

const getDeepgramDetectedLanguage = (alternative: DeepgramAlternative): string | null => {
  const wordLanguage = alternative.words?.find((word) => typeof word.language === 'string' && word.language.trim())?.language;
  if (wordLanguage) return wordLanguage;

  const language = alternative.languages?.find((candidate) => {
    if (typeof candidate === 'string') return candidate.trim();
    return typeof candidate.language === 'string' && candidate.language.trim();
  });

  if (typeof language === 'string') return language;
  return language?.language ?? null;
};

const getConfiguredBackendApiUrl = () => (
  resolveSpeechTokenApiUrl(import.meta.env.VITE_SPEECH_TOKEN_API_URL as string | undefined)
  ?? resolveSpeechTokenApiUrl(import.meta.env.VITE_API_URL as string | undefined)
  ?? DEFAULT_BACKEND_API_URL
);

const buildDeepgramUrl = (lang: string) => {
  const backendUrl = new URL(getConfiguredBackendApiUrl());
  backendUrl.protocol = backendUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  backendUrl.pathname = DEEPGRAM_PROXY_PATH;
  backendUrl.search = '';
  backendUrl.searchParams.set('model', 'nova-3');
  backendUrl.searchParams.set('interim_results', 'true');
  backendUrl.searchParams.set('smart_format', 'true');

  if (lang === 'auto') {
    backendUrl.searchParams.set('detect_language', 'true');
  } else {
    backendUrl.searchParams.set('language', lang);
  }

  return backendUrl.toString();
};

/**
 * 음성인식 Hook. STT provider 우선순위는 Deepgram → Azure Speech → Web Speech API다.
 */
export const useSpeechRecognition = ({
  provider = 'deepgram',
  lang,
  onResult,
  onEnd,
  onError,
}: SpeechRecognitionOptions) => {
  const browserRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const azureRecognizerRef = useRef<AzureRecognizer | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const deepgramRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramStreamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const listeningIntentRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const { setDetectedLanguage } = useTranscriptionStore();

  const isBrowserSupported = !!getBrowserSpeechRecognition();
  const isDeepgramSupported = typeof WebSocket !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const isSupported = provider === 'deepgram' || provider === 'azure' || isBrowserSupported;

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onResult, onEnd, onError]);

  const setListening = useCallback((value: boolean) => {
    isListeningRef.current = value;
    setIsListening(value);
  }, []);

  const stopDeepgramRecognition = useCallback(async () => {
    const recorder = deepgramRecorderRef.current;
    const socket = deepgramSocketRef.current;

    if (socket?.readyState === WEB_SOCKET_OPEN) {
      socket.send(JSON.stringify({ type: 'Finalize' }));
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    deepgramStreamRef.current?.getTracks().forEach((track) => track.stop());
    socket?.close();

    deepgramRecorderRef.current = null;
    deepgramSocketRef.current = null;
    deepgramStreamRef.current = null;
    setListening(false);
  }, [setListening]);

  const stopAzureRecognition = useCallback(async () => {
    const recognizer = azureRecognizerRef.current;
    if (!recognizer) return;

    await new Promise<void>((resolve) => {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
          resolve();
        },
        () => {
          recognizer.close();
          resolve();
        },
      );
    });
    azureRecognizerRef.current = null;
    setListening(false);
  }, [setListening]);

  const initializeBrowserRecognition = useCallback(() => {
    const SpeechRecognition = getBrowserSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] Web Speech API is not supported');
      return null;
    }

    const recognition = new SpeechRecognition();
    browserRecognitionRef.current = recognition;

    recognition.lang = getBrowserLanguage(lang);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = lang === 'auto' ? 3 : 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      retryCountRef.current = 0;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];

        if (lang === 'auto' && result.isFinal && result[0]) {
          const detectedLang = extractLanguageFromResult(result);
          if (detectedLang) {
            setDetectedLanguage(detectedLang);
          }
        }

        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) onResultRef.current(finalTranscript, true);
      if (interimTranscript) onResultRef.current(interimTranscript, false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechRecognition] Error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningIntentRef.current = false;
      }
      onErrorRef.current?.(event);
    };

    recognition.onend = () => {
      setListening(false);

      if (listeningIntentRef.current) {
        if (retryCountRef.current < MAX_RETRIES) {
          setTimeout(() => {
            try {
              recognition.start();
              setListening(true);
              retryCountRef.current++;
            } catch (error) {
              console.error('[SpeechRecognition] Restart error:', error);
            }
          }, 250);
        } else {
          console.error('[SpeechRecognition] Max retries exceeded');
          retryCountRef.current = 0;
        }
      }
      onEndRef.current?.();
    };

    return recognition;
  }, [lang, setDetectedLanguage, setListening]);

  const startBrowserRecognition = useCallback(() => {
    const recognition = browserRecognitionRef.current ?? initializeBrowserRecognition();
    if (!recognition) return false;

    try {
      listeningIntentRef.current = true;
      recognition.start();
      setListening(true);
      return true;
    } catch (error) {
      console.error('[SpeechRecognition] Start error:', error);
      return false;
    }
  }, [initializeBrowserRecognition, setListening]);

  const startAzureRecognition = useCallback(async () => {
    listeningIntentRef.current = true;
    const tokenResult = await fetchAzureSpeechToken();
    if (tokenResult.status !== 'available') {
      onErrorRef.current?.({ error: tokenResult.error ?? 'Azure Speech token unavailable' });
      if (isBrowserSupported) {
        startBrowserRecognition();
      } else {
        setListening(false);
      }
      return;
    }

    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenResult.token, tokenResult.region);
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = lang === 'auto'
      ? sdk.SpeechRecognizer.FromConfig(
        speechConfig,
        sdk.AutoDetectSourceLanguageConfig.fromLanguages(AZURE_AUTO_DETECT_LANGUAGES),
        audioConfig,
      ) as unknown as AzureRecognizer
      : new sdk.SpeechRecognizer(
        Object.assign(speechConfig, { speechRecognitionLanguage: getBrowserLanguage(lang) }),
        audioConfig,
      ) as unknown as AzureRecognizer;
    azureRecognizerRef.current = recognizer;

    recognizer.recognizing = (_sender, event) => {
      const text = event.result?.text?.trim();
      if (lang === 'auto' && event.result) {
        const detectedLanguage = getAzureDetectedLanguage(sdk, event.result);
        if (detectedLanguage) setDetectedLanguage(detectedLanguage);
      }
      if (text) onResultRef.current(text, false);
    };

    recognizer.recognized = (_sender, event) => {
      const text = event.result?.text?.trim();
      if (lang === 'auto' && event.result) {
        const detectedLanguage = getAzureDetectedLanguage(sdk, event.result);
        if (detectedLanguage) setDetectedLanguage(detectedLanguage);
      }
      if (text) onResultRef.current(text, true);
    };

    recognizer.canceled = (_sender, event) => {
      onErrorRef.current?.({ error: event.errorDetails || 'Azure Speech recognition canceled' });
      listeningIntentRef.current = false;
      setListening(false);
    };

    recognizer.sessionStopped = () => {
      setListening(false);
      onEndRef.current?.();
    };

    await new Promise<void>((resolve) => {
      recognizer.startContinuousRecognitionAsync(
        () => {
          setListening(true);
          resolve();
        },
        (error) => {
          onErrorRef.current?.({ error });
          setListening(false);
          resolve();
        },
      );
    });
  }, [isBrowserSupported, lang, setDetectedLanguage, setListening, startBrowserRecognition]);

  const startDeepgramRecognition = useCallback(async () => {
    listeningIntentRef.current = true;
    if (!isDeepgramSupported) {
      onErrorRef.current?.({ error: 'Deepgram streaming is not supported in this browser' });
      await startAzureRecognition();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket(buildDeepgramUrl(lang));
      let hasOpened = false;
      let fallbackStarted = false;

      const cleanupDeepgramSession = () => {
        const recorder = deepgramRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }

        deepgramRecorderRef.current = null;
        deepgramSocketRef.current = null;
        deepgramStreamRef.current?.getTracks().forEach((track) => track.stop());
        deepgramStreamRef.current = null;
        setListening(false);
      };

      const fallbackFromDeepgram = async (error: string) => {
        if (fallbackStarted || !listeningIntentRef.current) return;
        fallbackStarted = true;
        onErrorRef.current?.({ error });
        cleanupDeepgramSession();
        await startAzureRecognition();
      };

      deepgramStreamRef.current = stream;
      deepgramSocketRef.current = socket;

      socket.onopen = () => {
        hasOpened = true;
        const recorder = new MediaRecorder(stream);
        deepgramRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && socket.readyState === WEB_SOCKET_OPEN) {
            socket.send(event.data);
          }
        };

        recorder.start(DEEPGRAM_MEDIA_TIMESLICE_MS);
        setListening(true);
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(String(event.data)) as DeepgramResultMessage;
        const alternative = payload.channel?.alternatives?.[0];
        const transcript = alternative?.transcript?.trim();
        if (!alternative || !transcript) return;

        if (lang === 'auto') {
          const detectedLanguage = getDeepgramDetectedLanguage(alternative);
          if (detectedLanguage) setDetectedLanguage(detectedLanguage);
        }

        onResultRef.current(transcript, Boolean(payload.is_final));
      };

      socket.onerror = () => {
        void fallbackFromDeepgram('Deepgram WebSocket error');
      };

      socket.onclose = () => {
        if (!fallbackStarted && !hasOpened && listeningIntentRef.current) {
          void fallbackFromDeepgram('Deepgram WebSocket closed before streaming started');
          return;
        }

        cleanupDeepgramSession();
        if (!fallbackStarted) {
          onEndRef.current?.();
        }
      };
    } catch (error) {
      onErrorRef.current?.({ error: error instanceof Error ? error.message : 'Deepgram microphone stream unavailable' });
      await startAzureRecognition();
    }
  }, [isDeepgramSupported, lang, setDetectedLanguage, setListening, startAzureRecognition]);

  useEffect(() => {
    if (provider === 'deepgram') {
      return () => {
        listeningIntentRef.current = false;
        void stopDeepgramRecognition();
        void stopAzureRecognition();
        browserRecognitionRef.current?.stop();
        browserRecognitionRef.current = null;
      };
    }

    if (provider === 'azure') {
      return () => {
        listeningIntentRef.current = false;
        void stopAzureRecognition();
        browserRecognitionRef.current?.stop();
        browserRecognitionRef.current = null;
      };
    }

    const recognition = initializeBrowserRecognition();

    return () => {
      listeningIntentRef.current = false;
      recognition?.stop();
      browserRecognitionRef.current = null;
    };
  }, [provider, stopDeepgramRecognition, stopAzureRecognition, initializeBrowserRecognition]);

  const start = useCallback(async () => {
    if (isListeningRef.current) return;

    if (provider === 'deepgram') {
      await startDeepgramRecognition();
      return;
    }

    if (provider === 'azure') {
      await startAzureRecognition();
      return;
    }

    startBrowserRecognition();
  }, [provider, startDeepgramRecognition, startAzureRecognition, startBrowserRecognition]);

  const stop = useCallback(async () => {
    listeningIntentRef.current = false;

    if (provider === 'deepgram') {
      await stopDeepgramRecognition();
      return;
    }

    if (provider === 'azure') {
      await stopAzureRecognition();
      return;
    }

    if (browserRecognitionRef.current && isListeningRef.current) {
      browserRecognitionRef.current.stop();
      setListening(false);
    }
  }, [provider, stopDeepgramRecognition, stopAzureRecognition, setListening]);

  return { start, stop, isListening, isSupported };
};

/**
 * 음성인식 결과에서 언어 추출 (휴리스틱)
 */
function extractLanguageFromResult(result: SpeechRecognitionResult): string | null {
  const text = result[0].transcript;

  if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
    return 'ko-KR';
  }

  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return 'ja-JP';
  }

  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'zh-CN';
  }

  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar-SA';
  }

  return 'en-US';
}
