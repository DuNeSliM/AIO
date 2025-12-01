import React from "react";

interface TopBarProps {
  title?: string;
  onLogout?: () => void;
}

export default function TopBar({ title, onLogout }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h3>{title || "AIO"}</h3>
      </div>
      <div className="topbar-right">
        <button className="mini" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
