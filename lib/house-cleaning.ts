/**
 * lib/house-cleaning.ts — Tidy house-cleaning app model
 *
 * Port of `/Users/otherworld/house-cleaning` (vanilla Tidy) onto the Modules
 * platform. State lives on `module.config.houseCleaning` (same self-contained
 * pattern as `tripItinerary`) so the mini-app can keep its own tree of areas,
 * hierarchical tasks, needed items, stuck sessions, per-area subareas, and plans
 * without flattening them onto Lists/Items.
 *
 * Pure + unit-testable. The React shell is
 * `components/Modules/workspace/housecleaning/TidyView.tsx`.
 */

export const GENERAL_AREA_ID = "general"

export const IMPORTANCE = [
  { k: "crucial", label: "Crucial" },
  { k: "important", label: "Important" },
  { k: "preferred", label: "Preferred" },
  { k: "optional", label: "Optional" },
  { k: "unset", label: "Unclassified" },
] as const

export type Importance = (typeof IMPORTANCE)[number]["k"]

export const RANK: Record<Importance, number> = {
  crucial: 0,
  important: 1,
  preferred: 2,
  optional: 3,
  unset: 4,
}

export const TIME_FILTERS: Array<[number, string]> = [
  [0, "Any length"],
  [5, "5 min or less"],
  [15, "15 min or less"],
  [30, "30 min or less"],
  [60, "1 hour or less"],
]

export const PLAN_TIERS = [
  { k: "min", label: "Bare minimum" },
  { k: "good", label: "Good" },
  { k: "extra", label: "Exceptional" },
] as const

export type PlanTier = (typeof PLAN_TIERS)[number]["k"]

export const DEFAULT_AREAS: HouseArea[] = [
  { id: "kitchen", name: "Kitchen" },
  { id: "living", name: "Living Room" },
  { id: "bedroom", name: "Bedroom" },
  { id: "bathroom", name: "Bathroom" },
  { id: "entry", name: "Entryway" },
  { id: "laundry", name: "Laundry" },
]

export const GENERAL_AREA: HouseArea = { id: GENERAL_AREA_ID, name: "General" }

export interface HouseArea {
  id: string
  name: string
}

export interface HouseSubareaCheck {
  id: string
  title: string
  done: boolean
  checks?: HouseSubareaCheck[]
}

export interface HouseSubarea {
  id: string
  areaId: string
  name: string
  done: boolean
  completedAt?: number | null
  createdAt: number
  checks: HouseSubareaCheck[]
}

export const SUBAREA_BOX_TITLE = "Sort out 1 miscellaneous box"
export const SUBAREA_SWEEP_TITLE = "Sweep the current area"

export type HouseSubareaSessionKind = "perfect" | "box" | "sweep"

export interface HouseSubareaSessionItem {
  kind: HouseSubareaSessionKind
  subareaId?: string
  title: string
  checks: HouseSubareaCheck[]
  /** Generated 50–80 when a Perfect run starts. Missing (old sessions) → 100. */
  threshold: number
}

export function subareaSweepTitle(areaName?: string | null): string {
  const name = String(areaName || "").trim()
  return name ? `Sweep the ${name}` : SUBAREA_SWEEP_TITLE
}

export interface HouseSubareaSession {
  areaId: string
  items: HouseSubareaSessionItem[]
  index: number
  phase: "task" | "done"
  /** Extra percent points banked this run. Resets on `startSubareaSession`. */
  bank: number
}

export interface HouseTask {
  id: string
  areaId: string
  parentId: string | null
  title: string
  importance: Importance
  estMin: number
  actualSec: number
  done: boolean
  completedAt?: number | null
  collapsed: boolean
  createdAt: number
}

export interface HouseNeeded {
  id: string
  areaId: string
  text: string
  got: boolean
  createdAt: number
}

export const SIDEQUEST_TASKS_TO_UNLOCK = 3
export const SIDEQUEST_SESSIONS_TO_UNLOCK = 2
export const SIDEQUEST_MIN_MINUTES = 20
export const SIDEQUEST_MAX_MINUTES = 50

export interface HouseSidequest {
  id: string
  areaId: string
  title: string
  done: boolean
  completedAt?: number | null
  createdAt: number
}

export interface HouseSidequestEarn {
  tasks: number
  sessions: number
  unlocked: boolean
}

export interface HouseSidequestSession {
  sidequestId: string
  title: string
  areaId: string
  durationSec: number
  phase: "pick" | "run" | "done"
  clock: HouseClock | null
  timedOut: boolean
}

export interface HouseStuckActual {
  sec: number
  at: number
}

export interface HouseStuckTask {
  id: string
  title: string
  kind: "timed" | "repeat"
  timeMode: "random" | "fixed"
  fixedMin: number
  randomMin: number
  randomMax: number
  nMode: "random" | "fixed" | "none"
  nFixed: number
  nMin: number
  nMax: number
  actuals: HouseStuckActual[]
  createdAt: number
}

export interface HouseStuckSessionItem {
  taskId: string
  kind: "timed" | "repeat"
  title: string
  durationSec: number | null
  random: boolean
}

export interface HouseClock {
  running: boolean
  startedAt: number | null
  baseSec: number
}

export interface HouseStuckSession {
  items: HouseStuckSessionItem[]
  index: number
  phase: "task" | "done"
  clock: HouseClock | null
}

export interface HousePlan {
  durationHr: number
  durationMin: number
  durationSec: number
  tiers: Record<PlanTier, string[]>
  phase: "draft" | "run" | "done"
  clock: HouseClock | null
  createdAt: number
}

export interface HouseGoal {
  total: number
  crucial: number
}

export interface HouseTimer {
  taskId: string
  startedAt: number
}

export interface HouseFilters {
  imp: Record<Importance, boolean>
  maxMin: number
  hideDone: boolean
}

export type TidyTheme = "system" | "light" | "dark"

export interface HouseCleaningState {
  areas: HouseArea[]
  tasks: HouseTask[]
  needed: HouseNeeded[]
  stuckTasks: HouseStuckTask[]
  stuckSession: HouseStuckSession | null
  subareas: HouseSubarea[]
  subareaSession: HouseSubareaSession | null
  sidequests: HouseSidequest[]
  sidequestEarn: HouseSidequestEarn
  sidequestSession: HouseSidequestSession | null
  plan: HousePlan | null
  goal: HouseGoal
  timer: HouseTimer | null
  filters: HouseFilters
  theme?: TidyTheme
}

export function blankSidequestEarn(): HouseSidequestEarn {
  return { tasks: 0, sessions: 0, unlocked: false }
}

export function tidyUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function blankHouseCleaning(): HouseCleaningState {
  return {
    areas: DEFAULT_AREAS.map((a) => ({ ...a })),
    tasks: [],
    needed: [],
    stuckTasks: [],
    stuckSession: null,
    subareas: [],
    subareaSession: null,
    sidequests: [],
    sidequestEarn: blankSidequestEarn(),
    sidequestSession: null,
    plan: null,
    goal: { total: 0, crucial: 0 },
    timer: null,
    filters: {
      imp: { crucial: true, important: true, preferred: true, optional: true, unset: true },
      maxMin: 0,
      hideDone: false,
    },
    theme: "system",
  }
}

export function normalizeStuck(st: Partial<HouseStuckTask> & { title?: string }): HouseStuckTask {
  return {
    id: st.id || tidyUid(),
    title: String(st.title || "").trim() || "Untitled",
    kind: st.kind === "timed" ? "timed" : "repeat",
    timeMode: st.timeMode === "random" ? "random" : "fixed",
    fixedMin: Math.max(1, Number(st.fixedMin) || 15),
    randomMin: Math.max(1, Number(st.randomMin) || 5),
    randomMax: Math.max(1, Number(st.randomMax) || 20),
    nMode: st.nMode === "random" || st.nMode === "fixed" ? st.nMode : "none",
    nFixed: Math.max(1, Number(st.nFixed) || 5),
    nMin: Math.max(1, Number(st.nMin) || 5),
    nMax: Math.max(1, Number(st.nMax) || 100),
    actuals: Array.isArray(st.actuals)
      ? st.actuals.map((a) =>
          typeof a === "number"
            ? { sec: Math.max(0, Math.round(a)), at: 0 }
            : { sec: Math.max(0, Math.round(a.sec || 0)), at: a.at || 0 },
        )
      : [],
    createdAt: st.createdAt || Date.now(),
  }
}

