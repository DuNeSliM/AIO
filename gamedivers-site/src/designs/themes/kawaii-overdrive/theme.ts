import type { DesignManifest } from '../../themeManifest'
import kawaiiBubbles from './assets/kawaii-bubbles.svg'
import kawaiiHeartsRain from './assets/kawaii-hearts-rain.svg'
import kawaiiStickers from './assets/kawaii-anime-stickers.svg'

const kawaiiManifest: DesignManifest = {
  layout: 'kawaii',
  assets: {
    panelTexture: `url("${kawaiiStickers}") center / cover no-repeat`,
    buttonTexture:
      `radial-gradient(circle at 86% 16%, rgba(255, 224, 247, 0.4) 0 18%, transparent 22%),` +
      `url("${kawaiiHeartsRain}") center / cover no-repeat`,
    sidebarTexture: `url("${kawaiiBubbles}") center / cover no-repeat`,
  },
}

export default kawaiiManifest
