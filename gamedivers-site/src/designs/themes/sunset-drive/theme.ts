import type { DesignManifest } from '../../themeManifest'

const sunsetManifest: DesignManifest = {
  layout: 'default',
  assets: {
    panelTexture:
      `radial-gradient(circle at 84% 14%, rgba(255, 210, 160, 0.2) 0 22%, transparent 26%),` +
      `linear-gradient(160deg, rgba(255, 132, 70, 0.2), rgba(94, 34, 14, 0.08))`,
    buttonTexture:
      `radial-gradient(circle at 88% 18%, rgba(255, 216, 173, 0.38) 0 15%, transparent 18%),` +
      `linear-gradient(140deg, rgba(255, 166, 102, 0.22), rgba(140, 56, 24, 0.1))`,
    sidebarTexture: `linear-gradient(180deg, rgba(255, 158, 96, 0.18), rgba(102, 37, 17, 0.1))`,
  },
}

export default sunsetManifest
