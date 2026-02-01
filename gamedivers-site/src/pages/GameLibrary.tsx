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
    <div className="flex flex-col gap-6">
      <header className="hud-glass rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="hud-label">{t('library.title')}</p>
            <h1 className="text-2xl tone-primary">{t('library.title')}</h1>
            {steamAuth.isLoggedIn && (
              <p className="text-sm tone-muted">{t('library.steamConnected', { username: steamAuth.username ?? '' })}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {steamAuth.isLoggedIn && (
              <button className="btn-primary" onClick={() => loadSteamLibrary(steamAuth.steamId ?? '')} disabled={loading || syncing}>
                {syncing ? '...' : t('library.syncSteam')}
              </button>
            )}
            <button className="btn-soft" onClick={() => loadEpicLibrary()} disabled={loading || syncing}>
              {syncing ? '...' : t('library.syncEpic')}
            </button>
            <button className="btn-ghost" onClick={reload} disabled={loading || syncing}>
              {t('library.reload')}
            </button>
          </div>
        </div>
      </header>

      <div className="hud-panel rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-1 items-center gap-3">
            <input
              type="text"
              placeholder={t('library.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-hud"
            />
            {search && <span className="chip">{games.length} gefunden</span>}
          </div>

          <div className="flex items-center gap-3">
            <select
              className="btn-soft text-sm"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
            >
              <option value="recent">{t('library.recent')}</option>
              <option value="a-z">{t('library.az')}</option>
              <option value="z-a">{t('library.za')}</option>
              <option value="playtime">{t('library.playtime')}</option>
            </select>
            <div className="flex gap-2">
              <button className={`btn-soft ${viewMode === 'grid' ? 'border-neon/60 text-neon' : ''}`} onClick={() => setViewMode('grid')}>
                {t('library.viewGrid')}
              </button>
              <button className={`btn-soft ${viewMode === 'list' ? 'border-neon/60 text-neon' : ''}`} onClick={() => setViewMode('list')}>
                {t('library.viewList')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        {loading && <div className="text-sm tone-muted">{t('library.loading')}</div>}
        {error && <div className="text-sm text-red-400">Fehler: {error}</div>}
        {!loading && !error && games.length === 0 && <div className="text-sm tone-muted">{t('library.empty')}</div>}
        {!loading && !error && games.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-[0.2em] tone-muted">
              {t('library.count', { count: games.length, total: totalGames })}
            </div>
            <GameList games={games} viewMode={viewMode} />
          </>
        )}
      </section>
    </div>
  )
}

