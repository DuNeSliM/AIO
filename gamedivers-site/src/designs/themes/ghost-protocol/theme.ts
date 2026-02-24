import type { DesignManifest } from '../../themeManifest'

const ghostManifest: DesignManifest = {
  layout: 'default',
  assets: {
    panelTexture:
      `radial-gradient(circle at 84% 14%, rgba(201, 214, 211, 0.12) 0 20%, transparent 24%),` +
      `linear-gradient(160deg, rgba(144, 163, 160, 0.12), rgba(45, 57, 55, 0.08))`,
    buttonTexture:
      `radial-gradient(circle at 88% 18%, rgba(218, 230, 227, 0.3) 0 14%, transparent 18%),` +
      `linear-gradient(140deg, rgba(168, 184, 181, 0.16), rgba(75, 93, 90, 0.1))`,
    sidebarTexture: `linear-gradient(180deg, rgba(161, 178, 175, 0.14), rgba(56, 69, 67, 0.1))`,
  },
}

export default ghostManifest
