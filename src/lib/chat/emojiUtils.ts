/**
 * 이모지 관련 유틸리티 함수들 - Emojis World API 기반
 * @module emojiUtils
 */

// 이모지 데이터 타입 정의
export interface EmojiData {
 id: number;
 name: string;
 emoji: string;
  unicode: string;
  version: string;
  category: {
    id: number;
    name: string;
  };
  sub_category: {
    id: number;
    name: string;
  };
  children: any[];
 parent: any;
}

// 이모지 카테고리 타입 정의
export interface EmojiCategory {
  id: number;
  name: string;
  emojis_count: number;
  sub_categories: EmojiSubCategory[];
}

// 이모지 하위 카테고리 타입 정의
export interface EmojiSubCategory {
  id: number;
  name: string;
  emojis_count: number;
}

/**
 * 모든 이모지 카테고리 가져오기
 * @returns {Promise<EmojiCategory[]>} 이모지 카테고리 배열
 */
export const fetchEmojiCategories = async (): Promise<EmojiCategory[]> => {
  try {
    const response = await fetch('https://api.emojisworld.fr/v1/categories');
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    
    throw new Error('이모지 카테고리 데이터를 가져올 수 없습니다.');
  } catch (error) {
    console.error('이모지 카테고리 가져오기 오류:', error);
    return [];
  }
};

/**
 * 이모지 검색
 * @param {string} query 검색어
 * @param {number} limit 결과 제한 수 (기본값: 50, 최대: 50)
 * @param {number[]} categories 카테고리 ID 배열
 * @param {number[]} subCategories 하위 카테고리 ID 배열
 * @param {number[]} versions 버전 배열
 * @returns {Promise<EmojiData[]>} 검색 결과 이모지 데이터 배열
 */
export const searchEmoji = async (
  query: string,
 limit?: number,
  categories?: number[],
  subCategories?: number[],
  versions?: number[]
): Promise<EmojiData[]> => {
  try {
    let url = `https://api.emojisworld.fr/v1/search?q=${encodeURIComponent(query)}`;
    
    if (limit) url += `&limit=${limit}`;
    if (categories) url += `&categories=${categories.join(',')}`;
    if (subCategories) url += `&sub_categories=${subCategories.join(',')}`;
    if (versions) url += `&versions=${versions.join(',')}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    
    throw new Error(`검색어 ${query}에 대한 이모지 데이터를 가져올 수 없습니다.`);
  } catch (error) {
    console.error(`검색어 ${query} 이모지 검색 오류:`, error);
    return [];
  }
};

/**
 * 랜덤 이모지 가져오기
 * @param {number} limit 결과 제한 수 (기본값: 1, 최대: 50)
 * @param {number[]} categories 카테고리 ID 배열
 * @param {number[]} subCategories 하위 카테고리 ID 배열
 * @param {number[]} versions 버전 배열
 * @returns {Promise<EmojiData[]>} 랜덤 이모지 데이터 배열
 */
export const fetchRandomEmoji = async (
  limit?: number,
  categories?: number[],
  subCategories?: number[],
  versions?: number[]
): Promise<EmojiData[]> => {
  try {
    let url = 'https://api.emojisworld.fr/v1/random';
    
    const params = [];
    if (limit) params.push(`limit=${limit}`);
    if (categories) params.push(`categories=${categories.join(',')}`);
    if (subCategories) params.push(`sub_categories=${subCategories.join(',')}`);
    if (versions) params.push(`versions=${versions.join(',')}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    
    throw new Error('랜덤 이모지 데이터를 가져올 수 없습니다.');
  } catch (error) {
    console.error('랜덤 이모지 가져오기 오류:', error);
    return [];
  }
};

/**
 * 인기 이모지 가져오기
 * @param {number} limit 결과 제한 수 (기본값: 1, 최대: 50)
 * @param {number[]} categories 카테고리 ID 배열
 * @param {number[]} subCategories 하위 카테고리 ID 배열
 * @param {number[]} versions 버전 배열
 * @returns {Promise<EmojiData[]>} 인기 이모지 데이터 배열
 */
export const fetchPopularEmoji = async (
  limit?: number,
  categories?: number[],
  subCategories?: number[],
  versions?: number[]
): Promise<EmojiData[]> => {
  try {
    let url = 'https://api.emojisworld.fr/v1/popular';
    
    const params = [];
    if (limit) params.push(`limit=${limit}`);
    if (categories) params.push(`categories=${categories.join(',')}`);
    if (subCategories) params.push(`sub_categories=${subCategories.join(',')}`);
    if (versions) params.push(`versions=${versions.join(',')}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    
    throw new Error('인기 이모지 데이터를 가져올 수 없습니다.');
  } catch (error) {
    console.error('인기 이모지 가져오기 오류:', error);
    return [];
  }
};

/**
 * ID로 특정 이모지 가져오기
 * @param {number} id 이모지 ID
 * @returns {Promise<EmojiData>} 특정 이모지 데이터
 */
export const fetchEmojiById = async (id: number): Promise<EmojiData> => {
  try {
    const response = await fetch(`https://api.emojisworld.fr/v1/emojis/${id}`);
    const data = await response.json();
    
    if (data.id) {
      return data;
    }
    
    throw new Error(`ID ${id}의 이모지 데이터를 가져올 수 없습니다.`);
  } catch (error) {
    console.error(`ID ${id} 이모지 가져오기 오류:`, error);
    throw error;
  }
};

/**
 * 이모지 삽입 핸들러
 * @param {string} emoji 삽입할 이모지
 * @param {HTMLInputElement} inputRef 입력 필드 참조
 * @param {Function} setMessage 메시지 상태 업데이트 함수
 */
export const insertEmoji = (
  emoji: string,
  inputRef: React.RefObject<HTMLInputElement>,
  setMessage: React.Dispatch<React.SetStateAction<string>>
) => {
  if (inputRef.current) {
    const input = inputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    
    // 커서 위치에 이모지 삽입
    const newValue = 
      currentValue.substring(0, start) + 
      emoji + 
      currentValue.substring(end);
    
    setMessage(newValue);
    
    // 다음 렌더링 후 커서 위치 업데이트
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = start + emoji.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);
  }
};