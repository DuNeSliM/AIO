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
      library: 'Library',
      store: 'Store',
      downloads: 'Missions',
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
      title: 'Game Library',
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
      steamPrivate: 'Steam Profil muss auf "Oeffentlich" stehen, um die Bibliothek zu laden.',
      count: '{count} von {total} Spielen',
      reload: 'Reload',
      syncSteam: 'Steam',
      syncEpic: 'Epic (lokal)',
    },
    store: {
      title: 'Store',
      subtitle: 'Compare prices from Steam and Epic Games.',
      searchPlaceholder: 'Spiel suchen...',
      search: 'Suchen',
      compare: 'Preis vergleichen',
      region: 'Region',
      empty: 'Keine Treffer. Tipp: Spielnamen genauer eingeben.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Guenstigster Preis',
      offer: 'Zum Angebot',
      wishlist: {
        title: 'Wishlist',
        add: 'Merken',
        remove: 'Entfernen',
        empty: 'Keine Wunschlisteintraege.',
        targetPlaceholder: 'Zielpreis',
        onSale: 'Im Sale',
        belowTarget: 'Unter Ziel',
        syncSteam: 'Steam Wishlist laden',
        loginRequired: 'Steam Login erforderlich, um die Wishlist zu laden.',
        steamPrivate: 'Steam Profil/Wunschliste muss auf "Oeffentlich" stehen.',
        steamBlocked: 'Steam blockiert die Wishlist-Abfrage. Stelle sicher, dass Profil und Spieldetails oeffentlich sind. Wenn es bereits oeffentlich ist, oeffne die Wishlist einmal im Steam Store und versuche es erneut.',
        checkNow: 'Jetzt pruefen',
        checking: 'Pruefe...',
        lastChecked: 'Letzter Check: {date}',
        never: 'Noch nie',
        notifications: 'Benachrichtigungen',
        enable: 'Aktivieren',
        disable: 'Deaktivieren',
        permissionDenied: 'Browser blockiert Benachrichtigungen. Bitte in den Seiteneinstellungen erlauben.',
        onedrive: 'OneDrive Sync',
        connect: 'Verbinden',
        disconnect: 'Trennen',
        grant: 'Zugriff erlauben',
        connected: 'Verbunden',
        notSupported: 'Nicht unterstuetzt',
        alerts: 'Alerts',
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
      design: 'Design',
      designHint: 'Waehle aus deinen freigeschalteten Designs.',
      noDesigns: 'Keine Designs verfuegbar',
      tutorial: 'Tutorial',
      tutorialHint: 'Starte die Einfuehrung erneut fuer Tests oder neue Nutzer.',
      restartTutorial: 'Tutorial neu starten',
    },
    missions: {
      label: 'MISSIONEN',
      title: 'Missionen & Fortschritt',
      subtitle: 'Taegliche Ziele, Belohnungen und dein Fortschritt.',
      enabledOn: 'MISSIONEN AN',
      enabledOff: 'MISSIONEN AUS',
      disabledInfo: 'Missionssystem pausiert',
      disabledMessage: 'Missionen sind pausiert. Aktiviere sie jederzeit wieder.',
      difficulty: 'Schwierigkeit',
      difficultyOption: {
        relaxed: 'Entspannt',
        standard: 'Standard',
        hardcore: 'Hart',
      },
      rerollsOn: 'REROLLS AN',
      rerollsOff: 'REROLLS AUS',
      rerollsUsed: 'Verwendet {used}/{limit}',
      stableSet: 'Stabiles Missions-Set aktiv',
      sections: {
        daily: 'TAEGLICHE MISSIONEN',
        report: 'WOECHENTLICHER STORE-BERICHT',
        badges: 'ABZEICHEN-SHOP',
        designs: 'DESIGN-SHOP',
        activity: 'AKTIVITAETSLOG',
      },
      report: {
        steam: 'Steam Ersparnis',
        epic: 'Epic Ersparnis',
        total: 'Gesamt',
      },
      activityEmpty: 'Keine aktuellen Events',
      purchase: 'Kaufen',
      buyDesign: 'Freischalten',
      equip: 'Aktivieren',
      reroll: 'Neu wuerfeln',
      status: {
        complete: 'ABGESCHLOSSEN',
        owned: 'BESITZT',
        active: 'AKTIV',
      },
      toasts: {
        notEnoughCredits: 'NICHT GENUG CREDITS',
        purchased: 'GEKAUFT: {title}',
        difficultySet: 'SCHWIERIGKEIT: {difficulty}',
        missionsEnabled: 'MISSIONEN AKTIVIERT',
        missionsDisabled: 'MISSIONEN PAUSIERT',
        rerollsEnabled: 'REROLLS AKTIVIERT',
        rerollsDisabled: 'REROLLS DEAKTIVIERT',
        rerollLimitReached: 'REROLL-LIMIT ERREICHT',
        rerollsDisabledHint: 'REROLLS SIND DEAKTIVIERT',
        completedCannotReroll: 'ABGESCHLOSSENE MISSIONEN KOENNEN NICHT GEREROLLT WERDEN',
        rerollFailed: 'REROLL FEHLGESCHLAGEN',
        rerolled: 'MISSION GEREROLLT',
        designPurchased: 'DESIGN GEKAUFT: {design}',
        designEquipped: 'DESIGN AKTIVIERT: {design}',
        designOwned: 'DESIGN BEREITS FREIGESCHALTET',
        designLocked: 'DESIGN NOCH GESPERRT',
      },
      pool: {
        'scan-sector': 'Markt-Scans ausfuehren',
        'compare-market': 'Store-Angebote vergleichen',
        'track-cargo': 'Wishlist verfolgen',
        'sync-watchlist': 'Watchlist synchronisieren',
        'launch-drop': 'Ungespielte Titel starten',
        'price-audit': 'Deal-Checks ausfuehren',
        'search-burst': 'Neue Titel suchen',
      },
      designs: {
        catalog: {
          'neo-grid': {
            name: 'Neo Grid',
            description: 'Standard-Design mit klassischem Scanner-Look.',
          },
          'sunset-drive': {
            name: 'Sunset Drive',
            description: 'Warme Orangen und tiefe Roettoene fuer entspannte Sessions.',
          },
          'cobalt-strike': {
            name: 'Cobalt Strike',
            description: 'Kuehles Blau mit hohem Kontrast und klarem Fokus.',
          },
          'ghost-protocol': {
            name: 'Ghost Protocol',
            description: 'Dunkles Stealth-Layout mit reduzierter Leuchtwirkung.',
          },
        },
      },
    },
    onboarding: {
      label: 'STARTMISSION',
      title: 'Gefuehrtes Tutorial',
      subtitle: 'Diese einmalige Mission zeigt dir die wichtigsten Funktionen der App.',
      progress: 'Fortschritt: {done}/{total}',
      open: 'Tutorial anzeigen',
      minimize: 'Minimieren',
      skip: 'Tutorial ueberspringen',
      finish: 'Mission abschliessen',
      status: {
        complete: 'ABGESCHLOSSEN',
        pending: 'OFFEN',
      },
      openPage: 'Zu {page}',
      pages: {
        store: 'Store',
      },
      steps: {
        search: {
          title: 'Erste Suche starten',
          description: 'Suche im Store nach einem Spieltitel.',
        },
        compare: {
          title: 'Ein Angebot vergleichen',
          description: 'Waehle ein Suchergebnis und nutze Preisvergleich.',
        },
        addWishlist: {
          title: 'Ein Spiel merken',
          description: 'Fuege mindestens ein Spiel deiner Wishlist hinzu.',
        },
        runSync: {
          title: 'Wishlist-Check ausfuehren',
          description: 'Nutze Jetzt pruefen, um aktuelle Deals zu laden.',
        },
      },
    },
  },
  en: {
    nav: {
      library: 'Library',
      store: 'Store',
      downloads: 'Missions',
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
      title: 'Game Library',
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
      steamPrivate: 'Your Steam profile must be public to load the library.',
      count: '{count} of {total} games',
      reload: 'Reload',
      syncSteam: 'Steam',
      syncEpic: 'Epic (local)',
    },
    store: {
      title: 'Store',
      subtitle: 'Compare prices from Steam and Epic Games.',
      searchPlaceholder: 'Search game...',
      search: 'Search',
      compare: 'Compare price',
      region: 'Region',
      empty: 'No results. Tip: use a more specific title.',
      steam: 'Steam',
      epic: 'Epic Games',
      cheapest: 'Cheapest price',
      offer: 'View offer',
      wishlist: {
        title: 'Wishlist',
        add: 'Add',
        remove: 'Remove',
        empty: 'No wishlist items yet.',
        targetPlaceholder: 'Target price',
        onSale: 'On sale',
        belowTarget: 'Below target',
        syncSteam: 'Load Steam wishlist',
        loginRequired: 'Steam login required to load wishlist.',
        steamPrivate: 'Your Steam profile/wishlist must be set to public.',
        steamBlocked: 'Steam blocked the wishlist request. Make sure your profile and game details are public. If they already are, open your wishlist once in the Steam Store and try again.',
        checkNow: 'Check now',
        checking: 'Checking...',
        lastChecked: 'Last check: {date}',
        never: 'Never',
        notifications: 'Notifications',
        enable: 'Enable',
        disable: 'Disable',
        permissionDenied: 'Browser blocked notifications. Allow them in your site settings.',
        onedrive: 'OneDrive sync',
        connect: 'Connect',
        disconnect: 'Disconnect',
        grant: 'Grant access',
        connected: 'Connected',
        notSupported: 'Not supported',
        alerts: 'Alerts',
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
      design: 'Design',
      designHint: 'Pick from your unlocked designs.',
      noDesigns: 'No designs available',
      tutorial: 'Tutorial',
      tutorialHint: 'Run onboarding again for testing or handover.',
      restartTutorial: 'Restart tutorial',
    },
    missions: {
      label: 'MISSIONS',
      title: 'Missions & Progress',
      subtitle: 'Daily objectives, rewards, and your progression.',
      enabledOn: 'MISSIONS ON',
      enabledOff: 'MISSIONS OFF',
      disabledInfo: 'Mission system paused',
      disabledMessage: 'Missions are paused. You can enable them anytime.',
      difficulty: 'Difficulty',
      difficultyOption: {
        relaxed: 'Relaxed',
        standard: 'Standard',
        hardcore: 'Hardcore',
      },
      rerollsOn: 'REROLLS ON',
      rerollsOff: 'REROLLS OFF',
      rerollsUsed: 'Used {used}/{limit}',
      stableSet: 'Stable mission set active',
      sections: {
        daily: 'DAILY MISSIONS',
        report: 'WEEKLY STORE REPORT',
        badges: 'BADGE STORE',
        designs: 'DESIGN STORE',
        activity: 'ACTIVITY LOG',
      },
      report: {
        steam: 'Steam savings',
        epic: 'Epic savings',
        total: 'Total savings',
      },
      activityEmpty: 'No recent events',
      purchase: 'Purchase',
      buyDesign: 'Unlock',
      equip: 'Equip',
      reroll: 'Reroll',
      status: {
        complete: 'COMPLETE',
        owned: 'OWNED',
        active: 'ACTIVE',
      },
      toasts: {
        notEnoughCredits: 'NOT ENOUGH CREDITS',
        purchased: 'PURCHASED: {title}',
        difficultySet: 'DIFFICULTY: {difficulty}',
        missionsEnabled: 'MISSIONS ENABLED',
        missionsDisabled: 'MISSIONS PAUSED',
        rerollsEnabled: 'REROLLS ENABLED',
        rerollsDisabled: 'REROLLS DISABLED',
        rerollLimitReached: 'REROLL LIMIT REACHED',
        rerollsDisabledHint: 'REROLLS ARE DISABLED',
        completedCannotReroll: 'COMPLETED MISSIONS CANNOT REROLL',
        rerollFailed: 'REROLL FAILED',
        rerolled: 'MISSION REROLLED',
        designPurchased: 'DESIGN PURCHASED: {design}',
        designEquipped: 'DESIGN EQUIPPED: {design}',
        designOwned: 'DESIGN ALREADY OWNED',
        designLocked: 'DESIGN IS LOCKED',
      },
      pool: {
        'scan-sector': 'Run market scans',
        'compare-market': 'Compare store offers',
        'track-cargo': 'Track wishlist cargo',
        'sync-watchlist': 'Sync watchlist',
        'launch-drop': 'Launch unplayed titles',
        'price-audit': 'Run deal checks',
        'search-burst': 'Search fresh titles',
      },
      designs: {
        catalog: {
          'neo-grid': {
            name: 'Neo Grid',
            description: 'Default terminal look with balanced neon contrast.',
          },
          'sunset-drive': {
            name: 'Sunset Drive',
            description: 'Warm amber highlights and deep dusk accents.',
          },
          'cobalt-strike': {
            name: 'Cobalt Strike',
            description: 'Cool blue palette built for crisp scan readability.',
          },
          'ghost-protocol': {
            name: 'Ghost Protocol',
            description: 'Stealth-focused dark layout with muted glow.',
          },
        },
      },
    },
    onboarding: {
      label: 'STARTUP MISSION',
      title: 'Guided Tour',
      subtitle: 'Complete this one-time mission to learn the core app flows.',
      progress: 'Progress: {done}/{total}',
      open: 'Open tutorial',
      minimize: 'Minimize',
      skip: 'Skip tutorial',
      finish: 'Finish mission',
      status: {
        complete: 'COMPLETE',
        pending: 'PENDING',
      },
      openPage: 'Open {page}',
      pages: {
        store: 'Store',
      },
      steps: {
        search: {
          title: 'Run your first search',
          description: 'Use Store search to find any title.',
        },
        compare: {
          title: 'Compare one offer',
          description: 'Pick a result and use compare price.',
        },
        addWishlist: {
          title: 'Add one wishlist item',
          description: 'Save at least one game to your wishlist.',
        },
        runSync: {
          title: 'Run a wishlist check',
          description: 'Use Check now to refresh your tracked deals.',
        },
      },
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

