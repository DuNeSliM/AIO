import { useI18n } from '../i18n/i18n'
import { useWishlist } from '../hooks/useWishlist'
import type { Theme } from '../types'

type SettingsProps = {
  theme: Theme
  onToggleTheme: () => void
}

export default function Settings({ theme, onToggleTheme }: SettingsProps) {
  const { lang, setLang, t } = useI18n()
  const isDark = theme === 'dark'
  const region = localStorage.getItem('storeRegion') || 'DE'
  const {
    onedriveStatus,
    onedriveSupported,
    connectOnedrive,
    disconnectOnedrive,
    requestOnedriveAccess,
    notificationsEnabled,
    notificationsSupported,
    enableNotifications,
    disableNotifications,
  } = useWishlist(region)

  return (
    <div className="flex flex-col gap-6">
      <header className="term-frame term-frame--orange">
        <div className="term-panel rounded-[15px] p-6">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="term-label">{t('settings.title')}</p>
          <h1 className="text-2xl tone-primary">{t('settings.title')}</h1>
          <p className="text-sm term-subtle">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="term-frame">
        <div className="term-panel rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.theme')}</div>
              <div className="text-xs term-subtle">{t('settings.themeHint')}</div>
            </div>
            <button className="term-btn-primary" onClick={onToggleTheme}>
              {isDark ? t('settings.dark') : t('settings.light')}
            </button>
          </div>
        </div>
      </div>

      <div className="term-frame">
        <div className="term-panel rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.language')}</div>
              <div className="text-xs term-subtle">{t('settings.languageHint')}</div>
            </div>
            <button className="term-btn-secondary" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}>
              {lang === 'de' ? 'Deutsch' : 'English'}
            </button>
          </div>
        </div>
      </div>

      <div className="term-frame">
        <div className="term-panel rounded-[15px] p-5">
          <div className="term-corners">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="term-label">Wishlist Settings</div>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="term-subtle">{t('store.wishlist.notifications')}</span>
              <button
                className="term-btn-secondary"
                onClick={() => (notificationsEnabled ? disableNotifications() : void enableNotifications())}
                disabled={!notificationsSupported}
              >
                {notificationsEnabled ? t('store.wishlist.disable') : t('store.wishlist.enable')}
              </button>
              {!notificationsSupported && <span className="text-xs term-subtle">{t('store.wishlist.notSupported')}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="term-subtle">{t('store.wishlist.onedrive')}</span>
              {onedriveStatus === 'connected' ? (
                <button className="term-btn-secondary" onClick={() => void disconnectOnedrive()}>
                  {t('store.wishlist.disconnect')}
                </button>
              ) : onedriveStatus === 'permission-required' ? (
                <button className="term-btn-secondary" onClick={() => void requestOnedriveAccess()}>
                  {t('store.wishlist.grant')}
                </button>
              ) : (
                <button className="term-btn-secondary" onClick={() => void connectOnedrive()} disabled={!onedriveSupported}>
                  {t('store.wishlist.connect')}
                </button>
              )}
              {!onedriveSupported && <span className="text-xs term-subtle">{t('store.wishlist.notSupported')}</span>}
              {onedriveSupported && onedriveStatus === 'connected' && <span className="term-chip">{t('store.wishlist.connected')}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
