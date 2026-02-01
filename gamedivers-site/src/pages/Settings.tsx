import { useI18n } from '../i18n/i18n'
import type { Theme } from '../types'

type SettingsProps = {
  theme: Theme
  onToggleTheme: () => void
}

export default function Settings({ theme, onToggleTheme }: SettingsProps) {
  const { lang, setLang, t } = useI18n()
  const isDark = theme === 'dark'

  return (
    <div className="flex flex-col gap-6">
      <header className="hud-glass rounded-xl p-6">
        <p className="hud-label">{t('settings.title')}</p>
        <h1 className="text-2xl tone-primary">{t('settings.title')}</h1>
        <p className="text-sm tone-muted">{t('settings.subtitle')}</p>
      </header>

      <div className="hud-panel rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg tone-primary">{t('settings.theme')}</div>
            <div className="text-xs tone-muted">{t('settings.themeHint')}</div>
          </div>
          <button className="btn-primary" onClick={onToggleTheme}>
            {isDark ? t('settings.dark') : t('settings.light')}
          </button>
        </div>
      </div>

      <div className="hud-panel rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg tone-primary">{t('settings.language')}</div>
            <div className="text-xs tone-muted">{t('settings.languageHint')}</div>
          </div>
          <button className="btn-ghost" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}>
            {lang === 'de' ? 'Deutsch' : 'English'}
          </button>
        </div>
      </div>
    </div>
  )
}
