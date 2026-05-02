// frontend/src/components/SubtitleOverlay.tsx

import { useEffect, useState, useMemo, useRef, memo } from 'react';
import { translationService } from '@/lib/translationService';

interface SubtitleOverlayProps {
  transcript?: { text: string; isFinal: boolean; lang?: string; translatedText?: string; translatedLang?: string };
  targetLang: string;
}

const CAPTION_IDLE_HIDE_MS = 3500;

/**
 * 자막 오버레이 컴포넌트
 * Azure Translator 서버 route 기반 번역 지원
 * - 자동 숨김 기능 (3초 후 페이드아웃)
 */
const isConcreteLanguageCode = (lang?: string) => {
  if (!lang) return false;

  const normalized = lang.trim().toLowerCase();
  return normalized !== '' && normalized !== 'auto' && normalized !== 'und' && normalized !== 'unknown';
};

export const SubtitleOverlay = memo(({ transcript, targetLang }: SubtitleOverlayProps) => {
  const [translatedText, setTranslatedText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const translationId = useMemo(() => 
    transcript?.text, 
    [transcript?.text]
  );

  /**
   * 번역 실행
   */
  useEffect(() => {
    if (transcript?.translatedText) {
      setTranslatedText(transcript.translatedText);
      return;
    }

    if (!transcript?.isFinal || !transcript.text || targetLang === 'none') {
      setTranslatedText('');
      return;
    }

    // STT auto-detect가 아직 실제 발화 언어를 확정하지 못한 상태에서는
    // 외부 번역 API에 `auto|target` 같은 무효 langpair를 보내지 않는다.
    if (!isConcreteLanguageCode(transcript.lang)) {
      setTranslatedText('');
      return;
    }

    const sourceLang = translationService.normalizeLanguageCode(transcript.lang);
    const normalizedTarget = translationService.normalizeLanguageCode(targetLang);

    if (sourceLang === normalizedTarget) {
      setTranslatedText('');
      return;
    }

    let isCancelled = false;
    const currentTranslationId = translationId;

    translationService.translate(transcript.text, sourceLang, normalizedTarget)
      .then(result => {
        if (!isCancelled && currentTranslationId === translationId) {
          setTranslatedText(result.engine === 'azure' ? result.text : '');

          // 번역 엔진 표시 (개발 모드)
          if (import.meta.env.DEV) {
            console.log(`[Subtitle] Translated via ${result.engine}`);
          }
        }
      })
      .catch(err => {
        console.error('[Subtitle] Translation error:', err);
        if (!isCancelled) setTranslatedText('');
      });

    return () => {
      isCancelled = true;
    };
  }, [transcript, targetLang, translationId]);

  /**
   * 자막 표시/숨김 로직
   * - 텍스트가 있으면 표시
   * - 3초 후 자동 페이드아웃
   */
  useEffect(() => {
    if (transcript?.text && transcript.isFinal) {
      setIsVisible(true);
      
      // 기존 타이머 취소
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, CAPTION_IDLE_HIDE_MS);
    } else {
      setIsVisible(false);
    }
    
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [transcript?.text, transcript?.isFinal]);

  if (!transcript?.text || !transcript.isFinal || !isVisible) return null;

  return (
    <div 
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none absolute left-1/2 w-fit max-w-[90%] -translate-x-1/2 rounded-xl bg-black/65 p-2.5 text-center shadow-[0_18px_60px_-32px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08] backdrop-blur-md transition-opacity duration-300"
      style={{
        opacity: isVisible ? 1 : 0,
        bottom: 'calc(var(--room-dock-bottom-offset, 1rem) + env(safe-area-inset-bottom))',
      }}
    >
      {/* 원문 */}
      <p 
        className="whitespace-pre-wrap text-sm font-semibold text-white [overflow-wrap:break-word] [word-break:keep-all] opacity-100 transition-opacity duration-200 sm:text-base lg:text-xl"
      >
        {transcript.text}
      </p>
      
      {/* 번역문 */}
      {translatedText && (
        <p className="mt-1 text-sm font-medium text-cyan-300 lg:text-lg">
          {translatedText}
        </p>
      )}
    </div>
  );
});

SubtitleOverlay.displayName = 'SubtitleOverlay';
