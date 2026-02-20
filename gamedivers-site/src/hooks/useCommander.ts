import { useEffect, useState } from 'react'
import { loadCommander } from '../utils/gameify'

export function useCommander() {
  const [state, setState] = useState(() => loadCommander())

  useEffect(() => {
    const handler = () => setState(loadCommander())
    window.addEventListener('commander-update', handler)
    return () => window.removeEventListener('commander-update', handler)
  }, [])

  return state
}
