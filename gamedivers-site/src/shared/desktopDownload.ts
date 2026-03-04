function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

const releasesPageUrl = 'https://github.com/DuNeSliM/AIO/releases'
const configuredBaseOverride = import.meta.env.VITE_DESKTOP_DOWNLOAD_BASE_URL
  ? trimTrailingSlash(import.meta.env.VITE_DESKTOP_DOWNLOAD_BASE_URL)
  : null
const releaseTag = import.meta.env.VITE_DESKTOP_RELEASE_TAG?.trim()
const releaseTagBase = releaseTag
  ? `${releasesPageUrl}/download/${encodeURIComponent(releaseTag)}`
  : null
const configuredDownloadBase = configuredBaseOverride ?? releaseTagBase
const fallbackUrl = releasesPageUrl

export const desktopDownloadUrls = {
  setupExe: configuredDownloadBase ? `${configuredDownloadBase}/GameDivers-Windows-Setup.exe` : fallbackUrl,
  msi: configuredDownloadBase ? `${configuredDownloadBase}/GameDivers-Windows.msi` : fallbackUrl,
  checksums: configuredDownloadBase ? `${configuredDownloadBase}/SHA256SUMS.txt` : fallbackUrl,
  releases: releasesPageUrl,
}
