/**
 * components/Reviews/morning/draft.ts — Session draft for one morning.
 *
 * Key `brain2-morning-draft:{day}`. A finished store slice wins over the
 * draft. The text `gm` walk does not use this file.
 */
import { emptyTodoWalkForm, type TodoWalkFormFields } from "@/lib/morning-todo-walk"
import { offsetToClock } from "@/lib/sleep-log"
import type { MorningDraft, MorningSlice } from "./types"

export function draftStorageKey(dayKey: string) {
  return `brain2-morning-draft:${dayKey}`
}

export function asStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.map((x) => (typeof x === "string" ? x : String(x ?? "")))
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

export function safeClock(offset: number | undefined): string {
  if (offset === undefined || !Number.isFinite(offset)) return ""
  try {
    return offsetToClock(offset)
  } catch {
    return ""
  }
}

export function asWalkForms(value: unknown): Record<string, TodoWalkFormFields> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, TodoWalkFormFields> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Partial<TodoWalkFormFields>
    out[id] = {
      ...emptyTodoWalkForm(),
      tier: asString(r.tier),
      duration: asString(r.duration),
      points: asString(r.points),
      importance: asString(r.importance),
      resistance: asString(r.resistance),
      excitement: asString(r.excitement),
      skipped: !!r.skipped,
    }
  }
  return out
}

export function readMorningDraft(dayKey: string): MorningDraft | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(draftStorageKey(dayKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MorningDraft>
    if (!parsed || typeof parsed !== "object") return null
    return {
      allNighter: !!parsed.allNighter,
      wakeTime: asString(parsed.wakeTime),
      bedTime: asString(parsed.bedTime),
      dream: asString(parsed.dream),
      affirmations: asStringList(parsed.affirmations),
      newTodoLines: asStringList(parsed.newTodoLines, [""]),
      priorityIds: asStringList(parsed.priorityIds),
      priorityHabitIds: asStringList(parsed.priorityHabitIds),
      todoWalkById: asWalkForms(parsed.todoWalkById),
      dayPlan: asString(parsed.dayPlan),
      circumstance: {
        mustDo: !!parsed.circumstance?.mustDo,
        mustNotDo: !!parsed.circumstance?.mustNotDo,
        newEvents: !!parsed.circumstance?.newEvents,
        excited: !!parsed.circumstance?.excited,
      },
      mustDo: asString(parsed.mustDo),
      mustNotDo: asString(parsed.mustNotDo),
      newEvents: asString(parsed.newEvents),
      excitedAbout: asString(parsed.excitedAbout),
      bestDayWhy: asString(parsed.bestDayWhy),
      gratitude: asStringList(parsed.gratitude, Array.from({ length: 10 }, () => "")),
    }
  } catch {
    return null
  }
}

export function writeMorningDraft(dayKey: string, draft: MorningDraft) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(draftStorageKey(dayKey), JSON.stringify(draft))
  } catch {
    // Quota / private mode — in-progress answers stay in React state only.
  }
}

export function clearMorningDraft(dayKey: string) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.removeItem(draftStorageKey(dayKey))
  } catch {
    /* ignore */
  }
}

/** Finished store slice wins; otherwise same-day session draft; else clean defaults. */
export function seedFromMorning(existing: MorningSlice | undefined, draft: MorningDraft | null) {
  if (existing) {
    return {
      allNighter: !!existing.allNighter,
      wakeTime: asString(existing.wakeTime),
      bedTime: asString(existing.bedTime),
      dream: asString(existing.dream),
      affirmations: asStringList(existing.affirmations),
      newTodoLines: [""] as string[],
      priorityIds: asStringList(existing.priorityTaskIds),
      priorityHabitIds: asStringList(existing.priorityHabitIds),
      todoWalkById: {} as Record<string, TodoWalkFormFields>,
      dayPlan: asString(existing.dayPlanText),
      circumstance: {
        mustDo: !!existing.mustDo,
        mustNotDo: !!existing.mustNotDo,
        newEvents: !!existing.newEvents,
        excited: !!existing.excitedAbout,
      },
      mustDo: asString(existing.mustDo),
      mustNotDo: asString(existing.mustNotDo),
      newEvents: asString(existing.newEvents),
      excitedAbout: asString(existing.excitedAbout),
      bestDayWhy: asString(existing.bestDayWhy),
      gratitude: asStringList(existing.gratitude).length
        ? asStringList(existing.gratitude)
        : Array.from({ length: 10 }, () => ""),
    }
  }
  if (draft) return draft
  return {
    allNighter: false,
    wakeTime: "",
    bedTime: "",
    dream: "",
    affirmations: [] as string[],
    newTodoLines: [""] as string[],
    priorityIds: [] as string[],
    priorityHabitIds: [] as string[],
    todoWalkById: {} as Record<string, TodoWalkFormFields>,
    dayPlan: "",
    circumstance: { mustDo: false, mustNotDo: false, newEvents: false, excited: false },
    mustDo: "",
    mustNotDo: "",
    newEvents: "",
    excitedAbout: "",
    bestDayWhy: "",
    gratitude: Array.from({ length: 10 }, () => ""),
  }
}
