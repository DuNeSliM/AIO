import { useSteamAuth } from '../hooks/useSteamAuth'
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
  icon: JSX.Element
  label: string
  onClick: () => void
  className?: string
}

const SidebarIcon = ({ icon, label, onClick, className }: SidebarIconProps) => (
  <button className={`sidebar-icon ${className || ''}`} title={label} onClick={onClick}>
    <div className="icon-box">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {icon}
      </svg>
    </div>
    <span className="icon-label">{label}</span>
  </button>
)

type SidebarProps = {
  activePage?: Page
  onNavigate?: (page: Page) => void
}

export default function Sidebar({ activePage = 'library', onNavigate }: SidebarProps) {
  const steamAuth = useSteamAuth()
  const { t } = useI18n()

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="logo">AIO</div>
        {steamAuth.isLoggedIn && (
          <div className="user-badge" title={steamAuth.username ?? undefined}>
            {steamAuth.username}
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        <SidebarIcon
          icon={<LibraryIcon />}
          label={t('nav.library')}
          onClick={() => onNavigate?.('library')}
          className={activePage === 'library' ? 'active' : ''}
        />
        <SidebarIcon
          icon={<StoreIcon />}
          label={t('nav.store')}
          onClick={() => onNavigate?.('store')}
          className={activePage === 'store' ? 'active' : ''}
        />
        <SidebarIcon icon={<DownloadIcon />} label={t('nav.downloads')} onClick={() => {}} />
        <SidebarIcon
          icon={<SettingsIcon />}
          label={t('nav.settings')}
          onClick={() => onNavigate?.('settings')}
          className={activePage === 'settings' ? 'active' : ''}
        />
      </nav>
      <div className="sidebar-bottom">
        {!steamAuth.isLoggedIn ? (
          <button className="steam-login-btn" onClick={steamAuth.login}>
            {t('auth.steamLogin')}
          </button>
        ) : (
          <button className="steam-logout-btn" onClick={steamAuth.logout}>
            {t('auth.steamLogout')}
          </button>
        )}
        <button
          className="steam-login-btn"
          onClick={() => window.dispatchEvent(new Event('epic-local-sync'))}
          style={{ marginTop: '8px' }}
        >
          {t('epic.localSync')}
        </button>
        <small>v0.1</small>
      </div>
    </aside>
  )
}

