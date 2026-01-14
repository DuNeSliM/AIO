import { NavLink } from "react-router-dom";
import "./AppShell.css";
import type { PropsWithChildren } from "react";

function NavItem({ to, children }: PropsWithChildren<{ to: string }>) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
    >
      {children}
    </NavLink>
  );
}

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <div className="logo" />
          <div className="brandText">
            <div className="title">GameDivers</div>
            <div className="subtitle">Releases • Docs • Team board(not in use)</div>
          </div>
        </div>

        <nav className="nav">
          <NavItem to="/">Home</NavItem>
          <NavItem to="/download">Download</NavItem>
          <NavItem to="/docs">Docs</NavItem>
          <NavItem to="/board">Board</NavItem>
        </nav>
      </header>

      <main className="main">
        <div className="container">{children}</div>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} GameDivers</span>
        <span className="muted">React + Vite (Rolldown)</span>
      </footer>
    </div>
  );
}
