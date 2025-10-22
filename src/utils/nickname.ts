// src/utils/nickname.ts
import nicknamesData from '@/data/nicknames.json';

/**
 * Generate a friendly random nickname like "Brilliant Fox"
 */
export function generateRandomNickname(): string {
  const { adjectives, animals } = nicknamesData;
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
}
