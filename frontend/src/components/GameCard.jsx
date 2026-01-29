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
          {playtime > 0 && (
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
