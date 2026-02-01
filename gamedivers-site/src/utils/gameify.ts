type CommanderState = {
  commanderName: string
  xp: number
  level: number
  credits: number
  streak: number
  lastActiveDate: string
}

type CountersState = {
  dateKey: string
  scans: number
  syncs: number
  launchUnplayed: number
}

type MissionProgress = {
  scans: boolean
  cargo: boolean
  launch: boolean
  sync: boolean
}

const COMMANDER_KEY = 'commanderState'
const COUNTERS_KEY = 'commanderCounters'
const MISSIONS_KEY = 'commanderMissions'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function nextLevel(xp: number) {
  return Math.floor(xp / 100)
}

export function getRank(level: number) {
  if (level >= 10) return 'Admiral'
  if (level >= 6) return 'Spectre'
  if (level >= 3) return 'Operative'
  return 'Recruit'
}

function defaultCommander(): CommanderState {
  return {
    commanderName: 'Commander',
    xp: 0,
    level: 0,
    credits: 0,
    streak: 1,
    lastActiveDate: todayKey(),
  }
}

export function loadCommander(): CommanderState {
  const raw = localStorage.getItem(COMMANDER_KEY)
  if (!raw) return defaultCommander()
  try {
    const parsed = JSON.parse(raw) as CommanderState
    return { ...defaultCommander(), ...parsed }
  } catch {
    return defaultCommander()
  }
}

export function saveCommander(state: CommanderState) {
  localStorage.setItem(COMMANDER_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event('commander-update'))
}

export function setCommanderName(name: string) {
  const current = loadCommander()
  saveCommander({ ...current, commanderName: name })
}

function applyActivity(state: CommanderState) {
  const today = todayKey()
  if (state.lastActiveDate === today) return state
  const prev = new Date(state.lastActiveDate)
  const diff = Math.floor((Date.now() - prev.getTime()) / 86400000)
  const streak = diff === 1 ? state.streak + 1 : 1
  return { ...state, streak, lastActiveDate: today }
}

export function award(xp: number, credits = 0) {
  let state = loadCommander()
  state = applyActivity(state)
  const totalXp = state.xp + xp
  const next = {
    ...state,
    xp: totalXp,
    level: nextLevel(totalXp),
    credits: state.credits + credits,
  }
  saveCommander(next)
}

function defaultCounters(): CountersState {
  return {
    dateKey: todayKey(),
    scans: 0,
    syncs: 0,
    launchUnplayed: 0,
  }
}

export function loadCounters(): CountersState {
  const raw = localStorage.getItem(COUNTERS_KEY)
  if (!raw) return defaultCounters()
  try {
    const parsed = JSON.parse(raw) as CountersState
    if (parsed.dateKey !== todayKey()) return defaultCounters()
    return { ...defaultCounters(), ...parsed }
  } catch {
    return defaultCounters()
  }
}

export function saveCounters(state: CountersState) {
  localStorage.setItem(COUNTERS_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event('mission-update'))
}

export function recordScan() {
  const counters = loadCounters()
  saveCounters({ ...counters, scans: counters.scans + 1 })
}

export function recordSync() {
  const counters = loadCounters()
  saveCounters({ ...counters, syncs: counters.syncs + 1 })
}

export function recordLaunchUnplayed() {
  const counters = loadCounters()
  saveCounters({ ...counters, launchUnplayed: counters.launchUnplayed + 1 })
}

function defaultMissions(): MissionProgress {
  return { scans: false, cargo: false, launch: false, sync: false }
}

export function loadMissionProgress() {
  const raw = localStorage.getItem(MISSIONS_KEY)
  if (!raw) return { dateKey: todayKey(), progress: defaultMissions() }
  try {
    const parsed = JSON.parse(raw) as { dateKey: string; progress: MissionProgress }
    if (parsed.dateKey !== todayKey()) return { dateKey: todayKey(), progress: defaultMissions() }
    return { dateKey: parsed.dateKey, progress: { ...defaultMissions(), ...parsed.progress } }
  } catch {
    return { dateKey: todayKey(), progress: defaultMissions() }
  }
}

export function saveMissionProgress(progress: MissionProgress) {
  localStorage.setItem(MISSIONS_KEY, JSON.stringify({ dateKey: todayKey(), progress }))
  window.dispatchEvent(new Event('mission-update'))
}
