import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import UiCorners from '../components/ui/UiCorners'
import StoreComparePanel from '../features/store/components/StoreComparePanel'
import StoreSearchForm from '../features/store/components/StoreSearchForm'
import StoreSearchResults from '../features/store/components/StoreSearchResults'
import WishlistSection from '../features/store/components/WishlistSection'
import { useSteamWishlistSync } from '../features/store/hooks/useSteamWishlistSync'
import { searchItad, getItadPrices } from '../services/api'
import { useI18n } from '../i18n/i18n'
import { APP_EVENTS, onAppEvent } from '../shared/events'
import { STORAGE_KEYS } from '../shared/storage/keys'
import { getLocalString, setLocalJSON, setLocalString } from '../shared/storage/storage'
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
  const [region, setRegion] = useState(() => getLocalString(STORAGE_KEYS.app.storeRegion) || 'DE')
  const [scanning, setScanning] = useState(false)
  const [telemetryKey, setTelemetryKey] = useState('store.telemetry.lockingMarket')
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [counters, setCounters] = useState(() => loadCounters())
  const [priceCache, setPriceCache] = useState<Record<string, { steam?: number; epic?: number; currency?: string }>>({})
  const [showWishlist, setShowWishlist] = useState(() => getLocalString(STORAGE_KEYS.app.showWishlist) !== 'false')
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
  const { wishlistSyncing, onSyncSteamWishlist } = useSteamWishlistSync({
    steamId: steamAuth.steamId,
    items,
    addItem,
    checkPrices,
    setError,
    pushLog,
    t,
  })

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
    return onAppEvent(APP_EVENTS.missionUpdate, handler)
  }, [])

  useEffect(() => {
    setLocalJSON(STORAGE_KEYS.app.priceCache, priceCache)
  }, [priceCache])

  useEffect(() => {
    setLocalString(STORAGE_KEYS.app.showWishlist, showWishlist ? 'true' : 'false')
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
          <UiCorners />
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

      <StoreSearchForm
        query={query}
        region={region}
        loading={loading}
        onQueryChange={setQuery}
        onRegionChange={(value) => {
          setRegion(value)
          setLocalString(STORAGE_KEYS.app.storeRegion, value)
          pushLog(`REGION SET -> ${value}`)
        }}
        onSubmit={onSearch}
      />

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
        <StoreSearchResults
          results={results}
          selectedId={selected?.id}
          loading={loading}
          priceCache={priceCache}
          wishlistIds={wishlistIds}
          onCompare={onCompare}
          onRemoveWishlist={(game) => {
            removeItem(game.id)
            pushLog(`WATCHLIST: REMOVE -> ${game.title}`)
          }}
          onAddWishlist={(game) => {
            addItem({ id: game.id, title: game.title })
            award(15, 10)
            pushLog(`WATCHLIST: ADD -> ${game.title}`)
          }}
        />
      </div>

      {selected && (
        <StoreComparePanel
          sectionRef={compareRef}
          selected={selected}
          steamBest={steamBest}
          epicBest={epicBest}
          overallBest={overallBest}
        />
      )}

      {showWishlist && (
        <WishlistSection
          sectionRef={wishlistRef}
          steamLoggedIn={steamAuth.isLoggedIn}
          wishlistSyncing={wishlistSyncing}
          checking={checking}
          items={items}
          sortedItems={sortedWishlistItems}
          alerts={alerts}
          lastCheckedLabel={lastCheckedLabel}
          onSyncSteamWishlist={onSyncSteamWishlist}
          onCheckNow={onPing}
          onUpdateThreshold={updateThreshold}
          onRemove={(id, title) => {
            removeItem(id)
            pushLog(`WATCHLIST: REMOVE -> ${title}`)
          }}
        />
      )}

    </div>
  )
}


