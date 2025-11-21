import { useState } from "react";

interface LibraryPageProps {
  token: string;
}

interface LibraryGame {
  id: string;
  name: string;
  store: string;
  store_game_id: string;
  store_url: string;
  cover_image?: string;
  is_installed: boolean;
  install_path?: string;
  play_time?: number;
  last_played?: string;
}

export default function LibraryPage({ token }: LibraryPageProps) {
  const [games, setGames] = useState<LibraryGame[]>([
    // Mock data for testing
    {
      id: "1",
      name: "Counter-Strike 2",
      store: "steam",
      store_game_id: "730",
      store_url: "https://store.steampowered.com/app/730",
      is_installed: true,
      play_time: 1200,
    },
    {
      id: "2",
      name: "Cyberpunk 2077",
      store: "gog",
      store_game_id: "1423049311",
      store_url: "https://www.gog.com/game/cyberpunk_2077",
      is_installed: false,
    },
  ]);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [apiUrl] = useState("http://localhost:8080");

  const handleLaunch = async (game: LibraryGame) => {
    setLoading(game.id);
    setMessage("");
    
    try {
      const response = await fetch(
        `${apiUrl}/api/library/games/${game.id}/launch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store: game.store,
            store_game_id: game.store_game_id,
            store_url: game.store_url,
            is_installed: game.is_installed,
            install_path: game.install_path || "",
          }),
        }
      );

      const result = await response.json();
      setMessage(result.message);
      
      if (!result.success && result.action === "download_required") {
        // Update UI to show download option
        setMessage("Game not installed. Click Install to download.");
      }
    } catch (err) {
      setMessage(`Failed to launch: ${err}`);
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  const handleDownload = async (game: LibraryGame) => {
    setLoading(game.id);
    setMessage("");
    
    try {
      const response = await fetch(
        `${apiUrl}/api/library/games/${game.id}/download`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store: game.store,
            store_game_id: game.store_game_id,
          }),
        }
      );

      const result = await response.json();
      setMessage(result.message);
    } catch (err) {
      setMessage(`Failed to start download: ${err}`);
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  const handleSync = async () => {
    setLoading("sync");
    setMessage("Syncing library from all connected stores...");
    
    try {
      const response = await fetch(
        `${apiUrl}/api/stores/sync-all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`Successfully synced! Found ${result.total_synced || 0} games.`);
        // Reload library
        // TODO: Fetch real library data
      } else {
        setMessage(`Sync failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      setMessage(`Failed to sync: ${err}`);
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="library-page">
      <div className="library-header">
        <h2>📚 Your Game Library</h2>
        <button 
          onClick={handleSync} 
          disabled={loading === "sync"}
          className="primary-button"
        >
          {loading === "sync" ? "🔄 Syncing..." : "🔄 Sync Library"}
        </button>
      </div>

      {message && (
        <div className="message-box">
          {message}
        </div>
      )}

      <div className="library-grid">
        {games.map((game) => (
          <div key={game.id} className="library-game-card">
            {game.cover_image ? (
              <img src={game.cover_image} alt={game.name} className="game-cover" />
            ) : (
              <div className="game-cover-placeholder">
                <span>🎮</span>
              </div>
            )}
            
            <div className="game-details">
              <h3 className="game-title">{game.name}</h3>
              <div className="game-meta">
                <span className="store-badge">{game.store.toUpperCase()}</span>
                {game.play_time && (
                  <span className="playtime">⏱ {Math.floor(game.play_time / 60)}h played</span>
                )}
              </div>

              <div className="game-actions">
                {game.is_installed ? (
                  <button
                    onClick={() => handleLaunch(game)}
                    disabled={loading === game.id}
                    className="play-button"
                  >
                    {loading === game.id ? "Launching..." : "▶️ Play"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownload(game)}
                    disabled={loading === game.id}
                    className="download-button"
                  >
                    {loading === game.id ? "Opening..." : "📥 Install"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {games.length === 0 && (
        <div className="empty-state">
          <p>Your library is empty!</p>
          <p className="info">Connect your game store accounts to sync your games.</p>
        </div>
      )}

      <div className="library-info">
        <h3>💡 How to Test</h3>
        <ul>
          <li><strong>Play Button:</strong> Launches installed games via store deep links (steam://, epic://, etc.)</li>
          <li><strong>Install Button:</strong> Opens the store client to the download page</li>
          <li><strong>Deep Links:</strong> Make sure the respective store client is installed on your system</li>
        </ul>
      </div>
    </div>
  );
}
