/**
 * Chat 관련 상수 정의
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
} as const;

export const CHAT_MESSAGES = {
  SEARCH_PLACEHOLDER: 'Search messages...',
  INPUT_PLACEHOLDER: 'Type a message...',
  KEYBOARD_HINT: 'Press Enter to send, Shift+Enter for new line',
  ATTACH_TITLE: 'Attach file',
} as const;
