import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import type { Page } from '../types'
import { loadCounters } from '../utils/gameify'

const ONBOARDING_MISSION_KEY = 'onboardingMissionCompleted'
const ONBOARDING_PROGRESS_KEY = 'onboardingMissionProgress'
const ONBOARDING_MINIMIZED_KEY = 'onboardingMissionMinimized'
const ONBOARDING_BASELINE_KEY = 'onboardingMissionBaseline'

export const OPEN_ONBOARDING_EVENT = 'open-onboarding'

type OnboardingStepId = 'search' | 'compare' | 'addWishlist' | 'runSync'

type OnboardingProgress = Record<OnboardingStepId, boolean>

type OnboardingBaseline = {
  dateKey: string
  scans: number
  compares: number
  syncs: number
  wishlistCount: number
}

type TutorialStep = {
  id: OnboardingStepId
  page: Page
}

type OnboardingMissionProps = {
  onNavigate: (page: Page) => void
  onClose: () => void
}

const STEPS: TutorialStep[] = [
  { id: 'search', page: 'store' },
  { id: 'compare', page: 'store' },
  { id: 'addWishlist', page: 'store' },
  { id: 'runSync', page: 'store' },
]

function defaultProgress(): OnboardingProgress {
  return {
    search: false,
    compare: false,
    addWishlist: false,
    runSync: false,
  }
}

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

function snapshotBaseline(): OnboardingBaseline {
  const counters = loadCounters()
  return {
    dateKey: counters.dateKey,
    scans: counters.scans,
    compares: counters.compares,
    syncs: counters.syncs,
    wishlistCount: loadWishlistCount(),
  }
}

function loadOnboardingProgress(): OnboardingProgress {
  const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY)
  if (!raw) return defaultProgress()

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>
    return {
      search: parsed.search === true,
      compare: parsed.compare === true,
      addWishlist: parsed.addWishlist === true,
      runSync: parsed.runSync === true,
    }
  } catch {
    return defaultProgress()
  }
}

function saveOnboardingProgress(progress: OnboardingProgress) {
  localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress))
}

function loadOnboardingMinimized() {
  return localStorage.getItem(ONBOARDING_MINIMIZED_KEY) === 'true'
}

function saveOnboardingMinimized(value: boolean) {
  localStorage.setItem(ONBOARDING_MINIMIZED_KEY, value ? 'true' : 'false')
}

function loadOnboardingBaseline(): OnboardingBaseline {
  const current = snapshotBaseline()
  const raw = localStorage.getItem(ONBOARDING_BASELINE_KEY)
  if (!raw) {
    localStorage.setItem(ONBOARDING_BASELINE_KEY, JSON.stringify(current))
    return current
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingBaseline>
    if (parsed.dateKey !== current.dateKey) {
      localStorage.setItem(ONBOARDING_BASELINE_KEY, JSON.stringify(current))
      return current
    }
    return {
      dateKey: current.dateKey,
      scans: typeof parsed.scans === 'number' ? parsed.scans : current.scans,
      compares: typeof parsed.compares === 'number' ? parsed.compares : current.compares,
      syncs: typeof parsed.syncs === 'number' ? parsed.syncs : current.syncs,
      wishlistCount: typeof parsed.wishlistCount === 'number' ? parsed.wishlistCount : current.wishlistCount,
    }
  } catch {
    localStorage.setItem(ONBOARDING_BASELINE_KEY, JSON.stringify(current))
    return current
  }
}

function saveOnboardingBaseline(baseline: OnboardingBaseline) {
  localStorage.setItem(ONBOARDING_BASELINE_KEY, JSON.stringify(baseline))
}

export function shouldShowOnboardingMission() {
  return localStorage.getItem(ONBOARDING_MISSION_KEY) !== 'true'
}

export function openOnboardingMission() {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT))
}

export function restartOnboardingMission() {
  localStorage.setItem(ONBOARDING_MISSION_KEY, 'false')
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY)
  localStorage.removeItem(ONBOARDING_BASELINE_KEY)
  saveOnboardingMinimized(false)
  openOnboardingMission()
}

