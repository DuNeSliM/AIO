import { useState } from "react";

export interface Game {
  id: string;
  name: string;
  // Add other game properties as needed
}

/**
 * Custom hook to manage selected game state.
 */
export const useGameSelection = () => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const selectGame = (game: Game) => {
    setSelectedGame(game);
  };

  const closeDetails = () => {
    setSelectedGame(null);
  };

  return { selectedGame, selectGame, closeDetails };
};