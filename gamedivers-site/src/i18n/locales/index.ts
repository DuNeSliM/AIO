import { de } from './de'
import { en } from './en'
import type { Language, TranslationTree } from '../types'

export const translations: Record<Language, TranslationTree> = {
  de,
  en,
}
