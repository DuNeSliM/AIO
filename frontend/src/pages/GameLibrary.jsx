import React, { useEffect } from 'react'
import GameList from '../components/GameList'
import { useGames } from '../hooks/useGames'
import { useSteamAuth } from '../hooks/useSteamAuth'
import { useI18n } from '../i18n/i18n.jsx'

export default function GameLibrary(){
  const { games, totalGames, loading, syncing, error, search, setSearch, sortBy, setSortBy, reload, loadSteamLibrary, loadEpicLibrary } = useGames()
  const steamAuth = useSteamAuth()
  const { t } = useI18n()

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
          <h1>{t('library.title')}</h1>
          {steamAuth.isLoggedIn && <p className="steam-status">{t('library.steamConnected', { username: steamAuth.username })}</p>}
        </div>
        <div className="sync-actions">
          {steamAuth.isLoggedIn && (
            <button onClick={() => loadSteamLibrary(steamAuth.steamId)} disabled={loading || syncing}>
              {syncing ? '...' : t('library.syncSteam')}
            </button>
          )}
          <button onClick={() => loadEpicLibrary()} disabled={loading || syncing}>
            {syncing ? '...' : t('library.syncEpic')}
          </button>
          <button onClick={reload} disabled={loading || syncing}>
            {t('library.reload')}
          </button>
        </div>
      </header>

      <div className="library-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('library.searchPlaceholder')}
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
            {t('library.recent')}
          </button>
          <button
            className={`sort-tab ${sortBy === 'a-z' ? 'active' : ''}`}
            onClick={() => setSortBy('a-z')}
          >
            {t('library.az')}
          </button>
          <button
            className={`sort-tab ${sortBy === 'z-a' ? 'active' : ''}`}
            onClick={() => setSortBy('z-a')}
          >
            {t('library.za')}
          </button>
        </div>
      </div>

      <section>
        {loading && <div className="loading">{t('library.loading')}</div>}
        {error && <div className="error">Fehler: {error}</div>}
        {!loading && !error && games.length === 0 && (
          <div className="empty">
            {t('library.empty')}
          </div>
        )}
        {!loading && !error && games.length > 0 && (
          <>
            <div className="game-count">{t('library.count', { count: games.length, total: totalGames })}</div>
            <GameList games={games} />
          </>
        )}
      </section>
    </div>
  )
}