export default function OnboardingMission({ onNavigate, onClose }: OnboardingMissionProps) {
  const { t } = useI18n()
  const [progress, setProgress] = useState<OnboardingProgress>(() => loadOnboardingProgress())
  const [minimized, setMinimized] = useState(() => loadOnboardingMinimized())
  const [baseline, setBaseline] = useState<OnboardingBaseline>(() => loadOnboardingBaseline())

  const syncProgress = useCallback(() => {
    const counters = loadCounters()
    const wishlistCount = loadWishlistCount()

    let activeBaseline = baseline
    if (baseline.dateKey !== counters.dateKey) {
      activeBaseline = {
        dateKey: counters.dateKey,
        scans: counters.scans,
        compares: counters.compares,
        syncs: counters.syncs,
        wishlistCount,
      }
      setBaseline(activeBaseline)
      saveOnboardingBaseline(activeBaseline)
    }

    setProgress((prev) => {
      const next: OnboardingProgress = {
        search: prev.search || counters.scans > activeBaseline.scans,
        compare: prev.compare || counters.compares > activeBaseline.compares,
        addWishlist: prev.addWishlist || wishlistCount > activeBaseline.wishlistCount,
        runSync: prev.runSync || counters.syncs > activeBaseline.syncs,
      }

      const changed =
        next.search !== prev.search ||
        next.compare !== prev.compare ||
        next.addWishlist !== prev.addWishlist ||
        next.runSync !== prev.runSync

      if (changed) {
        saveOnboardingProgress(next)
        return next
      }

      return prev
    })
  }, [baseline])

  useEffect(() => {
    syncProgress()
    window.addEventListener('mission-update', syncProgress)
    window.addEventListener('focus', syncProgress)
    return () => {
      window.removeEventListener('mission-update', syncProgress)
      window.removeEventListener('focus', syncProgress)
    }
  }, [syncProgress])

  const doneCount = useMemo(() => STEPS.filter((step) => progress[step.id]).length, [progress])
  const allDone = doneCount === STEPS.length

  const setMinimizedState = (value: boolean) => {
    setMinimized(value)
    saveOnboardingMinimized(value)
  }

  const completeAndClose = () => {
    localStorage.setItem(ONBOARDING_MISSION_KEY, 'true')
    onClose()
  }

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]">
        <button
          className="term-btn-secondary"
          onClick={() => setMinimizedState(false)}
          title={t('onboarding.open')}
        >
          {t('onboarding.open')} {doneCount}/{STEPS.length}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-md px-4 sm:px-0">
      <div className="term-frame">
        <div className="term-panel rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="term-label">{t('onboarding.label')}</div>
              <h2 className="mt-3 text-lg tone-primary">{t('onboarding.title')}</h2>
            </div>
            <button className="term-btn-secondary" onClick={() => setMinimizedState(true)}>
              {t('onboarding.minimize')}
            </button>
          </div>

          <p className="mt-2 text-sm term-subtle">{t('onboarding.subtitle')}</p>

          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/55">
            {t('onboarding.progress', { done: doneCount, total: STEPS.length })}
          </div>

          <div className="mt-4 grid gap-2">
            {STEPS.map((step) => {
              const done = progress[step.id] === true
              const pageKey = `onboarding.pages.${step.page}`
              const pageLabel = t(pageKey) === pageKey ? step.page : t(pageKey)

              return (
                <div key={step.id} className="term-mission">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                        {t(`onboarding.steps.${step.id}.title`)}
                      </div>
                      <div className="mt-1 text-xs term-subtle">{t(`onboarding.steps.${step.id}.description`)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="term-chip">{done ? t('onboarding.status.complete') : t('onboarding.status.pending')}</span>
                      {!done && (
                        <button className="term-btn-secondary" onClick={() => onNavigate(step.page)}>
                          {t('onboarding.openPage', { page: pageLabel })}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="term-btn-secondary" onClick={completeAndClose}>
              {t('onboarding.skip')}
            </button>
            <button className="term-btn-primary" onClick={completeAndClose} disabled={!allDone}>
              {t('onboarding.finish')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
