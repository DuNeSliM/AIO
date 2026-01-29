import React, { useEffect } from 'react'
import GameList from '../components/GameList'
import { useGames } from '../hooks/useGames'
import { useSteamAuth } from '../hooks/useSteamAuth'

export default function GameLibrary(){
  const { games, totalGames, loading, syncing, error, search, setSearch, sortBy, setSortBy, reload, loadSteamLibrary, loadEpicLibrary } = useGames()
  const steamAuth = useSteamAuth()

  useEffect(() => {
    if (steamAuth.isLoggedIn && steamAuth.steamId) {
      loadSteamLibrary(steamAuth.steamId)
    }
  }, [steamAuth.isLoggedIn, steamAuth.steamId, loadSteamLibrary])

  useEffect(() => {
    loadEpicLibrary()
  }, [loadEpicLibrary])

  useEffect(() => {
    const handler = () => loadEpicLibrary()
    window.addEventListener('epic-local-sync', handler)
    return () => window.removeEventListener('epic-local-sync', handler)
  }, [loadEpicLibrary])

  return (
    <div className="page-library">
      <header className="page-header">
        <div>
          <h1>Game Library</h1>
          {steamAuth.isLoggedIn && <p className="steam-status">✓ Steam: {steamAuth.username}</p>}
        </div>
        <div className="sync-actions">
          {steamAuth.isLoggedIn && (
            <button onClick={() => loadSteamLibrary(steamAuth.steamId)} disabled={loading || syncing}>
              {syncing ? '...' : '🔄 Steam'}
            </button>
          )}
          <button onClick={() => loadEpicLibrary()} disabled={loading || syncing}>
            {syncing ? '...' : '🔄 Epic (lokal)'}
          </button>
          <button onClick={reload} disabled={loading || syncing}>
            ↻ Reload
          </button>
        </div>
      </header>

      <div className="library-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Spiel suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {search && <span className="search-count">{games.length} gefunden</span>}
        </div>

        <div className="sort-tabs">
          <button
            className={`sort-tab ${sortBy === 'recent' ? 'active' : ''}`}
            onClick={() => setSortBy('recent')}
          >
            ⏱ Zuletzt gespielt
          </button>
          <button
            className={`sort-tab ${sortBy === 'a-z' ? 'active' : ''}`}
            onClick={() => setSortBy('a-z')}
          >
            A → Z
          </button>
          <button
            className={`sort-tab ${sortBy === 'z-a' ? 'active' : ''}`}
            onClick={() => setSortBy('z-a')}
          >
            Z → A
          </button>
        </div>
      </div>

      <section>
        {loading && <div className="loading">Lade Spiele...</div>}
        {error && <div className="error">Fehler: {error}</div>}
        {!loading && !error && games.length === 0 && (
          <div className="empty">
            Keine Spiele gefunden. Starte den Epic Games Launcher oder melde dich mit Steam an.
          </div>
        )}
        {!loading && !error && games.length > 0 && (
          <>
            <div className="game-count">{games.length} von {totalGames} Spielen</div>
            <GameList games={games} />
          </>
        )}
      </section>
    </div>
  )
}
