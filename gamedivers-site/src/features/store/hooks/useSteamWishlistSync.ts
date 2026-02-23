import { useCallback, useState } from 'react'
import { fetchSteamWishlist, searchItad, syncSteamWishlistToBackend } from '../../../services/api'
import { STORAGE_KEYS } from '../../../shared/storage/keys'
import { getLocalJSON, setLocalJSON } from '../../../shared/storage/storage'
import type { ItadSearchItem, WishlistItem } from '../../../types'
import { backupSteamHeaderUrl, defaultSteamCapsuleUrl } from '../utils/steamAssets'

type AddWishlistItemInput = {
  id: string
  title: string
  image?: string
  imageBackup?: string
  source?: 'itad' | 'steam'
  steamAppId?: number
  itadId?: string
  addedAt?: number
}

type UseSteamWishlistSyncParams = {
  steamId: string | null
  items: WishlistItem[]
  addItem: (item: AddWishlistItemInput) => void
  checkPrices: () => Promise<void>
  setError: (message: string | null) => void
  pushLog: (entry: string) => void
  t: (key: string) => string
}

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

function isNumeric(text: string): boolean {
  return /^\d+$/.test(text.trim())
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
  return getLocalJSON<Record<string, string>>(STORAGE_KEYS.steam.wishlistNameCache, {})
}

function writeSteamNameCache(cache: Record<string, string>): void {
  setLocalJSON(STORAGE_KEYS.steam.wishlistNameCache, cache)
}

export function useSteamWishlistSync({
  steamId,
  items,
  addItem,
  checkPrices,
  setError,
  pushLog,
  t,
}: UseSteamWishlistSyncParams) {
  const [wishlistSyncing, setWishlistSyncing] = useState(false)

  const onSyncSteamWishlist = useCallback(async () => {
    if (!steamId) {
      setError(t('store.wishlist.loginRequired'))
      return
    }
    setWishlistSyncing(true)
    setError(null)
    try {
      const steamItems = await fetchSteamWishlist(steamId)
      const sorted = [...steamItems].sort((a, b) => (a.added ?? 0) - (b.added ?? 0))
      const titleLookupCache = new Map<string, ItadSearchItem | null>()
      const steamNameCache = readSteamNameCache()
      let steamNameCacheDirty = false
      const existingBySteamAppId = new Map<number, WishlistItem>()
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
  }, [steamId, setError, t, items, addItem, pushLog, checkPrices])

  return {
    wishlistSyncing,
    onSyncSteamWishlist,
  }
}
