import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";

type ColumnKey = "todo" | "doing" | "done";

type Task = {
  id: string;
  title: string;
  notes?: string;
};

type BoardState = Record<ColumnKey, Task[]>;

const STORAGE_KEY = "gamedivers_board_v1";

function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const defaultBoard: BoardState = {
  todo: [{ id: uid(), title: "Set up website", notes: "Add pages, style, deploy" }],
  doing: [{ id: uid(), title: "Desktop app MVP", notes: "Define features + download links" }],
  done: [{ id: uid(), title: "Repo created", notes: "Initial structure is in place" }],
};

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 18,
  padding: 16,
};

const columnTitle = (key: ColumnKey) =>
  ({ todo: "To do", doing: "In progress", done: "Done" } as const)[key];

export default function Board() {
  const [board, setBoard] = useState<BoardState>(defaultBoard);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setBoard(JSON.parse(raw) as BoardState);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  }, [board]);

  const columns = useMemo<ColumnKey[]>(() => ["todo", "doing", "done"], []);

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setBoard((b) => ({
      ...b,
      todo: [{ id: uid(), title, notes: newNotes.trim() || undefined }, ...b.todo],
    }));
    setNewTitle("");
    setNewNotes("");
  }

  function removeTask(col: ColumnKey, id: string) {
    setBoard((b) => ({ ...b, [col]: b[col].filter((t) => t.id !== id) }));
  }

  function moveTask(from: ColumnKey, to: ColumnKey, id: string) {
    setBoard((b) => {
      const task = b[from].find((t) => t.id === id);
      if (!task) return b;
      return {
        ...b,
        [from]: b[from].filter((t) => t.id !== id),
        [to]: [task, ...b[to]],
      };
    });
  }

  function resetBoard() {
    setBoard(defaultBoard);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...card, padding: 18 }}>
        <h2 style={{ margin: 0 }}>Team Board</h2>
        <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          Local-only board for now (stored in your browser). Later: connect to an API.
        </p>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title (required)"
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.15)",
              color: "var(--text)",
              outline: "none",
            }}
          />
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.15)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Button className="primary" onClick={addTask}>Add to To do</Button>
          <Button className="danger" onClick={resetBoard}>Reset Board</Button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {columns.map((col) => (
          <div key={col} style={card}>
            <h3 style={{ marginTop: 0 }}>{columnTitle(col)}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {board[col].map((t) => (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{t.title}</div>
                  {t.notes ? (
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                      {t.notes}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {col !== "todo" && (
                      <Button onClick={() => moveTask(col, col === "done" ? "doing" : "todo", t.id)}>
                        ← Back
                      </Button>
                    )}
                    {col !== "done" && (
                      <Button className="primary" onClick={() => moveTask(col, col === "todo" ? "doing" : "done", t.id)}>
                        Next →
                      </Button>
                    )}
                    <Button className="danger" onClick={() => removeTask(col, t.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              {board[col].length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No tasks here yet.</div>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
