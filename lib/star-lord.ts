/**
 * lib/star-lord.ts — Star Lord Report
 *
 * Three reflection rites on the days the ledger is read: the local new moon,
 * the local full moon, and the person's birthday. The questions are the rite
 * itself (a ledger check, then an inner-alchemy check). Terms stay in the
 * prompts because the person asked for this wording.
 *
 * A slot is open on the occasion's local day. If that report is still undone,
 * it stays open through the next local day, the way yesterday's night does.
 */

import { lunarOccasion, type LunarKind } from "@/lib/lunar"
import { localDayKey } from "@/lib/reviews-store"
import {
  DEFAULT_RITUAL_COMPLETION_BONUS,
  DEFAULT_RITUAL_SECTION_POINTS,
  clampPointAmount,
  type RitualPointSettings,
} from "@/lib/ritual-points"

export type StarLordKind = LunarKind | "birth"

export type StarLordStatus = "none" | "partial" | "done"

export interface StarLordQuestion {
  id: string
  /** "ledger" is the plain check. "alchemy" is breathed into the belly. */
  group: "ledger" | "alchemy"
  prompt: string
}

export interface StarLordRitual {
  kind: StarLordKind
  /** Menu and dialog title after "Star Lord Report". */
  title: string
  theme: string
  themeLine: string
  place: string
  questions: StarLordQuestion[]
}

export interface StarLordReport {
  /** `${kind}:${dateKey}` */
  id: string
  kind: StarLordKind
  /** Local day the occasion fell on. */
  dateKey: string
  answers: Record<string, string>
  completed: boolean
  completedAt?: string
}

export interface StarLordSlot {
  id: string
  kind: StarLordKind
  dateKey: string
  title: string
  periodTitle: string
  status: StarLordStatus
  /** Shown on the rituals board. The walk itself is the desktop dialog. */
  telegramCommand: string
  appPath: string
}

export const STAR_LORD_PREPARATION = [
  "Three deep, slow breaths into the belly, to settle.",
  "Wash your hands and face, to clear what has gone stagnant.",
  "Sit facing north.",
  "If you wish, light one stick of incense, or set out a cup of clear water.",
] as const

export const STAR_LORD_ALCHEMY_NOTE =
  "Do not answer these with the thinking mind alone. Breathe the question into the lower belly, three finger-widths below the navel, and let it sit. The answer may arrive as a sensation, a release, or a clear quiet. Then write what remains."

export const STAR_LORD_CLOSING = [
  "Rub your palms together until they are warm. Rest them over your heart, and bow slightly toward the north.",
  "May my thoughts match the clarity of the Void.",
  "May my actions flow like water.",
  "May the Star Lords look upon my path and find harmony.",
  "Drink the water, if you set a cup out.",
] as const

const NEW_MOON: StarLordRitual = {
  kind: "new",
  title: "New moon",
  theme: "Emptying the vessel",
  themeLine:
    "The new moon is the dark before the next spark. Clear what clutters the spirit, and plant one small intention for the cycle ahead.",
  place: "At home, in a quiet room, facing north.",
  questions: [
    { id: "guarded", group: "ledger", prompt: "Am I holding onto old patterns that clutter my spirit?" },
    {
      id: "action",
      group: "ledger",
      prompt: "What is one small, natural action I can take this month to live more simply and authentically?",
    },
    {
      id: "ledger",
      group: "ledger",
      prompt:
        "If the Star Lords look at my mind today, do they see a muddy pond or a clear mirror? What needs to settle so I can see clearly?",
    },
    {
      id: "vessel",
      group: "alchemy",
      prompt:
        "Is my inner space empty enough to receive the primordial Qi of the cosmos, or is my mind so full of concepts, identities, and desires that there is no room for the Dao to enter?",
    },
    {
      id: "reversal",
      group: "alchemy",
      prompt:
        "Can I trace my thoughts backward today? Instead of focusing on what I am thinking, can I rest in the silent awareness that exists before a thought is born?",
    },
    {
      id: "jing",
      group: "alchemy",
      prompt:
        "Where have I leaked my foundational energy (Jing) this past month through overstimulation, sensory indulgence, or erratic emotions? How will I seal the leak during this dark moon?",
    },
  ],
}

