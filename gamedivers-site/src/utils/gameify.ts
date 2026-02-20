import { DEFAULT_DESIGN_ID, DESIGN_CATALOG, isKnownDesignId } from '../designs/registry'
import type { DesignId } from '../designs/registry'

export { DESIGN_CATALOG } from '../designs/registry'

type CommanderState = {
  commanderName: string
  xp: number
  level: number
  credits: number
  streak: number
  lastActiveDate: string
  badges?: string[]
  unlockedDesigns?: DesignId[]
  activeDesign?: DesignId
}

export type CountersState = {
  dateKey: string
  scans: number
  syncs: number
  launchUnplayed: number
  compares: number
}

type MissionProgress = {
  scans: boolean
  cargo: boolean
  launch: boolean
  sync: boolean
}

export type MissionDifficulty = 'relaxed' | 'standard' | 'hardcore'

export type MissionPreferences = {
  difficulty: MissionDifficulty
  rerollsEnabled: boolean
  missionsEnabled: boolean
}

export type MissionMetrics = {
  scans: number
  syncs: number
  launchUnplayed: number
  compares: number
  wishlistCount: number
}

type MissionMetricKey = keyof MissionMetrics

type MissionDefinition = {
  id: string
  label: string
  metric: MissionMetricKey
  targets: Record<MissionDifficulty, number>
  rewardXp: number
  rewardCredits: number
  rewardLabel: string
}

type DailyMissionState = {
  dateKey: string
  missionIds: string[]
  completed: Record<string, boolean>
  rerollsUsed: number
}

export type DailyMissionCard = {
  id: string
  label: string
  progress: number
  target: number
  rewardXp: number
  rewardCredits: number
  rewardLabel: string
  done: boolean
}

export type RerollMissionResult = {
  ok: boolean
  reason?: 'disabled' | 'limit' | 'completed' | 'missing' | 'no-alternative'
  replacementId?: string
}

export type DailyMissionMeta = {
  rerollsUsed: number
  rerollsLimit: number
}

export type PurchaseDesignResult = {
  ok: boolean
  reason?: 'already-owned' | 'insufficient-credits'
}

const COMMANDER_KEY = 'commanderState'
const COUNTERS_KEY = 'commanderCounters'
const LEGACY_MISSIONS_KEY = 'commanderMissions'
const LOG_KEY = 'eventLog'
const MISSION_PREFS_KEY = 'commanderMissionPreferences'
const DAILY_MISSIONS_KEY = 'commanderDailyMissionsV2'
const DESIGN_PREVIEW_KEY = 'commanderDesignPreview'
export const DESIGN_PREVIEW_EVENT = 'design-preview-update'

const DAILY_MISSION_COUNT = 4
export const DAILY_REROLL_LIMIT = 2

