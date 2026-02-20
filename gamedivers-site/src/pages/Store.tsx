import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { searchItad, getItadPrices, fetchSteamWishlist, syncSteamWishlistToBackend } from '../services/api'
import { useI18n } from '../i18n/i18n'
import type { ItadDeal, ItadPrice, ItadPricesResponse, ItadSearchItem } from '../types'
import { useWishlist } from '../hooks/useWishlist'
import { useSteamAuth } from '../hooks/useSteamAuth'
import {
  addEventLog,
  award,
  loadCounters,
  recordCompare,
  recordScan,
  recordSync,
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

function defaultSteamCapsuleUrl(appId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`
}

function backupSteamHeaderUrl(appId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
}

const STEAM_NAME_CACHE_KEY = 'steamWishlistNameCache'

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isSteamPlaceholderTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return true
  return /^app\s+\d+$/.test(normalized) || /^steam app\s+\d+$/.test(normalized) || /^steam:\d+$/.test(normalized) || /^\d+$/.test(normalized)
}

function pickBestItadMatch(queryTitle: string, candidates: ItadSearchItem[]): ItadSearchItem | null {
  if (!candidates.length) return null
  const queryKey = normalizeTitleKey(queryTitle)
  if (!queryKey) return candidates[0] ?? null

  const exact = candidates.find((item) => normalizeTitleKey(item.title) === queryKey)
  if (exact) return exact

  const contains = candidates.find((item) => {
    const candidateKey = normalizeTitleKey(item.title)
    return candidateKey.includes(queryKey) || queryKey.includes(candidateKey)
  })
  return contains ?? candidates[0] ?? null
}

function readSteamNameCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STEAM_NAME_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

function writeSteamNameCache(cache: Record<string, string>): void {
  try {
    localStorage.setItem(STEAM_NAME_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore storage write failures
  }
}

function isNumeric(text: string): boolean {
  return /^\d+$/.test(text.trim())
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
  const [telemetryKey, setTelemetryKey] = useState('store.telemetry.lockingMarket')
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [counters, setCounters] = useState(() => loadCounters())
  const [priceCache, setPriceCache] = useState<Record<string, { steam?: number; epic?: number; currency?: string }>>({})
  const [showWishlist, setShowWishlist] = useState(() => localStorage.getItem('showWishlist') !== 'false')
  const [wishlistSyncing, setWishlistSyncing] = useState(false)
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
  const steamAuth = useSteamAuth()

  const wishlistIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const sortedWishlistItems = useMemo(() => {
    const score = (item: (typeof items)[number]) =>
      (item.belowThreshold ? 4 : 0) + (item.onSale ? 2 : 0) + ((item.dealsTop3?.length ?? 0) > 0 ? 1 : 0)
    return [...items].sort((a, b) => {
      const scoreDiff = score(b) - score(a)
      if (scoreDiff !== 0) return scoreDiff
      return (b.addedAt ?? 0) - (a.addedAt ?? 0)
    })
  }, [items])
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
    const telemetryOptions = [
      'store.telemetry.lockingMarket',
      'store.telemetry.scanningStores',
      'store.telemetry.calibratingLinks',
      'store.telemetry.pingingMarket',
    ]
    setTelemetryKey(telemetryOptions[Math.floor(Math.random() * telemetryOptions.length)] ?? 'store.telemetry.lockingMarket')
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
    recordCompare()
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

  const onSyncSteamWishlist = async () => {
    if (!steamAuth.steamId) {
      setError(t('store.wishlist.loginRequired'))
      return
    }
    setWishlistSyncing(true)
    setError(null)
    try {
      const steamItems = await fetchSteamWishlist(steamAuth.steamId)
      const sorted = [...steamItems].sort((a, b) => (a.added ?? 0) - (b.added ?? 0))
      const titleLookupCache = new Map<string, ItadSearchItem | null>()
      const steamNameCache = readSteamNameCache()
      let steamNameCacheDirty = false
      const existingBySteamAppId = new Map<number, (typeof items)[number]>()
      for (const existing of items) {
        if (typeof existing.steamAppId === 'number' && existing.steamAppId > 0) {
          existingBySteamAppId.set(existing.steamAppId, existing)
        }
      }

      const resolveItadMatch = async (query: string, expectedTitle?: string): Promise<ItadSearchItem | null> => {
        const key = normalizeTitleKey(query)
        if (!key) return null
        if (titleLookupCache.has(key)) return titleLookupCache.get(key) ?? null

        try {
          const data = await searchItad(query, 6)
          const candidates = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.results)
                ? data.results
                : []

          let match: ItadSearchItem | null
          if (expectedTitle && !isSteamPlaceholderTitle(expectedTitle)) {
            match = pickBestItadMatch(expectedTitle, candidates)
          } else if (isNumeric(query)) {
            match = candidates.length === 1 ? candidates[0] ?? null : null
          } else if (isSteamPlaceholderTitle(query)) {
            match = null
          } else {
            match = pickBestItadMatch(query, candidates)
          }

          titleLookupCache.set(key, match)
          return match
        } catch {
          titleLookupCache.set(key, null)
          return null
        }
      }

      const appIds: number[] = []
      for (const item of sorted) {
        const appId = item.appId
        const cachedSteamName = steamNameCache[String(appId)]?.trim() ?? ''
        const rawSteamTitle = item.name?.trim() || cachedSteamName
        const existing = existingBySteamAppId.get(appId)

        let resolvedItadId = existing?.itadId
        let resolvedTitle = existing?.title?.trim() || rawSteamTitle

        if (!resolvedItadId && existing?.source === 'itad' && !existing.id.startsWith('steam:')) {
          resolvedItadId = existing.id
        }

        let match: ItadSearchItem | null = null
        if (!resolvedItadId && rawSteamTitle && !isSteamPlaceholderTitle(rawSteamTitle)) {
          match = await resolveItadMatch(rawSteamTitle, rawSteamTitle)
          resolvedItadId = match?.id
          if (match?.title?.trim()) {
            resolvedTitle = match.title.trim()
          }
        }

        if (!resolvedItadId && (!resolvedTitle || isSteamPlaceholderTitle(resolvedTitle))) {
          match = await resolveItadMatch(String(appId))
          resolvedItadId = match?.id
          if (match?.title?.trim()) {
            resolvedTitle = match.title.trim()
          }
        }

        if (!resolvedTitle || isSteamPlaceholderTitle(resolvedTitle)) {
          resolvedTitle = rawSteamTitle && !isSteamPlaceholderTitle(rawSteamTitle)
            ? rawSteamTitle
            : `Steam App ${appId}`
        }

        if (!isSteamPlaceholderTitle(resolvedTitle)) {
          if (steamNameCache[String(appId)] !== resolvedTitle) {
            steamNameCache[String(appId)] = resolvedTitle
            steamNameCacheDirty = true
          }
        }

        const image = item.capsule?.trim() || defaultSteamCapsuleUrl(appId)
        const targetID = resolvedItadId || `steam:${appId}`
        addItem({
          id: targetID,
          title: resolvedTitle,
          image,
          imageBackup: backupSteamHeaderUrl(appId),
          source: resolvedItadId ? 'itad' : 'steam',
          steamAppId: appId,
          itadId: resolvedItadId,
          addedAt: item.added ? item.added * 1000 : Date.now(),
        })
        appIds.push(appId)
      }
      if (steamNameCacheDirty) {
        writeSteamNameCache(steamNameCache)
      }
      try {
        await syncSteamWishlistToBackend(appIds)
      } catch (backendError) {
        console.error('Failed to sync Steam wishlist to backend:', backendError)
      }
      pushLog(`STEAM WISHLIST SYNC: ${steamItems.length} ITEMS`)
      window.setTimeout(() => {
        void checkPrices()
      }, 150)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'steam-private') {
        setError(t('store.wishlist.steamPrivate'))
      } else if (message === 'steam-wishlist-blocked') {
        setError(t('store.wishlist.steamBlocked'))
      } else {
        setError(message)
      }
    } finally {
      setWishlistSyncing(false)
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
      <header className="ui-surface ui-surface--accent">
        <div className="ui-panel ui-panel-pad-lg">
          <div className="ui-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="ui-label">{t('store.title')}</div>
              <h1 className="mt-3 text-2xl tone-primary">{t('store.title')}</h1>
              <p className="mt-2 text-sm ui-subtle">{t('store.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="ui-btn-secondary"
                onClick={() => setShowWishlist((prev) => !prev)}
              >
                {showWishlist ? t('store.wishlist.hide') : t('store.wishlist.show')}
              </button>
              <button
                className="ui-btn-secondary"
                onClick={() => wishlistRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' })}
              >
                {t('store.wishlist.jump')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <form className="ui-surface" onSubmit={onSearch}>
        <div className="ui-panel flex flex-wrap items-center gap-3 ui-panel-pad-md">
          <div className="ui-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <input
            className="ui-input flex-1"
            type="text"
            placeholder={t('store.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="ui-label">{t('store.region')}</span>
          <select
            className="ui-select"
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
          <button type="submit" className="ui-btn-primary" disabled={loading}>
            {t('store.search')}
          </button>
        </div>
      </form>

      {error && <div className="text-sm text-red-400">{t('store.errorPrefix')}: {error}</div>}

      {hasSearched && !loading && results.length === 0 && <div className="text-sm ui-subtle">{t('store.empty')}</div>}

      <div className="relative">
        {scanning && (
            <div className="ui-overlay">
              <div className="ui-scanline" />
              <span>{t(telemetryKey)}</span>
              {(prefersReduced || scanning) && (
                <button className="ui-btn-secondary" onClick={() => setScanning(false)}>
                  {t('store.skipScan')}
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
              ? t('store.bestPriceSteam', { diff: diff.toFixed(2), currency })
              : epicCheaper
                ? t('store.bestPriceEpic', { diff: diff.toFixed(2), currency })
                : ''

            return (
              <div key={game.id} className={`ui-surface ${selected?.id === game.id ? 'ui-surface--accent' : ''}`}>
                <div className="ui-panel ui-panel-pad-sm">
                  <div className="ui-corners">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  {banner && <div className="ui-banner">{banner}</div>}
                  <div>
                    <p className="ui-label">{t('store.searchHit')}</p>
                    <div className="text-lg tone-primary">{game.title}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="ui-btn-primary" onClick={() => onCompare(game)} disabled={loading}>
                      {selected?.id === game.id && loading ? '...' : t('store.compare')}
                    </button>
                    {wishlistIds.has(game.id) ? (
                      <button
                        className="ui-btn-secondary"
                        onClick={() => {
                          removeItem(game.id)
                          pushLog(`WATCHLIST: REMOVE -> ${game.title}`)
                        }}
                      >
                        {t('store.wishlist.remove')}
                      </button>
                    ) : (
                      <button
                        className="ui-btn-secondary"
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
        <section className="ui-surface ui-surface--accent" ref={compareRef}>
          <div className="ui-panel ui-panel-pad-lg">
            <div className="ui-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="ui-label">{t('store.compare')}</p>
                <h2 className="text-xl tone-primary">{selected.title}</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
                <div className="ui-label">{t('store.steam')}</div>
                <div className="text-2xl tone-primary">{formatPrice(steamBest?.price)}</div>
                {steamBest?.cut && steamBest.cut > 0 && <div className="text-sm text-ember">-{steamBest.cut}%</div>}
                {steamBest?.url && (
                  <a className="ui-btn-secondary mt-3 inline-flex" href={steamBest.url} target="_blank" rel="noreferrer">
                    {t('store.offer')}
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-neon/15 bg-black/20 p-4">
                <div className="ui-label">{t('store.epic')}</div>
                <div className="text-2xl tone-primary">{formatPrice(epicBest?.price)}</div>
                {epicBest?.cut && epicBest.cut > 0 && <div className="text-sm text-ember">-{epicBest.cut}%</div>}
                {epicBest?.url && (
                  <a className="ui-btn-secondary mt-3 inline-flex" href={epicBest.url} target="_blank" rel="noreferrer">
                    {t('store.offer')}
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-ember/40 bg-black/30 p-4 shadow-ember">
                <div className="ui-label">{t('store.cheapest')}</div>
                <div className="text-2xl tone-primary">{formatPrice(overallBest?.price)}</div>
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
      )}

      {showWishlist && (
        <section className="ui-surface" ref={wishlistRef}>
          <div className="ui-panel ui-panel-pad-lg">
            <div className="ui-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="ui-label">{t('store.wishlist.title')}</p>
              <h2 className="text-xl tone-primary">{t('store.wishlist.title')}</h2>
              <div className="text-xs ui-subtle">{t('store.wishlist.lastChecked', { date: lastCheckedLabel })}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {steamAuth.isLoggedIn && (
                <button className="ui-btn-secondary" onClick={onSyncSteamWishlist} disabled={wishlistSyncing}>
                  {wishlistSyncing ? '...' : t('store.wishlist.syncSteam')}
                </button>
              )}
              <button className="ui-btn-primary" onClick={onPing} disabled={checking || items.length === 0}>
                {checking ? t('store.wishlist.checking') : t('store.wishlist.checkNow')}
              </button>
            </div>
          </div>

          {items.length === 0 && <div className="mt-4 text-sm ui-subtle">{t('store.wishlist.empty')}</div>}

          {items.length > 0 && (
            <div className="mt-4 grid gap-3">
              {sortedWishlistItems.map((item) => {
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
                const cheapestDeal = item.dealsTop3?.[0]

                return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neon/10 bg-black/20 p-4"
                >
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
                            {item.lastPrice.toFixed(2)} {item.currency ?? 'EUR'}
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
                          {t('store.cheapest')}: {cheapestDeal.price.toFixed(2)} {cheapestDeal.currency ?? item.currency ?? 'EUR'}
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
                          updateThreshold(item.id, null)
                          return
                        }
                        const parsed = Number.parseFloat(raw)
                        updateThreshold(item.id, Number.isNaN(parsed) ? null : Math.max(0, parsed))
                      }}
                    />
                    <button
                      className="ui-btn-secondary"
                      onClick={() => {
                        removeItem(item.id)
                        pushLog(`WATCHLIST: REMOVE -> ${item.title}`)
                      }}
                    >
                      {t('store.wishlist.remove')}
                    </button>
                  </div>
                  {item.dealsTop3 && item.dealsTop3.length > 0 && (
                    <div className="w-full">
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {item.dealsTop3.map((deal, index) => (
                          <div
                            key={`${item.id}-${index}`}
                            className="rounded-lg border border-neon/10 bg-black/25 p-3"
                          >
                            <div className="text-xs ui-subtle">{deal.shop || t('store.wishlist.sourceUnknown')}</div>
                            <div className="text-lg tone-primary">
                              {typeof deal.price === 'number'
                                ? `${deal.price.toFixed(2)} ${deal.currency ?? ''}`
                                : '-'}
                            </div>
                            {deal.cut && deal.cut > 0 && <div className="text-xs text-ember">-{deal.cut}%</div>}
                            {deal.url && (
                              <a className="ui-btn-secondary mt-2 inline-flex" href={deal.url} target="_blank" rel="noreferrer">
                                {t('store.offer')}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )})}
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
      )}

    </div>
  )
}


