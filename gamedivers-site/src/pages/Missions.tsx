import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { loadCounters, loadEventLog, loadMissionProgress, purchaseBadge } from '../utils/gameify'
import { useCommander } from '../hooks/useCommander'

type BadgeItem = {
  id: string
  title: string
  cost: number
  description: string
}

const BADGES: BadgeItem[] = [
  { id: 'badge-steam', title: 'Steam Vanguard', cost: 120, description: 'Rep the Steam faction.' },
  { id: 'badge-epic', title: 'Epic Vanguard', cost: 120, description: 'Rep the Epic faction.' },
  { id: 'badge-elite', title: 'Elite Scout', cost: 200, description: 'Awarded to top explorers.' },
]

function loadWishlistCount() {
  const raw = localStorage.getItem('wishlist')
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function loadPriceCache() {
  const raw = localStorage.getItem('priceCache')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, { steam?: number; epic?: number }>
  } catch {
    return {}
  }
}

export default function Missions() {
  const commander = useCommander()
  const [counters, setCounters] = useState(() => loadCounters())
  const [missions, setMissions] = useState(() => loadMissionProgress().progress)
  const [toast, setToast] = useState<string | null>(null)
  const [events, setEvents] = useState(() => loadEventLog())

  useEffect(() => {
    const handler = () => {
      setCounters(loadCounters())
      setMissions(loadMissionProgress().progress)
      setEvents(loadEventLog())
    }
    window.addEventListener('mission-update', handler)
    return () => window.removeEventListener('mission-update', handler)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const wishlistCount = useMemo(() => loadWishlistCount(), [events.length])

  const report = useMemo(() => {
    const cache = loadPriceCache()
    let steam = 0
    let epic = 0
    Object.values(cache).forEach((entry) => {
      if (typeof entry.steam !== 'number' || typeof entry.epic !== 'number') return
      const diff = Math.abs(entry.steam - entry.epic)
      if (entry.steam < entry.epic) steam += diff
      if (entry.epic < entry.steam) epic += diff
    })
    return { steam, epic }
  }, [events.length])

  const recentRewards = useMemo(() => {
    const now = Date.now()
    return events
      .filter((entry) => entry.message.startsWith('REWARD EARNED'))
      .filter((entry) => now - entry.timestamp < 10 * 60 * 1000)
      .slice(0, 3)
  }, [events])

  const onBuy = (badge: BadgeItem) => {
    const ok = purchaseBadge(badge.id, badge.cost)
    if (!ok) {
      setToast('NOT ENOUGH CREDITS')
      return
    }
    setToast(`PURCHASED: ${badge.title}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="term-frame term-frame--orange">
        <div className="term-panel rounded-[15px] p-6">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="term-label">MISSIONS</div>
          <h1 className="mt-3 text-2xl tone-primary">Missions & Progress</h1>
          <p className="mt-2 text-sm term-subtle">Daily objectives, rewards, and your progression.</p>
        </div>
      </header>

      {toast && <div className="term-toast">{toast}</div>}

      {recentRewards.length > 0 && (
        <div className="flex flex-col gap-2">
          {recentRewards.map((reward) => (
            <div key={reward.id} className="term-toast">
              {reward.message}
            </div>
          ))}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">DAILY MISSIONS</div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  id: 'scans',
                  label: 'Run 3 searches',
                  progress: Math.min(counters.scans, 3),
                  target: 3,
                  reward: '+25 XP / +20 CR',
                  done: missions.scans,
                },
                {
                  id: 'cargo',
                  label: 'Track 5 wishlist items',
                  progress: Math.min(wishlistCount, 5),
                  target: 5,
                  reward: '+30 XP / +30 CR',
                  done: missions.cargo,
                },
                {
                  id: 'launch',
                  label: 'Launch 1 new title',
                  progress: Math.min(counters.launchUnplayed, 1),
                  target: 1,
                  reward: '+40 XP / +35 CR',
                  done: missions.launch,
                },
                {
                  id: 'sync',
                  label: 'Sync watchlist once',
                  progress: Math.min(counters.syncs, 1),
                  target: 1,
                  reward: '+20 XP / +10 CR',
                  done: missions.sync,
                },
              ].map((mission) => (
                <div key={mission.id} className="term-mission">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                    <span>{mission.label}</span>
                    <span>{mission.done ? 'COMPLETE' : mission.reward}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-white/50">
                    <div
                      className="term-meter"
                      style={{ '--term-meter': `${(mission.progress / mission.target) * 100}%` } as CSSProperties}
                    />
                    <span>
                      {mission.progress}/{mission.target}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">WEEKLY STORE REPORT</div>
            <div className="mt-4 flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
              <div className="flex items-center justify-between">
                <span>Steam savings</span>
                <span>{report.steam.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Epic savings</span>
                <span>{report.epic.toFixed(2)}</span>
              </div>
              <div className="term-divider" />
              <div className="flex items-center justify-between">
                <span>Total savings</span>
                <span>{(report.steam + report.epic).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">BADGE STORE</div>
            <div className="mt-4 grid gap-3">
              {BADGES.map((badge) => {
                const owned = commander.badges?.includes(badge.id)
                return (
                  <div key={badge.id} className="term-mission">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                      <span>{badge.title}</span>
                      <span>{owned ? 'OWNED' : `${badge.cost} CR`}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/50">{badge.description}</div>
                    {!owned && (
                      <button className="term-btn-secondary mt-3" onClick={() => onBuy(badge)}>
                        Purchase
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">ACTIVITY LOG</div>
            <div className="mt-3 flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
              {events.length === 0 && <span>No recent events</span>}
              {events.slice(0, 6).map((entry) => (
                <span key={entry.id}>{entry.message}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
