/**
 * lib/module-output.ts — The one shape a module reports to the rest of Brain2
 *
 * A module (Speed Read today; a timer, a flashcard deck, a workout log later) does not know
 * which habit wants its numbers. It says what happened, in this shape, and the house routes it:
 *
 *   module  ──emit──▶  ModuleOutput  ──match──▶  habit feeds (`lib/habit-feeds.ts`)
 *                                     ──write──▶  ledger Item + habit cell (`lib/habit-contributions.ts`)
 *
 * The shape is data, so matching is a lookup and needs no model. A model is only for reshaping
 * something that is *not* in this shape yet (a module whose output is free text). It would produce
 * a `RawModuleOutput`, and `normalizeModuleOutput` below would accept or refuse it like any other.
 * That reshape step is **Planned**; nothing here calls one.
 *
 * Measures are the shared vocabulary. A habit says what it counts with its `unit` ("pages"),
 * a module says what it measured with `measure` ("pages"), and `measureFromUnit` is the bridge.
 * Pure. No stores.
 */

/** What a quantity is a quantity of. Add a row here and every habit and module can speak it. */
export interface MeasureDef {
  id: string
  /** Display unit in the singular and plural. */
  unit: [one: string, many: string]
  /** Words a habit's `unit` may use for this measure (lowercase). */
  aliases: string[]
  /** Whole numbers only (a page is not half read). */
  whole: boolean
  /** The verb an action item uses: "read" 3 pages of a book. */
  verb: string
  /** The item type a quantity of this measure is usually about. */
  subjectType?: string
}

export const MEASURES: MeasureDef[] = [
  { id: "pages", unit: ["page", "pages"], aliases: ["page", "pages", "pg", "pgs"], whole: true, verb: "read", subjectType: "book" },
  { id: "minutes", unit: ["minute", "minutes"], aliases: ["minute", "minutes", "min", "mins"], whole: false, verb: "spent" },
  { id: "count", unit: ["time", "times"], aliases: ["time", "times", "count", "reps", "rep"], whole: true, verb: "did" },
]

const BY_ID = new Map(MEASURES.map((m) => [m.id, m]))

export function measureDef(id: string | undefined | null): MeasureDef | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** The measure a habit's unit text means ("pages " → "pages"). Undefined for a unit we do not know. */
export function measureFromUnit(unit: string | undefined | null): string | undefined {
  const word = (unit ?? "").trim().toLowerCase()
  if (!word) return undefined
  return MEASURES.find((m) => m.aliases.includes(word))?.id
}

export interface ModuleOutputSubject {
  /** Item type id of the thing it was about, e.g. "book". */
  type: string
  /** What the person calls it. Used to find or create the item. */
  title: string
  /** A stable key from the module (a Speed Read library id), so a rename does not split the book. */
  key?: string
  /** The Brain2 item, once known. */
  itemId?: string
}

export interface ModuleOutput {
  /** Idempotency key. The same id applied twice counts once. */
  id: string
  /** Module id: "speed-read". The habit-detail entry form is "habit-entry". */
  moduleId: string
  /** A `MEASURES` id. */
  measure: string
  /** Positive amount in that measure. */
  amount: number
  /** ISO time the thing happened (not when it was filed). */
  at: string
  /** How long it took, when the module knows. */
  durationMs?: number
  subject?: ModuleOutputSubject
}

/** What a module hands over before it is checked. Same fields, nothing trusted. */
export type RawModuleOutput = Partial<Record<keyof ModuleOutput, unknown>>

export type NormalizeResult = { ok: true; output: ModuleOutput } | { ok: false; errors: string[] }

/**
 * Check a module's report and put it in canonical form. Refuses rather than guesses: an unknown
 * measure, a non-positive amount, a bad time. A caller that gets `ok: false` keeps the raw report
 * and shows the errors; it does not write.
 */
