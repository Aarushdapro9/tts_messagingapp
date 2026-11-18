import { useEffect, useState } from 'react';

const FAVORITES_KEY = 'messages.single-player-game-favorites';

function readFavorites() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

export function useGameFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(readFavorites);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
    } catch {
      // Favorites are a convenience feature; the game library still works if storage is unavailable.
    }
  }, [favoriteIds]);

  const toggleFavorite = (gameId) => setFavoriteIds((current) => {
    const next = new Set(current);
    next.has(gameId) ? next.delete(gameId) : next.add(gameId);
    return next;
  });

  return { favoriteIds, isFavorite: (gameId) => favoriteIds.has(gameId), toggleFavorite };
}
