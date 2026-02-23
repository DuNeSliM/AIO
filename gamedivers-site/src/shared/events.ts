export const APP_EVENTS = {
  missionUpdate: 'mission-update',
  epicLocalSync: 'epic-local-sync',
  commanderUpdate: 'commander-update',
  designPreviewUpdate: 'design-preview-update',
  openOnboarding: 'open-onboarding',
} as const

export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS]

export function emitAppEvent(name: AppEventName): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(name))
}

export function onAppEvent(name: AppEventName, listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler: EventListener = () => listener()
  window.addEventListener(name, handler)
  return () => window.removeEventListener(name, handler)
}
