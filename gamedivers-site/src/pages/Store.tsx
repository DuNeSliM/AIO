import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { searchItad, getItadPrices } from '../services/api'
import { useI18n } from '../i18n/i18n'
import type { ItadDeal, ItadPrice, ItadPricesResponse, ItadSearchItem } from '../types'
import { useWishlist } from '../hooks/useWishlist'
import {
  addEventLog,
  award,
  loadCounters,
  loadMissionProgress,
  recordScan,
  recordSync,
  saveMissionProgress,
} from '../utils/gameify'

function formatPrice(price?: ItadPrice) {
  if (!price) return '-'
  const amount = typeof price.amount === 'number' ? price.amount : price.amountInt ? price.amountInt / 100 : 0
  const currency = price.currency || 'EUR'
  return `${amount.toFixed(2)} ${currency}`
}

function getAmount(price?: ItadPrice): number | null {
  if (!price) return null
  if (typeof price.amount === 'number') return price.amount
  if (typeof price.amountInt === 'number') return price.amountInt / 100
  return null
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
  const [scanning, setScanning] = useState(false)
  const [telemetry, setTelemetry] = useState('LOCKING MARKET')
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [counters, setCounters] = useState(() => loadCounters())
  const [missionProgress, setMissionProgress] = useState(() => loadMissionProgress().progress)
  const [priceCache, setPriceCache] = useState<Record<string, { steam?: number; epic?: number; currency?: string }>>({})
  const [showWishlist, setShowWishlist] = useState(() => localStorage.getItem('showWishlist') !== 'false')
  const {
    items,
    addItem,
    removeItem,
    updateThreshold,
    alerts,
    checking,
    lastCheckedAt,
    checkPrices,
  } = useWishlist(region)

  const wishlistIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const lastCheckedLabel = lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : t('store.wishlist.never')
  const pushLog = useCallback((entry: string) => addEventLog(entry), [])
  const compareRef = useRef<HTMLDivElement | null>(null)
  const wishlistRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(media.matches)
    const handler = (event: MediaQueryListEvent) => setPrefersReduced(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      setCounters(loadCounters())
      setMissionProgress(loadMissionProgress().progress)
    }
    window.addEventListener('mission-update', handler)
    return () => window.removeEventListener('mission-update', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('priceCache', JSON.stringify(priceCache))
  }, [priceCache])

  useEffect(() => {
    localStorage.setItem('showWishlist', showWishlist ? 'true' : 'false')
  }, [showWishlist])

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSelected(null)
    setPrices(null)
    setHasSearched(true)
    award(10, 5)
    recordScan()
    pushLog('SEARCH STARTED')
    const telemetryOptions = ['LOCKING MARKET', 'SCANNING STORES', 'CALIBRATING LINKS', 'PINGING MARKET']
    setTelemetry(telemetryOptions[Math.floor(Math.random() * telemetryOptions.length)] ?? 'LOCKING MARKET')
    setScanning(true)
    const started = Date.now()
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
      pushLog(`SEARCH COMPLETE: ${normalized.length} RESULTS`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      const elapsed = Date.now() - started
      if (!prefersReduced && elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed))
      }
      setScanning(false)
      setLoading(false)
    }
  }

  const onCompare = async (game: ItadSearchItem) => {
    setSelected(game)
    setLoading(true)
    setError(null)
    pushLog(`COMPARE: ${game.title}`)
    try {
      const data = await getItadPrices(game.id, region)
      setPrices(data)
      const priceItem = Array.isArray(data) ? data.find((item) => item.id === game.id) : data?.games?.[game.id]
      const deals = priceItem?.deals || []
      const steamDeals = deals.filter((deal) => deal?.shop?.name?.toLowerCase()?.includes('steam'))
      const epicDeals = deals.filter((deal) => deal?.shop?.name?.toLowerCase()?.includes('epic'))
      const steamBest = pickLowestDeal(steamDeals)
      const epicBest = pickLowestDeal(epicDeals)
      const steamAmount = steamBest?.price ? getAmount(steamBest.price) : null
      const epicAmount = epicBest?.price ? getAmount(epicBest.price) : null
      setPriceCache((prev) => ({
        ...prev,
        [game.id]: {
          steam: steamAmount ?? undefined,
          epic: epicAmount ?? undefined,
          currency: steamBest?.price?.currency || epicBest?.price?.currency,
        },
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selected || !compareRef.current) return
    compareRef.current.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
  }, [selected, prefersReduced])

  const onPing = async () => {
    pushLog('WATCHLIST SYNC: START')
    award(10, 0)
    recordSync()
    await checkPrices()
    pushLog('WATCHLIST SYNC: COMPLETE')
  }

  useEffect(() => {
    const progress = loadMissionProgress().progress
    let updated = { ...progress }
    let completed = false

    if (!progress.scans && counters.scans >= 3) {
      updated.scans = true
      award(25, 20)
      pushLog('REWARD EARNED: SEARCH RUNNER')
      completed = true
    }

    if (!progress.cargo && items.length >= 5) {
      updated.cargo = true
      award(30, 30)
      pushLog('REWARD EARNED: WATCHLIST TRACKER')
      completed = true
    }

    if (!progress.launch && counters.launchUnplayed >= 1) {
      updated.launch = true
      award(40, 35)
      pushLog('REWARD EARNED: FIRST LAUNCH')
      completed = true
    }

    if (!progress.sync && counters.syncs >= 1) {
      updated.sync = true
      award(20, 10)
      pushLog('REWARD EARNED: WATCHLIST SYNC')
      completed = true
    }

    if (completed) {
      saveMissionProgress(updated)
      setMissionProgress(updated)
    }
  }, [counters, items.length, pushLog])

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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="term-label">{t('store.title')}</div>
              <h1 className="mt-3 text-2xl tone-primary">{t('store.title')}</h1>
              <p className="mt-2 text-sm term-subtle">{t('store.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="term-btn-secondary"
                onClick={() => setShowWishlist((prev) => !prev)}
              >
                {showWishlist ? 'Hide wishlist' : 'Show wishlist'}
              </button>
              <button
                className="term-btn-secondary"
                onClick={() => wishlistRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' })}
              >
                Jump to wishlist
              </button>
            </div>
          </div>
        </div>
      </header>

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
              pushLog(`REGION SET -> ${value}`)
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

      {error && <div className="text-sm text-red-400">Fehler: {error}</div>}

      {hasSearched && !loading && results.length === 0 && <div className="text-sm term-subtle">{t('store.empty')}</div>}

      <div className="relative">
        {scanning && (
          <div className="term-scanOverlay">
            <div className="term-scanline" />
            <span>{telemetry}</span>
            {(prefersReduced || scanning) && (
              <button className="term-btn-secondary" onClick={() => setScanning(false)}>
                SKIP
              </button>
            )}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((game) => {
            const cache = priceCache[game.id]
            const hasBoth = typeof cache?.steam === 'number' && typeof cache?.epic === 'number'
            const steamCheaper = hasBoth && (cache?.steam ?? 0) < (cache?.epic ?? 0)
            const epicCheaper = hasBoth && (cache?.epic ?? 0) < (cache?.steam ?? 0)
            const diff = hasBoth ? Math.abs((cache?.steam ?? 0) - (cache?.epic ?? 0)) : 0
            const currency = cache?.currency ? ` ${cache.currency}` : ''
            const banner = steamCheaper
              ? `BEST PRICE: STEAM (-${diff.toFixed(2)}${currency})`
              : epicCheaper
                ? `BEST PRICE: EPIC (-${diff.toFixed(2)}${currency})`
                : ''

            return (
              <div key={game.id} className={`term-frame ${selected?.id === game.id ? 'term-frame--orange' : ''}`}>
                <div className="term-panel rounded-[15px] p-4">
                  <div className="term-corners">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  {banner && <div className="term-banner">{banner}</div>}
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
                          pushLog(`WATCHLIST: REMOVE -> ${game.title}`)
                        }}
                      >
                        {t('store.wishlist.remove')}
                      </button>
                    ) : (
                      <button
                        className="term-btn-secondary"
                        onClick={() => {
                          addItem({ id: game.id, title: game.title })
                          award(15, 10)
                          pushLog(`WATCHLIST: ADD -> ${game.title}`)
                        }}
                      >
                        {t('store.wishlist.add')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <section className="term-frame term-frame--orange" ref={compareRef}>
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

      {showWishlist && (
        <section className="term-frame" ref={wishlistRef}>
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

          {items.length === 0 && <div className="mt-4 text-sm term-subtle">{t('store.wishlist.empty')}</div>}

          {items.length > 0 && (
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neon/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-base tone-primary">{item.title}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs term-subtle">
                      <span>
                        {item.lastPrice !== undefined
                          ? formatPrice({ amount: item.lastPrice, currency: item.currency })
                          : '-'}
                      </span>
                      {item.onSale && (
                        <span className="term-chip border-ember/40 text-ember">{t('store.wishlist.onSale')}</span>
                      )}
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
                        pushLog(`WATCHLIST: REMOVE -> ${item.title}`)
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
      )}

    </div>
  )
}
