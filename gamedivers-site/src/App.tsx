import { useEffect, useState, useRef } from 'react'
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
import { AuthProvider, useAuth } from './context/AuthContext'
import type { Page, Theme } from './types'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

function AppContent() {
  const { isLoggedIn } = useAuth()
  const [page, setPage] = useState<Page>('library')
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const isInitializedRef = useRef(false)

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Redirect to login if not authenticated (but skip first render)
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }

    if (!isLoggedIn && page !== 'register' && page !== 'login' && page !== 'forgot-password') {
      setPage('login')
    }
  }, [isLoggedIn, page])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Show login/register/forgot-password pages without sidebar
  if (page === 'login') {
    return <Login onSuccess={setPage} />
  }

  if (page === 'register') {
    return <Register onSuccess={setPage} />
  }

  if (page === 'forgot-password') {
    return <ForgotPassword onSuccess={setPage} />
  }

  // For protected pages, require login
  if (!isLoggedIn) {
    return <Login onSuccess={setPage} />
  }

  return (
    <div className="hud-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="relative z-10 ml-24 flex min-h-screen flex-col">
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
  )
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </AuthProvider>
  )
}
