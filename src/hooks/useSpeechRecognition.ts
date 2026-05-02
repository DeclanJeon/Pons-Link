// frontend/src/hooks/useSpeechRecognition.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchAzureSpeechToken, resolveSpeechTokenApiUrl } from '@/features/speech/azureSpeechToken';
import { SUPPORTED_LANGUAGES, useTranscriptionStore, type TranscriptionProvider, type TranscriptionRuntimeStatus } from '@/stores/useTranscriptionStore';

interface SpeechRecognitionOptions {
  provider?: TranscriptionProvider;
  lang: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (event: SpeechRecognitionErrorEvent | { error: string }) => void;
  onStatusChange?: (status: TranscriptionRuntimeStatus) => void;
}

type BrowserSpeechRecognitionConstructor = typeof window.SpeechRecognition;
type BrowserSpeechRecognitionInstance = InstanceType<BrowserSpeechRecognitionConstructor>;

type AzureRecognizer = {
  recognizing?: (_sender: unknown, event: { result?: AzureRecognitionResultLike }) => void;
  recognized?: (_sender: unknown, event: { result?: AzureRecognitionResultLike }) => void;
  canceled?: (_sender: unknown, event: { errorDetails?: string }) => void;
  sessionStopped?: () => void;
  startContinuousRecognitionAsync: (success?: () => void, error?: (error: string) => void) => void;
  stopContinuousRecognitionAsync: (success?: () => void, error?: (error: string) => void) => void;
  close: () => void;
};

type AzureRecognitionResultLike = {
  reason?: number;
  text?: string;
  properties?: {
    getProperty: (propertyId: number) => string;
  };
};

type DeepgramAlternative = {
  transcript?: string;
  words?: Array<{ language?: string; punctuated_word?: string; word?: string }>;
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
const DEEPGRAM_MEDIA_TIMESLICE_MS = 100;
const WEB_SOCKET_OPEN = 1;
const DEEPGRAM_UTTERANCE_END_MS = 1000;
const TRANSCRIPT_DEDUPE_WINDOW_MS = 1500;
const DEEPGRAM_MEDIA_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

const getBrowserSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const getBrowserLanguage = (lang: string) => (lang === 'auto' ? 'ko-KR' : lang);
const DEEPGRAM_LANGUAGE_OVERRIDES: Record<string, string> = {
  'ko-KR': 'ko',
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'pt-BR': 'pt-BR',
  'th-TH': 'th-TH',
  'ja-JP': 'ja',
};
const getDeepgramLanguage = (lang: string) => {
  if (lang === 'auto') return 'multi';
  return DEEPGRAM_LANGUAGE_OVERRIDES[lang] ?? lang.split('-')[0];
};
const getDeepgramMediaRecorderOptions = (): MediaRecorderOptions | undefined => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  const mimeType = DEEPGRAM_MEDIA_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
};
const AZURE_AUTO_DETECT_LANGUAGES = ['ko-KR', 'en-US', 'ja-JP', 'zh-CN'].filter((code) => (
  SUPPORTED_LANGUAGES.some((language) => language.code === code)
));

type AzureSpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');

type AzureDetailedWord = { Word?: string };

type AzureDetailedPhrase = {
  Display?: string;
  DisplayText?: string;
  DisplayWords?: AzureDetailedWord[];
  Words?: AzureDetailedWord[];
};

type AzureDetailedResult = {
  DisplayText?: string;
  NBest?: AzureDetailedPhrase[];
};

const KOREAN_TEXT_PATTERN = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

const shouldUseWordJoinForAzure = (displayText: string): boolean =>
  KOREAN_TEXT_PATTERN.test(displayText) && !/\s/.test(displayText.trim());

const compactTranscriptText = (text: string): string => text.replace(/\s+/g, '');

const removeRepeatedCompactKoreanPrefix = (text: string): string => {
  const trimmedText = text.trim().replace(/\s+/g, ' ');
  if (!KOREAN_TEXT_PATTERN.test(trimmedText) || !/\s/.test(trimmedText)) {
    return trimmedText;
  }

  const whitespaceMatches = Array.from(trimmedText.matchAll(/\s+/g));
  for (const match of whitespaceMatches) {
    const splitIndex = match.index;
    if (splitIndex === undefined) continue;

    const left = trimmedText.slice(0, splitIndex).trim();
    const right = trimmedText.slice(splitIndex).trim();
    const compactLeft = compactTranscriptText(left);
    const compactRight = compactTranscriptText(right);

    if (compactLeft.length < 4 || !compactRight.startsWith(compactLeft)) {
      continue;
    }

    const remainder = compactRight.slice(compactLeft.length);
    return remainder ? `${left} ${remainder}` : left;
  }

  return trimmedText;
};

const joinAzureWords = (words?: AzureDetailedWord[]): string | null => {
  if (!Array.isArray(words)) {
    return null;
  }

  const joined = words
    .map((word) => word.Word?.trim())
    .filter((word): word is string => Boolean(word))
    .join(' ')
    .trim();

  return joined || null;
};

