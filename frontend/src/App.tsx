import React from "react";
import AuthPage from "./components/AuthPage";
import StorePage from "./components/StorePage";
import LibraryPage from "./components/LibraryPage";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import GameDetails from "./components/GameDetails";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import { useGameSelection } from "./hooks/useGameSelection";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/global.css";
import "./styles/components.css";

/**
 * Main App component for the AIO Game Launcher.
 * Manages authentication, navigation, and game selection.
 */
const AppContent: React.FC = () => {
  const { token, isAuthenticated, login, logout } = useAuth();
  const { currentPage, navigate } = useNavigation(isAuthenticated ? "library" : "auth");
  const { selectedGame, selectGame, closeDetails } = useGameSelection();

  // If not authenticated, show auth page
  if (!isAuthenticated) {
    return (
      <div className="app centered" role="main" aria-label="Authentication Page">
        <AuthPage onLogin={login} />
      </div>
    );
  }

  return (
    <div className="app" role="application" aria-label="AIO Game Launcher">
      <Sidebar current={currentPage} onNavigate={navigate} />
      <div className="main-area">
        <TopBar
          title={currentPage === "library" ? "Library" : currentPage === "store" ? "Store" : "Gamedivers"}
          onLogout={logout}
        />
        <main className="content" role="main">
          {currentPage === "store" && (
            <StorePage token={token} onSelectGame={selectGame} />
          )}
          {currentPage === "library" && (
            <LibraryPage token={token} onSelectGame={selectGame} />
          )}
        </main>
      </div>
      {selectedGame && (
        <GameDetails
          game={selectedGame}
          onClose={closeDetails}
          onLaunch={(game) => {
            closeDetails();
            // TODO: Implement launch logic
          }}
          onDownload={(game) => {
            closeDetails();
            // TODO: Implement download logic
          }}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
