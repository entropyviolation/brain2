/**
 * lib/wire-bimby/plan.ts — Read a wiring request into steps (rules, no model)
 *
 * Reads sentences such as:
 *   "make it so the daily habits detail view includes pages read and attaches a Book type item
 *    that the user can tell exactly how many pages of what book they read"
 *   "connect the speed reader module to the daily reading habit ..."
 * and builds `WireStep`s: a feed (module → habit), a breakdown panel, an entry panel. The words
 * it listens for are the vocabulary the data already has: module aliases (`module-output-registry`),
 * measure aliases (`module-output`), item type names, and habit names. Whatever it cannot place
 * it leaves blank, and the check on that step says so instead of guessing.
 *
 * A model is **Planned** for exactly one job here: reshaping a sentence these rules do not read
 * into the same `WireStep` data. It would not decide anything the checks do not also verify.
 * Pure.
 */
import { MEASURES, measureDef } from "@/lib/module-output"
import { habitMeasure } from "@/lib/habit-feeds"
import { moduleNamedIn } from "@/lib/module-output-registry"
import type { WeeklyTask } from "@/lib/types"
import type { WireField, WirePlan, WireStep } from "./types"

export interface WireDeps {
  habits: WeeklyTask[]
  /** Activity pens, for the Tracking steps. Absent means none are known. */
  pens?: { id: string; name: string; parentIds: string[]; feedModule?: string }[]
  types: { id: string; name: string; pluralName?: string }[]
}

const GENERIC_TYPES = new Set(["task", "item", "action", "note", "list", "event"])
const STOP = new Set(["the", "a", "an", "to", "of", "my", "daily", "habit", "habits", "per", "day", "at", "least", "make", "it", "so", "view", "detail", "that", "and"])

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/i, "")
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)

export function looksLikeWire(text: string): boolean {
  const lower = text.toLowerCase()
  if (words(text).length < 6) return false
  if (wantsTrack(text)) return true
  const cue = /\b(connect|hook|wire|link|attach(?:es)?|make it so|detail view|break ?down|double[- ]click)\b/.test(lower)
  const subject = /\bhabits?\b/.test(lower) || !!moduleNamedIn(text)
  const measure = MEASURES.some((m) => m.aliases.some((a) => new RegExp(`\\b${a}\\b`).test(lower)))
  return cue && subject && (measure || !!moduleNamedIn(text))
}

/** "whenever I am actively speed reading, track that time with a pen called speedreading ..." */
export function wantsTrack(text: string): boolean {
  const lower = text.toLowerCase()
  return !!moduleNamedIn(text) && /\b(track(?:ed|ing)?|time ?block|pen)\b/.test(lower) && /\b(whenever|every time|each time|while|when|actively|sessions?)\b/.test(lower) && /\bpen\b/.test(lower)
}

/** Pen names said as `pen called X` / `pen named "X"`, in order. */
export function penNamesIn(text: string): string[] {
  const hits: { at: number; name: string }[] = []
  for (const m of text.matchAll(/pen\s+(?:called|named)\s+["“'‘]([^"”'’]+)["”'’]/gi)) hits.push({ at: m.index ?? 0, name: m[1]!.trim() })
  for (const m of text.matchAll(/pen\s+(?:called|named)\s+([A-Za-z][\w-]*)/gi)) if (!hits.some((h) => Math.abs(h.at - (m.index ?? 0)) < 2)) hits.push({ at: m.index ?? 0, name: m[1]!.trim() })
  return hits.sort((a, b) => a.at - b.at).map((h) => h.name)
}

function measureIn(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const m of MEASURES) if (m.aliases.some((a) => new RegExp(`\\b${a}\\b`).test(lower))) return m.id
  return undefined
}

function typeIn(text: string, deps: WireDeps): string | undefined {
  const lower = text.toLowerCase()
  for (const t of deps.types) {
    if (GENERIC_TYPES.has(t.id)) continue
    const names = [t.name, t.pluralName, t.id].filter((n): n is string => !!n).map((n) => n.toLowerCase())
    if (names.some((n) => new RegExp(`\\b${n}\\b`).test(lower))) return t.id
  }
  return undefined
}