const MISSION_POOL: MissionDefinition[] = [
  {
    id: 'scan-sector',
    label: 'Run market scans',
    metric: 'scans',
    targets: { relaxed: 2, standard: 3, hardcore: 5 },
    rewardXp: 25,
    rewardCredits: 20,
    rewardLabel: 'SCAN SECTOR',
  },
  {
    id: 'compare-market',
    label: 'Compare store offers',
    metric: 'compares',
    targets: { relaxed: 1, standard: 2, hardcore: 3 },
    rewardXp: 25,
    rewardCredits: 20,
    rewardLabel: 'MARKET COMPARER',
  },
  {
    id: 'track-cargo',
    label: 'Track wishlist cargo',
    metric: 'wishlistCount',
    targets: { relaxed: 3, standard: 5, hardcore: 8 },
    rewardXp: 30,
    rewardCredits: 30,
    rewardLabel: 'CARGO TRACKER',
  },
  {
    id: 'sync-watchlist',
    label: 'Sync watchlist',
    metric: 'syncs',
    targets: { relaxed: 1, standard: 1, hardcore: 2 },
    rewardXp: 20,
    rewardCredits: 10,
    rewardLabel: 'SYNC OPERATOR',
  },
  {
    id: 'launch-drop',
    label: 'Launch unplayed titles',
    metric: 'launchUnplayed',
    targets: { relaxed: 1, standard: 1, hardcore: 2 },
    rewardXp: 40,
    rewardCredits: 35,
    rewardLabel: 'FIRST DROP',
  },
  {
    id: 'price-audit',
    label: 'Run deal checks',
    metric: 'syncs',
    targets: { relaxed: 1, standard: 2, hardcore: 3 },
    rewardXp: 30,
    rewardCredits: 20,
    rewardLabel: 'DEAL AUDIT',
  },
  {
    id: 'search-burst',
    label: 'Search fresh titles',
    metric: 'scans',
    targets: { relaxed: 3, standard: 4, hardcore: 6 },
    rewardXp: 35,
    rewardCredits: 25,
    rewardLabel: 'SEARCH BURST',
  },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function nextLevel(xp: number) {
  return Math.floor(xp / 100)
}

function dispatchMissionUpdate() {
  window.dispatchEvent(new Event('mission-update'))
}

function defaultMissionPreferences(): MissionPreferences {
  return {
    difficulty: 'standard',
    rerollsEnabled: false,
    missionsEnabled: true,
  }
}

function parseNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toCounterInt(value: unknown): number {
  return Math.max(0, Math.floor(parseNumber(value)))
}

function makeSeed(input: string): number {
  let seed = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    seed ^= input.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0
}

function createRng(seed: number) {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle<T>(values: T[], seed: number): T[] {
  const next = [...values]
  const rnd = createRng(seed)
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function findMission(id: string): MissionDefinition | undefined {
  return MISSION_POOL.find((mission) => mission.id === id)
}

function generateMissionIds(seedInput: string): string[] {
  return shuffle(
    MISSION_POOL.map((mission) => mission.id),
    makeSeed(seedInput),
  ).slice(0, Math.min(DAILY_MISSION_COUNT, MISSION_POOL.length))
}

function createDailyMissionState(dateKey: string): DailyMissionState {
  return {
    dateKey,
    missionIds: generateMissionIds(`daily:${dateKey}`),
    completed: {},
    rerollsUsed: 0,
  }
}

function sanitizeMissionIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const unique: string[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    if (!findMission(value)) continue
    if (unique.includes(value)) continue
    unique.push(value)
    if (unique.length === DAILY_MISSION_COUNT) break
  }
  return unique
}

function sanitizeCompleted(input: unknown, missionIds: string[]) {
  if (!input || typeof input !== 'object') return {}
  const completed: Record<string, boolean> = {}
  missionIds.forEach((id) => {
    if ((input as Record<string, unknown>)[id] === true) {
      completed[id] = true
    }
  })
  return completed
}

function loadDailyMissionState(): DailyMissionState {
  const dateKey = todayKey()
  const raw = localStorage.getItem(DAILY_MISSIONS_KEY)

  if (!raw) {
    const fresh = createDailyMissionState(dateKey)
    saveDailyMissionState(fresh)
    return fresh
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DailyMissionState>
    if (parsed.dateKey !== dateKey) {
      const fresh = createDailyMissionState(dateKey)
      saveDailyMissionState(fresh)
      return fresh
    }

    const missionIds = sanitizeMissionIds(parsed.missionIds)
    const completeMissionIds =
      missionIds.length === DAILY_MISSION_COUNT ? missionIds : generateMissionIds(`daily:${dateKey}:repair`)

    const state: DailyMissionState = {
      dateKey,
      missionIds: completeMissionIds,
      completed: sanitizeCompleted(parsed.completed, completeMissionIds),
      rerollsUsed: toCounterInt(parsed.rerollsUsed),
    }

    if (missionIds.length !== DAILY_MISSION_COUNT) {
      saveDailyMissionState(state)
    }

    return state
  } catch {
    const fresh = createDailyMissionState(dateKey)
    saveDailyMissionState(fresh)
    return fresh
  }
}

function saveDailyMissionState(state: DailyMissionState) {
  localStorage.setItem(DAILY_MISSIONS_KEY, JSON.stringify(state))
  dispatchMissionUpdate()
}

function missionTarget(mission: MissionDefinition, difficulty: MissionDifficulty) {
  return mission.targets[difficulty]
}

function missionProgress(mission: MissionDefinition, metrics: MissionMetrics) {
  return toCounterInt(metrics[mission.metric])
}

export function loadMissionPreferences(): MissionPreferences {
  const raw = localStorage.getItem(MISSION_PREFS_KEY)
  if (!raw) return defaultMissionPreferences()
  try {
    const parsed = JSON.parse(raw) as Partial<MissionPreferences>
    const difficulty: MissionDifficulty =
      parsed.difficulty === 'relaxed' || parsed.difficulty === 'hardcore' || parsed.difficulty === 'standard'
        ? parsed.difficulty
        : 'standard'
    return {
      difficulty,
      rerollsEnabled: parsed.rerollsEnabled === true,
      missionsEnabled: parsed.missionsEnabled !== false,
    }
  } catch {
    return defaultMissionPreferences()
  }
}

export function saveMissionPreferences(patch: Partial<MissionPreferences>) {
  const current = loadMissionPreferences()
  const next: MissionPreferences = {
    ...current,
    ...patch,
    missionsEnabled: typeof patch.missionsEnabled === 'boolean' ? patch.missionsEnabled : current.missionsEnabled,
    difficulty:
      patch.difficulty === 'relaxed' || patch.difficulty === 'hardcore' || patch.difficulty === 'standard'
        ? patch.difficulty
        : current.difficulty,
  }
  localStorage.setItem(MISSION_PREFS_KEY, JSON.stringify(next))
  dispatchMissionUpdate()
}

export function buildMissionMetrics(counters: CountersState, wishlistCount: number): MissionMetrics {
  return {
    scans: toCounterInt(counters.scans),
    syncs: toCounterInt(counters.syncs),
    launchUnplayed: toCounterInt(counters.launchUnplayed),
    compares: toCounterInt(counters.compares),
    wishlistCount: Math.max(0, toCounterInt(wishlistCount)),
  }
}

export function getDailyMissionCards(metrics: MissionMetrics): DailyMissionCard[] {
  const preferences = loadMissionPreferences()
  const state = loadDailyMissionState()

  return state.missionIds
    .map((id) => findMission(id))
    .filter((mission): mission is MissionDefinition => !!mission)
    .map((mission) => {
      const target = missionTarget(mission, preferences.difficulty)
      const progress = Math.min(target, missionProgress(mission, metrics))
      return {
        id: mission.id,
        label: mission.label,
        progress,
        target,
        rewardXp: mission.rewardXp,
        rewardCredits: mission.rewardCredits,
        rewardLabel: `+${mission.rewardXp} XP / +${mission.rewardCredits} CR`,
        done: state.completed[mission.id] === true,
      }
    })
}

export function evaluateDailyMissions(metrics: MissionMetrics): DailyMissionCard[] {
  const preferences = loadMissionPreferences()
  if (!preferences.missionsEnabled) {
    return getDailyMissionCards(metrics)
  }
  const state = loadDailyMissionState()
  const completed = { ...state.completed }
  const newlyCompleted: MissionDefinition[] = []

  state.missionIds.forEach((id) => {
    const mission = findMission(id)
    if (!mission) return
    if (completed[id]) return

    const target = missionTarget(mission, preferences.difficulty)
    const progress = missionProgress(mission, metrics)
    if (progress >= target) {
      completed[id] = true
      newlyCompleted.push(mission)
    }
  })

  if (newlyCompleted.length > 0) {
    saveDailyMissionState({ ...state, completed })
    newlyCompleted.forEach((mission) => {
      award(mission.rewardXp, mission.rewardCredits)
      addEventLog(`REWARD EARNED: ${mission.rewardLabel}`)
    })
  }

  return getDailyMissionCards(metrics)
}

function loadWishlistCountForMissions() {
  const raw = localStorage.getItem('wishlist')
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

export function evaluateDailyMissionsFromStorage() {
  const counters = loadCounters()
  const wishlistCount = loadWishlistCountForMissions()
  const metrics = buildMissionMetrics(counters, wishlistCount)
  return evaluateDailyMissions(metrics)
}

export function rerollDailyMission(missionId: string): RerollMissionResult {
  const preferences = loadMissionPreferences()
  if (!preferences.missionsEnabled || !preferences.rerollsEnabled) {
    return { ok: false, reason: 'disabled' }
  }

  const state = loadDailyMissionState()
  if (!state.missionIds.includes(missionId)) {
    return { ok: false, reason: 'missing' }
  }
  if (state.completed[missionId]) {
    return { ok: false, reason: 'completed' }
  }
  if (state.rerollsUsed >= DAILY_REROLL_LIMIT) {
    return { ok: false, reason: 'limit' }
  }

  const alternatives = MISSION_POOL.map((mission) => mission.id).filter((id) => !state.missionIds.includes(id))
  if (alternatives.length === 0) {
    return { ok: false, reason: 'no-alternative' }
  }

  const ordered = shuffle(alternatives, makeSeed(`${state.dateKey}:${state.rerollsUsed}:${missionId}`))
  const replacementId = ordered[0]

  const missionIds = state.missionIds.map((id) => (id === missionId ? replacementId : id))
  const completed = { ...state.completed }
  delete completed[missionId]
  delete completed[replacementId]

  saveDailyMissionState({
    ...state,
    missionIds,
    completed,
    rerollsUsed: state.rerollsUsed + 1,
  })

  const from = findMission(missionId)?.label ?? missionId
  const to = findMission(replacementId)?.label ?? replacementId
  addEventLog(`MISSION REROLL: ${from} -> ${to}`)
  return { ok: true, replacementId }
}

export function getDailyMissionMeta(): DailyMissionMeta {
  const state = loadDailyMissionState()
  return {
    rerollsUsed: state.rerollsUsed,
    rerollsLimit: DAILY_REROLL_LIMIT,
  }
}

function sanitizeDesigns(input: unknown): DesignId[] {
  if (!Array.isArray(input)) return [DEFAULT_DESIGN_ID]
  const designs: DesignId[] = [DEFAULT_DESIGN_ID]
  input.forEach((value) => {
    if (!isKnownDesignId(value)) return
    if (designs.includes(value)) return
    designs.push(value)
  })
  return designs
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
    badges: [],
    unlockedDesigns: [DEFAULT_DESIGN_ID],
    activeDesign: DEFAULT_DESIGN_ID,
  }
}

export function loadCommander(): CommanderState {
  const raw = localStorage.getItem(COMMANDER_KEY)
  if (!raw) return defaultCommander()
  try {
    const parsed = JSON.parse(raw) as CommanderState
    const unlockedDesigns = sanitizeDesigns(parsed.unlockedDesigns)
    const activeDesign =
      parsed.activeDesign && isKnownDesignId(parsed.activeDesign) && unlockedDesigns.includes(parsed.activeDesign)
        ? parsed.activeDesign
        : unlockedDesigns[0]
    return { ...defaultCommander(), ...parsed, unlockedDesigns, activeDesign }
  } catch {
    return defaultCommander()
  }
}

export function saveCommander(state: CommanderState) {
  localStorage.setItem(COMMANDER_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event('commander-update'))
}

export function updateCommander(patch: Partial<CommanderState>) {
  const current = loadCommander()
  saveCommander({ ...current, ...patch })
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

export function purchaseBadge(badgeId: string, cost: number): boolean {
  const state = loadCommander()
  const owned = state.badges ?? []
  if (owned.includes(badgeId)) return false
  if (state.credits < cost) return false
  saveCommander({ ...state, credits: state.credits - cost, badges: [...owned, badgeId] })
  return true
}

export function purchaseDesign(designId: DesignId): PurchaseDesignResult {
  const state = loadCommander()
  const unlocked = sanitizeDesigns(state.unlockedDesigns)
  if (unlocked.includes(designId)) {
    return { ok: false, reason: 'already-owned' }
  }

  const design = DESIGN_CATALOG.find((item) => item.id === designId)
  if (!design) {
    return { ok: false, reason: 'already-owned' }
  }

  if (state.credits < design.cost) {
    return { ok: false, reason: 'insufficient-credits' }
  }

  saveCommander({
    ...state,
    credits: state.credits - design.cost,
    unlockedDesigns: [...unlocked, designId],
  })
  addEventLog(`DESIGN PURCHASED: ${designId}`)
  return { ok: true }
}

export function grantCredits(amount: number): boolean {
  const value = Math.floor(amount)
  if (!Number.isFinite(value) || value <= 0) return false
  award(0, value)
  addEventLog(`DEV CREDITS: +${value}`)
  return true
}

export function loadDesignPreview(): DesignId | null {
  const raw = localStorage.getItem(DESIGN_PREVIEW_KEY)
  return isKnownDesignId(raw) ? raw : null
}

export function setDesignPreview(designId: DesignId | null) {
  if (designId && !isKnownDesignId(designId)) return
  if (designId) {
    localStorage.setItem(DESIGN_PREVIEW_KEY, designId)
  } else {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
  }
  window.dispatchEvent(new Event(DESIGN_PREVIEW_EVENT))
}

export function clearDesignPreview() {
  setDesignPreview(null)
}

export function equipDesign(designId: DesignId): boolean {
  const state = loadCommander()
  const unlocked = sanitizeDesigns(state.unlockedDesigns)
  if (!unlocked.includes(designId)) return false
  const hasPreview = loadDesignPreview() !== null
  if (hasPreview) {
    clearDesignPreview()
  }
  if (state.activeDesign === designId) return true
  saveCommander({ ...state, activeDesign: designId, unlockedDesigns: unlocked })
  addEventLog(`DESIGN EQUIPPED: ${designId}`)
  return true
}

type EventLogItem = {
  id: string
  message: string
  timestamp: number
}

export function loadEventLog(): EventLogItem[] {
  const raw = localStorage.getItem(LOG_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addEventLog(message: string) {
  const entry: EventLogItem = { id: `${Date.now()}-${Math.random()}`, message, timestamp: Date.now() }
  const next = [entry, ...loadEventLog()].slice(0, 20)
  localStorage.setItem(LOG_KEY, JSON.stringify(next))
  dispatchMissionUpdate()
}

function defaultCounters(): CountersState {
  return {
    dateKey: todayKey(),
    scans: 0,
    syncs: 0,
    launchUnplayed: 0,
    compares: 0,
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
  dispatchMissionUpdate()
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

export function recordCompare() {
  const counters = loadCounters()
  saveCounters({ ...counters, compares: counters.compares + 1 })
}

function defaultMissions(): MissionProgress {
  return { scans: false, cargo: false, launch: false, sync: false }
}

// Legacy API kept for backwards compatibility with older saved data.
export function loadMissionProgress() {
  const raw = localStorage.getItem(LEGACY_MISSIONS_KEY)
  if (!raw) return { dateKey: todayKey(), progress: defaultMissions() }
  try {
    const parsed = JSON.parse(raw) as { dateKey: string; progress: MissionProgress }
    if (parsed.dateKey !== todayKey()) return { dateKey: todayKey(), progress: defaultMissions() }
    return { dateKey: parsed.dateKey, progress: { ...defaultMissions(), ...parsed.progress } }
  } catch {
    return { dateKey: todayKey(), progress: defaultMissions() }
  }
}

// Legacy API kept for backwards compatibility with older saved data.
export function saveMissionProgress(progress: MissionProgress) {
  localStorage.setItem(LEGACY_MISSIONS_KEY, JSON.stringify({ dateKey: todayKey(), progress }))
  dispatchMissionUpdate()
}
