import catalogRaw from './catalog.json'
import { DEFAULT_DESIGN_MANIFEST, type DesignAssetSlots, type DesignLayoutPreset, type DesignManifest } from './themeManifest'

const themeModules = import.meta.glob('./themes/*/theme.css', { eager: true })
void themeModules
const manifestModules = import.meta.glob('./themes/*/theme.ts', { eager: true })

type CatalogRecord = {
  id?: unknown
  className?: unknown
  cost?: unknown
  default?: unknown
}

type ManifestModule = {
  default?: unknown
  manifest?: unknown
}

export type DesignId = string

export type DesignCatalogItem = {
  id: DesignId
  className: string
  cost: number
  isDefault: boolean
}

const DESIGN_LAYOUT_PRESETS: DesignLayoutPreset[] = ['default', 'meadow', 'kawaii']

function parseDesignIdFromPath(path: string): DesignId | null {
  const match = path.match(/^\.\/themes\/([^/]+)\/theme\.ts$/)
  return match?.[1] ?? null
}

function toLayoutPreset(value: unknown): DesignLayoutPreset {
  if (typeof value === 'string' && DESIGN_LAYOUT_PRESETS.includes(value as DesignLayoutPreset)) {
    return value as DesignLayoutPreset
  }
  return DEFAULT_DESIGN_MANIFEST.layout
}

function toAssetLayer(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function toAssetSlots(value: unknown): DesignAssetSlots {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  return {
    panelTexture: toAssetLayer(source.panelTexture),
    buttonTexture: toAssetLayer(source.buttonTexture),
    sidebarTexture: toAssetLayer(source.sidebarTexture),
  }
}

function toManifest(value: unknown): DesignManifest {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  const assets = toAssetSlots(source.assets)
  return {
    layout: toLayoutPreset(source.layout),
    assets,
  }
}

const manifestById = new Map<DesignId, DesignManifest>()
Object.entries(manifestModules).forEach(([path, moduleRecord]) => {
  const id = parseDesignIdFromPath(path)
  if (!id) return

  const moduleValue = moduleRecord as ManifestModule
  const manifestValue = moduleValue.default ?? moduleValue.manifest
  manifestById.set(id, toManifest(manifestValue))
})

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

export function getDesignManifest(id: DesignId | undefined | null): Readonly<{
  layout: DesignLayoutPreset
  assets: DesignAssetSlots
}> {
  const manifest = id ? manifestById.get(id) : null
  return {
    layout: manifest?.layout ?? DEFAULT_DESIGN_MANIFEST.layout,
    assets: manifest?.assets ?? {},
  }
}
