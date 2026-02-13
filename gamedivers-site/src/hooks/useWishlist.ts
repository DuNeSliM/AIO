import { useCallback, useEffect, useRef, useState } from 'react'
import { getItadPrices } from '../services/api'
import type { ItadDeal, ItadPrice, ItadPricesResponse, WishlistItem } from '../types'
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
    const storedItems = parseWishlist(localStorage.getItem(WISHLIST_KEY))
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
        if (fileItems) setItems(fileItems)
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

  const addItem = useCallback((item: { id: string; title: string; source?: 'itad' | 'steam'; steamAppId?: number; itadId?: string; addedAt?: number }) => {
    setItems((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev
      const source = item.source ?? 'itad'
      return [
        {
          id: item.id,
          title: item.title,
          source,
          steamAppId: item.steamAppId,
          itadId: item.itadId ?? (source === 'itad' ? item.id : undefined),
          addedAt: item.addedAt ?? Date.now(),
          currency: defaultCurrency,
        },
        ...prev,
      ]
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
    if (fileItems) setItems(fileItems)
    setOnedriveStatus('connected')
    return true
  }, [])

  const checkPrices = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    const updated: WishlistItem[] = []
    for (const item of itemsRef.current) {
      try {
        const source = item.source ?? (item.id.startsWith('steam:') ? 'steam' : 'itad')
        const itadId = item.itadId ?? (source === 'itad' ? item.id : null)
        if (!itadId) {
          updated.push({ ...item, lastCheckedAt: Date.now() })
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
    setItems(updated)
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
