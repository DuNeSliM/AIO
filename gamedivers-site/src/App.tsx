import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import GameLibrary from './pages/GameLibrary'
import Store from './pages/Store'
import Settings from './pages/Settings'
import Missions from './pages/Missions'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import CommanderHud from './components/CommanderHud'
import { I18nProvider } from './i18n/i18n'
import { useAuth } from './hooks/useAuth'
import type { Page, Theme } from './types'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

export default function App() {
  const { isLoggedIn } = useAuth()
  const [page, setPage] = useState<Page>(() => isLoggedIn ? 'library' : 'login')
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn && page !== 'register' && page !== 'login' && page !== 'forgot-password') {
      setPage('login')
    }
  }, [isLoggedIn, page])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Show login/register/forgot-password pages without sidebar
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
      </div>
    </I18nProvider>
  )
}
