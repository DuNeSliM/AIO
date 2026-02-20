import { useEffect, useState } from 'react'
import { launchGame } from '../services/api'
import { getLastPlayedDate, getPlaytimeHours } from '../utils/gameFormat'
import type { Game, ViewMode } from '../types'
import { addEventLog, award, recordLaunchUnplayed } from '../utils/gameify'

type LaunchButtonProps = {
  onClick: () => void
  loading: boolean
}

function LaunchButton({ onClick, loading }: LaunchButtonProps) {
  return (
    <button className="ui-btn-primary text-xs" onClick={onClick} disabled={loading}>
      {loading ? '...' : 'Start'}
    </button>
  )
}

type GameCardProps = {
  game: Game
  viewMode?: ViewMode
  index: number
}

export default function GameCard({ game, viewMode = 'grid', index }: GameCardProps) {
  const { name, platform, image, imageFallback, id, appId, appName, gameName, lastPlayed, playtime } = game
  const [launching, setLaunching] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | undefined>(image)
  const [usedImageFallback, setUsedImageFallback] = useState(false)
  const assetId = `AIO-${String(index + 1).padStart(4, '0')}`
  const nodeLabel = platform ? platform.toUpperCase() : 'UNKNOWN'

  useEffect(() => {
    setImageSrc(image)
    setUsedImageFallback(false)
  }, [image, imageFallback])

  const start = async () => {
    setLaunching(true)
    try {
      award(20, 15)
      if (!lastPlayed || lastPlayed === 0) {
        recordLaunchUnplayed()
      }
      addEventLog(`LAUNCH: ${name}`)
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

  const handleImageError = () => {
    if (!usedImageFallback && imageFallback) {
      setImageSrc(imageFallback)
      setUsedImageFallback(true)
      return
    }
    setImageSrc(undefined)
  }

  return (
    <article className="ui-card">
      <div
        className={`ui-panel flex gap-4 ui-panel-pad-sm transition hover:border-neon/40 ${
          viewMode === 'list' ? 'items-center' : 'flex-col'
        }`}
      >
        <div className="ui-corners">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="ui-cardHeader" />
        <div className={viewMode === 'list' ? 'flex h-16 w-24 shrink-0 items-center' : 'w-full'}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              onError={handleImageError}
              className={`rounded-lg object-cover ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`}
            />
          ) : (
            <div className={`rounded-lg bg-white/5 ${viewMode === 'list' ? 'h-16 w-24' : 'h-36 w-full'}`} />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="ui-label">ID: {assetId}</p>
            <h3 className="text-lg tone-primary">{name}</h3>
          </div>
          <div className="space-y-1 text-xs ui-subtle">
            <div className="flex items-center justify-between">
              <span>Last played</span>
              <span className="tone-soft">{getLastPlayedDate(lastPlayed)}</span>
            </div>
            {(playtime ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span>Playtime</span>
                <span className="tone-soft">{getPlaytimeHours(playtime)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="ui-chip">Store: {nodeLabel}</span>
            <LaunchButton onClick={start} loading={launching} />
          </div>
        </div>
      </div>
    </article>
  )
}



