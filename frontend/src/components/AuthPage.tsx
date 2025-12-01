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
  const [mode, setMode] = useState<"login" | "register" | "stores">("login");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [apiUrl] = useState("http://localhost:8080");
  
  // Form fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    
    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }
    
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters!");
      return;
    }
    
    setLoading("register");
    
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage("Account created successfully! Logging you in...");
        // Save token to localStorage
        localStorage.setItem("aio_token", data.token);
        onLogin(data.token);
      } else {
        setMessage(`Registration failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading("");
    }
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading("login");
    
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage("Login successful!");
        // Save token to localStorage
        localStorage.setItem("aio_token", data.token);
        onLogin(data.token);
      } else {
        setMessage(`Login failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading("");
    }
  };

  const handleStoreLogin = async (store: string) => {
    setLoading(store);
    try {
      const authUrl = `${apiUrl}/api/auth/${store}/login`;
      
      // Open OAuth in browser - backend will redirect back via aio:// protocol
      // use Tauri shell.open when running inside Tauri; fall back to window.open for browser dev
      try {
        await open(authUrl);
      } catch (err) {
        // Fallback for non-Tauri environments (Vite dev in browser)
        console.warn('Tauri shell.open failed, falling back to window.open:', err);
        window.open(authUrl, '_blank');
      }
      
      // Clear loading state after opening
      setTimeout(() => setLoading(""), 1000);
      
    } catch (error) {
      console.error("Failed to open login:", error);
      setMessage("Failed to open login page: " + error);
      setLoading("");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>🎮 AIO Game Library</h1>
        
        {message && (
          <div className={`message-box ${message.includes("success") ? "success" : "error"}`}>
            {message}
          </div>
        )}
        
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            className={mode === "stores" ? "active" : ""}
            onClick={() => setMode("stores")}
          >
            Link Stores
          </button>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>Login to Your Account</h2>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit" 
              className="primary-button"
              disabled={loading === "login"}
            >
              {loading === "login" ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="auth-form">
            <h2>Create New Account</h2>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                required
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <button 
              type="submit" 
              className="primary-button"
              disabled={loading === "register"}
            >
              {loading === "register" ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        {mode === "stores" && (
          <div className="auth-section">
            <h2>Link Your Game Store Accounts</h2>
            <p className="info">Connect your game stores to automatically sync your library</p>
            <div className="store-grid">
              {STORES.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreLogin(store.id)}
                  disabled={loading === store.id}
                  className="store-button"
                  style={{ backgroundColor: store.color }}
                >
                  {loading === store.id ? "Opening..." : store.name}
                </button>
              ))}
            </div>
            <p className="info-small">
              Note: You need to login to your AIO account first before linking stores
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
