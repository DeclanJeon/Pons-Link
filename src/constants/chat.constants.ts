/**
 * Chat 관련 상수 정의 (확장)
 * @module ChatConstants
 */

export const CHAT_CONSTANTS = {
  TYPING_TIMEOUT: 2000,
  ANIMATION_DURATION: 200,
  SPRING_CONFIG: {
    type: "spring" as const,
    damping: 25,
    stiffness: 200
  },
  MAX_MESSAGE_WIDTH: '85%',
  PANEL_WIDTH: 'w-80',
  FOCUS_DELAY: 100,
  SCROLL_THRESHOLD: 100, // 새 메시지 알림 표시 임계값
  MESSAGE_GROUP_TIME_THRESHOLD: 5 * 60 * 1000, // 5분
  DRAFT_SAVE_DELAY: 500, // 임시 저장 지연
  LINK_PREVIEW_TIMEOUT: 5000, // 링크 미리보기 타임아웃
} as const;

export const CHAT_MESSAGES = {
  SEARCH_PLACEHOLDER: '메시지 검색...',
  INPUT_PLACEHOLDER: '메시지를 입력하세요...',
  KEYBOARD_HINT: 'Enter로 전송, Shift+Enter로 줄바꿈',
  ATTACH_TITLE: '파일 첨부',
  FULLSCREEN_ENTER: '전체화면',
  FULLSCREEN_EXIT: '전체화면 종료',
  NEW_MESSAGES: (count: number) => `${count}개의 새 메시지`,
  SCROLL_TO_BOTTOM: '최신 메시지로 이동',
  TYPING_SINGLE: (name: string) => `${name}님이 입력 중입니다...`,
  TYPING_MULTIPLE: (name: string, count: number) => `${name} 외 ${count}명이 입력 중입니다...`,
} as const;

export const EMOJI_CATEGORIES = [
  { id: 'recent', name: '최근 사용', icon: '🕐' },
  { id: 'smileys', name: '이모티콘', icon: '😀' },
  { id: 'people', name: '사람', icon: '👋' },
  { id: 'animals', name: '동물', icon: '🐶' },
  { id: 'food', name: '음식', icon: '🍕' },
  { id: 'travel', name: '여행', icon: '✈️' },
  { id: 'activities', name: '활동', icon: '⚽' },
  { id: 'objects', name: '사물', icon: '💡' },
  { id: 'symbols', name: '기호', icon: '❤️' },
  { id: 'flags', name: '국기', icon: '🚩' },
] as const;
