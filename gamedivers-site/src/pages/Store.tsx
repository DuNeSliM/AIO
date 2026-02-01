import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { searchItad, getItadPrices } from '../services/api'
import { useI18n } from '../i18n/i18n'
import type { ItadDeal, ItadPrice, ItadPricesResponse, ItadSearchItem } from '../types'
import { useWishlist } from '../hooks/useWishlist'

function formatPrice(price?: ItadPrice) {
  if (!price) return '-'
  const amount = typeof price.amount === 'number' ? price.amount : price.amountInt ? price.amountInt / 100 : 0
  const currency = price.currency || 'EUR'
  return `${amount.toFixed(2)} ${currency}`
}

function pickLowestDeal(deals?: ItadDeal[] | null) {
  if (!deals || deals.length === 0) return null
  return deals.reduce<ItadDeal | null>((lowest, deal) => {
    if (!deal?.price) return lowest
    if (!lowest?.price) return deal
    const a = deal.price.amount ?? (deal.price.amountInt ? deal.price.amountInt / 100 : 0)
    const b = lowest.price.amount ?? (lowest.price.amountInt ? lowest.price.amountInt / 100 : 0)
    return a < b ? deal : lowest
  }, null)
}

export default function Store() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItadSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ItadSearchItem | null>(null)
  const [prices, setPrices] = useState<ItadPricesResponse | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [region, setRegion] = useState(() => localStorage.getItem('storeRegion') || 'DE')
  const {
    items,
    addItem,
    removeItem,
    updateThreshold,
    onedriveStatus,
    onedriveSupported,
    connectOnedrive,
    disconnectOnedrive,
    requestOnedriveAccess,
    notificationsEnabled,
    notificationsSupported,
    enableNotifications,
    disableNotifications,
    alerts,
    checking,
    lastCheckedAt,
    checkPrices,
  } = useWishlist(region)

  const wishlistIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const lastCheckedLabel = lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : t('store.wishlist.never')

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSelected(null)
    setPrices(null)
    setHasSearched(true)
    try {
      const data = await searchItad(query.trim(), 10)
      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.results)
            ? data.results
            : []
      setResults(normalized)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onCompare = async (game: ItadSearchItem) => {
    setSelected(game)
    setLoading(true)
    setError(null)
    try {
      const data = await getItadPrices(game.id, region)
      setPrices(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const priceItem = Array.isArray(prices)
    ? prices.find((item) => item.id === selected?.id)
    : prices?.games?.[selected?.id ?? '']

  const deals = priceItem?.deals || []
  const steamDeals = deals.filter((deal) => deal?.shop?.name?.toLowerCase()?.includes('steam'))
  const epicDeals = deals.filter((deal) => deal?.shop?.name?.toLowerCase()?.includes('epic'))
  const steamBest = pickLowestDeal(steamDeals)
  const epicBest = pickLowestDeal(epicDeals)
  const overallBest = pickLowestDeal(deals)

  return (
    <div className="flex flex-col gap-6">
      <header className="hud-glass rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="hud-label">{t('store.title')}</p>
            <h1 className="text-2xl tone-primary">{t('store.title')}</h1>
            <p className="text-sm tone-muted">{t('store.subtitle')}</p>
          </div>
        </div>
      </header>

      <form className="hud-panel flex flex-wrap items-center gap-3 rounded-xl p-5" onSubmit={onSearch}>
        <input
          className="input-hud flex-1"
          type="text"
          placeholder={t('store.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="hud-label">{t('store.region')}</span>
        <select
          className="btn-soft text-sm"
          value={region}
          onChange={(event) => {
            const value = event.target.value
            setRegion(value)
            localStorage.setItem('storeRegion', value)
          }}
        >
          <option value="DE">DE</option>
          <option value="US">US</option>
          <option value="GB">UK</option>
          <option value="FR">FR</option>
          <option value="ES">ES</option>
          <option value="IT">IT</option>
          <option value="NL">NL</option>
          <option value="PL">PL</option>
          <option value="SE">SE</option>
          <option value="NO">NO</option>
          <option value="FI">FI</option>
          <option value="DK">DK</option>
          <option value="CA">CA</option>
          <option value="AU">AU</option>
        </select>
        <button type="submit" className="btn-primary" disabled={loading}>
          {t('store.search')}
        </button>
      </form>

      {error && <div className="text-sm text-red-400">Fehler: {error}</div>}

      {hasSearched && !loading && results.length === 0 && <div className="text-sm tone-muted">{t('store.empty')}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((game) => (
          <div
            key={game.id}
            className={`flex flex-col gap-4 rounded-xl border p-4 ${
              selected?.id === game.id ? 'border-ember/70 bg-panel/90' : 'border-neon/15 bg-panel/60'
            }`}
          >
            <div>
              <p className="hud-label">Search hit</p>
              <div className="text-lg tone-primary">{game.title}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => onCompare(game)} disabled={loading}>
                {selected?.id === game.id && loading ? '...' : t('store.compare')}
              </button>
              {wishlistIds.has(game.id) ? (
                <button className="btn-ghost" onClick={() => removeItem(game.id)}>
                  {t('store.wishlist.remove')}
                </button>
              ) : (
                <button className="btn-ghost" onClick={() => addItem({ id: game.id, title: game.title })}>
                  {t('store.wishlist.add')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="hud-panel rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="hud-label">{t('store.wishlist.title')}</p>
            <h2 className="text-xl tone-primary">{t('store.wishlist.title')}</h2>
            <div className="text-xs tone-muted">{t('store.wishlist.lastChecked', { date: lastCheckedLabel })}</div>
          </div>
          <button className="btn-primary" onClick={() => void checkPrices()} disabled={checking || items.length === 0}>
            {checking ? t('store.wishlist.checking') : t('store.wishlist.checkNow')}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="tone-muted">{t('store.wishlist.notifications')}</span>
            <button
              className="btn-ghost"
              onClick={() => (notificationsEnabled ? disableNotifications() : void enableNotifications())}
              disabled={!notificationsSupported}
            >
              {notificationsEnabled ? t('store.wishlist.disable') : t('store.wishlist.enable')}
            </button>
            {!notificationsSupported && <span className="text-xs tone-muted">{t('store.wishlist.notSupported')}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="tone-muted">{t('store.wishlist.onedrive')}</span>
            {onedriveStatus === 'connected' ? (
              <button className="btn-ghost" onClick={() => void disconnectOnedrive()}>
                {t('store.wishlist.disconnect')}
              </button>
            ) : onedriveStatus === 'permission-required' ? (
              <button className="btn-ghost" onClick={() => void requestOnedriveAccess()}>
                {t('store.wishlist.grant')}
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => void connectOnedrive()} disabled={!onedriveSupported}>
                {t('store.wishlist.connect')}
              </button>
            )}
            {!onedriveSupported && <span className="text-xs tone-muted">{t('store.wishlist.notSupported')}</span>}
            {onedriveSupported && onedriveStatus === 'connected' && (
              <span className="text-xs text-neon/80">{t('store.wishlist.connected')}</span>
            )}
          </div>
        </div>

        {items.length === 0 && <div className="mt-4 text-sm tone-muted">{t('store.wishlist.empty')}</div>}

        {items.length > 0 && (
          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neon/10 bg-black/20 p-4">
                <div className="flex flex-col gap-2">
                  <div className="text-base tone-primary">{item.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs tone-muted">
                    <span>
                      {item.lastPrice !== undefined
                        ? formatPrice({ amount: item.lastPrice, currency: item.currency })
                        : '-'}
                    </span>
                    {item.onSale && <span className="chip border-ember/40 text-ember">{t('store.wishlist.onSale')}</span>}
                    {item.belowThreshold && (
                      <span className="chip border-neon/40 text-neon">{t('store.wishlist.belowTarget')}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder={t('store.wishlist.targetPlaceholder')}
                    value={item.threshold ?? ''}
                    onChange={(event) =>
                      updateThreshold(item.id, event.target.value ? Number(event.target.value) : null)
                    }
                    className="input-hud w-32"
                  />
                  <button className="btn-ghost" onClick={() => removeItem(item.id)}>
                    {t('store.wishlist.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="mt-6 rounded-lg border border-neon/15 bg-black/20 p-4">
            <div className="hud-label">{t('store.wishlist.alerts')}</div>
          <div className="mt-2 flex flex-col gap-2 text-xs tone-muted">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4">
                <span>{alert.message}</span>
                  <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="hud-panel rounded-xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="hud-label">{t('store.compare')}</p>
              <h2 className="text-xl tone-primary">{selected.title}</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
              <div className="hud-label">{t('store.steam')}</div>
              <div className="text-2xl tone-primary">{formatPrice(steamBest?.price)}</div>
              {steamBest?.cut && steamBest.cut > 0 && <div className="text-sm text-ember">-{steamBest.cut}%</div>}
              {steamBest?.url && (
                <a className="btn-ghost mt-3 inline-flex" href={steamBest.url} target="_blank" rel="noreferrer">
                  {t('store.offer')}
                </a>
              )}
            </div>
            <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
              <div className="hud-label">{t('store.epic')}</div>
              <div className="text-2xl tone-primary">{formatPrice(epicBest?.price)}</div>
              {epicBest?.cut && epicBest.cut > 0 && <div className="text-sm text-ember">-{epicBest.cut}%</div>}
              {epicBest?.url && (
                <a className="btn-ghost mt-3 inline-flex" href={epicBest.url} target="_blank" rel="noreferrer">
                  {t('store.offer')}
                </a>
              )}
            </div>
            <div className="rounded-lg border border-ember/40 bg-black/30 p-4 shadow-ember">
              <div className="hud-label">{t('store.cheapest')}</div>
              <div className="text-2xl tone-primary">{formatPrice(overallBest?.price)}</div>
              {overallBest?.shop?.name && <div className="text-sm tone-muted">{overallBest.shop.name}</div>}
              {overallBest?.url && (
                <a className="btn-primary mt-3 inline-flex" href={overallBest.url} target="_blank" rel="noreferrer">
                  {t('store.offer')}
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
