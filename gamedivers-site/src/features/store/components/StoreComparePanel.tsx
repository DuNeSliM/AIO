import type { RefObject } from 'react'
import UiCorners from '../../../components/ui/UiCorners'
import { useI18n } from '../../../i18n/i18n'
import type { ItadDeal, ItadSearchItem } from '../../../types'
import { formatItadPrice } from '../utils/priceFormat'

type StoreComparePanelProps = {
  sectionRef: RefObject<HTMLDivElement | null>
  selected: ItadSearchItem
  steamBest: ItadDeal | null
  epicBest: ItadDeal | null
  overallBest: ItadDeal | null
}

export default function StoreComparePanel({
  sectionRef,
  selected,
  steamBest,
  epicBest,
  overallBest,
}: StoreComparePanelProps) {
  const { t } = useI18n()

  return (
    <section className="ui-surface ui-surface--accent" ref={sectionRef}>
      <div className="ui-panel ui-panel-pad-lg">
        <UiCorners />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ui-label">{t('store.compare')}</p>
            <h2 className="text-xl tone-primary">{selected.title}</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
            <div className="ui-label">{t('store.steam')}</div>
            <div className="text-2xl tone-primary">{formatItadPrice(steamBest?.price)}</div>
            {(steamBest?.cut ?? 0) > 0 && <div className="text-sm text-ember">-{steamBest?.cut}%</div>}
            {steamBest?.url && (
              <a className="ui-btn-secondary mt-3 inline-flex" href={steamBest.url} target="_blank" rel="noreferrer">
                {t('store.offer')}
              </a>
            )}
          </div>
          <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
            <div className="ui-label">{t('store.epic')}</div>
            <div className="text-2xl tone-primary">{formatItadPrice(epicBest?.price)}</div>
            {(epicBest?.cut ?? 0) > 0 && <div className="text-sm text-ember">-{epicBest?.cut}%</div>}
            {epicBest?.url && (
              <a className="ui-btn-secondary mt-3 inline-flex" href={epicBest.url} target="_blank" rel="noreferrer">
                {t('store.offer')}
              </a>
            )}
          </div>
          <div className="rounded-lg border border-ember/40 bg-black/30 p-4 shadow-ember">
            <div className="ui-label">{t('store.cheapest')}</div>
            <div className="text-2xl tone-primary">{formatItadPrice(overallBest?.price)}</div>
            {overallBest?.shop?.name && <div className="text-sm tone-muted">{overallBest.shop.name}</div>}
            {overallBest?.url && (
              <a className="ui-btn-primary mt-3 inline-flex" href={overallBest.url} target="_blank" rel="noreferrer">
                {t('store.offer')}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
