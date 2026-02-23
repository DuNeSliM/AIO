import type { ItadSearchItem } from '../../../types'
import UiCorners from '../../../components/ui/UiCorners'
import { useI18n } from '../../../i18n/i18n'

type PriceCacheEntry = {
  steam?: number
  epic?: number
  currency?: string
}

type StoreSearchResultsProps = {
  results: ItadSearchItem[]
  selectedId?: string
  loading: boolean
  priceCache: Record<string, PriceCacheEntry>
  wishlistIds: Set<string>
  onCompare: (game: ItadSearchItem) => void
  onAddWishlist: (game: ItadSearchItem) => void
  onRemoveWishlist: (game: ItadSearchItem) => void
}

export default function StoreSearchResults({
  results,
  selectedId,
  loading,
  priceCache,
  wishlistIds,
  onCompare,
  onAddWishlist,
  onRemoveWishlist,
}: StoreSearchResultsProps) {
  const { t } = useI18n()

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((game) => {
        const cache = priceCache[game.id]
        const hasBoth = typeof cache?.steam === 'number' && typeof cache?.epic === 'number'
        const steamCheaper = hasBoth && (cache?.steam ?? 0) < (cache?.epic ?? 0)
        const epicCheaper = hasBoth && (cache?.epic ?? 0) < (cache?.steam ?? 0)
        const diff = hasBoth ? Math.abs((cache?.steam ?? 0) - (cache?.epic ?? 0)) : 0
        const currency = cache?.currency ? ` ${cache.currency}` : ''
        const banner = steamCheaper
          ? t('store.bestPriceSteam', { diff: diff.toFixed(2), currency })
          : epicCheaper
            ? t('store.bestPriceEpic', { diff: diff.toFixed(2), currency })
            : ''

        return (
          <div key={game.id} className={`ui-surface ${selectedId === game.id ? 'ui-surface--accent' : ''}`}>
            <div className="ui-panel ui-panel-pad-sm">
              <UiCorners />
              {banner && <div className="ui-banner">{banner}</div>}
              <div>
                <p className="ui-label">{t('store.searchHit')}</p>
                <div className="text-lg tone-primary">{game.title}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="ui-btn-primary" onClick={() => onCompare(game)} disabled={loading}>
                  {selectedId === game.id && loading ? '...' : t('store.compare')}
                </button>
                {wishlistIds.has(game.id) ? (
                  <button className="ui-btn-secondary" onClick={() => onRemoveWishlist(game)}>
                    {t('store.wishlist.remove')}
                  </button>
                ) : (
                  <button className="ui-btn-secondary" onClick={() => onAddWishlist(game)}>
                    {t('store.wishlist.add')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
