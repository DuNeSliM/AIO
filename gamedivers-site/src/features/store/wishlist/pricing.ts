import { getItadPrices } from '../../../services/api'
import type { ItadDeal, ItadPrice, ItadPricesResponse } from '../../../types'
import { ITAD_RATE_RETRY_DELAYS_MS } from './constants'
import type { WishlistDealSummary } from './types'

export function pickLowestDeal(deals?: ItadDeal[] | null): ItadDeal | null {
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

export function getAmount(price?: ItadPrice): number | null {
  if (!price) return null
  if (typeof price.amount === 'number') return price.amount
  if (typeof price.amountInt === 'number') return price.amountInt / 100
  return null
}

export function normalizePriceItem(prices: ItadPricesResponse | null, gameId: string) {
  if (!prices) return null
  if (Array.isArray(prices)) return prices.find((item) => item.id === gameId) ?? null
  return prices.games?.[gameId] ?? null
}

export async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRateLimitedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('429') ||
    message.includes('rate_limited') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('upstream service unavailable')
  )
}

function includesShopKeyword(name: string | undefined, keyword: string): boolean {
  const normalized = name?.toLowerCase() ?? ''
  return normalized.includes(keyword)
}

function pickShopLowestDeal(deals: ItadDeal[], keyword: string): ItadDeal | null {
  const matches = deals.filter((deal) => includesShopKeyword(deal?.shop?.name, keyword))
  return pickLowestDeal(matches)
}

function normalizeDealSummary(deal: ItadDeal | null, fallbackCurrency: string): WishlistDealSummary | null {
  if (!deal?.price) return null
  const amount = getAmount(deal.price)
  if (amount === null) return null
  return {
    shop: deal.shop?.name || undefined,
    price: amount,
    currency: deal.price.currency || fallbackCurrency,
    cut: deal.cut ?? 0,
    url: deal.url,
  }
}

export function dedupeDealSummaries(deals: WishlistDealSummary[]): WishlistDealSummary[] {
  const seen = new Set<string>()
  const unique: WishlistDealSummary[] = []
  for (const deal of deals) {
    const key = `${(deal.shop ?? '').toLowerCase()}|${deal.price ?? ''}|${deal.currency ?? ''}|${deal.url ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(deal)
  }
  return unique
}

export function getWishlistStoreDeals(
  deals: ItadDeal[],
  fallbackCurrency: string,
): { lowest: WishlistDealSummary | null; steam: WishlistDealSummary | null; epic: WishlistDealSummary | null } {
  const lowest = normalizeDealSummary(pickLowestDeal(deals), fallbackCurrency)
  const steam = normalizeDealSummary(pickShopLowestDeal(deals, 'steam'), fallbackCurrency)
  const epic = normalizeDealSummary(pickShopLowestDeal(deals, 'epic'), fallbackCurrency)
  return { lowest, steam, epic }
}

export async function getItadPricesWithRetry(gameId: string, region: string): Promise<ItadPricesResponse> {
  let attempt = 0
  while (true) {
    try {
      return await getItadPrices(gameId, region)
    } catch (error) {
      if (!isRateLimitedError(error) || attempt >= ITAD_RATE_RETRY_DELAYS_MS.length) {
        throw error
      }
      await waitFor(ITAD_RATE_RETRY_DELAYS_MS[attempt] ?? ITAD_RATE_RETRY_DELAYS_MS[ITAD_RATE_RETRY_DELAYS_MS.length - 1])
      attempt += 1
    }
  }
}
