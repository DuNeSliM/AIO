import React from "react";

interface SidebarProps {
  current: "library" | "store" | "auth";
  onNavigate: (p: "library" | "store" | "auth") => void;
  onLogout?: () => void;
}

export default function Sidebar({ current, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">AIO</div>
        <h2>AIO Library</h2>
      </div>

      <nav className="side-nav">
        <button className={current === "library" ? "active" : "inactive"} onClick={() => onNavigate("library")}>📚 Library</button>
        <button className={current === "store" ? "active" : "inactive"} onClick={() => onNavigate("store")}>🛒 Store</button>
      </nav>

      <div className="side-footer">
        Built with ❤️ • Tauri
        <button className="mini" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