const FULL_MOON: StarLordRitual = {
  kind: "full",
  title: "Full moon",
  theme: "Illumination",
  themeLine:
    "The full moon is the bright half of the month. Everything done so far is lit. Look at harmony and friction in that light, then balance outward action with rest as the moon wanes.",
  place: "Facing north.",
  questions: [
    {
      id: "mirror",
      group: "ledger",
      prompt:
        "Now that the month is half over, where have my actions created harmony (Dao), and where have they caused friction or conflict?",
    },
    {
      id: "virtue",
      group: "ledger",
      prompt:
        "How have I practiced kindness and humility over the last two weeks? Did I act out of genuine selflessness, or for the praise of others?",
    },
    {
      id: "balance",
      group: "ledger",
      prompt:
        "Where am I overextending myself? How can I balance my outward actions (Yang) with inner rest (Yin) as the moon begins to wane?",
    },
    {
      id: "marriage",
      group: "alchemy",
      prompt:
        "Am I operating with a hot, reactive mind (Fire), or a cold, stagnant heart (Water)? How can I sink the fire of my mind into the water of my lower Dantian to create the alchemical steam of pure vitality?",
    },
    {
      id: "ego",
      group: "alchemy",
      prompt:
        "Under the bright light of full consciousness, what aspect of my ego am I still mistaking for my true self (Zhenren)? What spiritual pride or spiritual identity must be burned away?",
    },
    {
      id: "celestial",
      group: "alchemy",
      prompt:
        "Am I reacting to the world around me, or am I acting as a pure mirror? Does the light shining out of my eyes today belong to my personal ego, or is it the universal Spirit (Shen) shining through a clean window?",
    },
  ],
}

const BIRTHDAY: StarLordRitual = {
  kind: "birth",
  title: "Birthday",
  theme: "The day the ledger opened",
  themeLine:
    "This day is a return to the source, not a count of years. The ledger opened when you were born. Read it, thank what sustains you, and set down what you are ready to dissolve.",
  place: "Facing north.",
  questions: [
    {
      id: "nature",
      group: "ledger",
      prompt:
        "Am I closer to my true, authentic self today than I was a year ago, or have I let the demands of the world distort who I am?",
    },
    {
      id: "gratitude",
      group: "ledger",
      prompt: "How can I express gratitude today to the forces that sustain me — my parents, nature, and the universe?",
    },
    {
      id: "destiny",
      group: "ledger",
      prompt:
        "If the Star Lords review my entire life's ledger today, does my current path reflect my highest purpose? What heavy burdens or regrets am I ready to ask the cosmos to dissolve?",
    },
    {
      id: "prenatal",
      group: "alchemy",
      prompt:
        "If I strip away my name, my age, my history, my trauma, and my human memories, what remains? Can I touch the pure, unconditioned consciousness that existed before I was formed in my mother's womb?",
    },
    {
      id: "clock",
      group: "alchemy",
      prompt:
        "Am I letting linear time decay my spirit, or am I actively pulling my scattered life force back from the past and the future into the timeless present?",
    },
    {
      id: "falseSelf",
      group: "alchemy",
      prompt:
        "To be reborn into the Dao, something must die. What old layer of my history, what ancient narrative of who I think I am, am I finally ready to dissolve into the Primordial Void today?",
    },
  ],
}

export const STAR_LORD_RITUALS: Record<StarLordKind, StarLordRitual> = {
  new: NEW_MOON,
  full: FULL_MOON,
  birth: BIRTHDAY,
}

export function starLordReportId(kind: StarLordKind, dateKey: string): string {
  return `${kind}:${dateKey}`
}

export function starLordPointsTaskId(kind: StarLordKind, dateKey: string): string {
  return `ritual:star-lord:${kind}:${dateKey}`
}

export function starLordPointsLabel(kind: StarLordKind, sections: number, bonus: number): string {
  const name = STAR_LORD_RITUALS[kind].title
  return `Star Lord Report · ${name} · ${sections} section${sections === 1 ? "" : "s"} + ${bonus} bonus`
}

export function cleanStarLordAnswers(
  kind: StarLordKind,
  answers: Record<string, string>,
): Record<string, string> {
  const ids = new Set(STAR_LORD_RITUALS[kind].questions.map((q) => q.id))
  const next: Record<string, string> = {}
  for (const [id, value] of Object.entries(answers)) {
    if (!ids.has(id)) continue
    const trimmed = value.trim()
    if (trimmed) next[id] = trimmed
  }
  return next
}

export function starLordPhase(report: StarLordReport | undefined): StarLordStatus {
  if (!report) return "none"
  if (report.completed) return "done"
  if (Object.keys(report.answers).some((id) => report.answers[id]?.trim())) return "partial"
  return "none"
}

/** Answered questions. Drafts are not passed here — the caller skips points when the rite is unfinished. */
export function completedStarLordSections(kind: StarLordKind, answers: Record<string, string>): string[] {
  const clean = cleanStarLordAnswers(kind, answers)
  return STAR_LORD_RITUALS[kind].questions.map((q) => q.id).filter((id) => !!clean[id])
}

