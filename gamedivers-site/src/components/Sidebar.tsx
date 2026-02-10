import type { ReactNode } from 'react'
import { useSteamAuth } from '../hooks/useSteamAuth'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/i18n'
import type { Page } from '../types'

const LibraryIcon = () => (
  <>
    <rect x="3" y="3" width="4" height="4" strokeWidth="2" />
    <rect x="10" y="3" width="4" height="4" strokeWidth="2" />
    <rect x="17" y="3" width="4" height="4" strokeWidth="2" />
    <rect x="3" y="10" width="4" height="4" strokeWidth="2" />
    <rect x="10" y="10" width="4" height="4" strokeWidth="2" />
    <rect x="17" y="10" width="4" height="4" strokeWidth="2" />
    <rect x="3" y="17" width="4" height="4" strokeWidth="2" />
    <rect x="10" y="17" width="4" height="4" strokeWidth="2" />
    <rect x="17" y="17" width="4" height="4" strokeWidth="2" />
  </>
)

const StoreIcon = () => (
  <>
    <path d="M3 9h18v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9z" strokeWidth="2" fill="none" />
    <path d="M3 9l2-4h14l2 4M8 13v4M12 13v4M16 13v4" strokeWidth="2" />
  </>
)

const DownloadIcon = () => (
  <>
    <path d="M12 3v11m0 0l-4-4m4 4l4-4" strokeWidth="2" />
    <path d="M4 18h16" strokeWidth="2" />
  </>
)

const SettingsIcon = () => (
  <>
    <circle cx="12" cy="12" r="2.5" strokeWidth="2" />
    <path
      d="M12 1v4m0 10v4M4.22 4.22l2.83 2.83m4.24 4.24l2.83 2.83M1 12h4m10 0h4m-16.78 7.78l2.83-2.83m4.24-4.24l2.83-2.83"
      strokeWidth="2"
    />
  </>
)

type SidebarIconProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  className?: string
}

const SidebarIcon = ({ icon, label, onClick, className }: SidebarIconProps) => (
  <button
    className={`group flex flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] transition ${
      className || ''
    }`}
    title={label}
    onClick={onClick}
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neon/20 bg-panel/80 text-neon shadow-glow transition group-hover:-translate-y-0.5 group-hover:border-neon/60">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {icon}
      </svg>
    </div>
    <span className="text-[10px] tone-muted group-hover:text-neon">{label}</span>
  </button>
)

type SidebarProps = {
  activePage?: Page
  onNavigate?: (page: Page) => void
}

export default function Sidebar({ activePage = 'library', onNavigate }: SidebarProps) {
  const steamAuth = useSteamAuth()
  const { user, logout, isLoading } = useAuth()
  const { t } = useI18n()

  const handleLogout = async () => {
    await logout()
    onNavigate?.('login')
  }

  return (
    <aside className="flex w-24 flex-col items-center gap-8 border-r border-neon/10 bg-panel/60 px-3 py-6 backdrop-blur">
      <div className="flex flex-col items-center gap-3">
        <div className="font-display text-xl text-ember">AIO</div>
        <div className="hud-divider w-10" />
        {user && (
          <div className="text-[10px] uppercase tracking-[0.25em] tone-muted" title={user.username}>
            {user.username}
          </div>
        )}
        {steamAuth.isLoggedIn && (
          <div className="text-[10px] uppercase tracking-[0.25em] tone-muted" title={steamAuth.username ?? undefined}>
            {steamAuth.username}
          </div>
        )}
      </div>
      <nav className="flex flex-col gap-5">
        <SidebarIcon
          icon={<LibraryIcon />}
          label={t('nav.library')}
          onClick={() => onNavigate?.('library')}
          className={activePage === 'library' ? 'text-neon' : 'tone-muted'}
        />
        <SidebarIcon
          icon={<StoreIcon />}
          label={t('nav.store')}
          onClick={() => onNavigate?.('store')}
          className={activePage === 'store' ? 'text-neon' : 'tone-muted'}
        />
        <SidebarIcon
          icon={<DownloadIcon />}
          label={t('nav.downloads')}
          onClick={() => onNavigate?.('downloads')}
          className={activePage === 'downloads' ? 'text-neon' : 'tone-muted'}
        />
        <SidebarIcon
          icon={<SettingsIcon />}
          label={t('nav.settings')}
          onClick={() => onNavigate?.('settings')}
          className={activePage === 'settings' ? 'text-neon' : 'tone-muted'}
        />
      </nav>
      <div className="mt-auto flex w-full flex-col gap-3">
        {user && (
          <button 
            className="btn-ghost w-full text-xs" 
            onClick={handleLogout}
            disabled={isLoading}
          >
            {isLoading ? t('auth.loggingOut') : t('auth.logout')}
          </button>
        )}
        {!steamAuth.isLoggedIn ? (
          <button className="btn-primary w-full text-xs" onClick={steamAuth.login}>
            {t('auth.steamLogin')}
          </button>
        ) : (
          <button className="btn-ghost w-full text-xs" onClick={steamAuth.logout}>
            {t('auth.steamLogout')}
          </button>
        )}
        <button className="btn-soft w-full text-xs" onClick={() => window.dispatchEvent(new Event('epic-local-sync'))}>
          {t('epic.localSync')}
        </button>
        <small className="text-center text-[10px] tone-muted">v0.1</small>
      </div>
    </aside>
  )
}