/** The daily habits a sentence could mean, best first, with the measure they count. */
export function rankHabits(text: string, deps: WireDeps, measure: string | undefined): WeeklyTask[] {
  const said = new Set(words(text).map(stem).filter((w) => w.length > 2 && !STOP.has(w)))
  const daily = deps.habits.filter((h) => (h.frequency ?? "daily") === "daily" && !(h.pauses?.length && !h.pauses[h.pauses.length - 1]!.to))
  const scored = daily.map((h) => {
    const own = habitMeasure(h)
    const hits = words(h.name).map(stem).filter((w) => w.length > 2 && !STOP.has(w) && said.has(w)).length
    const fits = measure && own === measure ? 1 : 0
    return { h, score: hits * 3 + fits, ok: !measure || !own || own === measure }
  })
  return scored.filter((s) => s.ok).sort((a, b) => b.score - a.score).map((s) => s.h)
}

const habitOptions = (deps: WireDeps): [string, string][] =>
  deps.habits.filter((h) => (h.frequency ?? "daily") === "daily").map((h) => [h.id, h.name])

function fields(deps: WireDeps, v: { habit: string; module?: string; measure: string; subjectType?: string }): WireField[] {
  const out: WireField[] = [{ key: "habit", label: "Habit", value: v.habit, options: [["", "— choose —"], ...habitOptions(deps)] }]
  if (v.module !== undefined)
    out.push({ key: "module", label: "Module", value: v.module, options: [["speed-read", "Speed Read"], ["habit-entry", "Habit entry form"]] })
  out.push({ key: "measure", label: "Counts", value: v.measure, options: MEASURES.map((m) => [m.id, m.unit[1]]) })
  out.push({
    key: "subjectType",
    label: "About",
    value: v.subjectType ?? "",
    options: [["", "nothing in particular"], ...deps.types.filter((t) => !GENERIC_TYPES.has(t.id)).map((t): [string, string] => [t.id, t.name])],
  })
  return out
}

export function signature(step: WireStep): string {
  const f = (k: WireField["key"]) => step.fields.find((x) => x.key === k)?.value ?? ""
  return [step.kind, f("habit"), f("module"), f("measure"), f("subjectType"), f("pen"), f("parentPen")].join("|")
}

