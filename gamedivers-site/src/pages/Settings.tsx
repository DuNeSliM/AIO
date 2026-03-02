import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import UiCorners from '../components/ui/UiCorners'
import { useWishlist } from '../hooks/useWishlist'
import { useCommander } from '../hooks/useCommander'
import { restartOnboardingMission } from '../components/OnboardingMission'
import { DESIGN_CATALOG } from '../designs/registry'
import { desktopDownloadUrls } from '../shared/desktopDownload'
import { STORAGE_KEYS } from '../shared/storage/keys'
import { getLocalString } from '../shared/storage/storage'
import { equipDesign } from '../utils/gameify'
import type { Theme } from '../types'

type SettingsProps = {
  theme: Theme
  onToggleTheme: () => void
}

function removeStoredKeys(keys: string[]) {
  keys.forEach((key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  })
}

export default function Settings({ theme, onToggleTheme }: SettingsProps) {
  const { lang, setLang, t } = useI18n()
  const commander = useCommander()
  const isDark = theme === 'dark'
  const region = getLocalString(STORAGE_KEYS.app.storeRegion) || 'DE'
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const {
    onedriveStatus,
    onedriveSupported,
    connectOnedrive,
    disconnectOnedrive,
    requestOnedriveAccess,
    notificationsEnabled,
    notificationsSupported,
    notificationPermission,
    enableNotifications,
    disableNotifications,
    clearWishlist,
    reloadWishlist,
  } = useWishlist(region)

  const unlockedDesigns = DESIGN_CATALOG.filter((design) => commander.unlockedDesigns?.includes(design.id))

  useEffect(() => {
    if (!dataMessage) return
    const timer = window.setTimeout(() => setDataMessage(null), 2600)
    return () => window.clearTimeout(timer)
  }, [dataMessage])

  const reloadWishlistData = async () => {
    const ok = await reloadWishlist()
    setDataMessage(ok ? t('settings.data.reloadedWishlist') : t('settings.data.reloadedWishlistFallback'))
  }

  const clearWishlistData = async () => {
    const confirmed = window.confirm(t('settings.data.confirmClearWishlist'))
    if (!confirmed) return
    await clearWishlist()
    setDataMessage(t('settings.data.clearedWishlist'))
  }

  const clearAllGameData = async () => {
    const confirmed = window.confirm(t('settings.data.confirmClearAll'))
    if (!confirmed) return

    await clearWishlist()
    removeStoredKeys([
      STORAGE_KEYS.app.priceCache,
      STORAGE_KEYS.steam.id,
      STORAGE_KEYS.steam.username,
      STORAGE_KEYS.steam.wishlistNameCache,
      STORAGE_KEYS.steam.wishlistShadowCache,
      STORAGE_KEYS.epic.id,
      STORAGE_KEYS.epic.username,
      STORAGE_KEYS.epic.accessToken,
    ])
    window.location.reload()
  }

  const reloadAllData = () => {
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="ui-surface ui-surface--accent">
        <div className="ui-panel ui-panel-pad-lg">
          <UiCorners />
          <p className="ui-label">{t('settings.title')}</p>
          <h1 className="text-2xl tone-primary">{t('settings.title')}</h1>
          <p className="text-sm ui-subtle">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.theme')}</div>
              <div className="text-xs ui-subtle">{t('settings.themeHint')}</div>
            </div>
            <button className="ui-btn-primary" onClick={onToggleTheme}>
              {isDark ? t('settings.dark') : t('settings.light')}
            </button>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.design')}</div>
              <div className="text-xs ui-subtle">{t('settings.designHint')}</div>
            </div>
            <select
              className="ui-select"
              value={commander.activeDesign ?? unlockedDesigns[0]?.id}
              disabled={unlockedDesigns.length === 0}
              onChange={(event) => {
                equipDesign(event.target.value)
              }}
            >
              {unlockedDesigns.length === 0 && <option value="">{t('settings.noDesigns')}</option>}
              {unlockedDesigns.map((design) => (
                <option key={design.id} value={design.id}>
                  {t(`missions.designs.catalog.${design.id}.name`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.tutorial')}</div>
              <div className="text-xs ui-subtle">{t('settings.tutorialHint')}</div>
            </div>
            <button className="ui-btn-secondary" onClick={restartOnboardingMission}>
              {t('settings.restartTutorial')}
            </button>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.language')}</div>
              <div className="text-xs ui-subtle">{t('settings.languageHint')}</div>
            </div>
            <button className="ui-btn-secondary" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}>
              {lang === 'de' ? 'Deutsch' : 'English'}
            </button>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="ui-label">{t('settings.wishlist.title')}</div>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="ui-subtle">{t('store.wishlist.notifications')}</span>
              <button
                className="ui-btn-secondary"
                onClick={() => (notificationsEnabled ? disableNotifications() : void enableNotifications())}
                disabled={!notificationsSupported || (notificationPermission === 'denied' && !notificationsEnabled)}
              >
                {notificationsEnabled ? t('store.wishlist.disable') : t('store.wishlist.enable')}
              </button>
              {!notificationsSupported && <span className="text-xs ui-subtle">{t('store.wishlist.notSupported')}</span>}
              {notificationsSupported && notificationPermission === 'denied' && (
                <span className="text-xs text-amber-300">{t('store.wishlist.permissionDenied')}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex flex-col">
                <span className="ui-subtle">{t('store.wishlist.onedrive')}</span>
                <span className="text-xs ui-subtle">{t('store.wishlist.onedriveHint')}</span>
              </div>
              {onedriveStatus === 'connected' ? (
                <button className="ui-btn-secondary" onClick={() => void disconnectOnedrive()}>
                  {t('store.wishlist.disconnect')}
                </button>
              ) : onedriveStatus === 'permission-required' ? (
                <button className="ui-btn-secondary" onClick={() => void requestOnedriveAccess()}>
                  {t('store.wishlist.grant')}
                </button>
              ) : (
                <button className="ui-btn-secondary" onClick={() => void connectOnedrive()} disabled={!onedriveSupported}>
                  {t('store.wishlist.connect')}
                </button>
              )}
              {!onedriveSupported && <span className="text-xs ui-subtle">{t('store.wishlist.notSupported')}</span>}
              {onedriveSupported && onedriveStatus === 'connected' && <span className="ui-chip">{t('store.wishlist.connected')}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg tone-primary">{t('settings.desktop.title')}</div>
              <div className="text-xs ui-subtle">{t('settings.desktop.hint')}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="ui-btn-primary" href={desktopDownloadUrls.setupExe} target="_blank" rel="noreferrer noopener">
                {t('settings.desktop.downloadSetup')}
              </a>
              <a className="ui-btn-secondary" href={desktopDownloadUrls.msi} target="_blank" rel="noreferrer noopener">
                {t('settings.desktop.downloadMsi')}
              </a>
              <a className="ui-btn-ghost" href={desktopDownloadUrls.checksums} target="_blank" rel="noreferrer noopener">
                {t('settings.desktop.checksums')}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-surface">
        <div className="ui-panel ui-panel-pad-md">
          <UiCorners />
          <div className="ui-label">{t('settings.data.title')}</div>
          <div className="mt-2 text-xs ui-subtle">{t('settings.data.hint')}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="ui-btn-secondary" onClick={() => void reloadWishlistData()}>
              {t('settings.data.reloadWishlist')}
            </button>
            <button className="ui-btn-secondary" onClick={reloadAllData}>
              {t('settings.data.reloadAll')}
            </button>
            <button className="ui-btn-ghost" onClick={() => void clearWishlistData()}>
              {t('settings.data.clearWishlist')}
            </button>
            <button className="ui-btn-ghost" onClick={() => void clearAllGameData()}>
              {t('settings.data.clearAll')}
            </button>
          </div>
          {dataMessage && <div className="mt-3 text-xs tone-soft">{dataMessage}</div>}
        </div>
      </div>
    </div>
  )
}



