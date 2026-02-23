import { useI18n } from '../../../i18n/i18n'
import type { WishlistItem } from '../../../types'
import { formatMoney } from '../utils/priceFormat'
import { backupSteamHeaderUrl, defaultSteamCapsuleUrl } from '../utils/steamAssets'
import WishlistDealCard from './WishlistDealCard'

type WishlistItemCardProps = {
  item: WishlistItem
  onUpdateThreshold: (id: string, threshold: number | null) => void
  onRemove: (id: string, title: string) => void
}

export default function WishlistItemCard({ item, onUpdateThreshold, onRemove }: WishlistItemCardProps) {
  const { t } = useI18n()

  const computedPrimaryImage =
    item.image ||
    (item.source === 'steam' && typeof item.steamAppId === 'number'
      ? defaultSteamCapsuleUrl(item.steamAppId)
      : undefined)
  const computedBackupImage =
    item.imageBackup ||
    (item.source === 'steam' && typeof item.steamAppId === 'number'
      ? backupSteamHeaderUrl(item.steamAppId)
      : undefined)
  const cheapestDeal = item.lowestDeal ?? item.dealsTop3?.[0]

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neon/10 bg-black/20 p-4">
      <div className="flex min-w-0 items-start gap-3">
        {(computedPrimaryImage || computedBackupImage) && (
          <img
            src={computedPrimaryImage || computedBackupImage}
            alt={item.title}
            className="h-14 w-28 rounded-md border border-neon/15 object-cover"
            loading="lazy"
            data-fallback={computedBackupImage}
            onError={(event) => {
              const fallback = event.currentTarget.dataset.fallback
              if (!fallback) return
              if (event.currentTarget.src === fallback) return
              event.currentTarget.src = fallback
            }}
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="text-base tone-primary">{item.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/55">
            <span>{item.source === 'steam' ? t('store.wishlist.sourceSteam') : t('store.wishlist.sourceManual')}</span>
            {typeof item.lastPrice === 'number' && (
              <span>
                {formatMoney(item.lastPrice, item.currency ?? 'EUR')}
              </span>
            )}
            {item.lastCheckedAt && <span>{new Date(item.lastCheckedAt).toLocaleTimeString()}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
            {item.onSale && <span className="ui-chip">{t('store.wishlist.onSale')}</span>}
            {item.belowThreshold && <span className="ui-chip">{t('store.wishlist.belowTarget')}</span>}
          </div>
          {typeof cheapestDeal?.price === 'number' && (
            <div className="text-xs ui-subtle">
              {t('store.cheapest')}: {formatMoney(cheapestDeal.price, cheapestDeal.currency ?? item.currency ?? 'EUR')}
              {cheapestDeal.shop ? ` - ${cheapestDeal.shop}` : ''}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="ui-input w-28"
          type="number"
          min={0}
          step="0.01"
          placeholder={t('store.wishlist.targetPlaceholder')}
          value={typeof item.threshold === 'number' ? item.threshold : ''}
          onChange={(event) => {
            const raw = event.target.value
            if (!raw) {
              onUpdateThreshold(item.id, null)
              return
            }
            const parsed = Number.parseFloat(raw)
            onUpdateThreshold(item.id, Number.isNaN(parsed) ? null : Math.max(0, parsed))
          }}
        />
        <button
          className="ui-btn-secondary"
          onClick={() => onRemove(item.id, item.title)}
        >
          {t('store.wishlist.remove')}
        </button>
      </div>
      {item.dealsTop3 && item.dealsTop3.length > 0 && (
        <div className="w-full">
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {item.dealsTop3.map((deal, index) => (
              <WishlistDealCard key={`${item.id}-${index}`} deal={deal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
