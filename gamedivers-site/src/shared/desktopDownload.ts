function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

const defaultDownloadBase = 'https://github.com/DuNeSliM/AIO/releases/latest/download'
const configuredDownloadBase = import.meta.env.VITE_DESKTOP_DOWNLOAD_BASE_URL
  ? trimTrailingSlash(import.meta.env.VITE_DESKTOP_DOWNLOAD_BASE_URL)
  : defaultDownloadBase

export const desktopDownloadUrls = {
  setupExe: `${configuredDownloadBase}/GameDivers-Windows-Setup.exe`,
  msi: `${configuredDownloadBase}/GameDivers-Windows.msi`,
  checksums: `${configuredDownloadBase}/SHA256SUMS.txt`,
}
