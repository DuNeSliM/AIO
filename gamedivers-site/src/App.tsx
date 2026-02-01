import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import GameLibrary from './pages/GameLibrary'
import Store from './pages/Store'
import Settings from './pages/Settings'
import CommanderHud from './components/CommanderHud'
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
      <div className="hud-shell">
        <div className="relative z-10 flex min-h-screen">
          <Sidebar activePage={page} onNavigate={setPage} />
          <main className="flex-1 px-6 py-8 lg:px-10">
            <div className="mb-6">
              <CommanderHud />
            </div>
            {page === 'store' && <Store />}
            {page === 'settings' && <Settings theme={theme} onToggleTheme={toggleTheme} />}
            {page !== 'store' && page !== 'settings' && <GameLibrary />}
          </main>
        </div>
      </div>
    </I18nProvider>
  )
}
