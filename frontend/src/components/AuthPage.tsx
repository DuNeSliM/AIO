import { useState } from "react";
import { open } from "@tauri-apps/api/shell";

interface AuthPageProps {
  onLogin: (token: string) => void;
}

const STORES = [
  { id: "steam", name: "Steam", color: "#1b2838" },
  { id: "epic", name: "Epic Games", color: "#0078f2" },
  { id: "gog", name: "GOG", color: "#86328a" },
  { id: "xbox", name: "Xbox", color: "#107c10" },
  { id: "battlenet", name: "Battle.net", color: "#148eff" },
  { id: "uplay", name: "Uplay", color: "#0080ff" },
  { id: "amazon", name: "Amazon", color: "#ff9900" },
  { id: "ea", name: "EA", color: "#e60012" },
  { id: "psn", name: "PlayStation", color: "#003087" },
];

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [loading, setLoading] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [apiUrl, setApiUrl] = useState("http://localhost:8080");

  const handleStoreLogin = async (store: string) => {
    setLoading(store);
    try {
      const authUrl = `${apiUrl}/api/auth/${store}/login`;
      
      // Open OAuth in browser - backend will redirect back to localhost:1420 with token
      await open(authUrl);
      
      // Clear loading state after opening
      setTimeout(() => setLoading(""), 1000);
      
    } catch (error) {
      console.error("Failed to open login:", error);
      alert("Failed to open login page: " + error);
      setLoading("");
    }
  };

  const handleManualLogin = () => {
    if (manualToken.trim()) {
      onLogin(manualToken.trim());
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-section">
        <h2>API Configuration</h2>
        <div className="form-group">
          <label>Backend API URL:</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8080"
          />
        </div>
      </div>

      <div className="auth-section">
        <h2>Sign In with Game Store</h2>
        <p className="info">Click a store to sign in. A login window will open.</p>
        <div className="store-grid">
          {STORES.map((store) => (
            <button
              key={store.id}
              onClick={() => handleStoreLogin(store.id)}
              disabled={loading === store.id}
              className="store-button"
              style={{ backgroundColor: store.color }}
            >
              {loading === store.id ? "Opening..." : `Sign in with ${store.name}`}
            </button>
          ))}
        </div>
      </div>

      <div className="auth-section">
        <h2>Manual Token Entry</h2>
        <p className="info">After logging in, paste the JWT token here:</p>
        <textarea
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Paste JWT token here..."
          rows={4}
        />
        <button onClick={handleManualLogin} className="primary-button">
          Login with Token
        </button>
      </div>

      <div className="auth-section">
        <h3>Quick Test (Development)</h3>
        <p className="info">For testing without OAuth, you can use any mock token:</p>
        <button onClick={() => onLogin("test-token-12345")} className="secondary-button">
          Use Test Token
        </button>
      </div>
    </div>
  );
}
