import React from 'react'
import GameCard from './GameCard'

export default function GameList({games=[]}){
  if (!games.length) return <div className="empty">No games found</div>
  return (
    <div className="game-list">
      {games.map(g => <GameCard key={g.id} game={g} />)}
    </div>
  )
}
