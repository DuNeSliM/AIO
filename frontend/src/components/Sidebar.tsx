import React from "react";

interface SidebarProps {
  current: "library" | "store" | "auth";
  onNavigate: (p: "library" | "store" | "auth") => void;
}

export default function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="brand">
        <div className="logo" aria-label="Gamedivers logo">G</div>
        <h2>Gamedivers</h2>
      </div>

      <nav className="side-nav" aria-label="Page navigation">
        <button
          className={current === "library" ? "active" : ""}
          onClick={() => onNavigate("library")}
          aria-current={current === "library" ? "page" : undefined}
          aria-label="Navigate to Library"
        >
          📚 Library
        </button>
        <button
          className={current === "store" ? "active" : ""}
          onClick={() => onNavigate("store")}
          aria-current={current === "store" ? "page" : undefined}
          aria-label="Navigate to Store"
        >
          🛒 Store
        </button>
      </nav>
    </aside>
  );
}
