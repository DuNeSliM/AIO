export type DesignLayoutPreset = 'default' | 'meadow' | 'kawaii'

export type DesignAssetSlots = {
  panelTexture?: string
  buttonTexture?: string
  sidebarTexture?: string
}

export type DesignManifest = {
  layout?: DesignLayoutPreset
  assets?: DesignAssetSlots
}

export const DEFAULT_DESIGN_MANIFEST: Readonly<Required<Pick<DesignManifest, 'layout'>> & { assets: DesignAssetSlots }> = {
  layout: 'default',
  assets: {},
}
