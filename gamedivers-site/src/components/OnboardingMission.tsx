import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import UiCorners from './ui/UiCorners'
import { APP_EVENTS, emitAppEvent, onAppEvent } from '../shared/events'
import { STORAGE_KEYS } from '../shared/storage/keys'
import type { Page } from '../types'
import { loadCounters, loadEventLog } from '../utils/gameify'

const ONBOARDING_MISSION_KEY = 'onboardingMissionCompleted'
const ONBOARDING_PROGRESS_KEY = 'onboardingMissionProgress'
const ONBOARDING_MINIMIZED_KEY = 'onboardingMissionMinimized'
const ONBOARDING_BASELINE_KEY = 'onboardingMissionBaseline'

export const OPEN_ONBOARDING_EVENT = APP_EVENTS.openOnboarding

type OnboardingStepId =
  | 'visitLibrary'
  | 'visitStore'
  | 'search'
  | 'compare'
  | 'addWishlist'
  | 'runSync'
  | 'visitMissions'
  | 'visitSettings'
  | 'importWishlist'
  | 'launchGame'

type OnboardingProgress = Record<OnboardingStepId, boolean>

type OnboardingBaseline = {
  dateKey: string
  scans: number
  compares: number
  syncs: number
  launchUnplayed: number
  wishlistCount: number
  startedAt: number
}

type TutorialStep = {
  id: OnboardingStepId
  page: Page
  optional?: boolean
}

type OnboardingMissionProps = {
  currentPage: Page
  onNavigate: (page: Page) => void
  onClose: () => void
}

const STEPS: TutorialStep[] = [
  { id: 'visitLibrary', page: 'library' },
  { id: 'visitStore', page: 'store' },
  { id: 'search', page: 'store' },
  { id: 'compare', page: 'store' },
  { id: 'addWishlist', page: 'store' },
  { id: 'runSync', page: 'store' },
  { id: 'visitMissions', page: 'downloads' },
  { id: 'visitSettings', page: 'settings' },
  { id: 'importWishlist', page: 'store', optional: true },
  { id: 'launchGame', page: 'library', optional: true },
]

function defaultProgress(): OnboardingProgress {
  return {
    visitLibrary: false,
    visitStore: false,
    search: false,
    compare: false,
    addWishlist: false,
    runSync: false,
    visitMissions: false,
    visitSettings: false,
    importWishlist: false,
    launchGame: false,
  }
}

function loadWishlistCount() {
  const raw = localStorage.getItem(STORAGE_KEYS.wishlist.items)
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
    launchUnplayed: counters.launchUnplayed,
    wishlistCount: loadWishlistCount(),
    startedAt: Date.now(),
  }
}

function loadOnboardingProgress(): OnboardingProgress {
  const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY)
  if (!raw) return defaultProgress()

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>
    return {
      visitLibrary: parsed.visitLibrary === true,
      visitStore: parsed.visitStore === true,
      search: parsed.search === true,
      compare: parsed.compare === true,
      addWishlist: parsed.addWishlist === true,
      runSync: parsed.runSync === true,
      visitMissions: parsed.visitMissions === true,
      visitSettings: parsed.visitSettings === true,
      importWishlist: parsed.importWishlist === true,
      launchGame: parsed.launchGame === true,
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
      launchUnplayed: typeof parsed.launchUnplayed === 'number' ? parsed.launchUnplayed : current.launchUnplayed,
      wishlistCount: typeof parsed.wishlistCount === 'number' ? parsed.wishlistCount : current.wishlistCount,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : current.startedAt,
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
  emitAppEvent(APP_EVENTS.openOnboarding)
}

export function restartOnboardingMission() {
  localStorage.setItem(ONBOARDING_MISSION_KEY, 'false')
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY)
  localStorage.removeItem(ONBOARDING_BASELINE_KEY)
  saveOnboardingMinimized(false)
  openOnboardingMission()
}

