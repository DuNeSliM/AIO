import { describe, expect, it } from 'vitest'
import type { WishlistItem } from '../../../types'
import {
  dedupeByID,
  dedupeSteamDuplicates,
  getSteamAppIDFromItem,
  isSteamPlaceholderTitle,
  parseSteamAppID,
  parseWishlist,
} from './normalize'

describe('wishlist normalize helpers', () => {
  it('parses wishlist JSON safely', () => {
    expect(parseWishlist('invalid')).toEqual([])
    expect(parseWishlist('[]')).toEqual([])
  })

  it('detects placeholder Steam titles', () => {
    expect(isSteamPlaceholderTitle('Steam App 1234')).toBe(true)
    expect(isSteamPlaceholderTitle('app 999')).toBe(true)
    expect(isSteamPlaceholderTitle('Baldurs Gate 3')).toBe(false)
  })

  it('extracts Steam app IDs from text and wishlist items', () => {
    expect(parseSteamAppID('steam:570')).toBe(570)
    expect(parseSteamAppID('abc')).toBeNull()

    const item: WishlistItem = {
      id: 'steam:730',
      title: 'Steam App 730',
      addedAt: Date.now(),
    }
    expect(getSteamAppIDFromItem(item)).toBe(730)
  })

  it('deduplicates items by best quality and steam app id', () => {
    const lowQuality: WishlistItem = {
      id: 'same-id',
      title: 'Steam App 10',
      source: 'steam',
      steamAppId: 10,
      addedAt: 1,
    }
    const highQuality: WishlistItem = {
      id: 'same-id',
      title: 'Real Game Title',
      source: 'itad',
      steamAppId: 10,
      itadId: 'itad-10',
      image: 'img.jpg',
      addedAt: 2,
    }

    const dedupedById = dedupeByID([lowQuality, highQuality])
    expect(dedupedById).toHaveLength(1)
    expect(dedupedById[0]?.title).toBe('Real Game Title')

    const dedupedBySteam = dedupeSteamDuplicates([lowQuality, highQuality])
    expect(dedupedBySteam).toHaveLength(1)
    expect(dedupedBySteam[0]?.title).toBe('Real Game Title')
  })
})
