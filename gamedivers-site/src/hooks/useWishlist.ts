import { useCallback, useEffect, useRef, useState } from 'react'
import { getItadPrices, searchItad } from '../services/api'
import type { ItadDeal, ItadPrice, ItadPricesResponse, ItadSearchItem, WishlistItem } from '../types'
import { idbDel, idbGet, idbSet } from '../utils/idb'

type StorageMode = 'local' | 'onedrive'
type OnedriveStatus = 'unsupported' | 'disconnected' | 'permission-required' | 'connected'
type DirectoryHandle = any
type PermissionMode = 'read' | 'readwrite'

type WishlistAlert = {
  id: string
  message: string
  createdAt: number
}

const WISHLIST_KEY = 'wishlist'
const STORAGE_MODE_KEY = 'wishlistStorageMode'
const NOTIFY_KEY = 'wishlistNotifyEnabled'
const ONEDRIVE_HANDLE_KEY = 'wishlistOnedriveHandle'
const WISHLIST_FILE = 'gamedivers-wishlist.json'
const STEAM_NAME_CACHE_KEY = 'steamWishlistNameCache'
const ITAD_LOOKUP_CACHE_KEY = 'wishlistItadLookupCache'
const CHECK_INTERVAL_MINUTES = 30

const defaultCurrency = 'EUR'

function parseWishlist(raw: string | null): WishlistItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse wishlist:', error)
    return []
  }
}

function isSteamPlaceholderTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return true
  return /^steam:\d+$/.test(normalized) || /^app\s+\d+$/.test(normalized) || /^steam app\s+\d+$/.test(normalized) || /^\d+$/.test(normalized)
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseSteamAppID(value: string): number | null {
  const match = value.match(/\b(\d{3,})\b/)
  if (!match) return null
  const parsed = Number.parseInt(match[1] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getSteamAppIDFromItem(item: WishlistItem): number | null {
  if (typeof item.steamAppId === 'number' && item.steamAppId > 0) return item.steamAppId

  const fromID = parseSteamAppID(item.id)
  if (fromID) return fromID

  const fromTitle = parseSteamAppID(item.title ?? '')
  if (fromTitle && isSteamPlaceholderTitle(item.title ?? '')) return fromTitle
  return null
}

function isLegacySteamID(id: string, steamAppId?: number): boolean {
  if (!steamAppId || steamAppId <= 0) return false
  const raw = String(steamAppId)
  return id === raw || id === `steam:${raw}`
}

function wishlistItemQualityScore(item: WishlistItem): number {
  let value = 0
  if (item.source === 'itad' || !!item.itadId) value += 4
  if (!isSteamPlaceholderTitle(item.title || '')) value += 2
  if (item.image || item.imageBackup) value += 1
  if ((item.dealsTop3?.length ?? 0) > 0) value += 1
  return value
}

function dedupeSteamDuplicates(items: WishlistItem[]): WishlistItem[] {
  const remove = new Set<number>()
  const bestBySteamAppID = new Map<number, number>()

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const appID = item.steamAppId
    if (!appID || appID <= 0) continue

    const prevIndex = bestBySteamAppID.get(appID)
    if (prevIndex === undefined) {
      bestBySteamAppID.set(appID, i)
      continue
    }

    const prev = items[prevIndex]
    const keepCurrent = wishlistItemQualityScore(item) > wishlistItemQualityScore(prev)
    if (keepCurrent) {
      remove.add(prevIndex)
      bestBySteamAppID.set(appID, i)
    } else {
      remove.add(i)
    }
  }

  if (remove.size === 0) return items
  return items.filter((_, index) => !remove.has(index))
}

function dedupeByID(items: WishlistItem[]): WishlistItem[] {
  const keep = new Set<number>()
  const bestByID = new Map<string, number>()

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const prevIndex = bestByID.get(item.id)
    if (prevIndex === undefined) {
      bestByID.set(item.id, i)
      keep.add(i)
      continue
    }

    const prev = items[prevIndex]
    const keepCurrent = wishlistItemQualityScore(item) > wishlistItemQualityScore(prev)
    if (keepCurrent) {
      keep.delete(prevIndex)
      keep.add(i)
      bestByID.set(item.id, i)
    }
  }

  if (keep.size === items.length) return items
  return items.filter((_, index) => keep.has(index))
}

