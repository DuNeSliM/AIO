import { useState } from "react";

interface StorePageProps {
  token: string;
}

interface SearchResult {
  store_game_id: string;
  name: string;
  cover_image?: string;
  price?: number;
  discount_price?: number;
  currency?: string;
  owned: boolean;
  owned_on: string[];
  store_url?: string;
}

export default function StorePage({ token }: StorePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiUrl] = useState("http://localhost:8080");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(
        `${apiUrl}/api/stores/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || {});
    } catch (err) {
      setError(`Failed to search: ${err}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openStorePage = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="store-page">
      <div className="search-section">
        <h2>🔍 Search Games Across All Stores</h2>
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for games..."
            className="search-input"
          />
          <button onClick={handleSearch} disabled={loading} className="primary-button">
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="results-section">
        {Object.entries(results).map(([storeName, games]) => (
          <div key={storeName} className="store-results">
            <h3 className="store-name">
              {storeName.toUpperCase()} ({games.length} results)
            </h3>
            <div className="game-grid">
              {games.map((game) => (
                <div key={game.store_game_id} className="game-card">
                  {game.cover_image && (
                    <img src={game.cover_image} alt={game.name} className="game-cover" />
                  )}
                  <div className="game-info">
                    <h4 className="game-title">{game.name}</h4>
                    
                    {game.owned && (
                      <div className="owned-badge">
                        ✓ Owned {game.owned_on.length > 0 && `on ${game.owned_on.join(", ")}`}
                      </div>
                    )}
                    
                    {!game.owned && (
                      <div className="price-info">
                        {game.discount_price ? (
                          <>
                            <span className="original-price">${game.price}</span>
                            <span className="discount-price">${game.discount_price}</span>
                          </>
                        ) : game.price ? (
                          <span className="price">${game.price}</span>
                        ) : (
                          <span className="price">Price N/A</span>
                        )}
                      </div>
                    )}
                    
                    {game.store_url && (
                      <button 
                        onClick={() => openStorePage(game.store_url!)}
                        className="buy-button"
                      >
                        {game.owned ? "View in Store" : `Buy on ${storeName}`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {Object.keys(results).length === 0 && !loading && (
          <div className="empty-state">
            <p>Search for games to see results from all stores!</p>
            <p className="info">You'll see ownership status for each game.</p>
          </div>
        )}
      </div>
    </div>
  );
}
