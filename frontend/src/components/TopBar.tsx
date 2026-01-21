import React from "react";
import { useTheme } from "../contexts/ThemeContext";

interface TopBarProps {
  title?: string;
  onLogout?: () => void;
}

export default function TopBar({ title, onLogout }: TopBarProps) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h3>{title || "Gamedivers"}</h3>
      </div>
      <div className="topbar-right">
        <button
          className="mini theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        <button className="mini" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