type ItadLookupCacheEntry = {
  id: string
  title?: string
}

type ItadLookupCache = Record<string, ItadLookupCacheEntry>

function readItadLookupCache(): ItadLookupCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(ITAD_LOOKUP_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as ItadLookupCache
  } catch {
    return {}
  }
}

function writeItadLookupCache(cache: ItadLookupCache): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ITAD_LOOKUP_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore storage write failures
  }
}

function normalizeSearchResults(
  data: ItadSearchItem[] | { data?: ItadSearchItem[]; results?: ItadSearchItem[] },
): ItadSearchItem[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.results)) return data.results
  return []
}

function pickBestItadMatch(queryTitle: string, candidates: ItadSearchItem[]): ItadSearchItem | null {
  if (!candidates.length) return null
  const queryKey = normalizeTitle(queryTitle)
  if (!queryKey) return candidates[0] ?? null

  const exact = candidates.find((item) => normalizeTitle(item.title) === queryKey)
  if (exact) return exact

  const startsWith = candidates.find((item) => normalizeTitle(item.title).startsWith(queryKey))
  if (startsWith) return startsWith

  const contains = candidates.find((item) => {
    const candidateKey = normalizeTitle(item.title)
    return candidateKey.includes(queryKey) || queryKey.includes(candidateKey)
  })
  return contains ?? candidates[0] ?? null
}

async function resolveWishlistItemItad(
  item: WishlistItem,
  cache: ItadLookupCache,
  queryCache: Map<string, ItadLookupCacheEntry | null>,
): Promise<ItadLookupCacheEntry | null> {
  const steamAppID = getSteamAppIDFromItem(item)
  const title = item.title?.trim() ?? ''
  const titleKey = normalizeTitle(title)

  const lookupKeys: string[] = []
  if (steamAppID) lookupKeys.push(`steam:${steamAppID}`)
  if (titleKey) lookupKeys.push(`title:${titleKey}`)

  for (const key of lookupKeys) {
    const found = cache[key]
    if (found?.id) return found
  }

  const queries: Array<{ query: string; expectedTitle?: string; strictSingle?: boolean }> = []
  if (title && !isSteamPlaceholderTitle(title)) {
    queries.push({ query: title, expectedTitle: title })
  }
  if (steamAppID) {
    queries.push({
      query: String(steamAppID),
      expectedTitle: title && !isSteamPlaceholderTitle(title) ? title : undefined,
      strictSingle: !title || isSteamPlaceholderTitle(title),
    })
  }

  for (const candidate of queries) {
    const queryKey = `q:${normalizeTitle(candidate.query) || candidate.query}`

    let resolved = queryCache.get(queryKey)
    if (resolved === undefined) {
      try {
        const raw = await searchItad(candidate.query, 6)
        const results = normalizeSearchResults(raw)
        let best: ItadSearchItem | null = null

        if (candidate.strictSingle) {
          best = results.length === 1 ? results[0] ?? null : null
        } else if (candidate.expectedTitle) {
          best = pickBestItadMatch(candidate.expectedTitle, results)
        } else {
          best = pickBestItadMatch(candidate.query, results)
        }

        resolved = best
          ? {
              id: best.id,
              title: best.title?.trim() || undefined,
            }
          : null
      } catch {
        resolved = null
      }
      queryCache.set(queryKey, resolved)
    }

    if (!resolved?.id) {
      continue
    }

    for (const key of lookupKeys) {
      cache[key] = resolved
    }
    return resolved
  }

  return null
}

