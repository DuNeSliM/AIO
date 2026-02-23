import { searchItad } from '../../../services/api'
import type { ItadSearchItem, WishlistItem } from '../../../types'
import { ITAD_LOOKUP_CACHE_KEY } from './constants'
import { getSteamAppIDFromItem, isSteamPlaceholderTitle, normalizeTitle } from './normalize'
import type { ItadLookupCache, ItadLookupCacheEntry } from './types'

export function readItadLookupCache(): ItadLookupCache {
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

export function writeItadLookupCache(cache: ItadLookupCache): void {
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

export async function resolveWishlistItemItad(
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
