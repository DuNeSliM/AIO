import React, { useState } from 'react'
import { searchItad, getItadPrices } from '../services/api'
import { useI18n } from '../i18n/i18n.jsx'

function formatPrice(price){
  if (!price) return '—'
  const amount = typeof price.amount === 'number' ? price.amount : price.amountInt / 100
  const currency = price.currency || 'EUR'
  return `${amount.toFixed(2)} ${currency}`
}

function pickLowestDeal(deals){
  if (!deals || deals.length === 0) return null
  return deals.reduce((lowest, deal) => {
    if (!deal?.price) return lowest
    if (!lowest) return deal
    const a = deal.price.amount ?? deal.price.amountInt / 100
    const b = lowest.price.amount ?? lowest.price.amountInt / 100
    return a < b ? deal : lowest
  }, null)
}

export default function Store(){
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [prices, setPrices] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  const onSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSelected(null)
    setPrices(null)
    setHasSearched(true)
    try{
      const data = await searchItad(query.trim(), 10)
      const normalized = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : []
      setResults(normalized)
    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  const onCompare = async (game) => {
    setSelected(game)
    setLoading(true)
    setError(null)
    try{
      const data = await getItadPrices(game.id, 'DE')
      setPrices(data)
    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  const priceItem = Array.isArray(prices)
    ? prices.find(p => p.id === selected?.id)
    : prices?.games?.[selected?.id]

  const deals = priceItem?.deals || []
  const steamDeals = deals.filter(d => d?.shop?.name?.toLowerCase()?.includes('steam'))
  const epicDeals = deals.filter(d => d?.shop?.name?.toLowerCase()?.includes('epic'))
  const steamBest = pickLowestDeal(steamDeals)
  const epicBest = pickLowestDeal(epicDeals)
  const overallBest = pickLowestDeal(deals)

  return (
    <div className="store-page">
      <header className="page-header">
        <div>
          <h1>{t('store.title')}</h1>
          <p className="steam-status">{t('store.subtitle')}</p>
        </div>
      </header>

      <form className="store-search" onSubmit={onSearch}>
        <input
          className="search-input"
          type="text"
          placeholder={t('store.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading}>{t('store.search')}</button>
      </form>

      {error && <div className="error">Fehler: {error}</div>}

      {hasSearched && !loading && results.length === 0 && (
        <div className="empty">{t('store.empty')}</div>
      )}

      <div className="store-results">
        {results.map(game => (
          <div key={game.id} className={`store-card ${selected?.id === game.id ? 'active' : ''}`}>
            <div className="store-card-title">{game.title}</div>
            <div className="store-card-actions">
              <button onClick={() => onCompare(game)} disabled={loading}>
                {selected?.id === game.id && loading ? '...' : t('store.compare')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <section className="store-compare">
          <h2>{selected.title}</h2>
          <div className="compare-grid">
            <div className="compare-card">
              <div className="compare-title">{t('store.steam')}</div>
              <div className="compare-price">{formatPrice(steamBest?.price)}</div>
              {steamBest?.cut > 0 && <div className="compare-sub">-{steamBest.cut}%</div>}
              {steamBest?.url && <a href={steamBest.url} target="_blank" rel="noreferrer">{t('store.offer')}</a>}
            </div>
            <div className="compare-card">
              <div className="compare-title">{t('store.epic')}</div>
              <div className="compare-price">{formatPrice(epicBest?.price)}</div>
              {epicBest?.cut > 0 && <div className="compare-sub">-{epicBest.cut}%</div>}
              {epicBest?.url && <a href={epicBest.url} target="_blank" rel="noreferrer">{t('store.offer')}</a>}
            </div>
            <div className="compare-card highlight">
              <div className="compare-title">{t('store.cheapest')}</div>
              <div className="compare-price">{formatPrice(overallBest?.price)}</div>
              {overallBest?.shop?.name && <div className="compare-sub">{overallBest.shop.name}</div>}
              {overallBest?.url && <a href={overallBest.url} target="_blank" rel="noreferrer">{t('store.offer')}</a>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
