import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useCommander } from '../hooks/useCommander'
import { useI18n } from '../i18n/i18n'
import {
  DESIGN_CATALOG,
  buildMissionMetrics,
  equipDesign,
  getDailyMissionCards,
  getDailyMissionMeta,
  loadCounters,
  loadEventLog,
  loadMissionPreferences,
  purchaseBadge,
  purchaseDesign,
  rerollDailyMission,
  saveMissionPreferences,
  type DesignId,
  type MissionDifficulty,
} from '../utils/gameify'

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

const DIFFICULTY_OPTIONS: MissionDifficulty[] = ['relaxed', 'standard', 'hardcore']

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

function formatDifficulty(difficulty: MissionDifficulty, t: (key: string) => string) {
  return t(`missions.difficultyOption.${difficulty}`).toUpperCase()
}

export default function Missions() {
  const commander = useCommander()
  const { t } = useI18n()
  const [counters, setCounters] = useState(() => loadCounters())
  const [preferences, setPreferences] = useState(() => loadMissionPreferences())
  const [missionMeta, setMissionMeta] = useState(() => getDailyMissionMeta())
  const [toast, setToast] = useState<string | null>(null)
  const [events, setEvents] = useState(() => loadEventLog())

  const refreshMissionData = useCallback(() => {
    setCounters(loadCounters())
    setPreferences(loadMissionPreferences())
    setMissionMeta(getDailyMissionMeta())
    setEvents(loadEventLog())
  }, [])

  useEffect(() => {
    const handler = () => {
      refreshMissionData()
    }
    window.addEventListener('mission-update', handler)
    return () => window.removeEventListener('mission-update', handler)
  }, [refreshMissionData])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const wishlistCount = useMemo(() => loadWishlistCount(), [events.length])

  const metrics = useMemo(() => {
    return buildMissionMetrics(counters, wishlistCount)
  }, [counters, wishlistCount])

  const dailyMissions = useMemo(
    () => getDailyMissionCards(metrics),
    [metrics, preferences.difficulty, missionMeta.rerollsUsed, events.length],
  )

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

  const getLocalizedMissionLabel = useCallback(
    (missionId: string, fallback: string) => {
      const key = `missions.pool.${missionId}`
      const localized = t(key)
      return localized === key ? fallback : localized
    },
    [t],
  )

  const getLocalizedDesignName = useCallback(
    (designId: DesignId) => {
      const key = `missions.designs.catalog.${designId}.name`
      const localized = t(key)
      return localized === key ? designId : localized
    },
    [t],
  )

  const getLocalizedDesignDescription = useCallback(
    (designId: DesignId) => {
      const key = `missions.designs.catalog.${designId}.description`
      const localized = t(key)
      return localized === key ? designId : localized
    },
    [t],
  )

  const onBuy = (badge: BadgeItem) => {
    const ok = purchaseBadge(badge.id, badge.cost)
    if (!ok) {
      setToast(t('missions.toasts.notEnoughCredits'))
      return
    }
    setToast(t('missions.toasts.purchased', { title: badge.title }))
  }

  const onSetDifficulty = (difficulty: MissionDifficulty) => {
    saveMissionPreferences({ difficulty })
    refreshMissionData()
    setToast(
      t('missions.toasts.difficultySet', {
        difficulty: formatDifficulty(difficulty, t),
      }),
    )
  }

  const onToggleMissions = () => {
    saveMissionPreferences({ missionsEnabled: !preferences.missionsEnabled })
    refreshMissionData()
    setToast(preferences.missionsEnabled ? t('missions.toasts.missionsDisabled') : t('missions.toasts.missionsEnabled'))
  }

  const onToggleRerolls = () => {
    saveMissionPreferences({ rerollsEnabled: !preferences.rerollsEnabled })
    refreshMissionData()
    setToast(preferences.rerollsEnabled ? t('missions.toasts.rerollsDisabled') : t('missions.toasts.rerollsEnabled'))
  }

  const onRerollMission = (missionId: string) => {
    const result = rerollDailyMission(missionId)
    if (!result.ok) {
      if (result.reason === 'limit') {
        setToast(t('missions.toasts.rerollLimitReached'))
        return
      }
      if (result.reason === 'disabled') {
        setToast(t('missions.toasts.rerollsDisabledHint'))
        return
      }
      if (result.reason === 'completed') {
        setToast(t('missions.toasts.completedCannotReroll'))
        return
      }
      setToast(t('missions.toasts.rerollFailed'))
      return
    }

    refreshMissionData()
    setToast(t('missions.toasts.rerolled'))
  }

  const onBuyDesign = (designId: DesignId) => {
    const result = purchaseDesign(designId)
    if (!result.ok) {
      if (result.reason === 'insufficient-credits') {
        setToast(t('missions.toasts.notEnoughCredits'))
        return
      }
      setToast(t('missions.toasts.designOwned'))
      return
    }
    refreshMissionData()
    setToast(t('missions.toasts.designPurchased', { design: getLocalizedDesignName(designId) }))
  }

  const onEquipDesign = (designId: DesignId) => {
    const ok = equipDesign(designId)
    if (!ok) {
      setToast(t('missions.toasts.designLocked'))
      return
    }
    refreshMissionData()
    setToast(t('missions.toasts.designEquipped', { design: getLocalizedDesignName(designId) }))
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
          <div className="term-label">{t('missions.label')}</div>
          <h1 className="mt-3 text-2xl tone-primary">{t('missions.title')}</h1>
          <p className="mt-2 text-sm term-subtle">{t('missions.subtitle')}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="term-btn-secondary" onClick={onToggleMissions}>
              {preferences.missionsEnabled ? t('missions.enabledOn') : t('missions.enabledOff')}
            </button>

            <span className="text-xs uppercase tracking-[0.18em] text-white/50">{t('missions.difficulty')}</span>
            <select
              className="term-select"
              value={preferences.difficulty}
              onChange={(event) => onSetDifficulty(event.target.value as MissionDifficulty)}
              disabled={!preferences.missionsEnabled}
            >
              {DIFFICULTY_OPTIONS.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {t(`missions.difficultyOption.${difficulty}`)}
                </option>
              ))}
            </select>

            <button className="term-btn-secondary" onClick={onToggleRerolls} disabled={!preferences.missionsEnabled}>
              {preferences.rerollsEnabled ? t('missions.rerollsOn') : t('missions.rerollsOff')}
            </button>

            {preferences.missionsEnabled && preferences.rerollsEnabled && (
              <span className="text-xs uppercase tracking-[0.18em] text-white/50">
                {t('missions.rerollsUsed', { used: missionMeta.rerollsUsed, limit: missionMeta.rerollsLimit })}
              </span>
            )}

            {preferences.missionsEnabled && !preferences.rerollsEnabled && (
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">{t('missions.stableSet')}</span>
            )}

            {!preferences.missionsEnabled && (
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">{t('missions.disabledInfo')}</span>
            )}
          </div>
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

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="term-frame">
          <div className="term-panel rounded-[15px] p-5">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-label">{t('missions.sections.daily')}</div>
            <div className="mt-4 grid gap-3">
              {!preferences.missionsEnabled && (
                <div className="term-mission">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/60">{t('missions.disabledMessage')}</div>
                </div>
              )}
              {preferences.missionsEnabled &&
                dailyMissions.map((mission) => (
                  <div key={mission.id} className="term-mission">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                      <span>{getLocalizedMissionLabel(mission.id, mission.label)}</span>
                      <span>{mission.done ? t('missions.status.complete') : mission.rewardLabel}</span>
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
                    {preferences.rerollsEnabled && !mission.done && (
                      <button
                        className="term-btn-secondary mt-3"
                        onClick={() => onRerollMission(mission.id)}
                        disabled={missionMeta.rerollsUsed >= missionMeta.rerollsLimit}
                      >
                        {t('missions.reroll')}
                      </button>
                    )}
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
            <div className="term-label">{t('missions.sections.report')}</div>
            <div className="mt-4 flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
              <div className="flex items-center justify-between">
                <span>{t('missions.report.steam')}</span>
                <span>{report.steam.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('missions.report.epic')}</span>
                <span>{report.epic.toFixed(2)}</span>
              </div>
              <div className="term-divider" />
              <div className="flex items-center justify-between">
                <span>{t('missions.report.total')}</span>
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
            <div className="term-label">{t('missions.sections.badges')}</div>
            <div className="mt-4 grid gap-3">
              {BADGES.map((badge) => {
                const owned = commander.badges?.includes(badge.id)
                return (
                  <div key={badge.id} className="term-mission">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                      <span>{badge.title}</span>
                      <span>{owned ? t('missions.status.owned') : `${badge.cost} CR`}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/50">{badge.description}</div>
                    {!owned && (
                      <button className="term-btn-secondary mt-3" onClick={() => onBuy(badge)}>
                        {t('missions.purchase')}
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
            <div className="term-label">{t('missions.sections.designs')}</div>
            <div className="mt-4 grid gap-3">
              {DESIGN_CATALOG.map((design) => {
                const unlocked = commander.unlockedDesigns?.includes(design.id) ?? false
                const active = commander.activeDesign === design.id
                return (
                  <div key={design.id} className="term-mission">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                      <span>{getLocalizedDesignName(design.id)}</span>
                      <span>{unlocked ? t('missions.status.owned') : `${design.cost} CR`}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/50">{getLocalizedDesignDescription(design.id)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {active && <span className="term-chip">{t('missions.status.active')}</span>}
                      {!active && unlocked && (
                        <button className="term-btn-secondary" onClick={() => onEquipDesign(design.id)}>
                          {t('missions.equip')}
                        </button>
                      )}
                      {!unlocked && (
                        <button className="term-btn-secondary" onClick={() => onBuyDesign(design.id)}>
                          {t('missions.buyDesign')}
                        </button>
                      )}
                    </div>
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
            <div className="term-label">{t('missions.sections.activity')}</div>
            <div className="mt-3 flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
              {events.length === 0 && <span>{t('missions.activityEmpty')}</span>}
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
