import React, { useState } from 'react'
import { launchGame } from '../services/api'
import { getLastPlayedDate, getPlaytimeHours } from '../utils/gameFormat'

function LaunchButton({onClick, loading}){
  return (
    <button className="btn-launch" onClick={onClick} disabled={loading}>
      {loading ? 'Starte...' : 'Start'}
    </button>
  )
}

export default function GameCard({game, viewMode='grid'}){
  const {name, platform, image, id, appId, appName, gameName, lastPlayed, playtime} = game
  const [launching, setLaunching] = useState(false)

  const start = async () => {
    setLaunching(true)
    try{
      // Use platform-specific IDs
      const identifier = appId || appName || gameName || id
      await launchGame(platform, identifier, appName || gameName)
      console.log(`Started ${name} (${platform})`)
    }catch(err){
      console.error('Launch failed:', err)
      alert(`Fehler beim Starten von ${name}: ${err.message}`)
    }finally{
      setLaunching(false)
    }
  }

  return (
    <article className={`game-card ${viewMode === 'list' ? 'list' : ''}`}>
      <div className="game-card-image">
        <div className="game-thumb">
          {image ? <img src={image} alt={name} /> : <div className="thumb-placeholder" />}
        </div>
        <div className="game-card-overlay">
          <LaunchButton onClick={start} loading={launching} />
        </div>
      </div>
      <div className="game-meta">
        <div className="game-meta-header">
          <h3>{name}</h3>
          <span className={`platform platform-${platform.toLowerCase()}`}>{platform}</span>
        </div>
        <div className="game-info">
          {lastPlayed && (
            <div className="info-row">
              <span className="info-label">Zuletzt:</span>
              <span className="info-value">{getLastPlayedDate(lastPlayed)}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Zeit:</span>
            <span className="info-value">{getPlaytimeHours(playtime)}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
