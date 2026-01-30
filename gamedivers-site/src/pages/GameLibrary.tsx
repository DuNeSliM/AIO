import { useEffect, useState } from 'react'
import GameList from '../components/GameList'
import { useGames } from '../hooks/useGames'
import type { SortBy } from '../hooks/useGames'
import { useSteamAuth } from '../hooks/useSteamAuth'
import { useI18n } from '../i18n/i18n'
import type { ViewMode } from '../types'

export default function GameLibrary() {
  const {
    games,
    totalGames,
    loading,
    syncing,
    error,
    search,
    setSearch,
    sortBy,
    setSortBy,
    reload,
    loadSteamLibrary,
    loadEpicLibrary,
  } = useGames()
  const steamAuth = useSteamAuth()
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('libraryView')
    return stored === 'list' ? 'list' : 'grid'
  })

  useEffect(() => {
    if (steamAuth.isLoggedIn && steamAuth.steamId) {
      loadSteamLibrary(steamAuth.steamId ?? '')
    }
  }, [steamAuth.isLoggedIn, steamAuth.steamId, loadSteamLibrary])

  useEffect(() => {
    loadEpicLibrary()
  }, [loadEpicLibrary])

  useEffect(() => {
    localStorage.setItem('libraryView', viewMode)
  }, [viewMode])

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
          {steamAuth.isLoggedIn && (
            <p className="steam-status">{t('library.steamConnected', { username: steamAuth.username ?? '' })}</p>
          )}
        </div>
        <div className="sync-actions">
          {steamAuth.isLoggedIn && (
            <button onClick={() => loadSteamLibrary(steamAuth.steamId ?? '')} disabled={loading || syncing}>
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
            onChange={(event) => setSearch(event.target.value)}
            className="search-input"
          />
          {search && <span className="search-count">{games.length} gefunden</span>}
        </div>

        <div className="sort-tabs">
          <select
            className="sort-dropdown"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
          >
            <option value="recent">{t('library.recent')}</option>
            <option value="a-z">{t('library.az')}</option>
            <option value="z-a">{t('library.za')}</option>
            <option value="playtime">{t('library.playtime')}</option>
          </select>
          <div className="view-toggle">
            <button className={`sort-tab ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              {t('library.viewGrid')}
            </button>
            <button className={`sort-tab ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              {t('library.viewList')}
            </button>
          </div>
        </div>
      </div>

      <section>
        {loading && <div className="loading">{t('library.loading')}</div>}
        {error && <div className="error">Fehler: {error}</div>}
        {!loading && !error && games.length === 0 && <div className="empty">{t('library.empty')}</div>}
        {!loading && !error && games.length > 0 && (
          <>
            <div className="game-count">{t('library.count', { count: games.length, total: totalGames })}</div>
            <GameList games={games} viewMode={viewMode} />
          </>
        )}
      </section>
    </div>
  )
}

