import type { WishlistItem } from '../../../types'
import { DEFAULT_CURRENCY, STEAM_NAME_CACHE_KEY } from './constants'

export function parseWishlist(raw: string | null): WishlistItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse wishlist:', error)
    return []
  }
}

export function isSteamPlaceholderTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return true
  return /^steam:\d+$/.test(normalized) || /^app\s+\d+$/.test(normalized) || /^steam app\s+\d+$/.test(normalized) || /^\d+$/.test(normalized)
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function parseSteamAppID(value: string): number | null {
  const match = value.match(/\b(\d{3,})\b/)
  if (!match) return null
  const parsed = Number.parseInt(match[1] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getSteamAppIDFromItem(item: WishlistItem): number | null {
  if (typeof item.steamAppId === 'number' && item.steamAppId > 0) return item.steamAppId

  const fromID = parseSteamAppID(item.id)
  if (fromID) return fromID

  const fromTitle = parseSteamAppID(item.title ?? '')
  if (fromTitle && isSteamPlaceholderTitle(item.title ?? '')) return fromTitle
  return null
}

export function isLegacySteamID(id: string, steamAppId?: number): boolean {
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

export function dedupeSteamDuplicates(items: WishlistItem[]): WishlistItem[] {
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

export function dedupeByID(items: WishlistItem[]): WishlistItem[] {
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

export function normalizeStoredWishlistItems(items: WishlistItem[]): WishlistItem[] {
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
      currency: item.currency ?? DEFAULT_CURRENCY,
    }
  })

  try {
    localStorage.setItem(STEAM_NAME_CACHE_KEY, JSON.stringify(steamNameCache))
  } catch {
    // ignore storage write failures
  }

  return dedupeSteamDuplicates(dedupeByID(normalized))
}
