import type { DesignManifest } from '../../themeManifest'

const cobaltManifest: DesignManifest = {
  layout: 'default',
  assets: {
    panelTexture:
      `radial-gradient(circle at 82% 14%, rgba(160, 231, 255, 0.18) 0 20%, transparent 24%),` +
      `linear-gradient(160deg, rgba(77, 171, 255, 0.16), rgba(14, 36, 78, 0.08))`,
    buttonTexture:
      `radial-gradient(circle at 88% 18%, rgba(184, 236, 255, 0.34) 0 15%, transparent 18%),` +
      `linear-gradient(140deg, rgba(105, 197, 255, 0.2), rgba(35, 83, 162, 0.1))`,
    sidebarTexture: `linear-gradient(180deg, rgba(102, 194, 255, 0.18), rgba(17, 45, 93, 0.1))`,
  },
}

export default cobaltManifest
