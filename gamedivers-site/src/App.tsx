import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./app/layout/AppShell";

import Home from "./app/pages/Home";
import Download from "./app/pages/Download";
import Docs from "./app/pages/Docs";
import Board from "./app/pages/Board";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/download" element={<Download />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/board" element={<Board />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
