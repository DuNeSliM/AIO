import { useState, useEffect } from "react";
import { open } from "@tauri-apps/api/shell";

interface LibraryPageProps {
  token: string;
  onSelectGame?: (game: LibraryGame) => void;
}

interface LibraryGame {
  id: string;
  name: string;
  store: string;
  store_game_id: string;
  store_url: string;
  cover_image?: string;
  icon?: string;
  is_installed: boolean;
  install_path?: string;
  play_time?: number;
  last_played?: string;
}

interface StoreAccount {
  store: string;
  display_name: string;
  is_connected: boolean;
  last_synced_at?: string;
}

const STORES = [
  { id: "steam", name: "Steam", color: "#1b2838" },
  { id: "epic", name: "Epic Games", color: "#0078f2" },
  { id: "gog", name: "GOG", color: "#86328a" },
  { id: "xbox", name: "Xbox", color: "#107c10" },
];

export default function LibraryPage({ token, onSelectGame }: LibraryPageProps) {
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [storeAccounts, setStoreAccounts] = useState<StoreAccount[]>([]);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [apiUrl] = useState("http://localhost:8080");

  console.log("LibraryPage render - showStoreModal:", showStoreModal, "storeAccounts:", storeAccounts.length);

  const fetchLibrary = async () => {
    setLoading("fetch");
    try {
      const response = await fetch(`${apiUrl}/api/library`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Library response:", data);
        setGames(data.games || []);
      } else {
        console.error("Failed to fetch library:", response.status);
      }
    } catch (err) {
      console.error("Error fetching library:", err);
    } finally {
      setLoading("");
    }
  };

  const fetchStoreAccounts = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/stores/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Store accounts:", data);
        // Handle both array response and object with accounts property
        if (Array.isArray(data)) {
          setStoreAccounts(data);
        } else if (data && Array.isArray(data.accounts)) {
          setStoreAccounts(data.accounts);
        } else {
          setStoreAccounts([]);
        }
      } else {
        console.error("Failed to fetch store accounts:", response.status);
        setStoreAccounts([]);
      }
    } catch (err) {
      console.error("Error fetching store accounts:", err);
      setStoreAccounts([]);
    }
  };

  const handleLinkStore = async (store: string) => {
    setLoading(store);
    try {
      // Pass JWT token as query parameter so backend can identify the user
      const authUrl = `${apiUrl}/api/auth/${store}/login?token=${encodeURIComponent(token)}`;
      // Try Tauri open first, fall back to window.open for dev in browser
      try {
        await open(authUrl);
      } catch (err) {
        console.warn('Tauri shell.open failed, falling back to window.open:', err);
        window.open(authUrl, '_blank');
      }
      setTimeout(() => setLoading(""), 1000);
    } catch (error) {
      console.error("Failed to open login:", error);
      setMessage("Failed to open login page: " + error);
      setLoading("");
    }
  };

  // Fetch library and store accounts on mount
  useEffect(() => {
    fetchLibrary();
    fetchStoreAccounts();

    // Listen for store link events
    const handleStoreLinked = () => {
      fetchStoreAccounts();
      setShowStoreModal(true);
    };

    window.addEventListener('store-linked', handleStoreLinked);
    return () => window.removeEventListener('store-linked', handleStoreLinked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        // Reload library to show new games
        await fetchLibrary();
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
        <h2>📚 Your Game Library ({games.length} games)</h2>
        <div className="header-actions">
          <button 
            onClick={() => {
              console.log("Opening store modal");
              setShowStoreModal(true);
            }} 
            className="secondary-button"
          >
            🔗 Manage Stores
          </button>
          <button 
            onClick={handleSync} 
            disabled={loading === "sync"}
            className="primary-button"
          >
            {loading === "sync" ? "🔄 Syncing..." : "🔄 Sync Library"}
          </button>
        </div>
      </div>

      {/* Store Accounts Modal */}
      {showStoreModal && (
        <div className="modal-overlay" onClick={() => {
          console.log("Closing modal from overlay");
          setShowStoreModal(false);
        }}>
          <div className="modal-content" onClick={(e) => {
            console.log("Modal content clicked");
            e.stopPropagation();
          }}>
            <div className="modal-header">
              <h2>🔗 Store Accounts</h2>
              <button onClick={() => {
                console.log("Closing modal from button");
                setShowStoreModal(false);
              }} className="close-button">✕</button>
            </div>
            <div className="modal-body">
              <p className="info">Link your game store accounts to automatically sync your library</p>
              
              <div className="store-accounts-list">
                {STORES.map((store) => {
                  const account = storeAccounts.find(a => a.store === store.id);
                  const isConnected = account?.is_connected;
                  
                  return (
                    <div key={store.id} className="store-account-item">
                      <div className="store-info">
                        <div className="store-icon" style={{ backgroundColor: store.color }}>
                          {store.name.charAt(0)}
                        </div>
                        <div className="store-details">
                          <h3>{store.name}</h3>
                          {isConnected && account?.display_name && (
                            <p className="connected-as">Connected as: {account.display_name}</p>
                          )}
                          {isConnected && account?.last_synced_at && (
                            <p className="last-sync">Last synced: {new Date(account.last_synced_at).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleLinkStore(store.id)}
                        disabled={loading === store.id}
                        className={isConnected ? "connected-button" : "connect-button"}
                      >
                        {loading === store.id ? "Opening..." : isConnected ? "✓ Connected" : "Connect"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="message-box">
          {message}
        </div>
      )}

      <div className="library-grid">
        {games.map((game) => (
          <div key={game.id} className="library-game-card" onClick={() => onSelectGame && onSelectGame(game)}>
            {game.cover_image || game.icon ? (
              <img src={game.cover_image || game.icon} alt={game.name} className="game-cover" />
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

      {games.length === 0 && !loading && (
        <div className="empty-state">
          <h2>🎮 Welcome to Your Game Library!</h2>
          <p>Your library is empty. Get started by:</p>
          <ol className="empty-steps">
            <li>Click "Manage Stores" to link your game accounts</li>
            <li>Click "Sync Library" to import your games</li>
            <li>Your games will appear here automatically!</li>
          </ol>
          <button onClick={() => setShowStoreModal(true)} className="primary-button">
            Get Started - Link Store Account
          </button>
        </div>
      )}
    </div>
  );
}
