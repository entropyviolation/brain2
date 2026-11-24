/**
 * lib/day-log-bimby/gather.ts — Every source of one day, as one numbered ledger
 *
 * `gatherDay` turns `DaySources` into `Evidence` rows sorted by clock, untimed
 * rows last, numbered E1, E2, … The document and the model both read only this
 * ledger, so a number in the narrative ([E12]) always points at a real row.
 * Pure: no stores, no model.
 */

import type { DaySources, Evidence, EvidenceSource, SourceEntry, SourceScope } from "./types"

export const MINUTES_PER_DAY = 1440

export const clock = (m: number): string => {
  const mm = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(m)))
  return mm >= MINUTES_PER_DAY ? "24:00" : `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`
}

export function duration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Local `YYYY-MM-DD` of an ISO time. */
export function localDateOf(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Minute of the local day of an ISO time, or null when it falls on another date. */
export function minuteOn(iso: string, date: string): number | null {
  if (!iso || localDateOf(iso) !== date) return null
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const clean = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim()

/** Which ledger source a tracking row is. By view id first, then the view's name. */
export function sourceOf(scope: SourceScope | undefined, entry: SourceEntry): EvidenceSource {
  const id = entry.scopeId
  const name = scope?.name ?? ""
  if (entry.intakeClass === "food" || entry.intakeClass === "drink") return "food"
  if (entry.intakeClass === "drug") return "intake"
  if (id === "activity") return "activity"
  if (id === "location" || /^locations?$/i.test(name)) return "place"
  if (id === "company" || /^company$/i.test(name)) return "company"
  if (id === "mood" || /^mood$/i.test(name)) return "mood"
  if (id === "iphone-screentime") return "screen-phone"
  if (id === "screentime") return "screen-mac"
  if (id === "iphone-calls") return "call"
  if (id === "iphone-texts") return "text"
  if (/food|intake|meal/i.test(name)) return "food"
  if (/med|drug|supplement/i.test(name)) return "intake"
  return "tracking"
}

const MACHINE_SOURCES: ReadonlySet<EvidenceSource> = new Set(["screen-mac", "screen-phone", "call", "text", "health"])

function namesFor(scopes: SourceScope[]) {
  const pens = new Map<string, string>()
  const variants = new Map<string, string>()
  const scopeById = new Map<string, SourceScope>()
  for (const s of scopes) {
    scopeById.set(s.id, s)
    for (const p of s.pens) {
      pens.set(`${s.id}:${p.id}`, p.name)
      for (const v of p.variants ?? []) variants.set(v.id, v.name)
    }
  }
  return { pens, variants, scopeById }
}

function entryEvidence(e: SourceEntry, names: ReturnType<typeof namesFor>, plateKcal: Record<string, number>): Omit<Evidence, "n"> {
  const scope = names.scopeById.get(e.scopeId)
  const source = sourceOf(scope, e)
  const pen = names.pens.get(`${e.scopeId}:${e.penId}`) ?? e.penId
  const others = (e.secondaryPenIds ?? []).map((id) => names.pens.get(`${e.scopeId}:${id}`) ?? id)
  const variants = (e.variantIds ?? []).map((id) => names.variants.get(id) ?? "").filter(Boolean)
  const title = clean(e.title)
  const machine = !!e.generatedBy || MACHINE_SOURCES.has(source)
  const notes = clean(e.notes)
  const instant = e.kind === "instant" || e.endMin <= e.startMin
  let what = pen
  if (variants.length) what += ` (${variants.join(", ")})`
  if (others.length) what += ` + ${others.join(", ")}`
  if (source === "text") {
    const dir = title.startsWith("→") ? "out" : title.startsWith("←") ? "in" : undefined
    const body = title.replace(/^[→←]\s*/, "")
    const service = isShortCode(pen)
    return {
      source,
      startMin: e.startMin,
      what: `${dir === "out" ? "Texted" : dir === "in" ? "Text from" : "Text with"} ${pen}${service ? " (a service)" : ""}${body ? `: “${body}”` : ""}`,
      machine: true,
      ...(service ? {} : { person: pen }),
      ...(dir ? { dir } : {}),
    }
  }
  if (source === "call") {
    const kind = title.replace(/^[→←]\s*/, "") || "call"
    const dir = title.startsWith("→") ? "outgoing" : title.startsWith("←") ? "incoming" : ""
    return {
      source,
      startMin: e.startMin,
      ...(instant ? {} : { endMin: e.endMin }),
      what: `${dir ? `${dir} ` : ""}${kind} · ${pen}`.replace(/^./, (c) => c.toUpperCase()),
      machine: true,
      ...(isShortCode(pen) ? {} : { person: pen }),
    }
  }
  if (title && title.toLowerCase() !== pen.toLowerCase()) what += ` · ${title}`
  if (source === "company" && e.talkingPenIds?.length) {
    const talking = e.talkingPenIds.map((id) => names.pens.get(`${e.scopeId}:${id}`) ?? id)
    what += ` (talking with ${talking.join(", ")})`
  }
  const kcal = plateKcal[e.id]
  if (kcal) what += ` · ${Math.round(kcal)} kcal`
  if (machine && notes) what += ` · ${notes}`
  return {
    source,
    startMin: e.startMin,
    ...(instant ? {} : { endMin: e.endMin }),
    what,
    ...(!machine && notes ? { ownWords: notes } : {}),
    ...(e.precision === "estimated" || e.clockCertainty === "estimated" || e.clockCertainty === "unknown" ? { estimated: true } : {}),
    ...(machine ? { machine: true } : {}),
    ...(source === "company" ? { person: pen } : {}),
    ...(kcal ? { kcal } : {}),
  }
}

/** A sender that is a service short code (verification codes, alerts), not a person: "65161", "262966". */
export const isShortCode = (name: string): boolean => /^\d{3,6}$/.test(name.replace(/\s/g, ""))

const sameWords = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase()

/** The ledger for one day. */
export function gatherDay(src: DaySources): Evidence[] {
  const names = namesFor(src.scopes)
  const rows: Omit<Evidence, "n">[] = []
  const date = src.date

  for (const e of src.entries) {
    if (e.date !== date || e.secret) continue
    rows.push(entryEvidence(e, names, src.plateKcal ?? {}))
  }

  const woke = src.sleep?.woke
  if (woke?.allNighter) rows.push({ source: "sleep", startMin: null, what: "All-nighter: no sleep the night before" })
  if (woke?.sleptMin !== undefined && woke.sleptMin >= 0) rows.push({ source: "sleep", startMin: woke.sleptMin, what: "Fell asleep (the night's sleep began after midnight)" })
  if (woke?.wokeMin !== undefined) {
    const slept = woke.sleptMin !== undefined ? woke.wokeMin - woke.sleptMin : undefined
    rows.push({ source: "sleep", startMin: woke.wokeMin, what: `Woke up${slept && slept > 0 ? ` after ${duration(slept)} of sleep` : ""}`, ...(woke.note ? { ownWords: woke.note } : {}) })
  }
  const tonight = src.sleep?.tonight
  if (tonight?.sleptMin !== undefined && tonight.sleptMin < 0) {
    rows.push({ source: "sleep", startMin: MINUTES_PER_DAY + tonight.sleptMin, what: "Went to sleep", ...(tonight.note ? { ownWords: tonight.note } : {}) })
  }

  const h = src.health
  if (h && Object.values(h).some((v) => typeof v === "number" && v > 0)) {
    const bits = [
      h.steps ? `${h.steps.toLocaleString("en-US")} steps` : "",
      h.distanceM ? `${(h.distanceM / 1000).toFixed(1)} km walked or run` : "",
      h.flights ? `${h.flights} flights climbed` : "",
      h.activeKcal ? `${Math.round(h.activeKcal)} active kcal` : "",
      h.heartAvg ? `heart ${Math.round(h.heartAvg)} bpm average${h.heartMin ? `, ${Math.round(h.heartMin)} low` : ""}${h.heartMax ? `, ${Math.round(h.heartMax)} high` : ""}` : "",
    ].filter(Boolean)
    rows.push({ source: "health", startMin: null, what: bits.join(" · "), machine: true })
  }

  const said: { min: number | null; text: string }[] = []
  for (const line of src.bim) {
    if (line.who !== "you" || !clean(line.text)) continue
    const min = minuteOn(line.at, date)
    said.push({ min, text: line.text })
    rows.push({ source: "bim", startMin: min, what: "Told BIM", ownWords: clean(line.text) })
  }
  for (const t of src.telegram) {
    const min = minuteOn(t.at, date)
    if (!clean(t.text)) continue
    if (said.some((s) => sameWords(s.text, t.text) && (s.min === null || min === null || Math.abs(s.min - min) <= 3))) continue
    rows.push({ source: "telegram", startMin: min, what: "Texted BIM on Telegram", ownWords: clean(t.text) })
  }
  for (const l of src.logs) {
    if (said.some((s) => sameWords(s.text, l.text))) continue
    rows.push({ source: "log", startMin: minuteOn(l.at, date), what: "Logged", ownWords: clean(l.text) })
  }
  if (clean(src.dayNote)) rows.push({ source: "day-note", startMin: null, what: "Day note", ownWords: clean(src.dayNote) })

  for (const d of src.docs) {
    const excerpt = clean(d.text).slice(0, 400)
    rows.push({ source: "doc", startMin: minuteOn(d.at, date), what: `${d.created ? "Started" : "Worked on"} the doc “${d.title}”`, ...(excerpt ? { ownWords: excerpt + (clean(d.text).length > 400 ? "…" : "") } : {}) })
  }
  for (const d of src.done) rows.push({ source: "done", startMin: minuteOn(d.at, date), what: `Finished “${d.title}”` })
  for (const ev of src.events) {
    const m = ev.time && /^\d{1,2}:\d{2}$/.test(ev.time) ? Number(ev.time.split(":")[0]) * 60 + Number(ev.time.split(":")[1]) : null
    rows.push({ source: "event", startMin: ev.allDay ? null : m, what: `On the calendar: ${ev.title}${ev.allDay ? " (all day)" : ""}` })
  }
  for (const p of src.plans) {
    rows.push({ source: "plan", startMin: minuteOn(p.at, date), what: `Planned the day${p.items.length ? `: ${p.items.join("; ")}` : ""}`, ownWords: clean(p.text) })
  }
  if (src.photos) rows.push({ source: "photo", startMin: null, what: `${src.photos} photo${src.photos === 1 ? "" : "s"} filed on this day` })
  for (const a of src.amendments) {
    if (a.date !== date) continue
    rows.push({ source: "amendment", startMin: a.atMin ?? null, what: `My ${a.kind}`, ownWords: clean(a.text) })
  }

  rows.sort((a, b) => {
    if (a.startMin === null && b.startMin === null) return 0
    if (a.startMin === null) return 1
    if (b.startMin === null) return -1
    return a.startMin - b.startMin || (b.endMin ?? b.startMin) - (a.endMin ?? a.startMin)
  })
  return rows.map((r, i) => ({ ...r, n: i + 1 }))
}

/** Minutes of `[0, until)` with no Activity span, as runs of at least `minLen` minutes. */
export function untrackedRuns(evidence: readonly Evidence[], until = MINUTES_PER_DAY, minLen = 30): [number, number][] {
  const covered = new Uint8Array(MINUTES_PER_DAY)
  for (const e of evidence) {
    if (e.startMin === null || e.endMin === undefined) continue
    if (e.source !== "activity" && !(e.source === "sleep")) continue
    covered.fill(1, Math.max(0, e.startMin), Math.min(MINUTES_PER_DAY, e.endMin))
  }
  const runs: [number, number][] = []
  let from = -1
  for (let m = 0; m <= until; m++) {
    const open = m < until && !covered[m]
    if (open && from < 0) from = m
    if (!open && from >= 0) {
      if (m - from >= minLen) runs.push([from, m])
      from = -1
    }
  }
  return runs
}

/** Minutes covered by the given sources' spans, counted once. */
export function coveredMinutes(evidence: readonly Evidence[], sources: readonly EvidenceSource[]): number {
  const covered = new Uint8Array(MINUTES_PER_DAY)
  for (const e of evidence) {
    if (e.startMin === null || e.endMin === undefined || !sources.includes(e.source)) continue
    covered.fill(1, Math.max(0, e.startMin), Math.min(MINUTES_PER_DAY, e.endMin))
  }
  let n = 0
  for (const c of covered) n += c
  return n
}
