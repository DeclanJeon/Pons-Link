// frontend/src/hooks/useSpeechRecognition.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchAzureSpeechToken } from '@/features/speech/azureSpeechToken';
import { useTranscriptionStore, type TranscriptionProvider } from '@/stores/useTranscriptionStore';

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

const getBrowserSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const getBrowserLanguage = (lang: string) => (lang === 'auto' ? 'ko-KR' : lang);

/**
 * 음성인식 Hook. Azure Speech를 기본 provider로 사용하고, 필요하면 Web Speech API로 fallback한다.
 */
export const useSpeechRecognition = ({
  provider = 'browser',
  lang,
  onResult,
  onEnd,
  onError,
}: SpeechRecognitionOptions) => {
  const browserRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const azureRecognizerRef = useRef<AzureRecognizer | null>(null);
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
  const isSupported = provider === 'azure' || isBrowserSupported;

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onResult, onEnd, onError]);

  const setListening = useCallback((value: boolean) => {
    isListeningRef.current = value;
    setIsListening(value);
  }, []);

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

  const startAzureRecognition = useCallback(async () => {
    listeningIntentRef.current = true;
    const tokenResult = await fetchAzureSpeechToken();
    if (tokenResult.status !== 'available') {
      onErrorRef.current?.({ error: tokenResult.error ?? 'Azure Speech token unavailable' });
      setListening(false);
      return;
    }

    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenResult.token, tokenResult.region);
    speechConfig.speechRecognitionLanguage = getBrowserLanguage(lang);
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig) as AzureRecognizer;
    azureRecognizerRef.current = recognizer;

    recognizer.recognizing = (_sender, event) => {
      const text = event.result?.text?.trim();
      if (text) onResultRef.current(text, false);
    };

    recognizer.recognized = (_sender, event) => {
      const text = event.result?.text?.trim();
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
  }, [lang, setListening]);

  useEffect(() => {
    if (provider === 'azure') {
      return () => {
        listeningIntentRef.current = false;
        void stopAzureRecognition();
      };
    }

    const SpeechRecognition = getBrowserSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] Web Speech API is not supported');
      return;
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

    return () => {
      listeningIntentRef.current = false;
      recognition.stop();
    };
  }, [lang, setDetectedLanguage, provider, stopAzureRecognition, setListening]);

  const start = useCallback(async () => {
    if (isListeningRef.current) return;

    if (provider === 'azure') {
      await startAzureRecognition();
      return;
    }

    if (browserRecognitionRef.current) {
      try {
        listeningIntentRef.current = true;
        browserRecognitionRef.current.start();
        setListening(true);
      } catch (error) {
        console.error('[SpeechRecognition] Start error:', error);
      }
    }
  }, [provider, startAzureRecognition, setListening]);

  const stop = useCallback(async () => {
    listeningIntentRef.current = false;

    if (provider === 'azure') {
      await stopAzureRecognition();
      return;
    }

    if (browserRecognitionRef.current && isListeningRef.current) {
      browserRecognitionRef.current.stop();
      setListening(false);
    }
  }, [provider, stopAzureRecognition, setListening]);

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
