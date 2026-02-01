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
    <button className="term-btn-primary text-xs" onClick={onClick} disabled={loading}>
      {loading ? '...' : 'LAUNCH'}
    </button>
  )
}

type GameCardProps = {
  game: Game
  viewMode?: ViewMode
  index: number
}

export default function GameCard({ game, viewMode = 'grid', index }: GameCardProps) {
  const { name, platform, image, id, appId, appName, gameName, lastPlayed, playtime } = game
  const [launching, setLaunching] = useState(false)
  const assetId = `AIO-${String(index + 1).padStart(4, '0')}`
  const nodeLabel = platform ? platform.toUpperCase() : 'UNKNOWN'

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
    <article className="term-card">
      <div
        className={`term-panel flex gap-4 rounded-[15px] p-4 transition hover:border-neon/40 ${
          viewMode === 'list' ? 'items-center' : 'flex-col'
        }`}
      >
        <div className="term-corners">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="term-cardHeader" />
        <div className={viewMode === 'list' ? 'flex h-16 w-24 shrink-0 items-center' : 'w-full'}>
          {image ? (
            <img
              src={image}
              alt={name}
              className={`rounded-lg object-cover ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`}
            />
          ) : (
            <div className={`rounded-lg bg-white/5 ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`} />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="term-label">ASSET ID: {assetId}</p>
            <h3 className="text-lg tone-primary">{name}</h3>
          </div>
          <div className="space-y-1 text-xs term-subtle">
            <div className="flex items-center justify-between">
              <span>LAST LAUNCH</span>
              <span className="tone-soft">{getLastPlayedDate(lastPlayed)}</span>
            </div>
            {(playtime ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span>FLIGHT TIME</span>
                <span className="tone-soft">{getPlaytimeHours(playtime)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="term-chip">NODE: {nodeLabel}</span>
            <LaunchButton onClick={start} loading={launching} />
          </div>
        </div>
      </div>
    </article>
  )
}
