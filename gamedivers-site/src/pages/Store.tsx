import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
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
  const [logs, setLogs] = useState<string[]>([])
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
  const pushLog = useCallback((entry: string) => {
    setLogs((prev) => [entry, ...prev].slice(0, 4))
  }, [])

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
      pushLog(`SCAN COMPLETE: ${normalized.length} RESULTS`)
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
    pushLog(`UPLINK COMPARE: ${game.title}`)
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

  const onPing = async () => {
    pushLog('PING UPLINK: START')
    await checkPrices()
    pushLog('PING UPLINK: COMPLETE')
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
      <header className="term-frame term-frame--orange">
        <div className="term-panel rounded-[15px] p-6">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="term-label">{t('store.title')}</div>
          <h1 className="mt-3 text-2xl tone-primary">{t('store.title')}</h1>
          <p className="mt-2 text-sm term-subtle">{t('store.subtitle')}</p>
        </div>
      </header>

      <section className="term-frame">
        <div className="term-panel rounded-[15px] p-4">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="term-chip">SHIP: AIO-01</span>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
                UPLINK
                <div className="term-meter" style={{ '--term-meter': '70%' } as CSSProperties} />
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
                POWER
                <div className="term-meter" style={{ '--term-meter': '82%' } as CSSProperties} />
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
                HULL
                <div className="term-meter" style={{ '--term-meter': '64%' } as CSSProperties} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="term-chip">REGION: {region}</span>
              <span className="term-chip">
                <span className="term-signal" />
                LINK: STABLE
              </span>
            </div>
          </div>
        </div>
      </section>

      <form className="term-frame" onSubmit={onSearch}>
        <div className="term-panel flex flex-wrap items-center gap-3 rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <input
            className="term-console flex-1"
            type="text"
            placeholder={t('store.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="term-label">{t('store.region')}</span>
          <select
            className="term-select"
            value={region}
            onChange={(event) => {
              const value = event.target.value
              setRegion(value)
              localStorage.setItem('storeRegion', value)
              pushLog(`UPLINK: REGION SET -> ${value}`)
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
          <button type="submit" className="term-btn-primary" disabled={loading}>
            {t('store.search')}
          </button>
        </div>
      </form>

      <div className="term-panel rounded-[15px] p-4">
        <div className="term-label">NAV TELEMETRY</div>
        <div className="mt-3 flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.2em] text-white/50">
          <span>RESULTS: {hasSearched ? results.length : 0}</span>
          <span>WATCHLIST LAST PING: {lastCheckedLabel}</span>
          <span>SELECTED: {selected?.title ? 'LOCKED' : 'NONE'}</span>
        </div>
      </div>

      {error && <div className="text-sm text-red-400">Fehler: {error}</div>}

      {hasSearched && !loading && results.length === 0 && <div className="text-sm term-subtle">{t('store.empty')}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((game) => (
          <div key={game.id} className={`term-frame ${selected?.id === game.id ? 'term-frame--orange' : ''}`}>
            <div className="term-panel rounded-[15px] p-4">
              <div className="term-corners">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div>
                <p className="term-label">SEARCH HIT</p>
                <div className="text-lg tone-primary">{game.title}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="term-btn-primary" onClick={() => onCompare(game)} disabled={loading}>
                  {selected?.id === game.id && loading ? '...' : t('store.compare')}
                </button>
                {wishlistIds.has(game.id) ? (
                  <button
                    className="term-btn-secondary"
                    onClick={() => {
                      removeItem(game.id)
                      pushLog(`WATCHLIST: JETTISON -> ${game.title}`)
                    }}
                  >
                    {t('store.wishlist.remove')}
                  </button>
                ) : (
                  <button
                    className="term-btn-secondary"
                    onClick={() => {
                      addItem({ id: game.id, title: game.title })
                      pushLog(`WATCHLIST: ADD -> ${game.title}`)
                    }}
                  >
                    {t('store.wishlist.add')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="term-frame">
        <div className="term-panel rounded-[15px] p-6">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="term-label">{t('store.wishlist.title')}</p>
            <h2 className="text-xl tone-primary">{t('store.wishlist.title')}</h2>
            <div className="text-xs term-subtle">{t('store.wishlist.lastChecked', { date: lastCheckedLabel })}</div>
          </div>
          <button className="term-btn-primary" onClick={onPing} disabled={checking || items.length === 0}>
            {checking ? t('store.wishlist.checking') : t('store.wishlist.checkNow')}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="term-subtle">{t('store.wishlist.notifications')}</span>
            <button
              className="term-btn-secondary"
              onClick={() => (notificationsEnabled ? disableNotifications() : void enableNotifications())}
              disabled={!notificationsSupported}
            >
              {notificationsEnabled ? t('store.wishlist.disable') : t('store.wishlist.enable')}
            </button>
            {!notificationsSupported && <span className="text-xs term-subtle">{t('store.wishlist.notSupported')}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="term-subtle">{t('store.wishlist.onedrive')}</span>
            {onedriveStatus === 'connected' ? (
              <button className="term-btn-secondary" onClick={() => void disconnectOnedrive()}>
                {t('store.wishlist.disconnect')}
              </button>
            ) : onedriveStatus === 'permission-required' ? (
              <button className="term-btn-secondary" onClick={() => void requestOnedriveAccess()}>
                {t('store.wishlist.grant')}
              </button>
            ) : (
              <button className="term-btn-secondary" onClick={() => void connectOnedrive()} disabled={!onedriveSupported}>
                {t('store.wishlist.connect')}
              </button>
            )}
            {!onedriveSupported && <span className="text-xs term-subtle">{t('store.wishlist.notSupported')}</span>}
            {onedriveSupported && onedriveStatus === 'connected' && <span className="term-chip">{t('store.wishlist.connected')}</span>}
          </div>
        </div>

        {items.length === 0 && <div className="mt-4 text-sm term-subtle">{t('store.wishlist.empty')}</div>}

        {items.length > 0 && (
          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neon/10 bg-black/20 p-4">
                <div className="flex flex-col gap-2">
                  <div className="text-base tone-primary">{item.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs term-subtle">
                    <span>
                      {item.lastPrice !== undefined
                        ? formatPrice({ amount: item.lastPrice, currency: item.currency })
                        : '-'}
                    </span>
                    {item.onSale && <span className="term-chip border-ember/40 text-ember">{t('store.wishlist.onSale')}</span>}
                    {item.belowThreshold && (
                      <span className="term-chip border-neon/40 text-neon">{t('store.wishlist.belowTarget')}</span>
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
                    className="term-console w-32"
                  />
                  <button
                    className="term-btn-secondary"
                    onClick={() => {
                      removeItem(item.id)
                      pushLog(`WATCHLIST: JETTISON -> ${item.title}`)
                    }}
                  >
                    {t('store.wishlist.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="mt-6 rounded-lg border border-neon/15 bg-black/20 p-4">
            <div className="term-label">{t('store.wishlist.alerts')}</div>
            <div className="mt-2 flex flex-col gap-2 text-xs term-subtle">
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

      {selected && (
        <section className="term-frame term-frame--orange">
          <div className="term-panel rounded-[15px] p-6">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="term-label">{t('store.compare')}</p>
                <h2 className="text-xl tone-primary">{selected.title}</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
                <div className="term-label">{t('store.steam')}</div>
                <div className="text-2xl tone-primary">{formatPrice(steamBest?.price)}</div>
                {steamBest?.cut && steamBest.cut > 0 && <div className="text-sm text-ember">-{steamBest.cut}%</div>}
                {steamBest?.url && (
                  <a className="term-btn-secondary mt-3 inline-flex" href={steamBest.url} target="_blank" rel="noreferrer">
                    {t('store.offer')}
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
                <div className="term-label">{t('store.epic')}</div>
                <div className="text-2xl tone-primary">{formatPrice(epicBest?.price)}</div>
                {epicBest?.cut && epicBest.cut > 0 && <div className="text-sm text-ember">-{epicBest.cut}%</div>}
                {epicBest?.url && (
                  <a className="term-btn-secondary mt-3 inline-flex" href={epicBest.url} target="_blank" rel="noreferrer">
                    {t('store.offer')}
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-ember/40 bg-black/30 p-4 shadow-ember">
                <div className="term-label">{t('store.cheapest')}</div>
                <div className="text-2xl tone-primary">{formatPrice(overallBest?.price)}</div>
                {overallBest?.shop?.name && <div className="text-sm tone-muted">{overallBest.shop.name}</div>}
                {overallBest?.url && (
                  <a className="term-btn-primary mt-3 inline-flex" href={overallBest.url} target="_blank" rel="noreferrer">
                    {t('store.offer')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="term-frame">
        <div className="term-panel rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="term-label">SYSTEM LOG</div>
          <div className="mt-3 flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
            {logs.length === 0 && <span>NO RECENT EVENTS</span>}
            {logs.map((entry, index) => (
              <span key={`${entry}-${index}`}>{entry}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