const warnMissingAzureWordLevelText = (displayText: string, rawJson: string) => {
  if (!import.meta.env.DEV || !shouldUseWordJoinForAzure(displayText)) {
    return;
  }

  console.warn('[speech] Azure detailed result returned Korean display text without word-level fields.', {
    displayText,
    jsonResult: rawJson,
  });
};

const getAzureDetectedLanguage = (sdk: AzureSpeechSdk, result: unknown) => {
  try {
    return sdk.AutoDetectSourceLanguageResult.fromResult(result as never).language || null;
  } catch {
    return null;
  }
};

const getAzureDisplayText = (sdk: AzureSpeechSdk, result: AzureRecognitionResultLike): string => {
  try {
    const rawJson = result.properties?.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)?.trim();
    if (rawJson) {
      const payload = JSON.parse(rawJson) as AzureDetailedResult;
      const bestPhrase = payload.NBest?.find(
        (candidate) =>
          candidate.Display?.trim()
          || candidate.DisplayText?.trim()
          || candidate.DisplayWords?.length
          || candidate.Words?.length,
      );
      const detailedDisplay = bestPhrase?.Display?.trim() || bestPhrase?.DisplayText?.trim();
      const wordDisplay = joinAzureWords(bestPhrase?.DisplayWords) ?? joinAzureWords(bestPhrase?.Words);

      if (detailedDisplay) {
        if (wordDisplay && shouldUseWordJoinForAzure(detailedDisplay)) {
          return wordDisplay;
        }
        if (!wordDisplay) {
          warnMissingAzureWordLevelText(detailedDisplay, rawJson);
        }
        return detailedDisplay;
      }

      if (wordDisplay) {
        return wordDisplay;
      }

      const topLevelDisplay = payload.DisplayText?.trim();
      if (topLevelDisplay) return topLevelDisplay;
    }
  } catch {
    // Fall back to the SDK text field when detailed JSON is unavailable or malformed.
  }

  return result.text?.trim() ?? '';
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

const getDeepgramDisplayText = (alternative: DeepgramAlternative): string => {
  const transcript = alternative.transcript?.trim() ?? '';
  const wordDisplay = alternative.words
    ?.map((word) => (word.punctuated_word || word.word)?.trim())
    .filter((word): word is string => Boolean(word))
    .join(' ')
    .trim() ?? '';

  if (wordDisplay && (!transcript || shouldUseWordJoinForAzure(transcript))) {
    return wordDisplay;
  }

  return transcript || wordDisplay;
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
  backendUrl.searchParams.set('utterance_end_ms', String(DEEPGRAM_UTTERANCE_END_MS));
  backendUrl.searchParams.set('vad_events', 'true');
  backendUrl.searchParams.set('language', getDeepgramLanguage(lang));

  return backendUrl.toString();
};

/**
 * 음성인식 Hook. STT provider 우선순위는 Deepgram → Azure Speech → Web Speech API다.
 */