export function normalizeModuleOutput(raw: RawModuleOutput): NormalizeResult {
  const errors: string[] = []
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : ""
  if (!id) errors.push("id is missing")
  const moduleId = typeof raw.moduleId === "string" ? raw.moduleId.trim() : ""
  if (!moduleId) errors.push("moduleId is missing")
  const measureRaw = typeof raw.measure === "string" ? raw.measure.trim().toLowerCase() : ""
  const measure = measureDef(measureRaw)?.id ?? measureFromUnit(measureRaw)
  if (!measure) errors.push(`measure "${measureRaw}" is not one this house counts`)
  const def = measureDef(measure)
  let amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount)
  if (!Number.isFinite(amount) || amount <= 0) errors.push("amount must be more than zero")
  else if (def?.whole) amount = Math.round(amount)
  else amount = Math.round(amount * 100) / 100
  if (def?.whole && amount === 0) errors.push("amount rounds to zero")
  const atMs = typeof raw.at === "string" ? Date.parse(raw.at) : NaN
  if (!Number.isFinite(atMs)) errors.push("at is not a time")
  let subject: ModuleOutputSubject | undefined
  if (raw.subject !== undefined && raw.subject !== null) {
    const s = raw.subject as Partial<ModuleOutputSubject>
    const title = typeof s.title === "string" ? s.title.trim() : ""
    const type = typeof s.type === "string" ? s.type.trim() : ""
    if (!title || !type) errors.push("subject needs a type and a title")
    else
      subject = {
        type,
        title,
        ...(typeof s.key === "string" && s.key ? { key: s.key } : {}),
        ...(typeof s.itemId === "string" && s.itemId ? { itemId: s.itemId } : {}),
      }
  }
  if (errors.length || !measure) return { ok: false, errors }
  const durationMs = typeof raw.durationMs === "number" && raw.durationMs > 0 ? Math.round(raw.durationMs) : undefined
  return {
    ok: true,
    output: { id, moduleId, measure, amount, at: new Date(atMs).toISOString(), ...(durationMs ? { durationMs } : {}), ...(subject ? { subject } : {}) },
  }
}

/** "3 pages", "1 page", "2.5 minutes". */
export function describeAmount(measure: string, amount: number): string {
  const def = measureDef(measure)
  const unit = def ? (amount === 1 ? def.unit[0] : def.unit[1]) : measure
  return `${amount} ${unit}`
}

/** Local `YYYY-MM-DD` of an ISO time. A reading at 00:30 belongs to that local day. */
export function localDayKey(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

/** "Dune_-_Frank_Herbert (1).pdf" → "Dune - Frank Herbert". */
export function cleanBookTitle(fileName: string): string {
  return fileName
    .replace(/\.(pdf|epub|mobi|azw3?|txt)$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * One stretch of active use: when it started and ended, what it was about, and how much was done in it.
 * Speed Read reports one each time reading stops. Tracking pens fed by the module (`TrackPen.moduleFeed`)
 * turn it into a time block with a note (`lib/module-session-apply.ts`).
 */
export interface ModuleSession {
  /** Idempotency key. The same id painted twice is one block. */
  id: string
  moduleId: string
  startAt: string
  endAt: string
  subject?: ModuleOutputSubject
  /** What was done in it, e.g. 7 pages. */
  quantities: { measure: string; amount: number }[]
}

export type RawModuleSession = Partial<Record<keyof ModuleSession, unknown>>

export function normalizeModuleSession(raw: RawModuleSession): { ok: true; session: ModuleSession } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  const moduleId = typeof raw.moduleId === "string" ? raw.moduleId.trim() : ""
  if (!id) errors.push("id is missing")
  if (!moduleId) errors.push("moduleId is missing")
  const a = typeof raw.startAt === "string" ? Date.parse(raw.startAt) : NaN
  const b = typeof raw.endAt === "string" ? Date.parse(raw.endAt) : NaN
  if (!Number.isFinite(a) || !Number.isFinite(b)) errors.push("startAt and endAt must be times")
  else if (b <= a) errors.push("the session ends before it starts")
  let subject: ModuleOutputSubject | undefined
  const s = raw.subject as Partial<ModuleOutputSubject> | undefined
  if (s) {
    if (typeof s.type === "string" && typeof s.title === "string" && s.type.trim() && s.title.trim())
      subject = { type: s.type.trim(), title: s.title.trim(), ...(s.key ? { key: s.key } : {}), ...(s.itemId ? { itemId: s.itemId } : {}) }
    else errors.push("subject needs a type and a title")
  }
  const quantities = (Array.isArray(raw.quantities) ? raw.quantities : [])
    .map((q) => q as { measure?: unknown; amount?: unknown })
    .filter((q) => typeof q.measure === "string" && measureDef(q.measure) && typeof q.amount === "number" && q.amount > 0)
    .map((q) => ({ measure: q.measure as string, amount: q.amount as number }))
  if (errors.length) return { ok: false, errors }
  return { ok: true, session: { id, moduleId, startAt: new Date(a).toISOString(), endAt: new Date(b).toISOString(), ...(subject ? { subject } : {}), quantities } }
}
