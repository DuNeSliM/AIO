function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

export function getLocalString(key: string): string | null {
  if (!canUseStorage()) return null
  return localStorage.getItem(key)
}

export function setLocalString(key: string, value: string): void {
  if (!canUseStorage()) return
  localStorage.setItem(key, value)
}

export function removeLocalString(key: string): void {
  if (!canUseStorage()) return
  localStorage.removeItem(key)
}

export function getSessionString(key: string): string | null {
  if (!canUseStorage()) return null
  return sessionStorage.getItem(key)
}

export function setSessionString(key: string, value: string): void {
  if (!canUseStorage()) return
  sessionStorage.setItem(key, value)
}

export function removeSessionString(key: string): void {
  if (!canUseStorage()) return
  sessionStorage.removeItem(key)
}

export function getLocalJSON<T>(key: string, fallback: T): T {
  const raw = getLocalString(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setLocalJSON(key: string, value: unknown): void {
  setLocalString(key, JSON.stringify(value))
}
