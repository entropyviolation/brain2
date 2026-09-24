/**
 * lib/ingest/text-triggers.ts — Whole-message habit + discrete-event patterns
 *
 * Matched only when the *entire* message is the command (keyword, optional
 * quantity/score, optional trailing note) — never as a substring of freeform
 * inbox prose. First match wins; caller skips capture.
 */
import type { HabitTextTrigger, WeeklyTask } from "@/lib/types"

export type HabitTriggerMode = "done" | "quantity" | "score"

export interface HabitTriggerMatch {
  habitId: string
  habitName: string
  trigger: HabitTextTrigger
  value?: number
  note: string
}

export interface DiscreteTriggerDef {
  id: string
  /** Pattern with optional `{slot}` placeholders, e.g. `ate {food}`. */
  pattern: string
}

export interface DiscreteTriggerMatch {
  trigger: DiscreteTriggerDef
  /** Human title for the event (message with slots filled). */
  title: string
  slots: Record<string, string>
}

/** Built-in presets that ship editable on matching habits / in Settings. */
export const DEFAULT_HABIT_TRIGGER_PRESETS: Array<{
  keyword: string
  mode: HabitTriggerMode
  unitWords?: string[]
  connector?: string
  /** Habit name substrings (case-insensitive) that receive this preset. */
  habitNameHints: string[]
}> = [
  { keyword: "hemisync", mode: "done", habitNameHints: ["hemisync"] },
  {
    keyword: "read",
    mode: "quantity",
    unitWords: ["pages", "page"],
    habitNameHints: ["read", "reading"],
  },
  {
    keyword: "exercise",
    mode: "quantity",
    unitWords: ["min", "mins", "minutes", "minute"],
    habitNameHints: ["exercise"],
  },
  {
    keyword: "chess",
    mode: "score",
    connector: "score",
    habitNameHints: ["chess"],
  },
]

export const DEFAULT_DISCRETE_EVENT_TRIGGERS: DiscreteTriggerDef[] = [
  { id: "de-smoked-weed", pattern: "smoked weed" },
  { id: "de-drank-water", pattern: "drank water" },
  { id: "de-ate", pattern: "ate {item}" },
  { id: "de-took", pattern: "took {item}" },
]

