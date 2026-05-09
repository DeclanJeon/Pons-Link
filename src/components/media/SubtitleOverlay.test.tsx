import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubtitleOverlay } from './SubtitleOverlay';
import { translationService } from '@/lib/translationService';

vi.mock('@/lib/translationService', () => ({
  translationService: {
    normalizeLanguageCode: vi.fn((code: string) => {
      const lower = code.toLowerCase();
      if (lower === 'ko-kr') return 'ko';
      if (lower === 'en-us') return 'en';
      return lower.split('-')[0];
    }),
    translate: vi.fn(async () => ({
      text: 'translated caption',
      engine: 'azure' as const,
    })),
  },
}));

const mockedTranslationService = vi.mocked(translationService);

describe('SubtitleOverlay translation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders translated text below a final STT caption when a concrete source language is available', async () => {
    render(
      <SubtitleOverlay
        transcript={{ text: '안녕하세요', isFinal: true, lang: 'ko-KR' }}
        targetLang="en"
      />,
    );

    expect(screen.getByText('안녕하세요')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTranslationService.translate).toHaveBeenCalledWith('안녕하세요', 'ko', 'en');
      expect(screen.getByText('translated caption')).toBeInTheDocument();
    });
  });

  it('keeps the original caption and waits for detected source language when STT is still auto', async () => {
    render(
      <SubtitleOverlay
        transcript={{ text: 'hello from auto mode', isFinal: true, lang: 'auto' }}
        targetLang="ko"
      />,
    );

    expect(screen.getByText('hello from auto mode')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTranslationService.translate).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('translated caption')).not.toBeInTheDocument();
  });

  it('does not render a duplicate translated line when the translation service falls back to the original text', async () => {
    mockedTranslationService.translate.mockResolvedValueOnce({
      text: '이렇게',
      engine: 'none',
      error: 'Translation API returned 502',
    });

    render(
      <SubtitleOverlay
        transcript={{ text: '이렇게', isFinal: true, lang: 'ko-KR' }}
        targetLang="en"
      />,
    );

    expect(screen.getByText('이렇게')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTranslationService.translate).toHaveBeenCalledWith('이렇게', 'ko', 'en');
    });

    expect(screen.getAllByText('이렇게')).toHaveLength(1);
  });

  it('does not translate when translation is disabled', async () => {
    render(
      <SubtitleOverlay
        transcript={{ text: 'caption only', isFinal: true, lang: 'en-US' }}
        targetLang="none"
      />,
    );

    expect(screen.getByText('caption only')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTranslationService.translate).not.toHaveBeenCalled();
    });
  });

  it('uses Korean-friendly wrapping instead of breaking Hangul syllables apart', () => {
    render(
      <SubtitleOverlay
        transcript={{ text: '한국어 자막 띄어쓰기 유지', isFinal: true, lang: 'ko-KR' }}
        targetLang="none"
      />,
    );

    expect(screen.getByText('한국어 자막 띄어쓰기 유지')).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText('한국어 자막 띄어쓰기 유지')).toHaveClass('[word-break:keep-all]');
  });

  it('renders interim captions immediately while STT is still listening', () => {
    render(
      <SubtitleOverlay
        transcript={{ text: '마이크 입력 중', isFinal: false, lang: 'ko-KR' }}
        targetLang="none"
      />,
    );

    expect(screen.getByText('마이크 입력 중')).toBeInTheDocument();
    expect(mockedTranslationService.translate).not.toHaveBeenCalled();
  });

  it('keeps live captions above camera framing video layers', () => {
    render(
      <SubtitleOverlay
        transcript={{ text: '프레이밍 위에 보여야 함', isFinal: false, lang: 'ko-KR' }}
        targetLang="none"
      />,
    );

    expect(screen.getByRole('status')).toHaveClass('z-40');
  });

  it('hides a final caption after microphone input stops updating it', () => {
    vi.useFakeTimers();

    render(
      <SubtitleOverlay
        transcript={{ text: '마이크 입력 완료', isFinal: true, lang: 'ko-KR' }}
        targetLang="none"
      />,
    );

    expect(screen.getByText('마이크 입력 완료')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(screen.queryByText('마이크 입력 완료')).not.toBeInTheDocument();
  });
});
