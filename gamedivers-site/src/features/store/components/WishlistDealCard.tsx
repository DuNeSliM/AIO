import { useI18n } from '../../../i18n/i18n'
import type { WishlistItem } from '../../../types'
import { formatMoney } from '../utils/priceFormat'

type WishlistDeal = NonNullable<WishlistItem['dealsTop3']>[number]

type WishlistDealCardProps = {
  deal: WishlistDeal
}

export default function WishlistDealCard({ deal }: WishlistDealCardProps) {
  const { t } = useI18n()

  return (
    <div className="rounded-lg border border-neon/10 bg-black/25 p-3">
      <div className="text-xs ui-subtle">{deal.shop || t('store.wishlist.sourceUnknown')}</div>
      <div className="text-lg tone-primary">
        {typeof deal.price === 'number'
          ? formatMoney(deal.price, deal.currency)
          : '-'}
      </div>
      {(deal.cut ?? 0) > 0 && <div className="text-xs text-ember">-{deal.cut}%</div>}
      {deal.url && (
        <a className="ui-btn-secondary mt-2 inline-flex" href={deal.url} target="_blank" rel="noreferrer">
          {t('store.offer')}
        </a>
      )}
    </div>
  )
}
