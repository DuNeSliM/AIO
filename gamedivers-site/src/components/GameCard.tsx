import { useState } from 'react'
import { launchGame } from '../services/api'
import { getLastPlayedDate, getPlaytimeHours } from '../utils/gameFormat'
import type { Game, ViewMode } from '../types'

type LaunchButtonProps = {
  onClick: () => void
  loading: boolean
}

function LaunchButton({ onClick, loading }: LaunchButtonProps) {
  return (
    <button className="btn-primary text-xs" onClick={onClick} disabled={loading}>
      {loading ? 'Starte...' : 'Start'}
    </button>
  )
}

type GameCardProps = {
  game: Game
  viewMode?: ViewMode
}

export default function GameCard({ game, viewMode = 'grid' }: GameCardProps) {
  const { name, platform, image, id, appId, appName, gameName, lastPlayed, playtime } = game
  const [launching, setLaunching] = useState(false)

  const start = async () => {
    setLaunching(true)
    try {
      const identifier = appId || appName || gameName || id
      await launchGame(platform ?? 'unknown', identifier ?? '', appName ?? gameName)
      console.log(`Started ${name} (${platform})`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Launch failed:', err)
      alert(`Fehler beim Starten von ${name}: ${message}`)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <article
      className={`group flex gap-4 rounded-xl border border-neon/10 bg-panel/70 p-4 shadow-glow transition hover:border-neon/40 ${
        viewMode === 'list' ? 'items-center' : 'flex-col'
      }`}
    >
      <div className={viewMode === 'list' ? 'flex h-16 w-24 shrink-0 items-center' : 'w-full'}>
        {image ? (
          <img
            src={image}
            alt={name}
            className={`rounded-lg object-cover ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`}
          />
        ) : (
          <div
            className={`rounded-lg bg-white/5 ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="hud-label">Game</p>
          <h3 className="text-lg tone-primary">{name}</h3>
        </div>
        <div className="space-y-1 text-xs tone-muted">
          <div className="flex items-center justify-between">
            <span>Zuletzt gespielt</span>
            <span className="tone-soft">{getLastPlayedDate(lastPlayed)}</span>
          </div>
          {(playtime ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span>Spielzeit</span>
              <span className="tone-soft">{getPlaytimeHours(playtime)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.2em] tone-muted">{platform}</span>
          <LaunchButton onClick={start} loading={launching} />
        </div>
      </div>
    </article>
  )
}
