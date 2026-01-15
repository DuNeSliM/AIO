import { Link } from "react-router-dom";
import Button from "../components/Button";

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 18,
  padding: 16,
};

export default function Home() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...card, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.6 }}>
          GameDivers — product site + docs + team board
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
          Use this as your base. Later you can wire downloads to GitHub Releases and
          replace the local board with a real API.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button as={Link} to="/download" className="primary">Download</Button>
          <Button as={Link} to="/docs">Docs</Button>
          <Button as={Link} to="/board">Board</Button>
        </div>
      </section>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Downloads</h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Link to installers, checksums, and release notes.
          </p>
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Docs</h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Markdown docs you can version with the repo.
          </p>
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Board</h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Lightweight Kanban for “what’s next”.
          </p>
        </div>
      </div>
    </div>
  );
}
