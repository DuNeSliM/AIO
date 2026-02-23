export type Language = 'de' | 'en'

export type TranslationTree = {
  [key: string]: string | TranslationTree
}
