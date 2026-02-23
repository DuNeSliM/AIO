import type { RefObject } from 'react'
import UiCorners from '../../../components/ui/UiCorners'
import { useI18n } from '../../../i18n/i18n'
import type { WishlistItem } from '../../../types'
import WishlistItemCard from './WishlistItemCard'

type WishlistAlert = {
  id: string
  message: string
  createdAt: number
}

type WishlistSectionProps = {
  sectionRef: RefObject<HTMLDivElement | null>
  steamLoggedIn: boolean
  wishlistSyncing: boolean
  checking: boolean
  items: WishlistItem[]
  sortedItems: WishlistItem[]
  alerts: WishlistAlert[]
  lastCheckedLabel: string
  onSyncSteamWishlist: () => void | Promise<void>
  onCheckNow: () => void | Promise<void>
  onUpdateThreshold: (id: string, threshold: number | null) => void
  onRemove: (id: string, title: string) => void
}

export default function WishlistSection({
  sectionRef,
  steamLoggedIn,
  wishlistSyncing,
  checking,
  items,
  sortedItems,
  alerts,
  lastCheckedLabel,
  onSyncSteamWishlist,
  onCheckNow,
  onUpdateThreshold,
  onRemove,
}: WishlistSectionProps) {
  const { t } = useI18n()

  return (
    <section className="ui-surface" ref={sectionRef}>
      <div className="ui-panel ui-panel-pad-lg">
        <UiCorners />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="ui-label">{t('store.wishlist.title')}</p>
            <h2 className="text-xl tone-primary">{t('store.wishlist.title')}</h2>
            <div className="text-xs ui-subtle">{t('store.wishlist.lastChecked', { date: lastCheckedLabel })}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {steamLoggedIn && (
              <button className="ui-btn-secondary" onClick={() => void onSyncSteamWishlist()} disabled={wishlistSyncing}>
                {wishlistSyncing ? '...' : t('store.wishlist.syncSteam')}
              </button>
            )}
            <button className="ui-btn-primary" onClick={() => void onCheckNow()} disabled={checking || items.length === 0}>
              {checking ? t('store.wishlist.checking') : t('store.wishlist.checkNow')}
            </button>
          </div>
        </div>

        {items.length === 0 && <div className="mt-4 text-sm ui-subtle">{t('store.wishlist.empty')}</div>}

        {items.length > 0 && (
          <div className="mt-4 grid gap-3">
            {sortedItems.map((item) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                onUpdateThreshold={onUpdateThreshold}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="mt-6 rounded-lg border border-neon/15 bg-black/20 p-4">
            <div className="ui-label">{t('store.wishlist.alerts')}</div>
            <div className="mt-2 flex flex-col gap-2 text-xs ui-subtle">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-4">
                  <span>{alert.message}</span>
                  <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
