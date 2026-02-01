import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { searchItad, getItadPrices } from '../services/api'
import { useI18n } from '../i18n/i18n'
import type { ItadDeal, ItadPrice, ItadPricesResponse, ItadSearchItem } from '../types'
import { useWishlist } from '../hooks/useWishlist'
import {
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
  const [logs, setLogs] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [telemetry, setTelemetry] = useState('LOCKING UPLINK')
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [toasts, setToasts] = useState<string[]>([])
  const [counters, setCounters] = useState(() => loadCounters())
  const [missionProgress, setMissionProgress] = useState(() => loadMissionProgress().progress)
  const [priceCache, setPriceCache] = useState<Record<string, { steam?: number; epic?: number; currency?: string }>>({})
  const [wishlistMeta, setWishlistMeta] = useState<Record<string, { priority: string; mode: string }>>(() => {
    const raw = localStorage.getItem('wishlistMeta')
    if (!raw) return {}
    try {
      return JSON.parse(raw) as Record<string, { priority: string; mode: string }>
    } catch {
      return {}
    }
  })
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
  const pushToast = useCallback((entry: string) => {
    setToasts((prev) => [entry, ...prev].slice(0, 3))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item !== entry))
    }, 2400)
  }, [])

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
    pushLog('SCAN INITIATED')
    const telemetryOptions = ['LOCKING UPLINK', 'SCANNING NODES', 'CALIBRATING RELAY', 'PINGING MARKETS']
    setTelemetry(telemetryOptions[Math.floor(Math.random() * telemetryOptions.length)] ?? 'LOCKING UPLINK')
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
      pushLog(`SCAN COMPLETE: ${normalized.length} RESULTS`)
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
    pushLog(`UPLINK COMPARE: ${game.title}`)
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

  const onPing = async () => {
    pushLog('PING UPLINK: START')
    award(10, 0)
    recordSync()
    await checkPrices()
    pushLog('PING UPLINK: COMPLETE')
  }

  useEffect(() => {
    const progress = loadMissionProgress().progress
    let updated = { ...progress }
    let completed = false

    if (!progress.scans && counters.scans >= 3) {
      updated.scans = true
      award(25, 20)
      pushToast('REWARD ACQUIRED: SCAN RUNNER')
      completed = true
    }

    if (!progress.cargo && items.length >= 5) {
      updated.cargo = true
      award(30, 30)
      pushToast('REWARD ACQUIRED: CARGO TRACKER')
      completed = true
    }

    if (!progress.launch && counters.launchUnplayed >= 1) {
      updated.launch = true
      award(40, 35)
      pushToast('REWARD ACQUIRED: FIRST FLIGHT')
      completed = true
    }

    if (!progress.sync && counters.syncs >= 1) {
      updated.sync = true
      award(20, 10)
      pushToast('REWARD ACQUIRED: UPLINK SYNC')
      completed = true
    }

    if (completed) {
      saveMissionProgress(updated)
      setMissionProgress(updated)
    }
  }, [counters, items.length, pushToast])

  const updateMeta = (id: string, patch: { priority?: string; mode?: string }) => {
    setWishlistMeta((prev) => {
      const next = { ...prev, [id]: { priority: 'MED', mode: 'PASSIVE', ...(prev[id] || {}), ...patch } }
      localStorage.setItem('wishlistMeta', JSON.stringify(next))
      return next
    })
  }

  const factionSummary = useMemo(() => {
    let steam = 0
    let epic = 0
    Object.values(priceCache).forEach((entry) => {
      if (typeof entry.steam !== 'number' || typeof entry.epic !== 'number') return
      const diff = Math.abs(entry.steam - entry.epic)
      if (entry.steam < entry.epic) steam += diff
      if (entry.epic < entry.steam) epic += diff
    })
    return { steam, epic }
  }, [priceCache])

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

      <div className="term-frame">
        <div className="term-panel rounded-[15px] p-4">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="term-label">NAV TELEMETRY</div>
          <div className="mt-3 flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.2em] text-white/50">
            <span>RESULTS: {hasSearched ? results.length : 0}</span>
            <span>WATCHLIST LAST PING: {lastCheckedLabel}</span>
            <span>SELECTED: {selected?.title ? 'LOCKED' : 'NONE'}</span>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-400">Fehler: {error}</div>}

      {hasSearched && !loading && results.length === 0 && <div className="text-sm term-subtle">{t('store.empty')}</div>}

      {toasts.length > 0 && (
        <div className="flex flex-col gap-2">
          {toasts.map((toast) => (
            <div key={toast} className="term-toast">
              {toast}
            </div>
          ))}
        </div>
      )}

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
              ? `NODE ADVANTAGE: STEAM (-${diff.toFixed(2)}${currency})`
              : epicCheaper
                ? `NODE ADVANTAGE: EPIC (-${diff.toFixed(2)}${currency})`
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
            {items.map((item) => {
              const meta = wishlistMeta[item.id] || { priority: 'MED', mode: 'PASSIVE' }
              const signalValue = item.belowThreshold ? 90 : item.onSale ? 70 : 35
              return (
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
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
                      SIGNAL
                      <div className="term-meter" style={{ '--term-meter': `${signalValue}%` } as CSSProperties} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="term-select"
                      value={meta.priority}
                      onChange={(event) => updateMeta(item.id, { priority: event.target.value })}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MED">MED</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                    <button
                      className="term-btn-secondary"
                      onClick={() =>
                        updateMeta(item.id, { mode: meta.mode === 'PASSIVE' ? 'AGGRESSIVE' : 'PASSIVE' })
                      }
                    >
                      {meta.mode}
                    </button>
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
              )
            })}
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">MISSION BOARD</div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  id: 'scans',
                  label: 'RUN 3 SCANS',
                  progress: Math.min(counters.scans, 3),
                  target: 3,
                  reward: '+25 XP / +20 CR',
                  done: missionProgress.scans,
                },
                {
                  id: 'cargo',
                  label: 'TRACK 5 CARGO ITEMS',
                  progress: Math.min(items.length, 5),
                  target: 5,
                  reward: '+30 XP / +30 CR',
                  done: missionProgress.cargo,
                },
                {
                  id: 'launch',
                  label: 'LAUNCH 1 UNPLAYED TITLE',
                  progress: Math.min(counters.launchUnplayed, 1),
                  target: 1,
                  reward: '+40 XP / +35 CR',
                  done: missionProgress.launch,
                },
                {
                  id: 'sync',
                  label: 'SYNC UPLINK ONCE',
                  progress: Math.min(counters.syncs, 1),
                  target: 1,
                  reward: '+20 XP / +10 CR',
                  done: missionProgress.sync,
                },
              ].map((mission) => (
                <div key={mission.id} className="term-mission">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                    <span>{mission.label}</span>
                    <span>{mission.done ? 'COMPLETE' : mission.reward}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-white/50">
                    <div className="term-meter" style={{ '--term-meter': `${(mission.progress / mission.target) * 100}%` } as CSSProperties} />
                    <span>
                      {mission.progress}/{mission.target}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">WEEKLY FACTION REPORT</div>
            <div className="mt-4 flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
              <div className="flex items-center justify-between">
                <span>STEAM SAVINGS</span>
                <span>{factionSummary.steam.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>EPIC SAVINGS</span>
                <span>{factionSummary.epic.toFixed(2)}</span>
              </div>
              <div className="term-divider" />
              <div className="flex items-center justify-between">
                <span>TOTAL ADVANTAGE</span>
                <span>{(factionSummary.steam + factionSummary.epic).toFixed(2)}</span>
              </div>
            </div>
          </div>
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
