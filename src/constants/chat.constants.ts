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
  SEARCH_PLACEHOLDER: 'Search messages...',
  INPUT_PLACEHOLDER: 'Type a message...',
  KEYBOARD_HINT: 'Press Enter to send, Shift+Enter for new line',
  ATTACH_TITLE: 'Attach file',
  FULLSCREEN_ENTER: 'Fullscreen',
  FULLSCREEN_EXIT: 'Exit fullscreen',
  NEW_MESSAGES: (count: number) => `${count} new message${count > 1 ? 's' : ''}`,
  SCROLL_TO_BOTTOM: 'Jump to latest',
  TYPING_SINGLE: (name: string) => `${name} is typing...`,
  TYPING_MULTIPLE: (name: string, count: number) => `${name} and ${count} other${count > 1 ? 's' : ''} are typing...`,
} as const;

export const EMOJI_CATEGORIES = [
  { id: 'recent', name: 'Recent', icon: '🕐' },
  { id: 'smileys', name: 'Smileys', icon: '😀' },
  { id: 'people', name: 'People', icon: '👋' },
  { id: 'animals', name: 'Animals', icon: '🐶' },
  { id: 'food', name: 'Food', icon: '🍕' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'activities', name: 'Activities', icon: '⚽' },
  { id: 'objects', name: 'Objects', icon: '💡' },
  { id: 'symbols', name: 'Symbols', icon: '❤️' },
  { id: 'flags', name: 'Flags', icon: '🚩' },
] as const;
