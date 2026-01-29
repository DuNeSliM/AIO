import React from 'react'
import GameCard from './GameCard'

export default function GameList({games=[], viewMode='grid'}){
  if (!games.length) return <div className="empty">No games found</div>
  return (
    <div className={`game-list ${viewMode === 'list' ? 'list' : 'grid'}`}>
      {games.map(g => <GameCard key={g.id} game={g} viewMode={viewMode} />)}
    </div>
  )
}
