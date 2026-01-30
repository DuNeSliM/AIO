import GameCard from './GameCard'
import type { Game, ViewMode } from '../types'

type GameListProps = {
  games?: Game[]
  viewMode?: ViewMode
}

export default function GameList({ games = [], viewMode = 'grid' }: GameListProps) {
  if (!games.length) return <div className="empty">No games found</div>
  return (
    <div className={`game-list ${viewMode === 'list' ? 'list' : 'grid'}`}>
      {games.map((game) => (
        <GameCard key={game.id ?? game.name} game={game} viewMode={viewMode} />
      ))}
    </div>
  )
}