function normalizeStoredWishlistItems(items: WishlistItem[]): WishlistItem[] {
  if (items.length === 0) return items

  let steamNameCache: Record<string, string> = {}
  try {
    const raw = localStorage.getItem(STEAM_NAME_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        steamNameCache = parsed as Record<string, string>
      }
    }
  } catch {
    // keep empty cache
  }

  const normalized = items.map((item) => {
    const steamAppID = getSteamAppIDFromItem(item)
    const source = item.source ?? (steamAppID ? 'steam' : 'itad')
    const id =
      source === 'steam' && steamAppID && !item.itadId
        ? `steam:${steamAppID}`
        : item.id

    let title = item.title
    if (steamAppID && isSteamPlaceholderTitle(title ?? '')) {
      const cached = steamNameCache[String(steamAppID)]?.trim()
      if (cached && !isSteamPlaceholderTitle(cached)) {
        title = cached
      }
    }

    if (steamAppID && title && !isSteamPlaceholderTitle(title)) {
      steamNameCache[String(steamAppID)] = title
    }

    const nextSource: 'itad' | 'steam' =
      source === 'itad' || !!item.itadId ? 'itad' : 'steam'

    return {
      ...item,
      id,
      title: title || item.id,
      source: nextSource,
      steamAppId: steamAppID ?? undefined,
      itadId: item.itadId ?? (nextSource === 'itad' ? id : undefined),
    }
  })

  try {
    localStorage.setItem(STEAM_NAME_CACHE_KEY, JSON.stringify(steamNameCache))
  } catch {
    // ignore storage write failures
  }

  return dedupeSteamDuplicates(dedupeByID(normalized))
}

function pickLowestDeal(deals?: ItadDeal[] | null): ItadDeal | null {
  if (!deals || deals.length === 0) return null
  return deals.reduce<ItadDeal | null>((lowest, deal) => {
    if (!deal?.price) return lowest
    if (!lowest?.price) return deal
    const a = getAmount(deal.price)
    const b = getAmount(lowest.price)
    if (a === null) return lowest
    if (b === null) return deal
    return a < b ? deal : lowest
  }, null)
}

function getAmount(price?: ItadPrice): number | null {
  if (!price) return null
  if (typeof price.amount === 'number') return price.amount
  if (typeof price.amountInt === 'number') return price.amountInt / 100
  return null
}

function normalizePriceItem(prices: ItadPricesResponse | null, gameId: string) {
  if (!prices) return null
  if (Array.isArray(prices)) return prices.find((item) => item.id === gameId) ?? null
  return prices.games?.[gameId] ?? null
}

async function readWishlistFile(handle: DirectoryHandle): Promise<WishlistItem[] | null> {
  try {
    const fileHandle = await handle.getFileHandle(WISHLIST_FILE)
    const file = await fileHandle.getFile()
    const text = await file.text()
    return parseWishlist(text)
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return []
    console.error('Failed to read wishlist file:', error)
    return null
  }
}

async function writeWishlistFile(handle: DirectoryHandle, items: WishlistItem[]): Promise<void> {
  const fileHandle = await handle.getFileHandle(WISHLIST_FILE, { create: true })
  const stream = await fileHandle.createWritable()
  await stream.write(JSON.stringify(items, null, 2))
  await stream.close()
}

async function ensurePermission(
  handle: DirectoryHandle,
  mode: PermissionMode,
  prompt: boolean,
): Promise<boolean> {
  const query = await handle.queryPermission({ mode })
  if (query === 'granted') return true
  if (!prompt) return false
  const request = await handle.requestPermission({ mode })
  return request === 'granted'
}

function getPicker(): (() => Promise<DirectoryHandle>) | null {
  if (typeof window === 'undefined') return null
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> })
    .showDirectoryPicker
  return picker ?? null
}

