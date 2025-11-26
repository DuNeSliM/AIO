import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import AuthPage from "./components/AuthPage";
import StorePage from "./components/StorePage";
import LibraryPage from "./components/LibraryPage";

function App() {
  const [currentPage, setCurrentPage] = useState<"auth" | "store" | "library">("auth");
  const [token, setToken] = useState<string>("");

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("aio_token");
    if (savedToken) {
      setToken(savedToken);
      setCurrentPage("library");
    }
  }, []);

  // Check for token in URL on mount and when hash changes (from OAuth callback redirect)
  useEffect(() => {
    const checkForToken = () => {
      const hash = window.location.hash;
      if (hash.includes("auth-success")) {
        const params = new URLSearchParams(hash.split("?")[1]);
        const tokenFromUrl = params.get("token");
        const store = params.get("store");
        
        if (tokenFromUrl) {
          localStorage.setItem("aio_token", tokenFromUrl);
          setToken(tokenFromUrl);
          setCurrentPage("library");
          
          // Show success message
          alert(`Successfully linked ${store || "store"} account!`);
          
          // Clear the URL hash
          window.location.hash = "";
        }
      }
    };

    // Check on mount
    checkForToken();

    // Listen for hash changes (when browser redirects back from OAuth)
    window.addEventListener('hashchange', checkForToken);

    // Listen for deep link events from Tauri (when OS opens the app with aio:// protocol)
    let unlisten: (() => void) | undefined;
    listen<string>('deep-link', (event) => {
      console.log('Deep link received:', event.payload);
      const url = event.payload;
      
      // Parse URL: aio://auth-callback?token=xxx&store=yyy
      if (url.includes('auth-callback')) {
        try {
          const urlObj = new URL(url.replace('aio://', 'http://'));
          const tokenFromUrl = urlObj.searchParams.get('token');
          const store = urlObj.searchParams.get('store');
          
          if (tokenFromUrl) {
            // If we already have a token, this is just linking a store account
            // The backend already handled saving the store account, so just show success
            if (token) {
              setCurrentPage('library');
              alert(`Successfully linked ${store || 'store'} account! Click "Sync Library" to import your games.`);
              // Trigger a page reload to refresh store accounts
              window.dispatchEvent(new CustomEvent('store-linked'));
            } else {
              // This is a first-time login
              const decodedToken = decodeURIComponent(tokenFromUrl);
              localStorage.setItem("aio_token", decodedToken);
              setToken(decodedToken);
              setCurrentPage('library');
              alert(`Successfully logged in with ${store || 'store'}!`);
            }
          }
        } catch (e) {
          console.error('Failed to parse deep link:', e);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      window.removeEventListener('hashchange', checkForToken);
      if (unlisten) unlisten();
    };
  }, []);

  const handleLogin = (jwtToken: string) => {
    localStorage.setItem("aio_token", jwtToken);
    setToken(jwtToken);
    setCurrentPage("library");
  };
  
  const handleLogout = () => {
    localStorage.removeItem("aio_token");
    setToken("");
    setCurrentPage("auth");
  };

  // Show auth page if not logged in
  if (!token) {
    return (
      <div className="app">
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <h1>🎮 AIO Game Library</h1>
        <div className="nav-buttons">
          <button 
            onClick={() => setCurrentPage("library")}
            className={currentPage === "library" ? "active" : ""}
          >
            📚 Library
          </button>
          <button 
            onClick={() => setCurrentPage("store")}
            className={currentPage === "store" ? "active" : ""}
          >
            🛒 Store
          </button>
        </div>
        <button 
          onClick={handleLogout}
          className="logout"
        >
          Logout
        </button>
      </nav>

      <main className="content">
        {currentPage === "store" && <StorePage token={token} />}
        {currentPage === "library" && <LibraryPage token={token} />}
      </main>
    </div>
  );
}

export default App;
