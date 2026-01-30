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
    <button className="btn-launch" onClick={onClick} disabled={loading}>
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
    <article className={`game-card ${viewMode === 'list' ? 'list' : ''}`}>
      <div className="game-thumb">
        {image ? <img src={image} alt={name} /> : <div className="thumb-placeholder" />}
      </div>
      <div className="game-meta">
        <h3>{name}</h3>
        <div className="game-info">
          <div className="info-row">
            <span className="info-label">Zuletzt gespielt:</span>
            <span className="info-value">{getLastPlayedDate(lastPlayed)}</span>
          </div>
          {(playtime ?? 0) > 0 && (
            <div className="info-row">
              <span className="info-label">Spielzeit:</span>
              <span className="info-value">{getPlaytimeHours(playtime)}</span>
            </div>
          )}
        </div>
        <div className="game-meta-bottom">
          <span className="platform">{platform}</span>
          <LaunchButton onClick={start} loading={launching} />
        </div>
      </div>
    </article>
  )
}
