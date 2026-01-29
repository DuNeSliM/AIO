import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchGames, syncStore, fetchSteamLibrary, fetchEpicLibrary } from '../services/api'

export function useGames(){
  const [installedGames, setInstalledGames] = useState([])
  const [steamGames, setSteamGames] = useState([])
  const [epicGames, setEpicGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'a-z', 'z-a'

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try{
      const data = await fetchGames()
      setInstalledGames(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('Failed to load games:', err)
      setError(err.message)
      setInstalledGames([])
    }finally{
      setLoading(false)
    }
  }, [])

  const loadSteamLibrary = useCallback(async (steamId) => {
    if (!steamId) return
    setSyncing(true)
    setError(null)
    try{
      const data = await fetchSteamLibrary(steamId)
      setSteamGames(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('Failed to load Steam library:', err)
      setError(err.message)
    }finally{
      setSyncing(false)
    }
  }, [])

  const loadEpicLibrary = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try{
      const data = await fetchEpicLibrary()
      setEpicGames(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('Failed to load Epic library:', err)
      setError(err.message)
    }finally{
      setSyncing(false)
    }
  }, [])

  const combinedGames = useMemo(() => {
    return [...steamGames, ...epicGames, ...installedGames]
  }, [steamGames, epicGames, installedGames])

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = combinedGames.filter(g => 
      g.name.toLowerCase().includes(search.toLowerCase())
    )

    // Sort
    switch(sortBy){
      case 'a-z':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'z-a':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'recent':
        // Sort by last played (most recent first)
        result.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        break
    }

    return result
  }, [combinedGames, search, sortBy])

  async function syncFrom(store){
    setSyncing(true)
    setError(null)
    try{
      await syncStore(store)
      await loadGames()
    }catch(err){
      console.error('Sync failed:', err)
      setError(err.message)
    }finally{
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
    loadEpicLibrary
  }
}