export function planWire(text: string, deps: WireDeps, now: Date, id?: string): WirePlan {
  const trace: string[] = []
  const mod = moduleNamedIn(text)
  const measure = measureIn(text) ?? mod?.emits[0]?.measure
  const subjectType = typeIn(text, deps) ?? (mod?.emits.find((e) => e.measure === measure)?.subjectType ?? measureDef(measure)?.subjectType)
  if (mod) trace.push(`Module: ${mod.name}.`)
  if (measure) trace.push(`It counts ${measureDef(measure)?.unit[1] ?? measure}.`)
  if (subjectType) trace.push(`About ${deps.types.find((t) => t.id === subjectType)?.name ?? subjectType} items.`)
  const ranked = measure ? rankHabits(text, deps, measure) : []
  const best = ranked[0]
  const said = new Set(words(text).map(stem))
  const named = best ? words(best.name).map(stem).some((w) => w.length > 2 && !STOP.has(w) && said.has(w)) : false
  const habit = best && (named || ranked.length === 1) ? best : undefined
  const lower = text.toLowerCase()
  const trackOnly = wantsTrack(text)
  if (!trackOnly) trace.push(habit ? `Habit: “${habit.name}”.` : "I could not tell which habit. Pick it below.")
  const wantsBreakdown = /\b(includes?|shows?|see|break ?down|double[- ]click|detail view)\b/.test(lower)
  const wantsEntry = !!subjectType && /\b(attach(?:es)?|can tell|exactly how many|enter|type in|log (?:it|them|pages))\b/.test(lower)
  const steps: WireStep[] = []
  const base = { habit: habit?.id ?? "", measure: measure ?? "", subjectType }
  if (!trackOnly && mod && measure && mod.id !== "habit-entry") {
    steps.push({
      id: "s-feed",
      kind: "feed",
      title: `${mod.name} logs ${measureDef(measure)?.unit[1] ?? measure} into ${habit ? `“${habit.name}”` : "a habit"}`,
      reasoning: [
        `${mod.name} reports one ${mod.emits.find((e) => e.measure === measure)?.per ?? measure} at a time${mod.reportsTime ? ", with the clock time it happened" : ""}.`,
        subjectType
          ? `Each report is about a ${subjectType}: the door finds it by the module's key or a near-identical title, and creates it when none fits.`
          : "Each report carries no item, so it only changes the habit.",
        "It adds to the habit's cell for the day it happened and keeps a log row per day, so the cell can show its breakdown.",
      ],
      fields: fields(deps, { ...base, module: mod.id }),
      status: "pending",
    })
  }
  if (!trackOnly && wantsBreakdown && measure && (!mod || !steps.length || /detail view|break ?down|double[- ]click|includes?/.test(lower))) {
    steps.push({
      id: "s-breakdown",
      kind: "breakdown",
      title: `Detail view shows ${measureDef(measure)?.unit[1] ?? measure}${subjectType ? ` by ${subjectType}` : ""}`,
      reasoning: [
        "Double-clicking the habit's cell opens its detail view.",
        `A breakdown panel lists what made up the number${subjectType ? `, grouped by ${subjectType}` : ""}, with the time of each session, and names any part that was typed by hand.`,
      ],
      fields: fields(deps, base),
      status: "pending",
    })
  }
  if (!trackOnly && wantsEntry && measure) {
    steps.push({
      id: "s-entry",
      kind: "entry",
      title: `Detail view lets you log ${measureDef(measure)?.unit[1] ?? measure} against a ${subjectType}`,
      reasoning: [
        `An entry form in the detail view takes how many ${measureDef(measure)?.unit[1] ?? measure} and which ${subjectType}.`,
        "It reports through the same door as a module (as “Habit entry form”), so a typed entry and a read page are the same kind of row.",
      ],
      fields: fields(deps, base),
      status: "pending",
    })
  }
  if (mod?.sessions && wantsTrack(text)) {
    const [pen, parent] = penNamesIn(text)
    const penName = pen ?? ""
    trace.push(penName ? `Pen “${penName}”${parent ? `, counting as “${parent}”` : ""}.` : "I could not find the pen's name. Type it below.")
    steps.push({
      id: "s-track",
      kind: "track",
      title: `${mod.name} sessions are tracked on the pen “${penName || "…"}”${parent ? ` (counts as “${parent}”)` : ""}`,
      reasoning: [
        `Whenever you are actively using ${mod.name} (words flashing, from play to pause), that time is painted as a block on the pen.`,
        `Each block carries a note: what was done in it${subjectType ? ` and which ${subjectType}` : ""}, with the times. The ${subjectType ?? "item"} is found or created like a page report.`,
        parent ? `The pen counts as “${parent}”: nothing is relabelled, but anything that shows ${parent} rolls this time up.` : "The pen has no parent pen.",
        "A stretch under a minute is not painted. Time you painted by hand is not overwritten.",
      ],
      fields: [
        { key: "module", label: "Module", value: mod.id, options: [[mod.id, mod.name]] },
        { key: "pen", label: "Pen", value: penName, options: [], free: true },
        { key: "parentPen", label: "Counts as", value: parent ?? "", options: [], free: true },
      ],
      status: "pending",
    })
  }
  if (!steps.length) trace.push("I found nothing to wire in that.")
  return { id: id ?? `wire-${now.getTime().toString(36)}`, text, at: now.toISOString(), trace, steps, revisions: 0 }
}
