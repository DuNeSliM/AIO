import GameCard from './GameCard'
import { useI18n } from '../i18n/i18n'
import type { Game, ViewMode } from '../types'

type GameListProps = {
  games?: Game[]
  viewMode?: ViewMode
}

export default function GameList({ games = [], viewMode = 'grid' }: GameListProps) {
  const { t } = useI18n()
  if (!games.length) return <div className="text-sm tone-muted">{t('library.noGamesFound')}</div>
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
