import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";

import Home from "./pages/Home";
import Download from "./pages/Download";
import Docs from "./pages/Docs";
import Board from "./pages/Board";

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