export function starLordAwardPoints(
  kind: StarLordKind,
  answers: Record<string, string>,
  settings: RitualPointSettings,
  submitted: boolean,
): number {
  if (!submitted) return 0
  const sectionPoints = clampPointAmount(settings.sectionPoints, DEFAULT_RITUAL_SECTION_POINTS)
  const bonus = clampPointAmount(settings.completionBonus, DEFAULT_RITUAL_COMPLETION_BONUS)
  return completedStarLordSections(kind, answers).length * sectionPoints + bonus
}

export interface ParsedBirthday {
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
  /** Set when the stored value includes a year. */
  year?: number
}

/** `YYYY-MM-DD` or `MM-DD`. Empty and junk return null. */
export function parseBirthday(value: string | undefined | null): ParsedBirthday | null {
  const raw = (value ?? "").trim()
  if (!raw) return null
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const short = /^(\d{2})-(\d{2})$/.exec(raw)
  const year = full ? Number(full[1]) : undefined
  const month = Number((full ?? short)?.[full ? 2 : 1])
  const day = Number((full ?? short)?.[full ? 3 : 2])
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year !== undefined && (year < 1 || year > 9999)) return null
  const probe = new Date(year && year > 0 ? year : 2000, month - 1, day)
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
  return year ? { month, day, year } : { month, day }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Birthday match for a local date. A Feb 29 birthday falls on March 1 in a
 * year that has no Feb 29, so the day is not skipped.
 */
export function isBirthday(date: Date, birthday: string | undefined | null): boolean {
  const parsed = parseBirthday(birthday)
  if (!parsed) return false
  let month = parsed.month
  let day = parsed.day
  if (month === 2 && day === 29 && !isLeapYear(date.getFullYear())) {
    month = 3
    day = 1
  }
  return date.getMonth() + 1 === month && date.getDate() === day
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0)
}

function noon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
}

function occasionKind(date: Date, birthday: string | undefined | null): StarLordKind | null {
  return lunarOccasion(date) ?? (isBirthday(date, birthday) ? "birth" : null)
}

function slotFor(
  date: Date,
  kind: StarLordKind,
  reports: StarLordReport[],
): StarLordSlot {
  const dateKey = localDayKey(date)
  const ritual = STAR_LORD_RITUALS[kind]
  const report = reports.find((r) => r.id === starLordReportId(kind, dateKey))
  return {
    id: `star-lord:${kind}:${dateKey}`,
    kind,
    dateKey,
    title: `Star Lord · ${ritual.title}`,
    periodTitle: ritual.theme,
    status: starLordPhase(report),
    telegramCommand: "rituals",
    appPath: "Header → Rituals → Star Lord Report",
  }
}

/**
 * Occasions to show. Today always, when it is a report day. Yesterday only
 * while that report is still undone. A birthday that lands on a moon keeps
 * both rites.
 */
export function listStarLordSlots(
  reports: StarLordReport[],
  now = new Date(),
  birthday?: string | null,
): StarLordSlot[] {
  const slots: StarLordSlot[] = []
  const today = noon(now)
  const yesterday = addDays(today, -1)

  const pushDay = (date: Date, onlyIfUndone: boolean) => {
    const moon = lunarOccasion(date)
    const birth = isBirthday(date, birthday)
    const kinds: StarLordKind[] = []
    if (moon) kinds.push(moon)
    if (birth) kinds.push("birth")
    for (const kind of kinds) {
      const slot = slotFor(date, kind, reports)
      if (onlyIfUndone && slot.status === "done") continue
      slots.push(slot)
    }
  }

  pushDay(today, false)
  pushDay(yesterday, true)
  return slots
}

export function listAvailableStarLordSlots(
  reports: StarLordReport[],
  now = new Date(),
  birthday?: string | null,
): StarLordSlot[] {
  return listStarLordSlots(reports, now, birthday).filter((s) => s.status !== "done")
}

/** Extra lines for the Telegram rituals board. Empty when nothing is open. */
export function formatStarLordBoard(slots: StarLordSlot[]): string {
  if (slots.length === 0) return ""
  const lines = ["", "Star Lord Report (new moon, full moon, birthday):"]
  for (const slot of slots) {
    const state = slot.status === "done" ? "done" : slot.status === "partial" ? "in progress" : "not yet"
    lines.push(`  · ${slot.title} · ${slot.dateKey} (${state}) — app ${slot.appPath}`)
  }
  return lines.join("\n")
}

/** Used by tests that need the occasion helper without listing slots. */
export function starLordOccasion(date: Date, birthday?: string | null): StarLordKind | null {
  return occasionKind(date, birthday)
}
