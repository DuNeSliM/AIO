import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'

const translations = {
  de: {
    nav: {
      library: 'Library',
      store: 'Store',
      downloads: 'Downloads',
      settings: 'Settings'
    },
    auth: {
      steamLogin: 'Steam Login',
      steamLogout: 'Logout Steam'
    },
    epic: {
      localSync: 'Epic'
    },
    library: {
      title: 'Game Library',
      steamConnected: '✓ Steam: {username}',
      searchPlaceholder: '🔍 Spiel suchen...',
      recent: '⏱ Zuletzt gespielt',
      az: 'A → Z',
      za: 'Z → A',
      loading: 'Lade Spiele...',
      empty: 'Keine Spiele gefunden. Starte den Epic Games Launcher oder melde dich mit Steam an.',
      count: '{count} von {total} Spielen',
      reload: '↻ Reload',
      syncSteam: '🔄 Steam',
      syncEpic: '🔄 Epic (lokal)'
    },
    store: {
      title: 'Store',
      subtitle: 'Vergleiche Preise von Steam und Epic Games.',
      searchPlaceholder: 'Spiel suchen...',
      search: 'Suchen',
      compare: 'Preis vergleichen',
      empty: 'Keine Treffer. Tipp: Spielnamen genauer eingeben.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Günstigster Preis',
      offer: 'Zum Angebot'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Anzeige und Design.',
      theme: 'Theme',
      themeHint: 'Dark ist Standard.',
      dark: 'Dark',
      light: 'Light',
      language: 'Sprache',
      languageHint: 'Deutsch oder Englisch.'
    }
  },
  en: {
    nav: {
      library: 'Library',
      store: 'Store',
      downloads: 'Downloads',
      settings: 'Settings'
    },
    auth: {
      steamLogin: 'Steam Login',
      steamLogout: 'Logout Steam'
    },
    epic: {
      localSync: 'Epic'
    },
    library: {
      title: 'Game Library',
      steamConnected: '✓ Steam: {username}',
      searchPlaceholder: '🔍 Search games...',
      recent: '⏱ Recently played',
      az: 'A → Z',
      za: 'Z → A',
      loading: 'Loading games...',
      empty: 'No games found. Start Epic Games Launcher or sign in with Steam.',
      count: '{count} of {total} games',
      reload: '↻ Reload',
      syncSteam: '🔄 Steam',
      syncEpic: '🔄 Epic (local)'
    },
    store: {
      title: 'Store',
      subtitle: 'Compare prices from Steam and Epic Games.',
      searchPlaceholder: 'Search game...',
      search: 'Search',
      compare: 'Compare price',
      empty: 'No results. Tip: use a more specific title.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Cheapest price',
      offer: 'View offer'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Display and appearance.',
      theme: 'Theme',
      themeHint: 'Dark is default.',
      dark: 'Dark',
      light: 'Light',
      language: 'Language',
      languageHint: 'German or English.'
    }
  }
}

const I18nContext = createContext({
  lang: 'de',
  setLang: () => {},
  t: (key) => key
})

function getValue(obj, path){
  return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj)
}

function interpolate(str, vars){
  if (!vars) return str
  return Object.keys(vars).reduce((result, key) => {
    return result.replaceAll(`{${key}}`, String(vars[key]))
  }, str)
}

export function I18nProvider({ children }){
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'de')

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  const value = useMemo(() => {
    return {
      lang,
      setLang,
      t: (key, vars) => {
        const text = getValue(translations[lang], key) || key
        return interpolate(text, vars)
      }
    }
  }, [lang])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(){
  return useContext(I18nContext)
}
