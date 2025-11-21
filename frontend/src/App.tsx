import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import AuthPage from "./components/AuthPage";
import StorePage from "./components/StorePage";
import LibraryPage from "./components/LibraryPage";

function App() {
  const [currentPage, setCurrentPage] = useState<"auth" | "store" | "library">("auth");
  const [token, setToken] = useState<string>("");

  // Check for token in URL on mount (from OAuth callback redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("auth-success")) {
      const params = new URLSearchParams(hash.split("?")[1]);
      const tokenFromUrl = params.get("token");
      const store = params.get("store");
      
      if (tokenFromUrl) {
        setToken(tokenFromUrl);
        setCurrentPage("library");
        
        // Show success message
        alert(`Successfully logged in with ${store || "store"}!`);
        
        // Clear the URL hash
        window.location.hash = "";
      }
    }
  }, []);

  const handleLogin = (jwtToken: string) => {
    setToken(jwtToken);
    setCurrentPage("store");
  };

  return (
    <div className="app">
      <nav className="navbar">
        <h1>🎮 AIO Game Library - Test</h1>
        <div className="nav-buttons">
          <button 
            onClick={() => setCurrentPage("auth")}
            className={currentPage === "auth" ? "active" : ""}
          >
            🔐 Auth
          </button>
          <button 
            onClick={() => setCurrentPage("store")}
            className={currentPage === "store" ? "active" : ""}
            disabled={!token}
          >
            🛒 Store
          </button>
          <button 
            onClick={() => setCurrentPage("library")}
            className={currentPage === "library" ? "active" : ""}
            disabled={!token}
          >
            📚 Library
          </button>
        </div>
        {token && (
          <button 
            onClick={() => {
              setToken("");
              setCurrentPage("auth");
            }}
            className="logout"
          >
            Logout
          </button>
        )}
      </nav>

      <main className="content">
        {currentPage === "auth" && <AuthPage onLogin={handleLogin} />}
        {currentPage === "store" && <StorePage token={token} />}
        {currentPage === "library" && <LibraryPage token={token} />}
      </main>
    </div>
  );
}

export default App;
