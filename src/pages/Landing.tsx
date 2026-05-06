/**
 * Landing Page Component
 *
 * @description
 * 우주적 분위기의 랜딩 페이지로, 사용자가 화상 회의 방 타입을 선택하고
 * 방 정보를 입력할 수 있는 메인 진입점입니다.
 *
 * @features
 * - URL 쿼리 파라미터를 통한 딥 링킹 지원 (type=one-to-one|video-group)
 * - 전역 상태(Zustand)와 URL 간 양방향 동기화
 * - 점진적 애니메이션을 통한 시각적 계층 구조 형성
 * - 반응형 레이아웃 (모바일 우선 접근)
 *
 * @example
 * // URL을 통한 직접 접근
 * https://example.com/landing?type=one-to-one
 *
 * @cognitive-load
 * - 3단계 정보 공개: 헤더 → 선택 모드 → 방 정보 입력
 * - 각 섹션 간 200ms 지연으로 시각적 주의 순차 유도
 */

import { CosmicBackground } from '@/components/landing/CosmicBackground';
import { Header } from '@/components/landing/Header';
import { RoomInfo } from '@/components/landing/RoomInfo';
import { SelectionMode } from '@/components/landing/SelectionMode';
import { useLandingStore } from '@/stores/useLandingStore';
import { DEFAULT_ROOM_TYPE, isValidRoomType } from '@/types/roomCapabilities';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Landing 페이지 메인 컴포넌트
 *
 * @returns {JSX.Element} 랜딩 페이지 전체 레이아웃
 */
const Landing = (): JSX.Element => {
  const { t } = useTranslation();
  // 전역 상태 관리: 방 타입 선택 상태
  const { roomType, setRoomType } = useLandingStore();

  // 라우팅 관련 훅
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Effect 1: URL → Store 동기화 (초기 진입 시)
   *
   * @description
   * 사용자가 쿼리 파라미터가 포함된 URL로 직접 접근했을 때,
   * 해당 타입을 전역 상태에 반영합니다. 이는 딥 링킹과 북마크 기능을 지원합니다.
   *
   * @example
   * URL: /landing?type=video-group
   * → setRoomType('video-group') 실행
   *
   * @cognitive-principle
   * 사용자의 정신 모델 일치: URL 공유 시 동일한 상태가 복원되어야 한다는 기대
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const typeParam = searchParams.get('type');

    // 유효한 타입만 상태에 반영 (타입 안전성 보장)
    if (isValidRoomType(typeParam)) {
      setRoomType(typeParam);
      return;
    }

    setRoomType(DEFAULT_ROOM_TYPE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  /**
   * Effect 2: Store → URL 동기화 (상태 변경 시)
   *
   * @description
   * 사용자가 UI에서 방 타입을 선택하면, 해당 선택이 URL에 즉시 반영됩니다.
   * replace: true 옵션으로 브라우저 히스토리를 오염시키지 않습니다.
   *
   * @example
   * setRoomType('one-to-one') 호출
   * → URL이 /landing?type=one-to-one으로 변경
   *
   * @cognitive-principle
   * 시스템 상태 가시성: URL은 애플리케이션 상태를 나타내는 진실의 원천(Source of Truth)
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);

    if (roomType) {
      // 방 타입이 선택된 경우: URL에 추가
      searchParams.set('type', roomType);
    } else {
      // 방 타입이 없는 경우: URL에서 제거
      searchParams.delete('type');
    }

    // 히스토리 스택을 쌓지 않고 현재 엔트리를 교체
    navigate(
      {
        pathname: location.pathname,
        search: searchParams.toString()
      },
      { replace: true }
    );
  }, [roomType, location.pathname, location.search, navigate]);

  return (
    <div className="relative min-h-screen min-h-dvh overflow-x-hidden bg-[#050507] text-white">
      {/*
        배경 레이어: 우주적 분위기를 조성하는 애니메이션 배경
        z-index: 0 (기본값)
        인지 원칙: 시각적 팝아웃 - 동적 배경으로 주의를 유도하되 콘텐츠를 방해하지 않음
      */}
      <CosmicBackground />
      <Header />

      <main className="relative z-10 flex min-h-screen min-h-dvh items-start justify-center px-4 pb-36 pt-32 sm:items-center sm:px-8 sm:pb-10 sm:pt-10">
        <div className="w-full max-w-xl">
          <div className="animate-fade-in-up text-center">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              {t('landing.title')}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
              {t('landing.description')}
            </p>
          </div>

          <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
            <div className="animate-fade-in-up animation-delay-200">
              <SelectionMode />
            </div>

            <div className="animate-fade-in-up animation-delay-400">
              <RoomInfo />
            </div>
          </div>

          <div className="mt-5 animate-fade-in-up text-center animation-delay-600">
            <p className="mx-auto max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
              {t('landing.note')}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
