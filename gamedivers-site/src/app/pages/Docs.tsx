import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import gettingStarted from "../docs/getting-started.md?raw";
import roadmap from "../docs/roadmap.md?raw";

type Doc = { id: string; title: string; content: string };

const docs: Doc[] = [
  { id: "getting-started", title: "Getting Started", content: gettingStarted },
  { id: "roadmap", title: "Roadmap", content: roadmap },
];

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 18,
  padding: 16,
};

export default function Docs() {
  const [activeId, setActiveId] = useState(docs[0].id);
  const active = useMemo(() => docs.find((d) => d.id === activeId)!, [activeId]);

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "260px 1fr" }}>
      <aside style={{ ...card, height: "fit-content" }}>
        <h3 style={{ marginTop: 0 }}>Docs</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              style={{
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: d.id === activeId ? "rgba(122,162,255,.12)" : "rgba(255,255,255,0.03)",
                color: d.id === activeId ? "var(--text)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {d.title}
            </button>
          ))}
        </div>
      </aside>

      <article style={{ ...card, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>{active.title}</h2>
        <div style={{ color: "var(--muted)", lineHeight: 1.75 }}>
          <ReactMarkdown>{active.content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