export function normalizeStuckSession(ses: HouseStuckSession | null | undefined): HouseStuckSession | null {
  if (!ses || !Array.isArray(ses.items) || !ses.items.length) return null
  const items = ses.items
    .map((it) => ({
      taskId: it.taskId,
      kind: it.kind === "timed" ? ("timed" as const) : ("repeat" as const),
      title: String(it.title || ""),
      durationSec: it.durationSec == null ? null : Math.max(0, Number(it.durationSec) || 0),
      random: !!it.random,
    }))
    .filter((it) => it.title)
  if (!items.length) return null
  let index = Math.max(0, Math.min(Number(ses.index) || 0, items.length - 1))
  const phase = ses.phase === "done" ? "done" : "task"
  if (phase === "done") return { items, index: items.length - 1, phase, clock: null }
  const item = items[index]
  const clockIn = ses.clock || { running: false, startedAt: null, baseSec: 0 }
  const fallback = item.kind === "timed" ? item.durationSec || 0 : 0
  const startedAt = Number(clockIn.startedAt)
  const running = !!(clockIn.running && startedAt)
  return {
    items,
    index,
    phase,
    clock: {
      running,
      startedAt: running ? startedAt : null,
      baseSec: Number.isFinite(Number(clockIn.baseSec)) ? Math.max(0, Number(clockIn.baseSec)) : fallback,
    },
  }
}

export function normalizePlan(p: HousePlan | null | undefined): HousePlan | null {
  if (!p) return null
  const src = p.tiers || { min: [], good: [], extra: [] }
  const tiers: Record<PlanTier, string[]> = { min: [], good: [], extra: [] }
  PLAN_TIERS.forEach(({ k }) => {
    tiers[k] = Array.isArray(src[k]) ? src[k].filter((id) => typeof id === "string") : []
  })
  const durationHr = Math.max(0, Number(p.durationHr) || 0)
  const durationMin = Math.max(0, Number(p.durationMin) || 0)
  const durationSec = Math.max(60, Number(p.durationSec) || durationHr * 3600 + durationMin * 60)
  const phase = p.phase === "run" || p.phase === "done" ? p.phase : "draft"
  let clock: HouseClock | null = null
  if (p.clock && phase === "run") {
    const startedAt = Number(p.clock.startedAt)
    const running = !!(p.clock.running && startedAt)
    clock = {
      running,
      startedAt: running ? startedAt : null,
      baseSec: Math.max(0, Number(p.clock.baseSec) || 0),
    }
  }
  return { durationHr, durationMin, durationSec, tiers, phase, clock, createdAt: p.createdAt || Date.now() }
}

export function normalizeGoal(g: HouseGoal | null | undefined): HouseGoal {
  if (!g) return { total: 0, crucial: 0 }
  const total = Math.max(0, Math.round(Number(g.total) || 0))
  const crucial = Math.max(0, Math.round(Number(g.crucial) || 0))
  return { total, crucial: Math.min(crucial, total || crucial) }
}

export function subareaCheckDone(c: HouseSubareaCheck): boolean {
  const kids = c.checks || []
  return kids.length ? kids.every(subareaCheckDone) : !!c.done
}

export function subareaCheckLeaves(checks: HouseSubareaCheck[]): HouseSubareaCheck[] {
  return checks.flatMap((c) => {
    const kids = c.checks || []
    return kids.length ? subareaCheckLeaves(kids) : [c]
  })
}

export function subareaCheckProgress(checks: HouseSubareaCheck[]): { done: number; total: number; pct: number } {
  const leaves = subareaCheckLeaves(checks)
  if (!leaves.length) return { done: 0, total: 0, pct: 100 }
  const done = leaves.filter((c) => c.done).length
  const total = leaves.length
  return { done, total, pct: Math.round((done / total) * 100) }
}

function cloneChecks(checks: HouseSubareaCheck[]): HouseSubareaCheck[] {
  return checks.map((c) => {
    const kids = c.checks?.length ? cloneChecks(c.checks) : undefined
    return kids?.length ? { id: c.id, title: c.title, done: c.done, checks: kids } : { id: c.id, title: c.title, done: c.done }
  })
}

function resetChecksDone(checks: HouseSubareaCheck[]): HouseSubareaCheck[] {
  return checks.map((c) => {
    const kids = c.checks?.length ? resetChecksDone(c.checks) : undefined
    return kids?.length
      ? { id: c.id, title: c.title, done: false, checks: kids }
      : { id: c.id, title: c.title, done: false }
  })
}

function normalizeChecks(raw: unknown): HouseSubareaCheck[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => {
      if (!c || typeof c !== "object") return null
      const row = c as Partial<HouseSubareaCheck>
      const id = String(row.id || "")
      const title = String(row.title || "").trim()
      if (!id || !title) return null
      const kids = normalizeChecks(row.checks)
      if (kids.length) return { id, title, done: kids.every(subareaCheckDone), checks: kids }
      return { id, title, done: !!row.done }
    })
    .filter((c): c is HouseSubareaCheck => !!c)
}

function normalizeSubarea(raw: Partial<HouseSubarea> | null | undefined): HouseSubarea | null {
  if (!raw) return null
  const id = String(raw.id || "")
  const areaId = String(raw.areaId || "")
  const name = String(raw.name || "").trim()
  if (!id || !areaId || !name) return null
  return {
    id,
    areaId,
    name,
    done: !!raw.done,
    completedAt: raw.completedAt || null,
    createdAt: raw.createdAt || Date.now(),
    checks: normalizeChecks(raw.checks),
  }
}

