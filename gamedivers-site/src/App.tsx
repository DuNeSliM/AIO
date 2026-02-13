import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import CommanderHud from './components/CommanderHud'
import OnboardingMission, { OPEN_ONBOARDING_EVENT, shouldShowOnboardingMission } from './components/OnboardingMission'
import { DESIGN_CLASS_NAMES, findDesignById } from './designs/registry'
import { useCommander } from './hooks/useCommander'
import { AuthProvider, useAuth } from './hooks/useAuth'
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

const PUBLIC_PAGES: Page[] = ['login', 'register', 'forgot-password']

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

function hasStoredSession(): boolean {
  const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
  return !!accessToken && !!refreshToken
}

function AppShell() {
  const commander = useCommander()
  const { isLoggedIn, isLoading } = useAuth()
  const [page, setPage] = useState<Page>(() => (hasStoredSession() ? 'library' : 'login'))
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboardingMission())

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
    if (isLoading) return

    if (isLoggedIn) {
      if (PUBLIC_PAGES.includes(page)) {
        setPage('library')
      }
      return
    }

    if (!PUBLIC_PAGES.includes(page)) {
      setPage('login')
    }
  }, [isLoggedIn, isLoading, page])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  if (page === 'login') {
    return <Login onSuccess={setPage} />
  }

  if (page === 'register') {
    return <Register onSuccess={setPage} />
  }

  if (page === 'forgot-password') {
    return <ForgotPassword onSuccess={setPage} />
  }

  return (
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

      {showOnboarding && <OnboardingMission onNavigate={setPage} onClose={() => setShowOnboarding(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </AuthProvider>
  )
}
