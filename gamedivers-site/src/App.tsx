import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import CommanderHud from './components/CommanderHud'
import OnboardingMission, { OPEN_ONBOARDING_EVENT, shouldShowOnboardingMission } from './components/OnboardingMission'
import { DESIGN_CLASS_NAMES, findDesignById } from './designs/registry'
import { useCommander } from './hooks/useCommander'
import { I18nProvider } from './i18n/i18n'
import ForgotPassword from './pages/ForgotPassword'
import GameLibrary from './pages/GameLibrary'
import Login from './pages/Login'
import Missions from './pages/Missions'
import Register from './pages/Register'
import Settings from './pages/Settings'
import Store from './pages/Store'
import type { Page, Theme } from './types'
import { evaluateDailyMissionsFromStorage } from './utils/gameify'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

function isUserLoggedIn(): boolean {
  const accessToken = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  return !!accessToken && !!refreshToken
}

export default function App() {
  const commander = useCommander()
  const [page, setPage] = useState<Page>(() => (isUserLoggedIn() ? 'library' : 'login'))
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboardingMission())
  const isInitializedRef = useRef(false)
  const loggedIn = isUserLoggedIn()

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    DESIGN_CLASS_NAMES.forEach((className) => document.body.classList.remove(className))
    const activeClass = findDesignById(commander.activeDesign)?.className ?? DESIGN_CLASS_NAMES[0]
    if (activeClass) {
      document.body.classList.add(activeClass)
    }
  }, [commander.activeDesign])

  useEffect(() => {
    const syncMissions = () => {
      evaluateDailyMissionsFromStorage()
    }
    syncMissions()
    window.addEventListener('mission-update', syncMissions)
    return () => window.removeEventListener('mission-update', syncMissions)
  }, [])

  useEffect(() => {
    const openOnboarding = () => setShowOnboarding(true)
    window.addEventListener(OPEN_ONBOARDING_EVENT, openOnboarding)
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, openOnboarding)
  }, [])

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }

    if (!loggedIn && page !== 'register' && page !== 'login' && page !== 'forgot-password') {
      setPage('login')
    }
  }, [loggedIn, page])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  if (page === 'login') {
    return (
      <I18nProvider>
        <Login onSuccess={setPage} />
      </I18nProvider>
    )
  }

  if (page === 'register') {
    return (
      <I18nProvider>
        <Register onSuccess={setPage} />
      </I18nProvider>
    )
  }

  if (page === 'forgot-password') {
    return (
      <I18nProvider>
        <ForgotPassword onSuccess={setPage} />
      </I18nProvider>
    )
  }

  return (
    <I18nProvider>
      <div className="hud-shell">
        <div className="relative z-10 flex min-h-screen">
          <Sidebar activePage={page} onNavigate={setPage} />
          <main className="flex-1 px-6 py-8 lg:px-10">
            <div className="mb-6">
              <CommanderHud />
            </div>
            {page === 'store' && <Store />}
            {page === 'downloads' && <Missions />}
            {page === 'settings' && <Settings theme={theme} onToggleTheme={toggleTheme} />}
            {page === 'library' && <GameLibrary />}
          </main>
        </div>

        {showOnboarding && (
          <OnboardingMission
            onNavigate={setPage}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </div>
    </I18nProvider>
  )
}
