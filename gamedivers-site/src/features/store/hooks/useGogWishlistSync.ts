import { useCallback, useState } from 'react'
import { fetchGogWishlist, syncGogWishlistToBackend, searchItad } from '../../../services/api'
import type { ItadSearchItem, WishlistItem } from '../../../types'

type AddWishlistItemInput = {
  id: string
  title: string
  image?: string
  imageBackup?: string
  source?: 'itad' | 'gog'
  itadId?: string
  addedAt?: number
}

type UseGogWishlistSyncParams = {
  accessToken: string | null
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

export function useGogWishlistSync({
  accessToken,
  items,
  addItem,
  checkPrices,
  setError,
  pushLog,
  t,
}: UseGogWishlistSyncParams) {
  const [wishlistSyncing, setWishlistSyncing] = useState(false)

  const onSyncGogWishlist = useCallback(async () => {
    if (!accessToken) {
      setError(t('store.wishlist.loginRequired'))
      return
    }
    setWishlistSyncing(true)
    setError(null)
    try {
      const gogItems = await fetchGogWishlist(accessToken)
      const titleLookupCache = new Map<string, ItadSearchItem | null>()

      const existingByGogId = new Map<string, WishlistItem>()
      for (const existing of items) {
        if (existing.source === 'gog' && existing.id) {
          existingByGogId.set(existing.id, existing)
        }
      }

      const resolveItadMatch = async (query: string): Promise<ItadSearchItem | null> => {
        const cacheKey = normalizeTitleKey(query)
        if (titleLookupCache.has(cacheKey)) {
          return titleLookupCache.get(cacheKey) ?? null
        }

        try {
          const results = await searchItad(query, 5)
          const candidates = Array.isArray(results) ? results : results?.data ?? results?.results ?? []
          const best = pickBestItadMatch(query, candidates)
          titleLookupCache.set(cacheKey, best)
          return best
        } catch {
          titleLookupCache.set(cacheKey, null)
          return null
        }
      }

      let newItems = 0
      let updated = 0

      for (const gogItem of gogItems) {
        const id = gogItem.id
        const title = gogItem.title || `GOG Game ${id}`
        const existing = existingByGogId.get(id)

        if (existing) {
          updated++
          pushLog(`✓ GOG wishlist: already have ${title}`)
          continue
        }

        const itadMatch = await resolveItadMatch(title)
        if (!itadMatch) {
          pushLog(`⚠ GOG wishlist: no ITAD match for ${title}`)
          continue
        }

        newItems++
        pushLog(`+ GOG wishlist: adding ${title}`)
        addItem({
          id: itadMatch.id,
          title: itadMatch.title,
          image: gogItem.image,
          source: 'gog',
          itadId: itadMatch.id,
          addedAt: Date.now(),
        })
      }

      // Save wishlist to backend
      if (gogItems.length > 0) {
        await syncGogWishlistToBackend(gogItems.map((item) => item.id))
      }

      // Check prices after sync
      await checkPrices()

      const summary = `GOG Wishlist Sync: ${newItems} new, ${updated} existing`
      pushLog(summary)
      setWishlistSyncing(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('GOG wishlist sync failed:', err)
      setError(msg)
      setWishlistSyncing(false)
    }
  }, [accessToken, addItem, checkPrices, items, pushLog, setError, t])

  return {
    wishlistSyncing,
    onSyncGogWishlist,
  }
}
