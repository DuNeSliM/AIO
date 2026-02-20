import GameCard from './GameCard'
import type { Game, ViewMode } from '../types'

type GameListProps = {
  games?: Game[]
  viewMode?: ViewMode
}

export default function GameList({ games = [], viewMode = 'grid' }: GameListProps) {
  if (!games.length) return <div className="text-sm tone-muted">No games found</div>
  return (
    <div
      className={
        viewMode === 'list'
          ? 'flex flex-col gap-4'
          : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
      }
    >
      {games.map((game, index) => (
        <GameCard key={game.id ?? game.name} game={game} viewMode={viewMode} index={index} />
      ))}
    </div>
  )
}
