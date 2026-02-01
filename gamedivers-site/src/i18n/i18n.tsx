import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

type Language = 'de' | 'en'

type TranslationTree = {
  [key: string]: string | TranslationTree
}

type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const translations: Record<Language, TranslationTree> = {
  de: {
    nav: {
      library: 'Hangar',
      store: 'Uplink',
      downloads: 'Downloads',
      settings: 'Settings',
    },
    auth: {
      steamLogin: 'Steam Login',
      steamLogout: 'Logout Steam',
    },
    epic: {
      localSync: 'Epic',
    },
    library: {
      title: 'Hangar Manifest',
      steamConnected: 'Steam: {username}',
      searchPlaceholder: 'Spiel suchen...',
      recent: 'Zuletzt gespielt',
      az: 'A to Z',
      za: 'Z to A',
      playtime: 'Spielzeit',
      viewGrid: 'Kacheln',
      viewList: 'Liste',
      loading: 'Lade Spiele...',
      empty: 'Keine Spiele gefunden. Starte den Epic Games Launcher oder melde dich mit Steam an.',
      count: '{count} von {total} Spielen',
      reload: 'Reload',
      syncSteam: 'Steam',
      syncEpic: 'Epic (lokal)',
    },
    store: {
      title: 'Uplink Market',
      subtitle: 'Cross-vendor uplink for Steam & Epic supply nodes.',
      searchPlaceholder: 'Spiel suchen...',
      search: 'Scan',
      compare: 'Uplink compare',
      region: 'Region',
      empty: 'Keine Treffer. Tipp: Spielnamen genauer eingeben.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Best Signal',
      offer: 'Open Node',
      wishlist: {
        title: 'Cargo Watchlist',
        add: 'Tag Cargo',
        remove: 'Jettison',
        empty: 'Keine Wunschlisteintraege.',
        targetPlaceholder: 'Zielpreis',
        onSale: 'Signal: Sale',
        belowTarget: 'Signal: Below Target',
        checkNow: 'Ping Uplink',
        checking: 'Pinging...',
        lastChecked: 'Letzter Check: {date}',
        never: 'Noch nie',
        notifications: 'Comms',
        enable: 'Engage',
        disable: 'Stand down',
        onedrive: 'Data Uplink',
        connect: 'Verbinden',
        disconnect: 'Trennen',
        grant: 'Zugriff erlauben',
        connected: 'Verbunden',
        notSupported: 'Nicht unterstuetzt',
        alerts: 'System Alerts',
      },
    },
    settings: {
      title: 'Settings',
      subtitle: 'Anzeige und Design.',
      theme: 'Theme',
      themeHint: 'Dark ist Standard.',
      dark: 'Dark',
      light: 'Light',
      language: 'Sprache',
      languageHint: 'Deutsch oder Englisch.',
    },
  },
  en: {
    nav: {
      library: 'Hangar',
      store: 'Uplink',
      downloads: 'Downloads',
      settings: 'Settings',
    },
    auth: {
      steamLogin: 'Steam Login',
      steamLogout: 'Logout Steam',
    },
    epic: {
      localSync: 'Epic',
    },
    library: {
      title: 'Hangar Manifest',
      steamConnected: 'Steam: {username}',
      searchPlaceholder: 'Search games...',
      recent: 'Recently played',
      az: 'A to Z',
      za: 'Z to A',
      playtime: 'Playtime',
      viewGrid: 'Grid',
      viewList: 'List',
      loading: 'Loading games...',
      empty: 'No games found. Start Epic Games Launcher or sign in with Steam.',
      count: '{count} of {total} games',
      reload: 'Reload',
      syncSteam: 'Steam',
      syncEpic: 'Epic (local)',
    },
    store: {
      title: 'Uplink Market',
      subtitle: 'Cross-vendor uplink for Steam & Epic supply nodes.',
      searchPlaceholder: 'Search game...',
      search: 'Scan',
      compare: 'Uplink compare',
      region: 'Region',
      empty: 'No results. Tip: use a more specific title.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Best signal',
      offer: 'Open node',
      wishlist: {
        title: 'Cargo Watchlist',
        add: 'Tag Cargo',
        remove: 'Jettison',
        empty: 'No wishlist items yet.',
        targetPlaceholder: 'Target price',
        onSale: 'Signal: Sale',
        belowTarget: 'Signal: Below Target',
        checkNow: 'Ping Uplink',
        checking: 'Pinging...',
        lastChecked: 'Last check: {date}',
        never: 'Never',
        notifications: 'Comms',
        enable: 'Engage',
        disable: 'Stand down',
        onedrive: 'Data Uplink',
        connect: 'Connect',
        disconnect: 'Disconnect',
        grant: 'Grant access',
        connected: 'Connected',
        notSupported: 'Not supported',
        alerts: 'System Alerts',
      },
    },
    settings: {
      title: 'Settings',
      subtitle: 'Display and appearance.',
      theme: 'Theme',
      themeHint: 'Dark is default.',
      dark: 'Dark',
      light: 'Light',
      language: 'Language',
      languageHint: 'German or English.',
    },
  },
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'de',
  setLang: () => {},
  t: (key) => key,
})

function getValue(obj: TranslationTree, path: string): string | undefined {
  const value = path.split('.').reduce<TranslationTree | string | undefined>((acc, part) => {
    if (!acc || typeof acc === 'string') return undefined
    return acc[part] as TranslationTree | string | undefined
  }, obj)
  return typeof value === 'string' ? value : undefined
}

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str
  return Object.keys(vars).reduce((result, key) => {
    return result.replaceAll(`{${key}}`, String(vars[key]))
  }, str)
}

type I18nProviderProps = {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem('lang')
    return stored === 'en' ? 'en' : 'de'
  })

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      setLang,
      t: (key, vars) => {
        const text = getValue(translations[lang], key) || key
        return interpolate(text, vars)
      },
    }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

