import { useState, useCallback, useMemo } from 'react'
import { fetchGames, syncStore, fetchSteamLibrary, fetchEpicLibrary, fetchGogLibrary } from '../services/api'
import type { Game } from '../types'

export type SortBy = 'recent' | 'a-z' | 'z-a' | 'playtime'

type UseGamesResult = {
  games: Game[]
  totalGames: number
  loading: boolean
  syncing: boolean
  error: string | null
  search: string
  setSearch: (value: string) => void
  sortBy: SortBy
  setSortBy: (value: SortBy) => void
  syncFrom: (store: string) => Promise<void>
  reload: () => Promise<void>
  loadSteamLibrary: (steamId: string) => Promise<void>
  loadEpicLibrary: () => Promise<void>
  loadGogLibrary: () => Promise<void>
}

export function useGames(): UseGamesResult {
  const [installedGames, setInstalledGames] = useState<Game[]>([])
  const [steamGames, setSteamGames] = useState<Game[]>([])
  const [epicGames, setEpicGames] = useState<Game[]>([])
  const [gogGames, setGogGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchGames()
      setInstalledGames(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to load games:', err)
      setError(message)
      setInstalledGames([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSteamLibrary = useCallback(async (steamId: string) => {
    if (!steamId) return
    setSyncing(true)
    setError(null)
    try {
      const data = await fetchSteamLibrary(steamId)
      setSteamGames(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to load Steam library:', err)
      setError(message)
    } finally {
      setSyncing(false)
    }
  }, [])

  const loadEpicLibrary = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const data = await fetchEpicLibrary()
      setEpicGames(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to load Epic library:', err)
      setError(message)
    } finally {
      setSyncing(false)
    }
  }, [])

  const loadGogLibrary = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const data = await fetchGogLibrary()
      setGogGames(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to load GOG library:', err)
      setError(message)
    } finally {
      setSyncing(false)
    }
  }, [])

  const combinedGames = useMemo(() => {
    return [...steamGames, ...epicGames, ...gogGames, ...installedGames]
  }, [steamGames, epicGames, gogGames, installedGames])

  const filteredGames = useMemo(() => {
    const needle = search.toLowerCase()
    const result = combinedGames.filter((game) => (game.name ?? '').toLowerCase().includes(needle))

    switch (sortBy) {
      case 'a-z':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'z-a':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'playtime':
        result.sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
        break
      case 'recent':
        result.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        break
    }

    return result
  }, [combinedGames, search, sortBy])

  const syncFrom = async (store: string) => {
    setSyncing(true)
    setError(null)
    try {
      await syncStore(store)
      await loadGames()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Sync failed:', err)
      setError(message)
    } finally {
      setSyncing(false)
    }
  }

  return {
    games: filteredGames,
    totalGames: combinedGames.length,
    loading,
    syncing,
    error,
    search,
    setSearch,
    sortBy,
    setSortBy,
    syncFrom,
    reload: loadGames,
    loadSteamLibrary,
    loadEpicLibrary,
    loadGogLibrary,
  }
}
