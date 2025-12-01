import React from "react";

interface Game {
  id?: string;
  name: string;
  cover_image?: string;
  store?: string;
  play_time?: number;
  is_installed?: boolean;
}

interface Props {
  game: Game | null;
  onClose: () => void;
  onLaunch?: (g: Game) => void;
  onDownload?: (g: Game) => void;
}

export default function GameDetails({ game, onClose, onLaunch, onDownload }: Props) {
  if (!game) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-details" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{game.name}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="game-detail-grid">
            {game.cover_image ? (
              <img src={game.cover_image} alt={game.name} className="detail-cover" />
            ) : (
              <div className="detail-cover placeholder">🎮</div>
            )}

            <div className="detail-info">
              <p className="store">Store: {game.store || "Unknown"}</p>
              {typeof game.play_time === "number" && (
                <p>Playtime: {Math.floor((game.play_time || 0) / 60)}h</p>
              )}

              <div className="detail-actions">
                {game.is_installed ? (
                  <button className="play-button" onClick={() => onLaunch && onLaunch(game)}>▶ Play</button>
                ) : (
                  <button className="download-button" onClick={() => onDownload && onDownload(game)}>📥 Install</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
