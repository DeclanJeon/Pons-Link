export class EmojiCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxAge = 60 * 60 * 1000; // 1시간

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export const emojiCache = new EmojiCache();