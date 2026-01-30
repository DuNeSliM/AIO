import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import GameLibrary from './pages/GameLibrary'
import Store from './pages/Store'
import Settings from './pages/Settings'
import { I18nProvider } from './i18n/i18n'
import type { Page, Theme } from './types'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

export default function App() {
  const [page, setPage] = useState<Page>('library')
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <I18nProvider>
      <div className="app-root">
        <Sidebar activePage={page} onNavigate={setPage} />
        <main className="app-main">
          {page === 'store' && <Store />}
          {page === 'settings' && <Settings theme={theme} onToggleTheme={toggleTheme} />}
          {page !== 'store' && page !== 'settings' && <GameLibrary />}
        </main>
      </div>
    </I18nProvider>
  )
}
