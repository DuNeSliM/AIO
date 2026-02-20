import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { getRank, setCommanderName } from '../utils/gameify'
import { useCommander } from '../hooks/useCommander'

export default function CommanderHud() {
  const commander = useCommander()
  const [name, setName] = useState(commander.commanderName)
  const [pulse, setPulse] = useState(false)

  const rank = useMemo(() => getRank(commander.level), [commander.level])
  const progress = commander.xp % 100

  useEffect(() => {
    setPulse(true)
    const timeout = window.setTimeout(() => setPulse(false), 600)
    return () => window.clearTimeout(timeout)
  }, [commander.xp])

  useEffect(() => {
    setName(commander.commanderName)
  }, [commander.commanderName])

  return (
    <div className="ui-surface ui-surface--accent">
      <div className="ui-panel ui-panel-pad-sm">
        <div className="ui-corners">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[220px]">
            <div className="ui-label">PLAYER PROGRESS</div>
            <input
              className="ui-input mt-3 w-full max-w-xs"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setCommanderName(name.trim() || 'Commander')}
            />
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">
              RANK: {rank} | LEVEL {commander.level}
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="min-w-[200px]">
              <div className="ui-label">XP</div>
              <div
                className={`ui-progress mt-2 ${pulse ? 'ui-progress--pulse' : ''}`}
                style={{ '--ui-progress': `${progress}%` } as CSSProperties}
              />
              <div className="mt-2 text-xs text-white/50">{commander.xp} XP</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="ui-chip">CREDITS: {commander.credits}</span>
              <span className="ui-chip">STREAK: {commander.streak}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



