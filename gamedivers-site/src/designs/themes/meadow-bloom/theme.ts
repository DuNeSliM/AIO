import type { DesignManifest } from '../../themeManifest'
import meadowForeground from './assets/meadow-foreground.svg'
import meadowPattern from './assets/meadow-pattern.svg'

const meadowManifest: DesignManifest = {
  layout: 'meadow',
  assets: {
    panelTexture: `url("${meadowPattern}") center / cover no-repeat`,
    buttonTexture:
      `radial-gradient(circle at 84% 18%, rgba(255, 237, 182, 0.36) 0 15%, transparent 18%),` +
      `url("${meadowForeground}") center / 210% no-repeat`,
    sidebarTexture: `url("${meadowPattern}") center / 180% no-repeat`,
  },
}

export default meadowManifest
