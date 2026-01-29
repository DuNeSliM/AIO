import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import GameLibrary from './pages/GameLibrary'
import Store from './pages/Store'
import Settings from './pages/Settings'
import { I18nProvider } from './i18n/i18n.jsx'

export default function App(){
  const [page, setPage] = useState('library')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
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
