import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { STORAGE_KEYS } from '../shared/storage/keys'
import { getLocalString, setLocalString } from '../shared/storage/storage'
import { translations } from './locales'
import type { Language, TranslationTree } from './types'

type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
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
    const stored = getLocalString(STORAGE_KEYS.app.lang)
    return stored === 'en' ? 'en' : 'de'
  })

  useEffect(() => {
    setLocalString(STORAGE_KEYS.app.lang, lang)
  }, [lang])

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      setLang,
      t: (key, vars) => {
        const text = getValue(translations[lang], key) ?? getValue(translations.en, key) ?? key
        return interpolate(text, vars)
      },
    }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
