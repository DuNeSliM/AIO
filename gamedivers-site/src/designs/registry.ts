import catalogRaw from './catalog.json'

const themeModules = import.meta.glob('./themes/*/theme.css', { eager: true })
void themeModules

type CatalogRecord = {
  id?: unknown
  className?: unknown
  cost?: unknown
  default?: unknown
}

export type DesignId = string

export type DesignCatalogItem = {
  id: DesignId
  className: string
  cost: number
  isDefault: boolean
}

function toCatalogItem(entry: CatalogRecord): DesignCatalogItem | null {
  if (typeof entry?.id !== 'string') return null
  if (typeof entry?.className !== 'string') return null
  const cost = typeof entry?.cost === 'number' && Number.isFinite(entry.cost) ? Math.max(0, Math.floor(entry.cost)) : 0
  const isDefault = entry?.default === true
  return {
    id: entry.id,
    className: entry.className,
    cost,
    isDefault,
  }
}

const parsedCatalog = Array.isArray(catalogRaw)
  ? catalogRaw.map((entry) => toCatalogItem(entry as CatalogRecord)).filter((entry): entry is DesignCatalogItem => !!entry)
  : []

const ensuredCatalog = parsedCatalog.length > 0 ? parsedCatalog : [{ id: 'neo-grid', className: 'design-neo-grid', cost: 0, isDefault: true }]

export const DEFAULT_DESIGN_ID: DesignId =
  ensuredCatalog.find((entry) => entry.isDefault)?.id ?? ensuredCatalog[0].id

export const DESIGN_CATALOG: DesignCatalogItem[] = ensuredCatalog

export const DESIGN_CLASS_NAMES = DESIGN_CATALOG.map((entry) => entry.className)

export function isKnownDesignId(value: unknown): value is DesignId {
  return typeof value === 'string' && DESIGN_CATALOG.some((entry) => entry.id === value)
}

export function findDesignById(id: DesignId | undefined | null): DesignCatalogItem | null {
  if (!id) return null
  return DESIGN_CATALOG.find((entry) => entry.id === id) ?? null
}
