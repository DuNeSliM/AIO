import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/api/shell";

type SortOption = "alpha" | "playtime";
type InstalledFilter = "all" | "installed" | "not_installed";

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

function isMockEnabledByUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mockSync") === "1";
}

export default function LibraryPage({ token, onSelectGame }: LibraryPageProps) {
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [storeAccounts, setStoreAccounts] = useState<StoreAccount[]>([]);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [apiUrl] = useState("http://localhost:8080");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("alpha");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>("all");

  const getMockGames = useMemo(
    () =>
      (): LibraryGame[] => [
        {
          id: "mock-steam-1",
          name: "Cyberpunk 2077",
          store: "steam",
          store_game_id: "1091500",
          store_url: "https://store.steampowered.com/app/1091500/Cyberpunk_2077/",
          cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg",
          is_installed: true,
          install_path: "C:\\Games\\Cyberpunk 2077",
          play_time: 1234,
          last_played: new Date().toISOString(),
        },
        {
          id: "mock-epic-1",
          name: "Control",
          store: "epic",
          store_game_id: "control",
          store_url: "https://store.epicgames.com/en-US/p/control",
          cover_image:
            "https://cdn2.unrealengine.com/Diesel%2Fproductv2%2Fcontrol%2Fhome%2FEGS_Control_RemedyEntertainment_S1_2560x1440-f3b38b2fc90d0cfa74e9f0b0a25d3fd6b3e2d11a.jpg",
          is_installed: false,
          play_time: 245,
        },
        {
          id: "mock-gog-1",
          name: "Baldur's Gate 3",
          store: "gog",
          store_game_id: "baldurs_gate_3",
          store_url: "https://www.gog.com/game/baldurs_gate_iii",
          cover_image:
            "https://images.gog-statics.com/7b0a41f1f42b6fe537c8dbb9e261d5b0f812b5f6f747b91313f2dba2f0b6c4da.jpg",
          is_installed: true,
          install_path: "D:\\GOG Games\\Baldurs Gate 3",
          play_time: 4200,
        },
      ],
    []
  );

  const [mockSyncEnabled, setMockSyncEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (isMockEnabledByUrl()) return true;

    return window.localStorage.getItem("mockSync") === "1";
  });

  const availableStores = useMemo(() => {
    const storeSet = new Set<string>();
    for (const g of games) storeSet.add(g.store);
    return Array.from(storeSet).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filteredAndSortedGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = games;

    if (q) {
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }

    if (storeFilter !== "all") {
      list = list.filter((g) => g.store === storeFilter);
    }

    if (installedFilter !== "all") {
      const wantInstalled = installedFilter === "installed";
      list = list.filter((g) => g.is_installed === wantInstalled);
    }

    const sorted = [...list];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "playtime") {
      // Descending: most played first
      sorted.sort((a, b) => (b.play_time || 0) - (a.play_time || 0));
    }

    return sorted;
  }, [games, searchQuery, sortBy, storeFilter, installedFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mockSync", mockSyncEnabled ? "1" : "0");
  }, [mockSyncEnabled]);

  useEffect(() => {
    if (!mockSyncEnabled) return;
    const mockGames = getMockGames();
    setGames(mockGames);
    setMessage(`(Mock) Loaded ${mockGames.length} games. Click "Sync Library" to re-run.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockSyncEnabled]);

  console.log(
    "LibraryPage render - showStoreModal:",
    showStoreModal,
    "storeAccounts:",
    storeAccounts.length,
    "mockSync:",
    mockSyncEnabled
  );

  const fetchLibrary = async () => {
    if (mockSyncEnabled) return;

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

        const normalizedGames: LibraryGame[] = Array.isArray(data)
          ? (data as LibraryGame[])
          : (data?.games as LibraryGame[]) || [];

        setGames(normalizedGames);
      } else {
        console.error("Failed to fetch library:", response.status);
        setGames([]);
      }
    } catch (err) {
      console.error("Error fetching library:", err);
      setGames([]);
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
      const authUrl = `${apiUrl}/api/auth/${store}/login?token=${encodeURIComponent(token)}`;
      try {
        await open(authUrl);
      } catch (err) {
        console.warn("Tauri shell.open failed, falling back to window.open:", err);
        window.open(authUrl, "_blank");
      }
      setTimeout(() => setLoading(""), 1000);
    } catch (error) {
      console.error("Failed to open login:", error);
      setMessage("Failed to open login page: " + error);
      setLoading("");
    }
  };

  const handleDisconnectStore = async (storeId: string) => {
    if (!window.confirm(`Are you sure you want to disconnect your ${storeId.toUpperCase()} account?`)) {
      return;
    }

    setLoading(storeId);
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/stores/${storeId}/disconnect`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage(`Successfully disconnected ${storeId.toUpperCase()} account`);
        await fetchStoreAccounts();
        await fetchLibrary();
      } else {
        const error = await response.json();
        setMessage(`Failed to disconnect: ${error.error || "Unknown error"}`);
      }
    } catch (err) {
      setMessage(`Failed to disconnect: ${err}`);
      console.error(err);
    } finally {
      setLoading("");
    }
  };

  const handleEpicConsoleSync = async () => {
    try {
      setMessage("Generating console script...");

      const userResponse = await fetch(`${apiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) {
        setMessage("Failed to get user info");
        return;
      }

      const userData = await userResponse.json();

      const currentGameCount = games.length;

      const script = `
(async function() {
  const userId = "${userData.id}";
  const token = "${token}";
  const apiUrl = "http://localhost:8080";

  console.log("🎮 Fetching Epic Games library...");

  let allGames = [];
  let nextPageToken = null;

  while (true) {
    const url = nextPageToken
      ? \`https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?nextPageToken=\${nextPageToken}\`
      : 'https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory';

    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      console.error("Failed to fetch orders");
      break;
    }

    const data = await response.json();
    const games = data.orders
      .filter(order => order.items && order.items.length > 0)
      .flatMap(order => order.items
        .filter(item => item.description)
        .map(item => ({
          name: item.description,
          epicId: item.offerId || "",
          platform: "Epic Games"
        }))
      );

    allGames = allGames.concat(games);
    console.log(\`Found \${allGames.length} games so far...\`);

    // Check if there's a next page
    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  // Remove duplicates
  const uniqueGames = Array.from(new Map(allGames.map(g => [g.name, g])).values());
  console.log(\`\n✅ Total unique games: \${uniqueGames.length}\`);

  // Send to backend using a form POST that opens result in new tab
  console.log("📤 Syncing " + uniqueGames.length + " games to AIO...");

  const syncData = {
    userId: userId,
    token: token,
    games: uniqueGames
  };

  // Create form and submit to new window
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = \`\${apiUrl}/api/stores/epic/browser-sync\`;
  form.target = '_blank';
  form.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'data';
  input.value = JSON.stringify(syncData);

  form.appendChild(input);
  document.body.appendChild(form);

  console.log("\n📋 Submitting to AIO...");
  form.submit();

  console.log("\n✅ Sync request sent!");
  console.log("A new window should open with the result.");
  console.log("\nIf popup is blocked, manually open:");
  console.log("%chttp://localhost:8080/api/stores/epic/browser-sync", "color: blue; text-decoration: underline;");
  console.log("(Note: You'll need to re-run this script if you use the manual link)");

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(form);
  }, 1000);
})();
`;

      await navigator.clipboard.writeText(script);

      await open("https://www.epicgames.com/account/transactions");
      await open("http://localhost:8080/epic-instructions");

      setMessage("✅ Script copied to clipboard!\n\nInstructions opened in new tab - follow the steps there!");

      let pollCount = 0;
      const maxPolls = 60;
      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          const response = await fetch(`${apiUrl}/api/library`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            const normalizedGames: LibraryGame[] = Array.isArray(data)
              ? (data as LibraryGame[])
              : (data?.games as LibraryGame[]) || [];

            const newGameCount = normalizedGames.length;

            if (newGameCount > currentGameCount) {
              clearInterval(pollInterval);
              setGames(normalizedGames);
              setMessage(`✅ Library updated! Added ${newGameCount - currentGameCount} new games from Epic.`);
              console.log(`Epic sync detected: ${currentGameCount} → ${newGameCount} games`);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          console.log("Stopped polling for Epic sync");
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to generate script:", error);
      setMessage("❌ Failed: " + error);
    }
  };

  useEffect(() => {
    if (!mockSyncEnabled) {
      fetchLibrary();
      fetchStoreAccounts();
    } else {
      fetchStoreAccounts();
    }

    const handleStoreLinked = () => {
      fetchStoreAccounts();
      setShowStoreModal(true);
    };

    window.addEventListener("store-linked", handleStoreLinked);
    return () => window.removeEventListener("store-linked", handleStoreLinked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mockSyncEnabled]);

  const handleLaunch = async (game: LibraryGame) => {
    setLoading(game.id);
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/library/games/${game.id}/launch`, {
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
      });

      const result = await response.json();
      setMessage(result.message);

      if (!result.success && result.action === "download_required") {
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
      const response = await fetch(`${apiUrl}/api/library/games/${game.id}/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          store: game.store,
          store_game_id: game.store_game_id,
        }),
      });

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

    if (mockSyncEnabled) {
      const mockGames = getMockGames();
      setGames(mockGames);
      setMessage(`(Mock) Successfully synced! Found ${mockGames.length} games.`);
      setLoading("");
      return;
    }

    setMessage("Syncing library from all connected stores...");

    try {
      const response = await fetch(`${apiUrl}/api/stores/sync-all`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`Successfully synced! Found ${result.total_synced || 0} games.`);
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
        <h2>📚 Your Game Library ({filteredAndSortedGames.length} games)</h2>
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
            onClick={() => setMockSyncEnabled((v: boolean) => !v)}
            className="secondary-button"
            title="Toggle mock sync (test data)"
          >
            🧪 Mock: {mockSyncEnabled ? "ON" : "OFF"}
          </button>

          <button onClick={handleSync} disabled={loading === "sync"} className="primary-button">
            {loading === "sync" ? "🔄 Syncing..." : "🔄 Sync Library"}
          </button>
        </div>
      </div>

      {/* Store Accounts Modal */}
      {showStoreModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            console.log("Closing modal from overlay");
            setShowStoreModal(false);
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => {
              console.log("Modal content clicked");
              e.stopPropagation();
            }}
          >
            <div className="modal-header">
              <h2>🔗 Store Accounts</h2>
              <button
                onClick={() => {
                  console.log("Closing modal from button");
                  setShowStoreModal(false);
                }}
                className="close-button"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="info">Link your game store accounts to automatically sync your library</p>

              <div className="store-accounts-list">
                {STORES.map((store) => {
                  const account = storeAccounts.find((a) => a.store === store.id);
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
                      <div className="store-actions">
                        {isConnected ? (
                          <>
                            <span className="connected-status">✓ Connected</span>
                            {store.id === "epic" && (
                              <button
                                onClick={handleEpicConsoleSync}
                                className="browser-sync-button"
                                title="Copy console script and open Epic Games"
                              >
                                🎮 Sync Games
                              </button>
                            )}
                            <button
                              onClick={() => handleDisconnectStore(store.id)}
                              disabled={loading === store.id}
                              className="disconnect-button"
                            >
                              {loading === store.id ? "Disconnecting..." : "Disconnect"}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleLinkStore(store.id)}
                            disabled={loading === store.id}
                            className="connect-button"
                          >
                            {loading === store.id ? "Opening..." : "Connect"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {message && <div className="message-box">{message}</div>}

      <div className="library-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="library-search">Search</label>
            <input
              id="library-search"
              className="filter-input"
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="library-sort">Sort</label>
            <select
              id="library-sort"
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="alpha">Alphabetical (A–Z)</option>
              <option value="playtime">Playtime (most played)</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="library-store">Store</label>
            <select
              id="library-store"
              className="filter-select"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="all">All stores</option>
              {availableStores.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="library-installed">Installed</label>
            <select
              id="library-installed"
              className="filter-select"
              value={installedFilter}
              onChange={(e) => setInstalledFilter(e.target.value as InstalledFilter)}
            >
              <option value="all">All</option>
              <option value="installed">Installed</option>
              <option value="not_installed">Not installed</option>
            </select>
          </div>

          <div className="filter-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setSearchQuery("");
                setSortBy("alpha");
                setStoreFilter("all");
                setInstalledFilter("all");
              }}
              disabled={!searchQuery && sortBy === "alpha" && storeFilter === "all" && installedFilter === "all"}
              title="Reset filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="library-grid">
        {filteredAndSortedGames.map((game) => (
          <div
            key={game.id}
            className="library-game-card"
            onClick={() => onSelectGame && onSelectGame(game)}
          >
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
                {game.play_time && <span className="playtime">⏱ {Math.floor(game.play_time / 60)}h played</span>}
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

      {filteredAndSortedGames.length === 0 && !loading && (
        <div className="empty-state">
          {games.length === 0 ? (
            <>
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
            </>
          ) : (
            <>
              <h2>🔎 No matches</h2>
              <p>No games match your current filters.</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setSearchQuery("");
                  setSortBy("alpha");
                  setStoreFilter("all");
                  setInstalledFilter("all");
                }}
              >
                Reset filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
