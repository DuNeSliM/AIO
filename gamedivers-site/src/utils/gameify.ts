import { DEFAULT_DESIGN_ID, DESIGN_CATALOG, isKnownDesignId } from '../designs/registry'
import type { DesignId } from '../designs/registry'
import { APP_EVENTS, emitAppEvent } from '../shared/events'
import { STORAGE_KEYS } from '../shared/storage/keys'

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

export type MissionDifficulty = 'easy' | 'standard' | 'hard'

export type MissionPreferences = {
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
  target: number
  difficulty: MissionDifficulty
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
  metric: MissionMetricKey
  difficulty: MissionDifficulty
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
const DESIGN_PREVIEW_DURATION_MS = 12 * 60 * 1000
export const DESIGN_PREVIEW_EVENT = APP_EVENTS.designPreviewUpdate

const DAILY_MISSION_COUNT = 5
export const DAILY_REROLL_LIMIT = 2

const MISSION_POOL: MissionDefinition[] = [
  {
    id: 'scan-sector',
    label: 'Run market scans',
    metric: 'scans',
    target: 2,
    difficulty: 'easy',
    rewardXp: 24,
    rewardCredits: 18,
    rewardLabel: 'RECON SWEEP',
  },
  {
    id: 'compare-market',
    label: 'Compare store offers',
    metric: 'compares',
    target: 1,
    difficulty: 'easy',
    rewardXp: 22,
    rewardCredits: 16,
    rewardLabel: 'QUICK COMPARE',
  },
  {
    id: 'track-cargo',
    label: 'Track wishlist cargo',
    metric: 'wishlistCount',
    target: 3,
    difficulty: 'easy',
    rewardXp: 26,
    rewardCredits: 20,
    rewardLabel: 'CARGO LOCK',
  },
  {
    id: 'sync-watchlist',
    label: 'Sync watchlist',
    metric: 'syncs',
    target: 1,
    difficulty: 'easy',
    rewardXp: 24,
    rewardCredits: 18,
    rewardLabel: 'WATCHLIST SYNC',
  },
  {
    id: 'launch-drop',
    label: 'Launch unplayed titles',
    metric: 'launchUnplayed',
    target: 1,
    difficulty: 'easy',
    rewardXp: 30,
    rewardCredits: 24,
    rewardLabel: 'FIRST LAUNCH',
  },
  {
    id: 'price-audit',
    label: 'Run deal checks',
    metric: 'syncs',
    target: 2,
    difficulty: 'standard',
    rewardXp: 38,
    rewardCredits: 32,
    rewardLabel: 'DEAL AUDIT',
  },
  {
    id: 'search-burst',
    label: 'Search fresh titles',
    metric: 'scans',
    target: 4,
    difficulty: 'standard',
    rewardXp: 36,
    rewardCredits: 30,
    rewardLabel: 'SEARCH BURST',
  },
  {
    id: 'offer-analyst',
    label: 'Audit competing offers',
    metric: 'compares',
    target: 3,
    difficulty: 'standard',
    rewardXp: 40,
    rewardCredits: 34,
    rewardLabel: 'OFFER ANALYST',
  },
  {
    id: 'cargo-convoy',
    label: 'Expand wishlist convoy',
    metric: 'wishlistCount',
    target: 6,
    difficulty: 'standard',
    rewardXp: 42,
    rewardCredits: 36,
    rewardLabel: 'CARGO CONVOY',
  },
  {
    id: 'playtest-rotation',
    label: 'Launch your backlog rotation',
    metric: 'launchUnplayed',
    target: 2,
    difficulty: 'standard',
    rewardXp: 45,
    rewardCredits: 38,
    rewardLabel: 'PLAYTEST ROTATION',
  },
  {
    id: 'deep-scan',
    label: 'Run deep market scans',
    metric: 'scans',
    target: 7,
    difficulty: 'hard',
    rewardXp: 56,
    rewardCredits: 52,
    rewardLabel: 'DEEP SCAN',
  },
  {
    id: 'market-marathon',
    label: 'Complete comparison marathon',
    metric: 'compares',
    target: 5,
    difficulty: 'hard',
    rewardXp: 58,
    rewardCredits: 54,
    rewardLabel: 'MARKET MARATHON',
  },
  {
    id: 'sync-surge',
    label: 'Execute sync surge',
    metric: 'syncs',
    target: 3,
    difficulty: 'hard',
    rewardXp: 60,
    rewardCredits: 58,
    rewardLabel: 'SYNC SURGE',
  },
  {
    id: 'collector-surge',
    label: 'Build a collector surge',
    metric: 'wishlistCount',
    target: 10,
    difficulty: 'hard',
    rewardXp: 62,
    rewardCredits: 60,
    rewardLabel: 'COLLECTOR SURGE',
  },
  {
    id: 'field-commander',
    label: 'Command a full launch sweep',
    metric: 'launchUnplayed',
    target: 3,
    difficulty: 'hard',
    rewardXp: 68,
    rewardCredits: 70,
    rewardLabel: 'FIELD COMMANDER',
  },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function nextLevel(xp: number) {
  return Math.floor(xp / 100)
}

function dispatchMissionUpdate() {
  emitAppEvent(APP_EVENTS.missionUpdate)
}

function defaultMissionPreferences(): MissionPreferences {
  return {
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

function missionIdsForDifficulty(difficulty: MissionDifficulty): string[] {
  return MISSION_POOL.filter((mission) => mission.difficulty === difficulty).map((mission) => mission.id)
}

function pushMissionId(selected: string[], candidate: string | undefined, maxCount: number) {
  if (!candidate) return
  if (selected.length >= maxCount) return
  if (selected.includes(candidate)) return
  selected.push(candidate)
}

function generateMissionIds(seedInput: string): string[] {
  const maxCount = Math.min(DAILY_MISSION_COUNT, MISSION_POOL.length)
  const easy = shuffle(missionIdsForDifficulty('easy'), makeSeed(`${seedInput}:easy`))
  const standard = shuffle(missionIdsForDifficulty('standard'), makeSeed(`${seedInput}:standard`))
  const hard = shuffle(missionIdsForDifficulty('hard'), makeSeed(`${seedInput}:hard`))
  const selected: string[] = []

  pushMissionId(selected, easy[0], maxCount)
  pushMissionId(selected, standard[0], maxCount)
  pushMissionId(selected, hard[0], maxCount)

  const remainder = shuffle(
    MISSION_POOL.map((mission) => mission.id),
    makeSeed(`${seedInput}:remainder`),
  )
  remainder.forEach((id) => pushMissionId(selected, id, maxCount))
  return selected.slice(0, maxCount)
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

function missionTarget(mission: MissionDefinition) {
  return mission.target
}

function missionProgress(mission: MissionDefinition, metrics: MissionMetrics) {
  return toCounterInt(metrics[mission.metric])
}

export function loadMissionPreferences(): MissionPreferences {
  const raw = localStorage.getItem(MISSION_PREFS_KEY)
  if (!raw) return defaultMissionPreferences()
  try {
    const parsed = JSON.parse(raw) as Partial<MissionPreferences> | null
    if (!parsed || typeof parsed !== 'object') {
      return defaultMissionPreferences()
    }
    return {
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
    rerollsEnabled: typeof patch.rerollsEnabled === 'boolean' ? patch.rerollsEnabled : current.rerollsEnabled,
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
  const state = loadDailyMissionState()

  return state.missionIds
    .map((id) => findMission(id))
    .filter((mission): mission is MissionDefinition => !!mission)
    .map((mission) => {
      const target = missionTarget(mission)
      const progress = Math.min(target, missionProgress(mission, metrics))
      return {
        id: mission.id,
        label: mission.label,
        metric: mission.metric,
        difficulty: mission.difficulty,
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

    const target = missionTarget(mission)
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
  const raw = localStorage.getItem(STORAGE_KEYS.wishlist.items)
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

  const currentMission = findMission(missionId)
  if (!currentMission) {
    return { ok: false, reason: 'missing' }
  }

  const sameDifficultyAlternatives = MISSION_POOL.filter(
    (mission) => mission.difficulty === currentMission.difficulty && !state.missionIds.includes(mission.id),
  ).map((mission) => mission.id)

  const allAlternatives = MISSION_POOL.filter((mission) => !state.missionIds.includes(mission.id)).map(
    (mission) => mission.id,
  )

  const alternatives = sameDifficultyAlternatives.length > 0 ? sameDifficultyAlternatives : allAlternatives
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
  emitAppEvent(APP_EVENTS.commanderUpdate)
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

type DesignPreviewState = {
  id: DesignId
  expiresAt: number
}

function readDesignPreviewState(): DesignPreviewState | null {
  const raw = localStorage.getItem(DESIGN_PREVIEW_KEY)
  if (!raw) return null

  if (isKnownDesignId(raw)) {
    const migrated: DesignPreviewState = {
      id: raw,
      expiresAt: Date.now() + DESIGN_PREVIEW_DURATION_MS,
    }
    localStorage.setItem(DESIGN_PREVIEW_KEY, JSON.stringify(migrated))
    return migrated
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DesignPreviewState>
    if (!isKnownDesignId(parsed.id)) return null
    const expiresAt =
      typeof parsed.expiresAt === 'number' && Number.isFinite(parsed.expiresAt)
        ? parsed.expiresAt
        : Date.now() + DESIGN_PREVIEW_DURATION_MS
    return { id: parsed.id, expiresAt }
  } catch {
    return null
  }
}

export function loadDesignPreview(): DesignId | null {
  const preview = readDesignPreviewState()
  if (!preview) {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
    return null
  }
  if (preview.expiresAt <= Date.now()) {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
    return null
  }
  return preview.id
}

export function getDesignPreviewRemainingMs(): number {
  const preview = readDesignPreviewState()
  if (!preview) {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
    return 0
  }
  const remainingMs = preview.expiresAt - Date.now()
  if (remainingMs <= 0) {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
    return 0
  }
  return remainingMs
}

export function setDesignPreview(designId: DesignId | null) {
  if (designId && !isKnownDesignId(designId)) return
  if (designId) {
    const payload: DesignPreviewState = {
      id: designId,
      expiresAt: Date.now() + DESIGN_PREVIEW_DURATION_MS,
    }
    localStorage.setItem(DESIGN_PREVIEW_KEY, JSON.stringify(payload))
  } else {
    localStorage.removeItem(DESIGN_PREVIEW_KEY)
  }
  emitAppEvent(APP_EVENTS.designPreviewUpdate)
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
