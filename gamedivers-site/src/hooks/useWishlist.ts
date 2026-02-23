import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_EVENTS, emitAppEvent } from '../shared/events'
import type { WishlistItem } from '../types'
import { idbDel, idbGet, idbSet } from '../utils/idb'
import {
  CHECK_INTERVAL_MINUTES,
  DEFAULT_CURRENCY,
  ITAD_MIN_REQUEST_INTERVAL_MS,
  NOTIFY_KEY,
  ONEDRIVE_HANDLE_KEY,
  STORAGE_MODE_KEY,
  WISHLIST_KEY,
} from '../features/store/wishlist/constants'
import {
  dedupeByID,
  dedupeSteamDuplicates,
  getSteamAppIDFromItem,
  isLegacySteamID,
  isSteamPlaceholderTitle,
  normalizeStoredWishlistItems,
  normalizeTitle,
  parseWishlist,
} from '../features/store/wishlist/normalize'
import {
  readItadLookupCache,
  resolveWishlistItemItad,
  writeItadLookupCache,
} from '../features/store/wishlist/itadLookup'
import {
  dedupeDealSummaries,
  getAmount,
  getItadPricesWithRetry,
  getWishlistStoreDeals,
  normalizePriceItem,
  pickLowestDeal,
  waitFor,
} from '../features/store/wishlist/pricing'
import {
  ensurePermission,
  getPicker,
  readWishlistFile,
  writeWishlistFile,
} from '../features/store/wishlist/storage'
import type {
  DirectoryHandle,
  ItadLookupCacheEntry,
  OnedriveStatus,
  StorageMode,
  WishlistAlert,
  WishlistDealSummary,
} from '../features/store/wishlist/types'

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
    emitAppEvent(APP_EVENTS.missionUpdate)
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
          currency: DEFAULT_CURRENCY,
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
    try {
      const lookupCache = readItadLookupCache()
      const queryCache = new Map<string, ItadLookupCacheEntry | null>()
      let lookupCacheDirty = false
      let lastItadRequestAt = 0
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

          const elapsed = Date.now() - lastItadRequestAt
          if (lastItadRequestAt > 0 && elapsed < ITAD_MIN_REQUEST_INTERVAL_MS) {
            await waitFor(ITAD_MIN_REQUEST_INTERVAL_MS - elapsed)
          }

          const prices = await getItadPricesWithRetry(itadId, region)
          lastItadRequestAt = Date.now()

          const priceItem = normalizePriceItem(prices, itadId)
          const deals = priceItem?.deals ?? []
          const bestDeal = pickLowestDeal(deals)
          const amount = getAmount(bestDeal?.price ?? null)
          const currency = bestDeal?.price?.currency ?? item.currency ?? DEFAULT_CURRENCY
          const cut = bestDeal?.cut ?? 0
          const onSale = cut > 0
          const belowThreshold =
            typeof item.threshold === 'number' && amount !== null ? amount <= item.threshold : false
          const storeDeals = getWishlistStoreDeals(deals, currency)
          const prioritizedDeals = dedupeDealSummaries(
            [storeDeals.lowest, storeDeals.steam, storeDeals.epic].filter(
              (deal): deal is WishlistDealSummary => !!deal,
            ),
          ).slice(0, 3)

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
            lowestDeal: storeDeals.lowest ?? undefined,
            dealsTop3: prioritizedDeals,
            lastCheckedAt: Date.now(),
          })
        } catch (error) {
          lastItadRequestAt = Date.now()
          console.error('Wishlist price check failed:', error)
          updated.push({ ...item, lastCheckedAt: Date.now() })
        }
      }

      if (lookupCacheDirty) {
        writeItadLookupCache(lookupCache)
      }
      setItems(dedupeSteamDuplicates(dedupeByID(updated)))
      setLastCheckedAt(Date.now())
    } finally {
      setChecking(false)
      checkingRef.current = false
    }
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
