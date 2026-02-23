import type { ItadPrice } from '../../../types'

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMoney(amount: number, currency?: string): string {
  const formatted = formatAmount(amount)
  return currency ? `${formatted} ${currency}` : formatted
}

export function formatItadPrice(price?: ItadPrice): string {
  if (!price) return '-'
  const amount = typeof price.amount === 'number' ? price.amount : price.amountInt ? price.amountInt / 100 : 0
  const currency = price.currency || 'EUR'
  return formatMoney(amount, currency)
}
