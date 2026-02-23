import { useEffect, useState } from 'react'
import { APP_EVENTS, onAppEvent } from '../shared/events'
import { loadCommander } from '../utils/gameify'

export function useCommander() {
  const [state, setState] = useState(() => loadCommander())

  useEffect(() => {
    const handler = () => setState(loadCommander())
    return onAppEvent(APP_EVENTS.commanderUpdate, handler)
  }, [])

  return state
}
