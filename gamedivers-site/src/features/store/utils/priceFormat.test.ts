import { describe, expect, it } from 'vitest'
import { formatItadPrice, formatMoney } from './priceFormat'

describe('priceFormat', () => {
  it('formats money with two decimal places', () => {
    const value = formatMoney(19.5, 'EUR')
    expect(value).toMatch(/19[.,]50 EUR/)
  })

  it('formats zero-padded decimals for integer values', () => {
    const value = formatMoney(24, 'USD')
    expect(value).toMatch(/24[.,]00 USD/)
  })

  it('returns a fallback for missing ITAD prices', () => {
    expect(formatItadPrice(undefined)).toBe('-')
  })
})
