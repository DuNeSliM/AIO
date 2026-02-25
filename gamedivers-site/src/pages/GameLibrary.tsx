import { useEffect, useState } from 'react'
import UiCorners from '../components/ui/UiCorners'
import GameList from '../components/GameList'
import { useGames } from '../hooks/useGames'
import type { SortBy } from '../hooks/useGames'
import { useAuth } from '../hooks/useAuth'
import { useSteamAuth } from '../hooks/useSteamAuth'
import { useI18n } from '../i18n/i18n'
import { canLoadGogLibrary } from '../services/api'
import { APP_EVENTS, onAppEvent } from '../shared/events'
import { STORAGE_KEYS } from '../shared/storage/keys'
import { getLocalString, setLocalString } from '../shared/storage/storage'
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
    loadGogLibrary,
  } = useGames()
  const { isLoggedIn, isLoading } = useAuth()
  const steamAuth = useSteamAuth()
  const { t } = useI18n()
  const showGogSync = canLoadGogLibrary()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = getLocalString(STORAGE_KEYS.app.libraryView)
    return stored === 'list' ? 'list' : 'grid'
  })

  useEffect(() => {
    if (isLoading || !isLoggedIn) return
    if (steamAuth.isLoggedIn && steamAuth.steamId) {
      void loadSteamLibrary(steamAuth.steamId ?? '')
    }
  }, [isLoading, isLoggedIn, steamAuth.isLoggedIn, steamAuth.steamId, loadSteamLibrary])

  useEffect(() => {
    if (isLoading || !isLoggedIn) return
    void loadEpicLibrary()
  }, [isLoading, isLoggedIn, loadEpicLibrary])

  useEffect(() => {
    if (isLoading || !isLoggedIn) return
    if (!showGogSync) return
    void loadGogLibrary()
  }, [isLoading, isLoggedIn, loadGogLibrary, showGogSync])

  useEffect(() => {
    if (isLoading || !isLoggedIn) return
    void reload()
  }, [isLoading, isLoggedIn, reload])

  useEffect(() => {
    setLocalString(STORAGE_KEYS.app.libraryView, viewMode)
  }, [viewMode])

  useEffect(() => {
    const handler = () => {
      void loadEpicLibrary()
      if (showGogSync) {
        void loadGogLibrary()
      }
    }
    return onAppEvent(APP_EVENTS.epicLocalSync, handler)
  }, [loadEpicLibrary, loadGogLibrary, showGogSync])

  return (
    <div className="flex flex-col gap-6">
      <header className="ui-surface ui-surface--accent">
        <div className="ui-panel ui-panel-pad-lg">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="ui-label">{t('library.title')}</p>
              <h1 className="text-2xl tone-primary">{t('library.title')}</h1>
              {steamAuth.isLoggedIn && (
                <p className="text-sm ui-subtle">{t('library.steamConnected', { username: steamAuth.username ?? '' })}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {steamAuth.isLoggedIn && (
                <button
                  className="ui-btn-primary"
                  onClick={() => loadSteamLibrary(steamAuth.steamId ?? '')}
                  disabled={loading || syncing}
                >
                  {syncing ? '...' : t('library.syncSteam')}
                </button>
              )}
              <button className="ui-btn-secondary" onClick={() => loadEpicLibrary()} disabled={loading || syncing}>
                {syncing ? '...' : t('library.syncEpic')}
              </button>
              {showGogSync && (
                <button className="ui-btn-secondary" onClick={() => loadGogLibrary()} disabled={loading || syncing}>
                  {syncing ? '...' : t('library.syncGog')}
                </button>
              )}
              <button className="ui-btn-secondary" onClick={reload} disabled={loading || syncing}>
                {t('library.reload')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 items-center gap-3">
              <input
                type="text"
                placeholder={t('library.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="ui-input"
              />
              {search && <span className="ui-chip">{t('library.results', { count: games.length })}</span>}
            </div>

            <div className="flex items-center gap-3">
              <select
                className="ui-select"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
              >
                <option value="recent">{t('library.recent')}</option>
                <option value="a-z">{t('library.az')}</option>
                <option value="z-a">{t('library.za')}</option>
                <option value="playtime">{t('library.playtime')}</option>
              </select>
              <div className="flex gap-2">
                <button
                  className={`ui-btn-secondary ${viewMode === 'grid' ? 'border-neon/80 text-neon' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  {t('library.viewGrid')}
                </button>
                <button
                  className={`ui-btn-secondary ${viewMode === 'list' ? 'border-neon/80 text-neon' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  {t('library.viewList')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        {loading && <div className="text-sm ui-subtle">{t('library.loading')}</div>}
        {error && (
          <div className="text-sm text-red-400">
            {t('library.errorPrefix')}: {error === 'steam-private' ? t('library.steamPrivate') : error}
          </div>
        )}
        {!loading && !error && games.length === 0 && <div className="text-sm ui-subtle">{t('library.empty')}</div>}
        {!loading && !error && games.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">
              {t('library.count', { count: games.length, total: totalGames })}
            </div>
            <GameList games={games} viewMode={viewMode} />
          </>
        )}
      </section>
    </div>
  )
}