function clampSubareaPercent(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** Old in-flight sessions without a threshold keep the 100% gate until a new run. */
function normalizeSessionThreshold(raw: unknown): number {
  if (raw == null || raw === "") return 100
  const n = Number(raw)
  if (!Number.isFinite(n)) return 100
  return clampSubareaPercent(n)
}

function normalizeSessionBank(raw: unknown): number {
  if (raw == null || raw === "") return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return clampSubareaPercent(n)
}

export function normalizeSubareaSession(ses: HouseSubareaSession | null | undefined): HouseSubareaSession | null {
  if (!ses || !Array.isArray(ses.items) || !ses.items.length) return null
  const areaId = String(ses.areaId || "")
  if (!areaId) return null
  const items = ses.items
    .map((it) => {
      const title = String(it.title || "").trim()
      if (!title) return null
      const checks = normalizeChecks(it.checks)
      const threshold = normalizeSessionThreshold((it as HouseSubareaSessionItem).threshold)
      if (it.kind === "box") return { kind: "box" as const, title, checks, threshold }
      if (it.kind === "sweep") return { kind: "sweep" as const, title, checks, threshold }
      const subareaId = String(it.subareaId || "")
      if (!subareaId) return null
      return { kind: "perfect" as const, subareaId, title, checks, threshold }
    })
    .filter((it): it is HouseSubareaSessionItem => !!it)
  if (!items.length) return null
  let index = Math.max(0, Math.min(Number(ses.index) || 0, items.length - 1))
  const phase = ses.phase === "done" ? "done" : "task"
  const bank = normalizeSessionBank(ses.bank)
  if (phase === "done") return { areaId, items, index: items.length - 1, phase, bank }
  return { areaId, items, index, phase, bank }
}

function normalizeTask(t: Partial<HouseTask>): HouseTask | null {
  const title = String(t.title || "").trim()
  if (!title || !t.id) return null
  const importance = IMPORTANCE.some((i) => i.k === t.importance) ? (t.importance as Importance) : "unset"
  return {
    id: t.id,
    areaId: t.areaId || GENERAL_AREA_ID,
    parentId: t.parentId || null,
    title,
    importance,
    estMin: Math.max(0, Number(t.estMin) || 0),
    actualSec: Math.max(0, Number(t.actualSec) || 0),
    done: !!t.done,
    completedAt: t.completedAt || null,
    collapsed: !!t.collapsed,
    createdAt: t.createdAt || Date.now(),
  }
}

function normalizeSidequest(raw: Partial<HouseSidequest> | null | undefined): HouseSidequest | null {
  if (!raw) return null
  const id = String(raw.id || "")
  const areaId = String(raw.areaId || "")
  const title = String(raw.title || "").trim()
  if (!id || !areaId || !title) return null
  return {
    id,
    areaId,
    title,
    done: !!raw.done,
    completedAt: raw.completedAt || null,
    createdAt: raw.createdAt || Date.now(),
  }
}

function normalizeSidequestEarn(raw: Partial<HouseSidequestEarn> | null | undefined): HouseSidequestEarn {
  const b = blankSidequestEarn()
  if (!raw || typeof raw !== "object") return b
  const tasks = Math.max(0, Math.round(Number(raw.tasks) || 0))
  const sessions = Math.max(0, Math.round(Number(raw.sessions) || 0))
  const unlocked =
    !!raw.unlocked || tasks >= SIDEQUEST_TASKS_TO_UNLOCK || sessions >= SIDEQUEST_SESSIONS_TO_UNLOCK
  return { tasks, sessions, unlocked }
}

export function normalizeSidequestSession(
  ses: HouseSidequestSession | null | undefined,
): HouseSidequestSession | null {
  if (!ses || !ses.sidequestId) return null
  const title = String(ses.title || "").trim()
  const areaId = String(ses.areaId || "")
  if (!title || !areaId) return null
  const phase = ses.phase === "run" || ses.phase === "done" || ses.phase === "pick" ? ses.phase : "pick"
  const durationSec = Math.max(0, Number(ses.durationSec) || 0)
  let clock: HouseClock | null = null
  if (ses.clock && phase === "run") {
    const startedAt = Number(ses.clock.startedAt)
    const running = !!(ses.clock.running && startedAt)
    clock = {
      running,
      startedAt: running ? startedAt : null,
      baseSec: Math.max(0, Number(ses.clock.baseSec) || durationSec),
    }
  }
  return {
    sidequestId: String(ses.sidequestId),
    title,
    areaId,
    durationSec,
    phase,
    clock: phase === "done" ? null : clock,
    timedOut: !!ses.timedOut,
  }
}

export function normalizeHouseCleaning(raw: unknown): HouseCleaningState {
  const b = blankHouseCleaning()
  if (!raw || typeof raw !== "object") return b
  const r = raw as Partial<HouseCleaningState>
  const areas = Array.isArray(r.areas)
    ? r.areas
        .map((a) => ({ id: String(a.id || ""), name: String(a.name || "").trim() }))
        .filter((a) => a.id && a.name)
    : b.areas
  const tasks = Array.isArray(r.tasks) ? (r.tasks.map(normalizeTask).filter(Boolean) as HouseTask[]) : []
  const needed = Array.isArray(r.needed)
    ? r.needed
        .filter((n) => n && n.id && n.text)
        .map((n) => ({
          id: n.id,
          areaId: n.areaId || GENERAL_AREA_ID,
          text: String(n.text),
          got: !!n.got,
          createdAt: n.createdAt || Date.now(),
        }))
    : []
  const theme = r.theme === "light" || r.theme === "dark" || r.theme === "system" ? r.theme : "system"
  return {
    areas: areas.length ? areas : b.areas,
    tasks,
    needed,
    stuckTasks: Array.isArray(r.stuckTasks) ? r.stuckTasks.map(normalizeStuck) : [],
    stuckSession: normalizeStuckSession(r.stuckSession),
    subareas: Array.isArray(r.subareas)
      ? (r.subareas.map(normalizeSubarea).filter(Boolean) as HouseSubarea[])
      : [],
    subareaSession: normalizeSubareaSession(r.subareaSession),
    sidequests: Array.isArray(r.sidequests)
      ? (r.sidequests.map(normalizeSidequest).filter(Boolean) as HouseSidequest[])
      : [],
    sidequestEarn: normalizeSidequestEarn(r.sidequestEarn),
    sidequestSession: normalizeSidequestSession(r.sidequestSession),
    plan: normalizePlan(r.plan),
    goal: normalizeGoal(r.goal),
    timer: r.timer && r.timer.taskId ? { taskId: r.timer.taskId, startedAt: Number(r.timer.startedAt) || Date.now() } : null,
    filters: {
      ...b.filters,
      ...(r.filters || {}),
      imp: { ...b.filters.imp, ...((r.filters || {}).imp || {}) },
    },
    theme,
  }
}

/** Seed Tidy the way a first-run house looks: default rooms + sample chores + stuck list. */
export function seedHouseCleaning(now = Date.now()): HouseCleaningState {
  const s = blankHouseCleaning()
  const task = (
    areaId: string,
    title: string,
    importance: Importance,
    estMin: number,
    i: number,
  ): HouseTask => ({
    id: `seed-${areaId}-${i}`,
    areaId,
    parentId: null,
    title,
    importance,
    estMin,
    actualSec: 0,
    done: false,
    collapsed: false,
    createdAt: now + i,
  })
  s.tasks = [
    task("kitchen", "Do dishes", "crucial", 15, 0),
    task("kitchen", "Clear counters", "important", 10, 1),
    task("kitchen", "Take out trash", "important", 5, 2),
    task("kitchen", "Wipe stove", "preferred", 8, 3),
    task("living", "Clear surfaces", "important", 10, 4),
    task("living", "Tidy floor", "preferred", 15, 5),
    task("living", "Fluff cushions", "optional", 5, 6),
    task("bedroom", "Make the bed", "crucial", 5, 7),
    task("bedroom", "Put away clothes", "important", 15, 8),
    task("bedroom", "Clear nightstand", "preferred", 5, 9),
    task("bathroom", "Wipe sink", "important", 8, 10),
    task("bathroom", "Clean toilet", "important", 10, 11),
    task("bathroom", "Hang towels", "preferred", 3, 12),
    task("entry", "Clear shoes / bags", "important", 8, 13),
    task("laundry", "Start a load", "preferred", 5, 14),
  ]
  s.stuckTasks = [
    normalizeStuck({
      id: "seed-stuck-away",
      title: "Put 5 things away",
      kind: "repeat",
      nMode: "none",
      createdAt: now,
    }),
    normalizeStuck({
      id: "seed-stuck-pickup",
      title: "Pick up {n} items",
      kind: "repeat",
      nMode: "random",
      nMin: 5,
      nMax: 100,
      createdAt: now + 1,
    }),
    normalizeStuck({
      id: "seed-stuck-timed",
      title: "Get this area as close to perfect as you can in {n} minutes",
      kind: "timed",
      timeMode: "random",
      randomMin: 5,
      randomMax: 20,
      createdAt: now + 2,
    }),
  ]
  return s
}

export function snapshotHouseCleaning(s: HouseCleaningState): HouseCleaningState {
  return {
    areas: s.areas,
    tasks: s.tasks,
    needed: s.needed,
    stuckTasks: s.stuckTasks,
    stuckSession: s.stuckSession,
    subareas: s.subareas,
    subareaSession: s.subareaSession,
    sidequests: s.sidequests || [],
    sidequestEarn: s.sidequestEarn || blankSidequestEarn(),
    sidequestSession: s.sidequestSession || null,
    plan: s.plan,
    goal: s.goal,
    timer: s.timer,
    filters: s.filters,
    theme: s.theme,
  }
}

export function byId(s: HouseCleaningState, id: string): HouseTask | undefined {
  return s.tasks.find((t) => t.id === id)
}

export function areaById(s: HouseCleaningState, id: string): HouseArea | undefined {
  if (id === GENERAL_AREA_ID) return GENERAL_AREA
  return s.areas.find((a) => a.id === id)
}

export function allAreas(s: HouseCleaningState): HouseArea[] {
  return [GENERAL_AREA, ...s.areas]
}

export function childrenOf(s: HouseCleaningState, id: string): HouseTask[] {
  return s.tasks.filter((t) => t.parentId === id)
}

export function isLeaf(s: HouseCleaningState, t: HouseTask): boolean {
  return childrenOf(s, t.id).length === 0
}

export function rootsOf(s: HouseCleaningState, areaId: string): HouseTask[] {
  return s.tasks.filter((t) => !t.parentId && t.areaId === areaId)
}

export function leavesOf(s: HouseCleaningState, t: HouseTask): HouseTask[] {
  return isLeaf(s, t) ? [t] : childrenOf(s, t.id).flatMap((c) => leavesOf(s, c))
}

export function allLeaves(s: HouseCleaningState): HouseTask[] {
  return s.tasks.filter((t) => isLeaf(s, t))
}

export function isRunning(s: HouseCleaningState, id: string): boolean {
  return !!s.timer && s.timer.taskId === id
}

export function liveSec(s: HouseCleaningState, t: HouseTask, now = Date.now()): number {
  return (t.actualSec || 0) + (isRunning(s, t.id) && s.timer ? (now - s.timer.startedAt) / 1000 : 0)
}

export function doneOf(s: HouseCleaningState, t: HouseTask): boolean {
  return isLeaf(s, t) ? !!t.done : leavesOf(s, t).every((l) => l.done)
}

export function estOf(s: HouseCleaningState, t: HouseTask): number {
  return isLeaf(s, t) ? t.estMin || 0 : childrenOf(s, t.id).reduce((n, c) => n + estOf(s, c), 0)
}

export function actOf(s: HouseCleaningState, t: HouseTask, now = Date.now()): number {
  return isLeaf(s, t) ? liveSec(s, t, now) : childrenOf(s, t.id).reduce((n, c) => n + actOf(s, c, now), 0)
}

export function sortTasks(s: HouseCleaningState, arr: HouseTask[]): HouseTask[] {
  return arr.slice().sort(
    (a, b) =>
      Number(doneOf(s, a)) - Number(doneOf(s, b)) || RANK[a.importance] - RANK[b.importance] || a.createdAt - b.createdAt,
  )
}

export function matchLeaf(s: HouseCleaningState, l: HouseTask): boolean {
  const f = s.filters
  if (!f.imp[l.importance]) return false
  if (f.maxMin && (l.estMin || 0) > f.maxMin) return false
  if (f.hideDone && l.done) return false
  return true
}

export function visible(s: HouseCleaningState, t: HouseTask): boolean {
  return isLeaf(s, t) ? matchLeaf(s, t) : leavesOf(s, t).some((l) => matchLeaf(s, l))
}

export function filterAndSort(s: HouseCleaningState, arr: HouseTask[]): HouseTask[] {
  return sortTasks(
    s,
    arr.filter((t) => visible(s, t)),
  )
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const p = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

export function fmtMin(min: number): string {
  min = Math.round(min)
  if (!min) return ""
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export function parseEst(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function isToday(ms: number | null | undefined, now = Date.now()): boolean {
  return !!ms && dayKey(ms) === dayKey(now)
}

export function todayProgress(s: HouseCleaningState, now = Date.now()): { total: number; crucial: number } {
  const done = allLeaves(s).filter((t) => t.done && isToday(t.completedAt, now))
  return {
    total: done.length,
    crucial: done.filter((t) => t.importance === "crucial").length,
  }
}

export function listSummary(s: HouseCleaningState, roots: HouseTask[]): string {
  const ls = roots.flatMap((t) => leavesOf(s, t)).filter((l) => matchLeaf(s, l))
  if (!ls.length) return ""
  const left = ls.filter((l) => !l.done)
  const mins = left.reduce((n, l) => n + (l.estMin || 0), 0)
  return `${left.length} open${mins ? ` · ${fmtMin(mins)} est` : ""} · ${ls.length - left.length} done`
}

export function mono(name: string): string {
  const w = String(name).trim().split(/\s+/).filter(Boolean)
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase()
}

export function importanceLabel(k: Importance): string {
  return IMPORTANCE.find((i) => i.k === k)?.label ?? "Unclassified"
}

/* ---- bulk add ---- */

export interface BulkBlock {
  name: string
  tasks: string[]
}

export function parseBulk(text: string): BulkBlock[] {
  const blocks: BulkBlock[] = []
  let cur: BulkBlock | null = null
  String(text)
    .split(/\r?\n/)
    .forEach((raw) => {
      let line = raw.trim()
      if (!line) return
      line = line.replace(/^[-*\u2022\u00b7+\u2013\u2014]\s*/, "").replace(/^\d+[.)]\s*/, "").trim()
      if (!line) return
      if (/:$/.test(line)) {
        const name = line.slice(0, -1).trim()
        if (name) {
          cur = { name, tasks: [] }
          blocks.push(cur)
        }
        return
      }
      if (!cur) {
        cur = { name: "General", tasks: [] }
        blocks.push(cur)
      }
      cur.tasks.push(line)
    })
  return blocks.filter((b) => b.tasks.length)
}

export function addTask(
  s: HouseCleaningState,
  fields: { areaId: string; parentId?: string | null; title: string; importance?: Importance; estMin?: number },
): { state: HouseCleaningState; task: HouseTask } {
  const task: HouseTask = {
    id: tidyUid(),
    areaId: fields.areaId,
    parentId: fields.parentId || null,
    title: fields.title,
    importance: fields.importance || "important",
    estMin: fields.estMin || 0,
    actualSec: 0,
    done: false,
    collapsed: false,
    createdAt: Date.now(),
  }
  return { state: { ...s, tasks: [...s.tasks, task] }, task }
}

export function importBulk(s: HouseCleaningState, text: string): { state: HouseCleaningState; message: string } {
  const blocks = parseBulk(text)
  if (!blocks.length) {
    return { state: s, message: "Nothing to import — paste a list first." }
  }
  let areas = s.areas.slice()
  let tasks = s.tasks.slice()
  let newAreas = 0
  let added = 0
  let skipped = 0
  const next: HouseCleaningState = { ...s, areas, tasks }
  blocks.forEach((b) => {
    let area = allAreas(next).find((a) => a.name.toLowerCase() === b.name.toLowerCase())
    if (!area) {
      area = { id: tidyUid(), name: b.name }
      areas = [...areas, area]
      next.areas = areas
      newAreas++
    }
    const seen = new Set(rootsOf(next, area.id).map((t) => t.title.toLowerCase()))
    b.tasks.forEach((title) => {
      if (seen.has(title.toLowerCase())) {
        skipped++
        return
      }
      seen.add(title.toLowerCase())
      const { state: ns, task } = addTask(next, {
        areaId: area!.id,
        parentId: null,
        title,
        importance: "unset",
        estMin: 0,
      })
      next.tasks = ns.tasks
      tasks = ns.tasks
      void task
      added++
    })
  })
  const message =
    `Imported ${added} task${added === 1 ? "" : "s"} into ${blocks.length} area${blocks.length === 1 ? "" : "s"}` +
    (newAreas ? ` (${newAreas} new)` : "") +
    (skipped ? ` · skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : "") +
    " · set importance and time on each when you are ready."
  return { state: { ...s, areas, tasks }, message }
}

/* ---- timers ---- */

export function commitTimer(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  if (!s.timer) return s
  const t = byId(s, s.timer.taskId)
  if (!t) return { ...s, timer: null }
  return {
    ...s,
    timer: null,
    tasks: s.tasks.map((x) =>
      x.id === t.id ? { ...x, actualSec: (x.actualSec || 0) + Math.round((now - s.timer!.startedAt) / 1000) } : x,
    ),
  }
}

export function startTaskTimer(s: HouseCleaningState, id: string, now = Date.now()): HouseCleaningState {
  let next = s
  if (s.timer && s.timer.taskId !== id) next = commitTimer(s, now)
  if (isRunning(next, id)) return next
  return { ...next, timer: { taskId: id, startedAt: now } }
}

function isSidequestRunning(s: HouseCleaningState): boolean {
  return s.sidequestSession?.phase === "run"
}

function creditSidequestTask(s: HouseCleaningState): HouseCleaningState {
  const earn = s.sidequestEarn || blankSidequestEarn()
  if (earn.unlocked || isSidequestRunning(s)) return s
  const tasks = earn.tasks + 1
  const unlocked = tasks >= SIDEQUEST_TASKS_TO_UNLOCK || earn.sessions >= SIDEQUEST_SESSIONS_TO_UNLOCK
  return { ...s, sidequestEarn: { ...earn, tasks, unlocked } }
}

function creditSidequestSession(s: HouseCleaningState): HouseCleaningState {
  const earn = s.sidequestEarn || blankSidequestEarn()
  if (earn.unlocked || isSidequestRunning(s)) return s
  const sessions = earn.sessions + 1
  const unlocked = earn.tasks >= SIDEQUEST_TASKS_TO_UNLOCK || sessions >= SIDEQUEST_SESSIONS_TO_UNLOCK
  return { ...s, sidequestEarn: { ...earn, sessions, unlocked } }
}

export function completeTask(s: HouseCleaningState, id: string, now = Date.now()): HouseCleaningState {
  const prior = byId(s, id)
  let next = isRunning(s, id) ? commitTimer(s, now) : s
  next = {
    ...next,
    tasks: next.tasks.map((t) => (t.id === id ? { ...t, done: true, completedAt: now } : t)),
  }
  if (prior && !prior.done) next = creditSidequestTask(next)
  return next
}

export function toggleDone(s: HouseCleaningState, id: string, now = Date.now()): HouseCleaningState {
  const t = byId(s, id)
  if (!t) return s
  if (t.done) {
    return { ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, done: false, completedAt: null } : x)) }
  }
  let next = isRunning(s, id) ? commitTimer(s, now) : s
  next = {
    ...next,
    tasks: next.tasks.map((x) => (x.id === id ? { ...x, done: true, completedAt: now } : x)),
  }
  return creditSidequestTask(next)
}

export function planContains(s: HouseCleaningState, id: string): boolean {
  if (!s.plan) return false
  return PLAN_TIERS.some(({ k }) => s.plan!.tiers[k].includes(id))
}

export function planAncestorIn(s: HouseCleaningState, id: string): boolean {
  let t = byId(s, id)
  while (t && t.parentId) {
    if (planContains(s, t.parentId)) return true
    t = byId(s, t.parentId)
  }
  return false
}

export function planDescendantIds(s: HouseCleaningState, id: string): string[] {
  const t = byId(s, id)
  if (!t) return [id]
  const ids: string[] = []
  const walk = (x: HouseTask) => {
    ids.push(x.id)
    childrenOf(s, x.id).forEach(walk)
  }
  walk(t)
  return ids
}

function scrubPlanIds(plan: HousePlan, ids: Set<string>): HousePlan {
  const tiers = { ...plan.tiers }
  PLAN_TIERS.forEach(({ k }) => {
    tiers[k] = tiers[k].filter((x) => !ids.has(x))
  })
  return { ...plan, tiers }
}

export function scrubPlanTask(s: HouseCleaningState, id: string): HouseCleaningState {
  if (!s.plan) return s
  return { ...s, plan: scrubPlanIds(s.plan, new Set(planDescendantIds(s, id))) }
}

export function deleteTask(s: HouseCleaningState, id: string): HouseCleaningState {
  const t = byId(s, id)
  if (!t) return s
  let next = scrubPlanTask(s, id)
  const killIds = new Set(planDescendantIds(next, id))
  if (next.timer && killIds.has(next.timer.taskId)) next = { ...next, timer: null }
  return { ...next, tasks: next.tasks.filter((x) => !killIds.has(x.id)) }
}

export function deleteArea(s: HouseCleaningState, id: string): HouseCleaningState {
  if (id === GENERAL_AREA_ID) return s
  let next = s
  next.tasks.filter((t) => t.areaId === id).forEach((t) => {
    next = scrubPlanTask(next, t.id)
  })
  if (next.timer) {
    const running = byId(next, next.timer.taskId)
    if (running?.areaId === id) next = { ...next, timer: null }
  }
  const subareaSession = next.subareaSession?.areaId === id ? null : next.subareaSession
  const sidequestSession = next.sidequestSession?.areaId === id ? null : next.sidequestSession
  return {
    ...next,
    tasks: next.tasks.filter((t) => t.areaId !== id),
    needed: next.needed.filter((n) => n.areaId !== id),
    subareas: next.subareas.filter((x) => x.areaId !== id),
    subareaSession,
    sidequests: (next.sidequests || []).filter((q) => q.areaId !== id),
    sidequestSession,
    areas: next.areas.filter((a) => a.id !== id),
  }
}

/* ---- stuck ---- */

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Heavily favor 2–3; 1, 4, and 5 are uncommon. */
export function pickStuckCount(max: number, random = Math.random): number {
  if (max <= 0) return 0
  const r = random()
  const n = r < 0.08 ? 1 : r < 0.48 ? 2 : r < 0.86 ? 3 : r < 0.96 ? 4 : 5
  return Math.min(n, max)
}

export function pickInt(lo: number, hi: number, random = Math.random): number {
  lo = Math.max(1, lo | 0)
  hi = Math.max(1, hi | 0)
  if (lo > hi) {
    const t = lo
    lo = hi
    hi = t
  }
  return lo + Math.floor(random() * (hi - lo + 1))
}

export function resolveStuckN(st: HouseStuckTask, random = Math.random): number | null {
  if (st.kind === "timed") {
    return st.timeMode === "random" ? pickInt(st.randomMin, st.randomMax, random) : Math.max(1, st.fixedMin | 0)
  }
  if (st.nMode === "random") return pickInt(st.nMin, st.nMax, random)
  if (st.nMode === "fixed") return Math.max(1, st.nFixed | 0)
  return null
}

export function fillStuckTitle(title: string, n: number | null): string {
  if (n == null) return title
  return String(title).replace(/\{n\}|\{minutes\}|\{min\}/gi, String(n))
}

export function stuckParamLabel(st: HouseStuckTask): string {
  if (st.kind === "timed") {
    if (st.timeMode === "random") {
      const lo = Math.min(st.randomMin, st.randomMax)
      const hi = Math.max(st.randomMin, st.randomMax)
      return `Random ${lo}–${hi} min`
    }
    return `${st.fixedMin} min`
  }
  if (st.nMode === "random") {
    const lo = Math.min(st.nMin, st.nMax)
    const hi = Math.max(st.nMin, st.nMax)
    return `${lo}–${hi}`
  }
  if (st.nMode === "fixed") return String(st.nFixed)
  return "Anytime"
}

export function stuckFreshClock(item: HouseStuckSessionItem): HouseClock {
  return item.kind === "timed"
    ? { running: false, startedAt: null, baseSec: item.durationSec || 0 }
    : { running: false, startedAt: null, baseSec: 0 }
}

export function stuckLive(s: HouseCleaningState, now = Date.now()): number {
  const ses = s.stuckSession
  if (!ses || !ses.clock) return 0
  const c = ses.clock
  const extra = c.running && c.startedAt ? (now - c.startedAt) / 1000 : 0
  const item = ses.items[ses.index]
  if (item && item.kind === "timed") return Math.max(0, c.baseSec - extra)
  return c.baseSec + extra
}

export function sessionItemFromTask(st: HouseStuckTask, randomFlag: boolean, random = Math.random): HouseStuckSessionItem {
  const n = resolveStuckN(st, random)
  return {
    taskId: st.id,
    kind: st.kind,
    title: fillStuckTitle(st.title, n),
    durationSec: st.kind === "timed" && n != null ? n * 60 : null,
    random: !!randomFlag,
  }
}

export function freezeStuckClock(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.stuckSession
  if (!ses || !ses.clock || !ses.clock.running) return s
  return {
    ...s,
    stuckSession: {
      ...ses,
      clock: { running: false, startedAt: null, baseSec: stuckLive(s, now) },
    },
  }
}

export function freezePlanClock(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const p = s.plan
  if (!p || !p.clock || !p.clock.running) return s
  return {
    ...s,
    plan: { ...p, clock: { running: false, startedAt: null, baseSec: planLive(s, now) } },
  }
}

export function freezeSidequestClock(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.sidequestSession
  if (!ses || !ses.clock || !ses.clock.running) return s
  return {
    ...s,
    sidequestSession: {
      ...ses,
      clock: { running: false, startedAt: null, baseSec: sidequestLive(s, now) },
    },
  }
}

export function freezeClocks(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  return freezeSidequestClock(freezePlanClock(freezeStuckClock(s, now), now), now)
}

export function startStuckMode(s: HouseCleaningState, random = Math.random): HouseCleaningState | { error: string } {
  if (s.sidequestSession?.phase === "run") {
    return { error: "Finish the sidequest first." }
  }
  if (s.subareaSession) {
    return { error: "Finish the subarea session first." }
  }
  if (!s.stuckTasks.length) {
    return { error: "Add a few stuck tasks first — things you can do anytime." }
  }
  const next = commitTimer(s)
  const picked = shuffle(next.stuckTasks).slice(0, pickStuckCount(next.stuckTasks.length, random))
  const items = picked.map((st) => sessionItemFromTask(st, random() < 0.2, random))
  return {
    ...next,
    stuckSession: { items, index: 0, phase: "task", clock: stuckFreshClock(items[0]) },
  }
}

export function stuckSwitch(s: HouseCleaningState, random = Math.random): HouseCleaningState {
  const ses = s.stuckSession
  if (!ses || ses.phase !== "task") return s
  const item = ses.items[ses.index]
  if (!item || !item.random) return s
  const pool = s.stuckTasks.filter((t) => t.id !== item.taskId)
  const src = pool.length ? pool : s.stuckTasks
  if (!src.length) return s
  const st = src[Math.floor(random() * src.length)]
  const items = ses.items.slice()
  items[ses.index] = sessionItemFromTask(st, true, random)
  return { ...s, stuckSession: { ...ses, items, clock: stuckFreshClock(items[ses.index]) } }
}

export function stuckStartClock(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.stuckSession
  if (!ses || ses.phase !== "task" || !ses.clock || ses.clock.running) return s
  return { ...s, stuckSession: { ...ses, clock: { ...ses.clock, running: true, startedAt: now } } }
}

export function stuckPause(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.stuckSession
  if (!ses || !ses.clock || !ses.clock.running) return s
  return {
    ...s,
    stuckSession: { ...ses, clock: { running: false, startedAt: null, baseSec: stuckLive(s, now) } },
  }
}

export function stuckComplete(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.stuckSession
  if (!ses || ses.phase !== "task") return s
  const item = ses.items[ses.index]
  if (!item) return s
  const sec = item.kind === "timed" ? item.durationSec || 0 : Math.max(0, Math.round(stuckLive(s, now)))
  const stuckTasks = s.stuckTasks.map((st) =>
    st.id === item.taskId ? { ...st, actuals: [...st.actuals, { sec, at: now }] } : st,
  )
  if (ses.index + 1 >= ses.items.length) {
    return creditSidequestSession({ ...s, stuckTasks, stuckSession: { ...ses, phase: "done", clock: null } })
  }
  const index = ses.index + 1
  return {
    ...s,
    stuckTasks,
    stuckSession: { ...ses, index, clock: stuckFreshClock(ses.items[index]) },
  }
}

export function endStuckMode(s: HouseCleaningState): HouseCleaningState {
  return { ...s, stuckSession: null }
}

/* ---- subareas ---- */

function shuffleWith<T>(arr: T[], random: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Always 2 or 3 when possible; 1 only if that is all the area has. */
export function pickSubareaCount(max: number, random = Math.random): number {
  if (max <= 0) return 0
  if (max === 1) return 1
  const n = random() < 0.5 ? 2 : 3
  return Math.min(n, max)
}

export function subareasOf(s: HouseCleaningState, areaId: string): HouseSubarea[] {
  return s.subareas.filter((x) => x.areaId === areaId).slice().sort((a, b) => a.createdAt - b.createdAt)
}

export function addSubarea(s: HouseCleaningState, areaId: string, name: string): HouseCleaningState {
  const trimmed = String(name || "").trim()
  if (!trimmed) return s
  const subarea: HouseSubarea = {
    id: tidyUid(),
    areaId,
    name: trimmed,
    done: false,
    completedAt: null,
    createdAt: Date.now(),
    checks: [],
  }
  return { ...s, subareas: [...s.subareas, subarea] }
}

export function deleteSubarea(s: HouseCleaningState, id: string): HouseCleaningState {
  const next = { ...s, subareas: s.subareas.filter((x) => x.id !== id) }
  const ses = next.subareaSession
  if (ses && ses.items.some((it) => it.subareaId === id)) {
    return { ...next, subareaSession: null }
  }
  return next
}

export function startSubareaSession(
  s: HouseCleaningState,
  areaId: string,
  random = Math.random,
): HouseCleaningState | { error: string } {
  if (s.sidequestSession?.phase === "run") {
    return { error: "Finish the sidequest first." }
  }
  if (s.stuckSession) {
    return { error: "Finish stuck mode first." }
  }
  const pool = subareasOf(s, areaId)
  if (!pool.length) {
    return { error: "Add a few subareas first — spots in this room you want to perfect." }
  }
  const count = pickSubareaCount(pool.length, random)
  const picked = shuffleWith(pool, random).slice(0, count)
  const perfects: HouseSubareaSessionItem[] = picked.map((sa) => ({
    kind: "perfect" as const,
    subareaId: sa.id,
    title: `Perfect the ${sa.name}`,
    checks: resetChecksDone(sa.checks || []),
    threshold: pickSubareaThreshold(random),
  }))
  const sweep: HouseSubareaSessionItem = {
    kind: "sweep",
    title: subareaSweepTitle(areaById(s, areaId)?.name),
    checks: [],
    threshold: 50,
  }
  const box: HouseSubareaSessionItem = {
    kind: "box",
    title: SUBAREA_BOX_TITLE,
    checks: [],
    threshold: 50,
  }
  const items = interleaveInterstitials(perfects, { sweep, box }, random).map((it) =>
    it.kind === "perfect" ? it : { ...it, checks: cloneChecks(it.checks || []), threshold: pickSubareaThreshold(random) },
  )
  return {
    ...s,
    subareaSession: { areaId, items, index: 0, phase: "task", bank: 0 },
  }
}

/** Inclusive 50–80 in one-percent steps. `random()` of 0 → 50, 1 → 80. */
export function pickSubareaThreshold(random = Math.random): number {
  return 50 + Math.round(random() * 30)
}

/** Drop `extra` at a random index from 1..length so it is never first. */
export function insertNotFirst<T>(items: T[], extra: T, random = Math.random): T[] {
  if (!items.length) return [extra]
  const at = 1 + Math.floor(random() * items.length)
  const next = items.slice()
  next.splice(at, 0, extra)
  return next
}

function cloneInterstitial<T>(item: T): T {
  if (item === null || typeof item !== "object") return item
  const row = item as T & { checks?: HouseSubareaCheck[] }
  if (!Array.isArray(row.checks)) return { ...row }
  return { ...row, checks: cloneChecks(row.checks) }
}

/**
 * Walk `perfects` in order. After every k (fresh random 1–3) insert `sweep`;
 * independently after every m (fresh random 1–3) insert `box`. Never first.
 * If both fire after the same perfect, sweep then box. Cadences may still
 * insert after the last perfect when their counter hits.
 */
export function interleaveInterstitials<T>(
  perfects: T[],
  extras: { sweep: T; box: T },
  random = Math.random,
): T[] {
  if (!perfects.length) return []
  const out: T[] = []
  let sweepIn = pickInt(1, 3, random)
  let boxIn = pickInt(1, 3, random)
  perfects.forEach((p) => {
    out.push(p)
    sweepIn -= 1
    boxIn -= 1
    if (sweepIn === 0) {
      out.push(cloneInterstitial(extras.sweep))
      sweepIn = pickInt(1, 3, random)
    }
    if (boxIn === 0) {
      out.push(cloneInterstitial(extras.box))
      boxIn = pickInt(1, 3, random)
    }
  })
  return out
}

export function subareaSessionChecks(s: HouseCleaningState): HouseSubareaCheck[] {
  const ses = s.subareaSession
  if (!ses || ses.phase !== "task") return []
  return ses.items[ses.index]?.checks ?? []
}

export function subareaProgress(s: HouseCleaningState): { doneLeaves: number; totalLeaves: number; percent: number } {
  const p = subareaCheckProgress(subareaSessionChecks(s))
  return { doneLeaves: p.done, totalLeaves: p.total, percent: p.pct }
}

export function subareaEffectiveThreshold(s: HouseCleaningState): number {
  const ses = s.subareaSession
  if (!ses || ses.phase !== "task") return 0
  const item = ses.items[ses.index]
  if (!item) return 0
  const threshold = Number.isFinite(item.threshold) ? item.threshold : 100
  const bank = Number.isFinite(ses.bank) ? ses.bank : 0
  return Math.max(0, threshold - bank)
}

export function subareaCanAdvance(s: HouseCleaningState): boolean {
  if (!s.subareaSession || s.subareaSession.phase !== "task") return false
  const progress = subareaProgress(s)
  if (!progress.totalLeaves) return true
  return progress.percent >= subareaEffectiveThreshold(s)
}

function mapCurrentSessionChecks(
  s: HouseCleaningState,
  fn: (checks: HouseSubareaCheck[]) => HouseSubareaCheck[],
): HouseCleaningState {
  const ses = s.subareaSession
  if (!ses || ses.phase !== "task") return s
  const item = ses.items[ses.index]
  if (!item) return s
  const checks = fn(item.checks || [])
  const items = ses.items.slice()
  items[ses.index] = { ...item, checks }
  let subareas = s.subareas
  if (item.kind === "perfect" && item.subareaId) {
    subareas = subareas.map((x) => (x.id === item.subareaId ? { ...x, checks: cloneChecks(checks) } : x))
  }
  return { ...s, subareas, subareaSession: { ...ses, items } }
}

function addCheckUnder(
  checks: HouseSubareaCheck[],
  parentId: string,
  child: HouseSubareaCheck,
): { checks: HouseSubareaCheck[]; found: boolean } {
  let found = false
  const next = checks.map((c) => {
    if (c.id === parentId) {
      found = true
      const kids = [...(c.checks || []), child]
      return { ...c, checks: kids, done: kids.every(subareaCheckDone) }
    }
    if (c.checks?.length) {
      const nested = addCheckUnder(c.checks, parentId, child)
      if (nested.found) {
        found = true
        return { ...c, checks: nested.checks, done: nested.checks.every(subareaCheckDone) }
      }
    }
    return c
  })
  return { checks: next, found }
}

function mapCheckTree(
  checks: HouseSubareaCheck[],
  id: string,
  fn: (c: HouseSubareaCheck) => HouseSubareaCheck,
): HouseSubareaCheck[] {
  return checks.map((c) => {
    if (c.id === id) return fn(c)
    if (!c.checks?.length) return c
    const kids = mapCheckTree(c.checks, id, fn)
    return { ...c, checks: kids, done: kids.every(subareaCheckDone) }
  })
}

function setChecksDone(checks: HouseSubareaCheck[], done: boolean): HouseSubareaCheck[] {
  return checks.map((c) => ({
    ...c,
    done,
    checks: c.checks?.length ? setChecksDone(c.checks, done) : undefined,
  }))
}

function removeCheck(checks: HouseSubareaCheck[], id: string): HouseSubareaCheck[] {
  return checks
    .filter((c) => c.id !== id)
    .map((c) => {
      if (!c.checks?.length) return c
      const kids = removeCheck(c.checks, id)
      if (!kids.length) return { id: c.id, title: c.title, done: c.done }
      return { ...c, checks: kids, done: kids.every(subareaCheckDone) }
    })
}

export function addSubareaCheck(s: HouseCleaningState, title: string, parentId?: string): HouseCleaningState {
  const trimmed = String(title || "").trim()
  if (!trimmed) return s
  const row: HouseSubareaCheck = { id: tidyUid(), title: trimmed, done: false }
  return mapCurrentSessionChecks(s, (checks) => {
    if (!parentId) return [...checks, row]
    const nested = addCheckUnder(checks, parentId, row)
    return nested.found ? nested.checks : checks
  })
}

export function toggleSubareaCheck(s: HouseCleaningState, checkId: string): HouseCleaningState {
  return mapCurrentSessionChecks(s, (checks) =>
    mapCheckTree(checks, checkId, (c) => {
      const kids = c.checks || []
      if (kids.length) {
        const nextDone = !kids.every(subareaCheckDone)
        return { ...c, done: nextDone, checks: setChecksDone(kids, nextDone) }
      }
      return { ...c, done: !c.done }
    }),
  )
}

export function deleteSubareaCheck(s: HouseCleaningState, checkId: string): HouseCleaningState {
  return mapCurrentSessionChecks(s, (checks) => removeCheck(checks, checkId))
}

export function subareaComplete(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.subareaSession
  if (!ses || ses.phase !== "task") return s
  if (!subareaCanAdvance(s)) return s
  const item = ses.items[ses.index]
  if (!item) return s
  const progress = subareaProgress(s)
  const effective = subareaEffectiveThreshold(s)
  const extra = Math.max(0, progress.percent - effective)
  const bank = clampSubareaPercent((ses.bank || 0) + extra)
  let subareas = s.subareas
  if (item.kind === "perfect" && item.subareaId) {
    subareas = subareas.map((x) =>
      x.id === item.subareaId ? { ...x, done: true, completedAt: now } : x,
    )
  }
  if (ses.index + 1 >= ses.items.length) {
    return creditSidequestSession({ ...s, subareas, subareaSession: { ...ses, bank, phase: "done" } })
  }
  return {
    ...s,
    subareas,
    subareaSession: { ...ses, bank, index: ses.index + 1 },
  }
}

export function endSubareaSession(s: HouseCleaningState): HouseCleaningState {
  return { ...s, subareaSession: null }
}

/* ---- sidequests ---- */

export function sidequestsOf(s: HouseCleaningState, areaId: string): HouseSidequest[] {
  return (s.sidequests || [])
    .filter((q) => q.areaId === areaId)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function openSidequests(s: HouseCleaningState): HouseSidequest[] {
  return (s.sidequests || []).filter((q) => !q.done)
}

export function addSidequest(s: HouseCleaningState, areaId: string, title: string): HouseCleaningState {
  const trimmed = String(title || "").trim()
  if (!trimmed) return s
  const q: HouseSidequest = {
    id: tidyUid(),
    areaId,
    title: trimmed,
    done: false,
    completedAt: null,
    createdAt: Date.now(),
  }
  return { ...s, sidequests: [...(s.sidequests || []), q] }
}

export function deleteSidequest(s: HouseCleaningState, id: string): HouseCleaningState {
  const next = { ...s, sidequests: (s.sidequests || []).filter((q) => q.id !== id) }
  if (next.sidequestSession?.sidequestId === id) {
    return { ...next, sidequestSession: null }
  }
  return next
}

export function pickSidequestMinutes(random = Math.random): number {
  return (
    SIDEQUEST_MIN_MINUTES +
    Math.round(Math.pow(random(), 0.72) * (SIDEQUEST_MAX_MINUTES - SIDEQUEST_MIN_MINUTES))
  )
}

export function pickRandomSidequest(s: HouseCleaningState, random = Math.random): HouseSidequest | null {
  const open = openSidequests(s)
  if (!open.length) return null
  return open[Math.floor(random() * open.length)]
}

export function sidequestLive(s: HouseCleaningState, now = Date.now()): number {
  const ses = s.sidequestSession
  if (!ses || !ses.clock) return ses?.durationSec ?? 0
  const extra = ses.clock.running && ses.clock.startedAt ? (now - ses.clock.startedAt) / 1000 : 0
  return Math.max(0, ses.clock.baseSec - extra)
}

export function beginSidequestPick(
  s: HouseCleaningState,
  random = Math.random,
): HouseCleaningState | { error: string } {
  if (isSidequestRunning(s)) {
    return { error: "Finish the sidequest first." }
  }
  if (!(s.sidequestEarn || blankSidequestEarn()).unlocked) {
    return { error: "Keep cleaning to unlock a sidequest." }
  }
  if (s.sidequestSession?.phase === "pick") return s
  const q = pickRandomSidequest(s, random)
  if (!q) {
    return { error: "Add a few sidequests first — extras you notice while cleaning." }
  }
  return {
    ...s,
    sidequestSession: {
      sidequestId: q.id,
      title: q.title,
      areaId: q.areaId,
      durationSec: 0,
      phase: "pick",
      clock: null,
      timedOut: false,
    },
  }
}

export function shuffleSidequestPick(s: HouseCleaningState, random = Math.random): HouseCleaningState {
  const ses = s.sidequestSession
  if (!ses || ses.phase !== "pick") return s
  const open = openSidequests(s)
  if (!open.length) return s
  const others = open.filter((q) => q.id !== ses.sidequestId)
  const pool = others.length ? others : open
  const q = pool[Math.floor(random() * pool.length)]
  return {
    ...s,
    sidequestSession: { ...ses, sidequestId: q.id, title: q.title, areaId: q.areaId },
  }
}

export function selectSidequest(s: HouseCleaningState, id: string): HouseCleaningState {
  const ses = s.sidequestSession
  if (!ses || ses.phase !== "pick") return s
  const q = (s.sidequests || []).find((x) => x.id === id && !x.done)
  if (!q) return s
  return {
    ...s,
    sidequestSession: { ...ses, sidequestId: q.id, title: q.title, areaId: q.areaId },
  }
}

export function startSidequest(
  s: HouseCleaningState,
  now = Date.now(),
  random = Math.random,
): HouseCleaningState | { error: string } {
  const ses = s.sidequestSession
  if (!ses || ses.phase !== "pick") {
    return { error: "Pick a sidequest first." }
  }
  if (!(s.sidequestEarn || blankSidequestEarn()).unlocked) {
    return { error: "Keep cleaning to unlock a sidequest." }
  }
  const durationSec = pickSidequestMinutes(random) * 60
  return {
    ...s,
    sidequestEarn: blankSidequestEarn(),
    sidequestSession: {
      ...ses,
      durationSec,
      phase: "run",
      clock: { running: true, startedAt: now, baseSec: durationSec },
      timedOut: false,
    },
  }
}

export function completeSidequest(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const ses = s.sidequestSession
  if (!ses || ses.phase !== "run") return s
  return {
    ...s,
    sidequests: (s.sidequests || []).map((q) =>
      q.id === ses.sidequestId ? { ...q, done: true, completedAt: now } : q,
    ),
    sidequestSession: null,
  }
}

export function dismissSidequest(s: HouseCleaningState): HouseCleaningState {
  return { ...s, sidequestSession: null }
}

export function expireSidequest(s: HouseCleaningState): HouseCleaningState {
  const ses = s.sidequestSession
  if (!ses || ses.phase !== "run") return s
  return { ...s, sidequestSession: null }
}

export function stuckRange(a: number, b: number, fallbackLo: number, fallbackHi: number): [number, number] {
  let lo = Math.max(1, Number(a) || fallbackLo)
  let hi = Math.max(1, Number(b) || fallbackHi)
  if (lo > hi) {
    const t = lo
    lo = hi
    hi = t
  }
  return [lo, hi]
}

/* ---- plans ---- */

export function emptyPlan(now = Date.now()): HousePlan {
  return {
    durationHr: 1,
    durationMin: 30,
    durationSec: 90 * 60,
    tiers: { min: [], good: [], extra: [] },
    phase: "draft",
    clock: null,
    createdAt: now,
  }
}

export function planTasks(s: HouseCleaningState, tier: PlanTier): HouseTask[] {
  if (!s.plan) return []
  return (s.plan.tiers[tier] || []).map((id) => byId(s, id)).filter((t): t is HouseTask => !!t)
}

export function planEst(s: HouseCleaningState, tier: PlanTier): number {
  return planTasks(s, tier).reduce((n, t) => n + estOf(s, t), 0)
}

export function planSec(p: HousePlan): number {
  return Math.max(60, (p.durationHr | 0) * 3600 + (p.durationMin | 0) * 60)
}

export function planLive(s: HouseCleaningState, now = Date.now()): number {
  const p = s.plan
  if (!p || !p.clock) return p ? planSec(p) : 0
  const extra = p.clock.running && p.clock.startedAt ? (now - p.clock.startedAt) / 1000 : 0
  return Math.max(0, p.clock.baseSec - extra)
}

export function planRemoveId(s: HouseCleaningState, id: string): HouseCleaningState {
  if (!s.plan) return s
  const tiers = { ...s.plan.tiers }
  PLAN_TIERS.forEach(({ k }) => {
    tiers[k] = tiers[k].filter((x) => x !== id)
  })
  return { ...s, plan: { ...s.plan, tiers } }
}

export function planAdd(s: HouseCleaningState, tier: PlanTier, id: string): HouseCleaningState {
  if (!s.plan || !s.plan.tiers[tier] || !byId(s, id)) return s
  if (planAncestorIn(s, id)) return s
  let next = s
  planDescendantIds(s, id).forEach((did) => {
    next = planRemoveId(next, did)
  })
  next = planRemoveId(next, id)
  const tiers = { ...next.plan!.tiers, [tier]: [...next.plan!.tiers[tier], id] }
  return { ...next, plan: { ...next.plan!, tiers } }
}

export function startPlan(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const plan = s.plan || emptyPlan(now)
  const sec = planSec(plan)
  return {
    ...s,
    stuckSession: null,
    subareaSession: null,
    plan: {
      ...plan,
      durationSec: sec,
      phase: "run",
      clock: { running: true, startedAt: now, baseSec: sec },
    },
  }
}

export function planPause(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const p = s.plan
  if (!p || !p.clock || !p.clock.running) return s
  return { ...s, plan: { ...p, clock: { running: false, startedAt: null, baseSec: planLive(s, now) } } }
}

export function planResume(s: HouseCleaningState, now = Date.now()): HouseCleaningState {
  const p = s.plan
  if (!p || p.phase !== "run" || !p.clock || p.clock.running) return s
  return { ...s, plan: { ...p, clock: { ...p.clock, running: true, startedAt: now } } }
}

export function completePlan(s: HouseCleaningState): HouseCleaningState {
  if (!s.plan || s.plan.phase !== "run") return s
  const next = commitTimer(s)
  return {
    ...next,
    plan: { ...next.plan!, phase: "done", clock: { running: false, startedAt: null, baseSec: 0 } },
  }
}

export function endPlan(s: HouseCleaningState): HouseCleaningState {
  return { ...s, plan: null }
}

export function cycleTheme(theme: TidyTheme | undefined): TidyTheme {
  const order: TidyTheme[] = ["system", "light", "dark"]
  const cur = theme || "system"
  return order[(order.indexOf(cur) + 1) % order.length]
}