export default function OnboardingMission({ currentPage, onNavigate, onClose }: OnboardingMissionProps) {
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
        launchUnplayed: counters.launchUnplayed,
        wishlistCount,
        startedAt: Date.now(),
      }
      setBaseline(activeBaseline)
      saveOnboardingBaseline(activeBaseline)
    }

    const importedFromSteam = loadEventLog().some(
      (entry) => entry.timestamp >= activeBaseline.startedAt && entry.message.startsWith('STEAM WISHLIST SYNC:'),
    )

    setProgress((prev) => {
      const next: OnboardingProgress = {
        visitLibrary: prev.visitLibrary || currentPage === 'library',
        visitStore: prev.visitStore || currentPage === 'store',
        search: prev.search || counters.scans > activeBaseline.scans,
        compare: prev.compare || counters.compares > activeBaseline.compares,
        addWishlist: prev.addWishlist || wishlistCount > activeBaseline.wishlistCount,
        runSync: prev.runSync || counters.syncs > activeBaseline.syncs,
        visitMissions: prev.visitMissions || currentPage === 'downloads',
        visitSettings: prev.visitSettings || currentPage === 'settings',
        importWishlist: prev.importWishlist || importedFromSteam,
        launchGame: prev.launchGame || counters.launchUnplayed > activeBaseline.launchUnplayed,
      }

      const changed =
        next.visitLibrary !== prev.visitLibrary ||
        next.visitStore !== prev.visitStore ||
        next.search !== prev.search ||
        next.compare !== prev.compare ||
        next.addWishlist !== prev.addWishlist ||
        next.runSync !== prev.runSync ||
        next.visitMissions !== prev.visitMissions ||
        next.visitSettings !== prev.visitSettings ||
        next.importWishlist !== prev.importWishlist ||
        next.launchGame !== prev.launchGame

      if (changed) {
        saveOnboardingProgress(next)
        return next
      }

      return prev
    })
  }, [baseline, currentPage])

  useEffect(() => {
    syncProgress()
    const unsubMission = onAppEvent(APP_EVENTS.missionUpdate, syncProgress)
    window.addEventListener('focus', syncProgress)
    return () => {
      unsubMission()
      window.removeEventListener('focus', syncProgress)
    }
  }, [syncProgress])

  const requiredSteps = useMemo(() => STEPS.filter((step) => step.optional !== true), [])
  const optionalSteps = useMemo(() => STEPS.filter((step) => step.optional === true), [])
  const requiredDoneCount = useMemo(
    () => requiredSteps.filter((step) => progress[step.id]).length,
    [requiredSteps, progress],
  )
  const optionalDoneCount = useMemo(
    () => optionalSteps.filter((step) => progress[step.id]).length,
    [optionalSteps, progress],
  )
  const allDone = requiredDoneCount === requiredSteps.length
  const currentRequiredStep = useMemo(
    () => requiredSteps.find((step) => !progress[step.id]) ?? null,
    [requiredSteps, progress],
  )
  const currentOptionalStep = useMemo(
    () => optionalSteps.find((step) => !progress[step.id]) ?? null,
    [optionalSteps, progress],
  )
  const activeStep = currentRequiredStep ?? currentOptionalStep
  const activeStepIndex = activeStep ? STEPS.findIndex((step) => step.id === activeStep.id) + 1 : null
  const activeStepPageKey = activeStep ? `onboarding.pages.${activeStep.page}` : null
  const activeStepPageLabel =
    activeStep && activeStepPageKey
      ? t(activeStepPageKey) === activeStepPageKey
        ? activeStep.page
        : t(activeStepPageKey)
      : ''
  const activeStepHowToKey = activeStep ? `onboarding.steps.${activeStep.id}.howTo` : null
  const activeStepHowTo =
    activeStep && activeStepHowToKey
      ? t(activeStepHowToKey) === activeStepHowToKey
        ? t(`onboarding.steps.${activeStep.id}.description`)
        : t(activeStepHowToKey)
      : ''

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
          className="ui-btn-secondary"
          onClick={() => setMinimizedState(false)}
          title={t('onboarding.open')}
        >
          {t('onboarding.open')} {requiredDoneCount}/{requiredSteps.length}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-sm px-4 sm:px-0">
      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />

          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="ui-label">{t('onboarding.label')}</div>
              <h2 className="mt-3 text-lg tone-primary">{t('onboarding.title')}</h2>
            </div>
            <button className="ui-btn-secondary" onClick={() => setMinimizedState(true)}>
              {t('onboarding.minimize')}
            </button>
          </div>

          <p className="mt-2 text-sm ui-subtle">{t('onboarding.subtitle')}</p>

          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/55">
            {t('onboarding.progress', { done: requiredDoneCount, total: requiredSteps.length })}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
            {t('onboarding.optionalProgress', { done: optionalDoneCount, total: optionalSteps.length })}
          </div>

          <div className="mt-4">
            {activeStep ? (
              <div className="ui-item">
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
                  <span>{t('onboarding.currentMission')}</span>
                  {activeStepIndex && (
                    <span>{t('onboarding.missionIndex', { index: activeStepIndex, total: STEPS.length })}</span>
                  )}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/75">
                  {t(`onboarding.steps.${activeStep.id}.title`)}
                </div>
                <div className="mt-1 text-xs ui-subtle">{t(`onboarding.steps.${activeStep.id}.description`)}</div>
                <div className="mt-2 text-xs text-white/65">{activeStepHowTo}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeStep.optional && <span className="ui-chip">{t('onboarding.status.optional')}</span>}
                  <span className="ui-chip">{t('onboarding.status.pending')}</span>
                  <button className="ui-btn-secondary" onClick={() => onNavigate(activeStep.page)}>
                    {t('onboarding.openPage', { page: activeStepPageLabel })}
                  </button>
                </div>
              </div>
            ) : (
              <div className="ui-item">
                <div className="text-xs uppercase tracking-[0.18em] text-white/75">{t('onboarding.completeTitle')}</div>
                <div className="mt-1 text-xs ui-subtle">{t('onboarding.completeDescription')}</div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="ui-btn-secondary" onClick={completeAndClose}>
              {t('onboarding.skip')}
            </button>
            <button className="ui-btn-primary" onClick={completeAndClose} disabled={!allDone}>
              {t('onboarding.finish')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




