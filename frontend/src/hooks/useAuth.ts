import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * Custom hook to manage authentication state and token handling.
 * Handles login, logout, and token retrieval from URL or deep links.
 */
export const useAuth = () => {
  const [token, setToken] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("aio_token");
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // Handle OAuth callback from URL hash or deep links
  useEffect(() => {
    const handleAuthCallback = (url: string) => {
      const params = new URLSearchParams(url.split("?")[1]);
      const tokenFromUrl = params.get("token");
      const store = params.get("store");

      if (tokenFromUrl) {
        const decodedToken = decodeURIComponent(tokenFromUrl);
        localStorage.setItem("aio_token", decodedToken);
        setToken(decodedToken);
        setIsAuthenticated(true);

        const message = isAuthenticated
          ? `Successfully linked ${store || "store"} account! Click "Sync Library" to import your games.`
          : `Successfully logged in with ${store || "store"}!`;

        alert(message);
        window.dispatchEvent(new CustomEvent("store-linked"));
      }
    };

    // Check URL hash on mount
    const hash = window.location.hash;
    if (hash.includes("auth-success")) {
      handleAuthCallback(hash);
      window.location.hash = "";
    }

    // Listen for hash changes
    const onHashChange = () => {
      const newHash = window.location.hash;
      if (newHash.includes("auth-success")) {
        handleAuthCallback(newHash);
        window.location.hash = "";
      }
    };
    window.addEventListener("hashchange", onHashChange);

    // Listen for deep link events from Tauri
    let unlisten: (() => void) | undefined;
    listen<string>("deep-link", (event) => {
      console.log("Deep link received:", event.payload);
      const url = event.payload;
      if (url.includes("auth-callback")) {
        try {
          const urlObj = new URL(url.replace("aio://", "http://"));
          handleAuthCallback(urlObj.search + urlObj.hash);
        } catch (e) {
          console.error("Failed to parse deep link:", e);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      if (unlisten) unlisten();
    };
  }, [isAuthenticated]);

  const login = (jwtToken: string) => {
    localStorage.setItem("aio_token", jwtToken);
    setToken(jwtToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("aio_token");
    setToken("");
    setIsAuthenticated(false);
  };

  return { token, isAuthenticated, login, logout };
};