export function makeHabitTriggerId(): string {
  return `ht-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Seed editable triggers onto a habit when it matches a preset and has none. */
export function defaultTriggersForHabit(habit: Pick<WeeklyTask, "name" | "textTriggers">): HabitTextTrigger[] {
  if (habit.textTriggers && habit.textTriggers.length > 0) return habit.textTriggers
  const name = habit.name.trim().toLowerCase()
  const out: HabitTextTrigger[] = []
  for (const preset of DEFAULT_HABIT_TRIGGER_PRESETS) {
    if (!preset.habitNameHints.some((hint) => name.includes(hint.toLowerCase()))) continue
    out.push({
      id: makeHabitTriggerId(),
      keyword: preset.keyword,
      mode: preset.mode,
      unitWords: preset.unitWords,
      connector: preset.connector,
    })
  }
  return out
}

export function triggersForHabit(habit: WeeklyTask): HabitTextTrigger[] {
  return defaultTriggersForHabit(habit)
}

/**
 * Try to match the whole message against habit triggers. Longer keywords win.
 * Does not fire when the keyword is merely contained in a longer freeform line.
 */
export function matchHabitTextTrigger(
  raw: string,
  habits: WeeklyTask[],
): HabitTriggerMatch | null {
  const text = raw.trim()
  if (!text) return null
  const lower = text.toLowerCase()

  const candidates: Array<{ habit: WeeklyTask; trigger: HabitTextTrigger }> = []
  for (const habit of habits) {
    for (const trigger of triggersForHabit(habit)) {
      if (!trigger.keyword.trim()) continue
      candidates.push({ habit, trigger })
    }
  }
  candidates.sort((a, b) => b.trigger.keyword.length - a.trigger.keyword.length)

  for (const { habit, trigger } of candidates) {
    const hit = matchOneHabitTrigger(lower, text, trigger)
    if (!hit) continue
    return {
      habitId: habit.id,
      habitName: habit.name,
      trigger,
      value: hit.value,
      note: hit.note,
    }
  }
  return null
}

function matchOneHabitTrigger(
  lower: string,
  original: string,
  trigger: HabitTextTrigger,
): { value?: number; note: string } | null {
  const kw = trigger.keyword.trim().toLowerCase()
  if (!kw) return null
  if (!lower.startsWith(kw)) return null
  const afterKw = lower.slice(kw.length)
  if (afterKw.length === 0) {
    return trigger.mode === "done" ? { note: "" } : null
  }
  if (!/^\s/.test(afterKw)) return null // "hemisyncish" must not match

  let rest = afterKw.trim()
  let originalRest = original.slice(kw.length).trim()

  if (trigger.mode === "done") {
    // Bare keyword only — trailing words mean this is not the command.
    // Exception: allow a note after the keyword for done habits.
    return { note: originalRest }
  }

  if (trigger.mode === "score") {
    const connector = (trigger.connector || "score").toLowerCase()
    if (!rest.startsWith(connector)) return null
    const afterConn = rest.slice(connector.length)
    if (afterConn.length > 0 && !/^\s/.test(afterConn)) return null
    rest = afterConn.trim()
    originalRest = originalRest.slice(connector.length).trim()
    // fall through to quantity parse
  }

  const num = rest.match(/^(-?\d+(?:\.\d+)?)\b/)
  if (!num) return null
  const value = Number(num[1])
  rest = rest.slice(num[0].length).trim()
  originalRest = originalRest.slice(num[0].length).trim()

  const units = (trigger.unitWords ?? []).map((u) => u.toLowerCase()).sort((a, b) => b.length - a.length)
  for (const unit of units) {
    if (rest === unit || rest.startsWith(unit + " ") || rest.startsWith(unit + "\t")) {
      rest = rest.slice(unit.length).trim()
      // Keep original casing for the note by slicing the same length from originalRest
      const origLower = originalRest.toLowerCase()
      if (origLower.startsWith(unit)) {
        originalRest = originalRest.slice(unit.length).trim()
      }
      break
    }
  }

  return { value, note: originalRest }
}

/** Whole-message match against discrete-event trigger patterns. */
export function matchDiscreteEventTrigger(
  raw: string,
  triggers: DiscreteTriggerDef[],
): DiscreteTriggerMatch | null {
  const text = raw.trim()
  if (!text) return null
  const ranked = [...triggers].sort((a, b) => b.pattern.length - a.pattern.length)
  for (const trigger of ranked) {
    const hit = matchDiscretePattern(text, trigger.pattern)
    if (hit) return { trigger, title: text, slots: hit }
  }
  return null
}

/**
 * Patterns are literal, case-insensitive, with `{name}` slots that capture one
 * or more words. The whole message must match.
 */
export function matchDiscretePattern(text: string, pattern: string): Record<string, string> | null {
  const trimmedPattern = pattern.trim()
  if (!trimmedPattern) return null
  const slotNames: string[] = []
  let reSrc = ""
  let i = 0
  while (i < trimmedPattern.length) {
    const ch = trimmedPattern[i]
    if (ch === "{") {
      const close = trimmedPattern.indexOf("}", i + 1)
      if (close === -1) return null
      const name = trimmedPattern.slice(i + 1, close).trim()
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) return null
      slotNames.push(name)
      reSrc += "(.+)"
      i = close + 1
      continue
    }
    if (/[.*+?^${}()|[\]\\]/.test(ch)) reSrc += `\\${ch}`
    else reSrc += ch
    i += 1
  }
  const re = new RegExp(`^${reSrc}$`, "i")
  const m = re.exec(text.trim())
  if (!m) return null
  const slots: Record<string, string> = {}
  slotNames.forEach((name, idx) => {
    slots[name] = (m[idx + 1] ?? "").trim()
  })
  return slots
}

export function fromTextMessageNote(now: Date, detail?: string): string {
  const time = formatMessageClock(now)
  const stamp = `from text message at ${time}`
  const detailTrim = (detail ?? "").trim()
  return detailTrim ? `${detailTrim}\n${stamp}` : stamp
}

export function formatMessageClock(now: Date): string {
  const h = now.getHours()
  const m = now.getMinutes()
  const h12 = h % 12 || 12
  const ampm = h < 12 ? "am" : "pm"
  const mins = m === 0 ? "" : `:${String(m).padStart(2, "0")}`
  return `${h12}${mins}${ampm}`
}