export const useSpeechRecognition = ({
  provider = 'azure',
  lang,
  onResult,
  onEnd,
  onError,
  onStatusChange,
}: SpeechRecognitionOptions) => {
  const browserRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const azureRecognizerRef = useRef<AzureRecognizer | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const deepgramRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramStreamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const listeningIntentRef = useRef(false);
  const lastEmittedTranscriptRef = useRef<{ text: string; isFinal: boolean; timestamp: number } | null>(null);
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
    onStatusChangeRef.current = onStatusChange;
  }, [onResult, onEnd, onError, onStatusChange]);

  const notifyStatus = useCallback((status: TranscriptionRuntimeStatus) => {
    onStatusChangeRef.current?.(status);
  }, []);

  const resetTranscriptDedupe = useCallback(() => {
    lastEmittedTranscriptRef.current = null;
  }, []);

  const emitTranscript = useCallback((text: string, isFinal: boolean) => {
    const normalizedText = removeRepeatedCompactKoreanPrefix(text);
    if (!normalizedText) return;

    const now = Date.now();
    const lastEmitted = lastEmittedTranscriptRef.current;
    if (
      lastEmitted
      && lastEmitted.text === normalizedText
      && lastEmitted.isFinal === isFinal
      && now - lastEmitted.timestamp < TRANSCRIPT_DEDUPE_WINDOW_MS
    ) {
      return;
    }

    lastEmittedTranscriptRef.current = { text: normalizedText, isFinal, timestamp: now };
    onResultRef.current(normalizedText, isFinal);
  }, []);

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

      emitTranscript(finalTranscript, true);
      emitTranscript(interimTranscript, false);
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
  }, [emitTranscript, lang, setDetectedLanguage, setListening]);

  const startBrowserRecognition = useCallback(() => {
    const recognition = browserRecognitionRef.current ?? initializeBrowserRecognition();
    if (!recognition) return false;

    try {
      notifyStatus('starting');
      resetTranscriptDedupe();
      listeningIntentRef.current = true;
      recognition.start();
      setListening(true);
      notifyStatus('live');
      return true;
    } catch (error) {
      console.error('[SpeechRecognition] Start error:', error);
      return false;
    }
  }, [initializeBrowserRecognition, notifyStatus, resetTranscriptDedupe, setListening]);

  const startAzureRecognition = useCallback(async (status: Extract<TranscriptionRuntimeStatus, 'starting' | 'fallback'> = 'starting') => {
    notifyStatus(status);
    resetTranscriptDedupe();
    listeningIntentRef.current = true;
    const tokenResult = await fetchAzureSpeechToken();
    if (tokenResult.status !== 'available') {
      onErrorRef.current?.({ error: tokenResult.error ?? 'Azure Speech token unavailable' });
      if (isBrowserSupported) {
        startBrowserRecognition();
      } else {
        notifyStatus('error');
        setListening(false);
      }
      return;
    }

    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenResult.token, tokenResult.region);
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;
    speechConfig.requestWordLevelTimestamps?.();
    speechConfig.setProperty?.(sdk.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, 'true');
    speechConfig.setProperty?.(sdk.PropertyId.SpeechServiceResponse_PostProcessingOption, 'TrueText');
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
      const text = event.result ? getAzureDisplayText(sdk, event.result) : '';
      if (lang === 'auto' && event.result) {
        const detectedLanguage = getAzureDetectedLanguage(sdk, event.result);
        if (detectedLanguage) setDetectedLanguage(detectedLanguage);
      }
      emitTranscript(text, false);
    };

    recognizer.recognized = (_sender, event) => {
      const text = event.result ? getAzureDisplayText(sdk, event.result) : '';
      if (lang === 'auto' && event.result) {
        const detectedLanguage = getAzureDetectedLanguage(sdk, event.result);
        if (detectedLanguage) setDetectedLanguage(detectedLanguage);
      }
      emitTranscript(text, true);
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
          notifyStatus('live');
          resolve();
        },
        (error) => {
          onErrorRef.current?.({ error });
          notifyStatus('error');
          setListening(false);
          resolve();
        },
      );
    });
  }, [emitTranscript, isBrowserSupported, lang, notifyStatus, resetTranscriptDedupe, setDetectedLanguage, setListening, startBrowserRecognition]);

  const startDeepgramRecognition = useCallback(async () => {
    notifyStatus('starting');
    resetTranscriptDedupe();
    listeningIntentRef.current = true;
    if (!isDeepgramSupported) {
      onErrorRef.current?.({ error: 'Deepgram streaming is not supported in this browser' });
      notifyStatus('error');
      setListening(false);
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

      const failFromDeepgram = (error: string) => {
        if (fallbackStarted || !listeningIntentRef.current) return;
        fallbackStarted = true;
        notifyStatus('error');
        onErrorRef.current?.({ error });
        cleanupDeepgramSession();
      };

      deepgramStreamRef.current = stream;
      deepgramSocketRef.current = socket;

      socket.onopen = () => {
        hasOpened = true;
        const recorderOptions = getDeepgramMediaRecorderOptions();
        const recorder = recorderOptions
          ? new MediaRecorder(stream, recorderOptions)
          : new MediaRecorder(stream);
        deepgramRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && socket.readyState === WEB_SOCKET_OPEN) {
            socket.send(event.data);
          }
        };

        recorder.start(DEEPGRAM_MEDIA_TIMESLICE_MS);
        setListening(true);
        notifyStatus('live');
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        let payload: DeepgramResultMessage;
        try {
          payload = JSON.parse(event.data) as DeepgramResultMessage;
        } catch {
          return;
        }

        const alternative = payload.channel?.alternatives?.[0];
        const transcript = alternative ? getDeepgramDisplayText(alternative) : '';
        if (!alternative || !transcript) return;

        if (lang === 'auto') {
          const detectedLanguage = getDeepgramDetectedLanguage(alternative);
          if (detectedLanguage) setDetectedLanguage(detectedLanguage);
        }

        emitTranscript(transcript, Boolean(payload.is_final));
      };

      socket.onerror = () => {
        failFromDeepgram('Deepgram WebSocket error');
      };

      socket.onclose = (event) => {
        if (!fallbackStarted && listeningIntentRef.current) {
          if (!hasOpened) {
            failFromDeepgram('Deepgram WebSocket closed before streaming started');
            return;
          }

          if (event.code !== 1000) {
            const reason = event.reason ? ` ${event.reason}` : '';
            failFromDeepgram(`Deepgram WebSocket closed abnormally: ${event.code}${reason}`);
            return;
          }
        }

        cleanupDeepgramSession();
        if (!fallbackStarted) {
          onEndRef.current?.();
        }
      };
    } catch (error) {
      notifyStatus('error');
      onErrorRef.current?.({ error: error instanceof Error ? error.message : 'Deepgram microphone stream unavailable' });
      setListening(false);
    }
  }, [emitTranscript, isDeepgramSupported, lang, notifyStatus, resetTranscriptDedupe, setDetectedLanguage, setListening]);

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
    notifyStatus('off');

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
  }, [provider, stopDeepgramRecognition, stopAzureRecognition, notifyStatus, setListening]);

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