export function useWishlist(region: string) {
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window
  const onedriveSupported = typeof window !== 'undefined' && !!getPicker()

  const [items, setItems] = useState<WishlistItem[]>([])
  const [storageMode, setStorageMode] = useState<StorageMode>('local')
  const [onedriveStatus, setOnedriveStatus] = useState<OnedriveStatus>('disconnected')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationsSupported ? Notification.permission : 'unsupported',
  )
  const [alerts, setAlerts] = useState<WishlistAlert[]>([])
  const [checking, setChecking] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)

  const handleRef = useRef<DirectoryHandle | null>(null)
  const itemsRef = useRef<WishlistItem[]>([])
  const checkingRef = useRef(false)

  const syncNotificationState = useCallback(() => {
    if (!notificationsSupported) {
      setNotificationPermission('unsupported')
      setNotificationsEnabled(false)
      localStorage.setItem(NOTIFY_KEY, 'false')
      return
    }
    const permission = Notification.permission
    setNotificationPermission(permission)
    const wantsNotifications = localStorage.getItem(NOTIFY_KEY) === 'true'
    const enabled = wantsNotifications && permission === 'granted'
    setNotificationsEnabled(enabled)
    if (wantsNotifications !== enabled) {
      localStorage.setItem(NOTIFY_KEY, enabled ? 'true' : 'false')
    }
  }, [notificationsSupported])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    const storedItems = normalizeStoredWishlistItems(parseWishlist(localStorage.getItem(WISHLIST_KEY)))
    setItems(storedItems)
    const storedMode = localStorage.getItem(STORAGE_MODE_KEY) === 'onedrive' ? 'onedrive' : 'local'
    setStorageMode(storedMode)
    syncNotificationState()

    if (!onedriveSupported) {
      setOnedriveStatus('unsupported')
      return
    }

    if (storedMode === 'onedrive') {
      void (async () => {
        const handle = await idbGet<DirectoryHandle>(ONEDRIVE_HANDLE_KEY)
        if (!handle) {
          setOnedriveStatus('disconnected')
          return
        }
        handleRef.current = handle
        const hasPermission = await ensurePermission(handle, 'readwrite', false)
        if (!hasPermission) {
          setOnedriveStatus('permission-required')
          return
        }
        const fileItems = await readWishlistFile(handle)
        if (fileItems) setItems(normalizeStoredWishlistItems(fileItems))
        setOnedriveStatus('connected')
      })()
    }
  }, [onedriveSupported, syncNotificationState])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = () => syncNotificationState()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNotificationState()
      }
    }
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === NOTIFY_KEY) {
        syncNotificationState()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorage)
    }
  }, [syncNotificationState])

  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items))
    window.dispatchEvent(new Event('mission-update'))
    if (storageMode !== 'onedrive') return
    if (onedriveStatus !== 'connected') return
    const handle = handleRef.current
    if (!handle) return
    void writeWishlistFile(handle, items).catch((error) => {
      console.error('Failed to save wishlist to OneDrive:', error)
    })
  }, [items, storageMode, onedriveStatus])

  const addAlert = useCallback((message: string) => {
    setAlerts((prev) => [{ id: `${Date.now()}-${Math.random()}`, message, createdAt: Date.now() }, ...prev].slice(0, 6))
  }, [])

  const notify = useCallback(
    (title: string, body: string) => {
      addAlert(`${title} - ${body}`)
      if (!notificationsSupported) return
      if (Notification.permission !== 'granted') return
      new Notification(title, { body })
    },
    [addAlert, notificationsSupported],
  )

  const enableNotifications = useCallback(async () => {
    if (!notificationsSupported) return false
    if (Notification.permission === 'denied') {
      setNotificationPermission('denied')
      setNotificationsEnabled(false)
      localStorage.setItem(NOTIFY_KEY, 'false')
      return false
    }
    if (Notification.permission === 'granted') {
      setNotificationPermission('granted')
      setNotificationsEnabled(true)
      localStorage.setItem(NOTIFY_KEY, 'true')
      return true
    }
    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'
    setNotificationPermission(permission)
    setNotificationsEnabled(granted)
    localStorage.setItem(NOTIFY_KEY, granted ? 'true' : 'false')
    return granted
  }, [notificationsSupported])

  const disableNotifications = useCallback(() => {
    setNotificationsEnabled(false)
    localStorage.setItem(NOTIFY_KEY, 'false')
  }, [])

  const addItem = useCallback((item: { id: string; title: string; image?: string; imageBackup?: string; source?: 'itad' | 'steam'; steamAppId?: number; itadId?: string; addedAt?: number }) => {
    setItems((prev) => {
      const source = item.source ?? 'itad'
      const canonicalID =
        source === 'steam' && !item.itadId && item.steamAppId && item.steamAppId > 0
          ? `steam:${item.steamAppId}`
          : item.id
      const incomingTitle = item.title?.trim() ?? ''
      const normalizedIncomingTitle = normalizeTitle(incomingTitle)
      const incomingSteamAppID = item.steamAppId

      let index = prev.findIndex((entry) => entry.id === canonicalID || entry.id === item.id)
      if (index < 0 && incomingSteamAppID && incomingSteamAppID > 0) {
        index = prev.findIndex(
          (entry) =>
            entry.steamAppId === incomingSteamAppID ||
            isLegacySteamID(entry.id, incomingSteamAppID),
        )
      }
      if (index < 0 && normalizedIncomingTitle) {
        index = prev.findIndex((entry) => normalizeTitle(entry.title) === normalizedIncomingTitle)
      }

      if (index >= 0) {
        const existing = prev[index]
        const existingTitle = existing.title?.trim() ?? ''
        const existingLooksLikeID = source === 'steam' && isSteamPlaceholderTitle(existingTitle)
        const incomingLooksLikeID = source === 'steam' && isSteamPlaceholderTitle(incomingTitle)
        const nextTitle =
          incomingTitle && (!incomingLooksLikeID || existingLooksLikeID || !existingTitle)
            ? incomingTitle
            : existingTitle || incomingTitle || item.id

        const nextImage = item.image?.trim() || existing.image
        const nextBackup = item.imageBackup?.trim() || existing.imageBackup
        const nextSteamAppID = existing.steamAppId ?? item.steamAppId
        const nextItadID = existing.itadId ?? item.itadId ?? (source === 'itad' ? item.id : undefined)
        const nextSource: 'itad' | 'steam' =
          existing.source === 'itad' || source === 'itad' || !!nextItadID
            ? 'itad'
            : 'steam'

        const updated: WishlistItem = {
          ...existing,
          title: nextTitle,
          image: nextImage,
          imageBackup: nextBackup,
          source: nextSource,
          steamAppId: nextSteamAppID,
          itadId: nextItadID,
        }

        if (
          updated.title === existing.title &&
          updated.image === existing.image &&
          updated.imageBackup === existing.imageBackup &&
          updated.source === existing.source &&
          updated.steamAppId === existing.steamAppId &&
          updated.itadId === existing.itadId
        ) {
          return prev
        }

        const next = [...prev]
        next[index] = updated
        return dedupeSteamDuplicates(dedupeByID(next))
      }

      const next = [
        {
          id: canonicalID,
          title: item.title,
          image: item.image,
          imageBackup: item.imageBackup,
          source,
          steamAppId: item.steamAppId,
          itadId: item.itadId ?? (source === 'itad' ? item.id : undefined),
          addedAt: item.addedAt ?? Date.now(),
          currency: defaultCurrency,
        },
        ...prev,
      ]
      return dedupeSteamDuplicates(dedupeByID(next))
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const updateThreshold = useCallback((id: string, threshold: number | null) => {
    setItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, threshold: threshold ?? undefined } : entry)),
    )
  }, [])

  const connectOnedrive = useCallback(async () => {
    if (!onedriveSupported) {
      setOnedriveStatus('unsupported')
      return false
    }
    const picker = getPicker()
    if (!picker) return false
    const handle = await picker()
    const hasPermission = await ensurePermission(handle, 'readwrite', true)
    if (!hasPermission) {
      setOnedriveStatus('permission-required')
      return false
    }
    handleRef.current = handle
    await idbSet(ONEDRIVE_HANDLE_KEY, handle)
    localStorage.setItem(STORAGE_MODE_KEY, 'onedrive')
    setStorageMode('onedrive')
    setOnedriveStatus('connected')
    await writeWishlistFile(handle, itemsRef.current)
    return true
  }, [onedriveSupported])

  const disconnectOnedrive = useCallback(async () => {
    handleRef.current = null
    await idbDel(ONEDRIVE_HANDLE_KEY)
    localStorage.setItem(STORAGE_MODE_KEY, 'local')
    setStorageMode('local')
    setOnedriveStatus('disconnected')
  }, [])

  const requestOnedriveAccess = useCallback(async () => {
    const handle = handleRef.current ?? (await idbGet<DirectoryHandle>(ONEDRIVE_HANDLE_KEY))
    if (!handle) {
      setOnedriveStatus('disconnected')
      return false
    }
    handleRef.current = handle
    const hasPermission = await ensurePermission(handle, 'readwrite', true)
    if (!hasPermission) {
      setOnedriveStatus('permission-required')
      return false
    }
    const fileItems = await readWishlistFile(handle)
    if (fileItems) setItems(normalizeStoredWishlistItems(fileItems))
    setOnedriveStatus('connected')
    return true
  }, [])

  const checkPrices = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    const lookupCache = readItadLookupCache()
    const queryCache = new Map<string, ItadLookupCacheEntry | null>()
    let lookupCacheDirty = false
    const updated: WishlistItem[] = []
    for (const item of itemsRef.current) {
      try {
        const source = item.source ?? (item.id.startsWith('steam:') ? 'steam' : 'itad')
        const steamAppID = getSteamAppIDFromItem(item)
        const placeholderTitle = isSteamPlaceholderTitle(item.title ?? '')
        let resolvedTitle = item.title
        let resolvedSource: 'itad' | 'steam' = source
        let itadId = item.itadId ?? (source === 'itad' && !item.id.startsWith('steam:') ? item.id : null)

        if (!itadId) {
          const resolved = await resolveWishlistItemItad(item, lookupCache, queryCache)
          if (resolved?.id) {
            itadId = resolved.id
            resolvedSource = 'itad'
            if (resolved.title && (placeholderTitle || !resolvedTitle)) {
              resolvedTitle = resolved.title
            }
            lookupCacheDirty = true
          }
        }

        if (!itadId) {
          updated.push({
            ...item,
            title: resolvedTitle || item.title,
            source: resolvedSource,
            steamAppId: steamAppID ?? item.steamAppId,
            lastCheckedAt: Date.now(),
          })
          continue
        }

        const prices = await getItadPrices(itadId, region)
        const priceItem = normalizePriceItem(prices, itadId)
        const deals = priceItem?.deals ?? []
        const sortedDeals = deals
          .filter((deal) => deal?.price)
          .map((deal) => ({
            shop: deal?.shop?.name,
            price: getAmount(deal.price) ?? null,
            currency: deal?.price?.currency ?? item.currency ?? defaultCurrency,
            cut: deal?.cut ?? 0,
            url: deal?.url,
          }))
          .filter((deal) => typeof deal.price === 'number')
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
        const topDeals = sortedDeals.slice(0, 3)
        const bestDeal = pickLowestDeal(deals)
        const amount = getAmount(bestDeal?.price ?? null)
        const currency = bestDeal?.price?.currency ?? item.currency ?? defaultCurrency
        const cut = bestDeal?.cut ?? 0
        const onSale = cut > 0
        const belowThreshold =
          typeof item.threshold === 'number' && amount !== null ? amount <= item.threshold : false

        if (notificationsEnabled) {
          if (onSale && !item.onSale) {
            notify('Sale alert', `${item.title} is on sale (${cut}% off).`)
          }
          if (belowThreshold && !item.belowThreshold) {
            notify('Price alert', `${item.title} is now ${amount?.toFixed(2)} ${currency}.`)
          }
        }

        updated.push({
          ...item,
          id: itadId,
          title: resolvedTitle || item.title,
          source: 'itad',
          steamAppId: steamAppID ?? item.steamAppId,
          itadId,
          lastPrice: amount ?? item.lastPrice,
          currency,
          onSale,
          belowThreshold,
          dealsTop3: topDeals,
          lastCheckedAt: Date.now(),
        })
      } catch (error) {
        console.error('Wishlist price check failed:', error)
        updated.push({ ...item, lastCheckedAt: Date.now() })
      }
    }
    if (lookupCacheDirty) {
      writeItadLookupCache(lookupCache)
    }
    setItems(dedupeSteamDuplicates(dedupeByID(updated)))
    setLastCheckedAt(Date.now())
    setChecking(false)
    checkingRef.current = false
  }, [notificationsEnabled, notify, region])

  useEffect(() => {
    if (!notificationsEnabled || items.length === 0) return
    const interval = window.setInterval(() => {
      void checkPrices()
    }, CHECK_INTERVAL_MINUTES * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [notificationsEnabled, items.length, checkPrices])

  return {
    items,
    addItem,
    removeItem,
    updateThreshold,
    storageMode,
    onedriveStatus,
    onedriveSupported,
    connectOnedrive,
    disconnectOnedrive,
    requestOnedriveAccess,
    notificationsEnabled,
    notificationsSupported,
    notificationPermission,
    enableNotifications,
    disableNotifications,
    alerts,
    checking,
    lastCheckedAt,
    checkPrices,
  }
}
