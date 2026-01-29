import React from 'react'
import { useI18n } from '../i18n/i18n.jsx'

export default function Settings({ theme, onToggleTheme }){
  const { lang, setLang, t } = useI18n()
  const isDark = theme === 'dark'

  return (
    <div className="settings-page">
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="steam-status">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-title">{t('settings.theme')}</div>
            <div className="settings-sub">{t('settings.themeHint')}</div>
          </div>
          <button className="settings-toggle" onClick={onToggleTheme}>
            {isDark ? t('settings.dark') : t('settings.light')}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-title">{t('settings.language')}</div>
            <div className="settings-sub">{t('settings.languageHint')}</div>
          </div>
          <button
            className="settings-toggle"
            onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
          >
            {lang === 'de' ? 'Deutsch' : 'English'}
          </button>
        </div>
      </div>
    </div>
  )
}
