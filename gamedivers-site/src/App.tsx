import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import CommanderHud from './components/CommanderHud'
import OnboardingMission, { OPEN_ONBOARDING_EVENT, shouldShowOnboardingMission } from './components/OnboardingMission'
import { DEFAULT_DESIGN_ID, DESIGN_CLASS_NAMES, findDesignById, getDesignManifest } from './designs/registry'
import { useCommander } from './hooks/useCommander'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { I18nProvider } from './i18n/i18n'
import AppLayout from './layouts/AppLayout'
import ForgotPassword from './pages/ForgotPassword'
import GameLibrary from './pages/GameLibrary'
import Login from './pages/Login'
import Missions from './pages/Missions'
import Register from './pages/Register'
import Settings from './pages/Settings'
import Store from './pages/Store'
import type { Page, Theme } from './types'
import { DESIGN_PREVIEW_EVENT, evaluateDailyMissionsFromStorage, loadDesignPreview } from './utils/gameify'

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
  const [previewDesign, setPreviewDesign] = useState(() => loadDesignPreview())
  const activeDesignId = previewDesign ?? commander.activeDesign ?? DEFAULT_DESIGN_ID
  const activeDesign = findDesignById(activeDesignId) ?? findDesignById(DEFAULT_DESIGN_ID)
  const activeDesignClass = activeDesign?.className ?? DESIGN_CLASS_NAMES[0]
  const activeManifest = getDesignManifest(activeDesign?.id ?? DEFAULT_DESIGN_ID)

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    DESIGN_CLASS_NAMES.forEach((className) => document.body.classList.remove(className))
    if (activeDesignClass) {
      document.body.classList.add(activeDesignClass)
    }
  }, [activeDesignClass])

  useEffect(() => {
    const manifest = getDesignManifest(activeDesign?.id ?? DEFAULT_DESIGN_ID)
    const bodyStyle = document.body.style

    const setRuntimeLayer = (variable: string, value: string | undefined) => {
      if (value) {
        bodyStyle.setProperty(variable, value)
        return
      }
      bodyStyle.removeProperty(variable)
    }

    setRuntimeLayer('--ui-runtime-panel-bg', manifest.assets.panelTexture)
    setRuntimeLayer('--ui-runtime-btn-primary-bg', manifest.assets.buttonTexture)
    setRuntimeLayer('--ui-runtime-btn-secondary-bg', manifest.assets.buttonTexture)
    setRuntimeLayer('--ui-runtime-btn-ghost-bg', manifest.assets.buttonTexture)
    setRuntimeLayer('--ui-runtime-btn-soft-bg', manifest.assets.buttonTexture)
    setRuntimeLayer('--ui-runtime-sidebar-bg', manifest.assets.sidebarTexture)
  }, [activeDesign?.id])

  useEffect(() => {
    const handler = () => setPreviewDesign(loadDesignPreview())
    window.addEventListener(DESIGN_PREVIEW_EVENT, handler)
    return () => window.removeEventListener(DESIGN_PREVIEW_EVENT, handler)
  }, [])

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
    <div className="ui-shell">
      <div className="ui-shell-art" aria-hidden="true" />
      <div className="ui-shell-art ui-shell-art--front" aria-hidden="true" />
      <AppLayout preset={activeManifest.layout} sidebar={<Sidebar activePage={page} onNavigate={setPage} />} header={<CommanderHud />}>
        {page === 'store' && <Store />}
        {page === 'downloads' && <Missions />}
        {page === 'settings' && <Settings theme={theme} onToggleTheme={toggleTheme} />}
        {page === 'library' && <GameLibrary />}
      </AppLayout>

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
