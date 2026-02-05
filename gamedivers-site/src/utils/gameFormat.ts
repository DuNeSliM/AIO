export function getLastPlayedDate(unixTimestamp?: number | null) {
  if (!unixTimestamp || unixTimestamp === 0) {
    return 'Nie gespielt'
  }

  const date = new Date(unixTimestamp * 1000)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  today.setHours(0, 0, 0, 0)
  yesterday.setHours(0, 0, 0, 0)
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  if (dateOnly.getTime() === today.getTime()) {
    return `Heute ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
  } else if (dateOnly.getTime() === yesterday.getTime()) {
    return `Gestern ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function getPlaytimeHours(minutes?: number | null) {
  if (!minutes) return '0h'
  const hours = Math.round(minutes / 60)
  return `${hours}h`
}
