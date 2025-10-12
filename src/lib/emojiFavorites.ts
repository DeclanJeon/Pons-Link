// src/lib/emojiFavorites.ts
export const getFavoriteEmojis = (): string[] => {
  const favorites = localStorage.getItem('favoriteEmojis');
  return favorites ? JSON.parse(favorites) : [];
};

export const addFavoriteEmoji = (emoji: string) => {
  const favorites = getFavoriteEmojis();
  if (!favorites.includes(emoji)) {
    favorites.push(emoji);
    localStorage.setItem('favoriteEmojis', JSON.stringify(favorites));
  }
};

export const removeFavoriteEmoji = (emoji: string) => {
  const favorites = getFavoriteEmojis();
  const index = favorites.indexOf(emoji);
  if (index > -1) {
    favorites.splice(index, 1);
    localStorage.setItem('favoriteEmojis', JSON.stringify(favorites));
  }
};