/**
 * lib/rituals.ts — Ritual slots, available/undone list, open paths
 *
 * User-facing concept is Rituals. Persistence stays on PeriodReview
 * (morning = day start, start = period start, root body = end/night).
 * Shared by the header Rituals menu, Home tile, Analytics, and BIM text.
 */
import type { PeriodReview, PeriodStartRitual, ReviewPeriod, RitualPhase } from "@/lib/types"
import {
  REVIEW_PERIODS,
  getPeriodKey,
  localDayKey,
  morningReviewPhase,
  periodLabel,
  previousPeriodDate,
  type MorningReviewPhase,
} from "@/lib/reviews-store"

export type RitualStatus = MorningReviewPhase // "none" | "partial" | "done"

export type RitualSlotKind =
  | "day-morning"
  | "day-night"
  | "period-start"
  | "period-end"

export interface RitualSlot {
  id: string
  kind: RitualSlotKind
  period: ReviewPeriod
  phase: RitualPhase
  /** Day-only sun/moon role. */
  dayRole?: "morning" | "night"
  periodKey: string
  /** Short title: "Morning", "Night", "Start", "Review". */
  title: string
  /** Period label for the key (e.g. "Saturday, June 20"). */
  periodTitle: string
  status: RitualStatus
  /** BIM command that opens this slot. */
  telegramCommand: string
  /** In-app path copy. */
  appPath: string
}

function hasEndBody(r: PeriodReview): boolean {
  return !!(
    r.summary?.trim() ||
    (r.gratitude?.length ?? 0) > 0 ||
    Object.keys(r.reflections ?? {}).length > 0 ||
    (r.resolvedTaskIds?.length ?? 0) > 0 ||
    (r.pushedTaskIds?.length ?? 0) > 0 ||
    r.planReflection?.trim() ||
    r.nextPlans?.trim() ||
    r.wakeReminder?.trim() ||
    r.tomorrowMatters?.trim() ||
    r.timeReflection?.trim() ||
    (r.tomorrowFocusGoalIds?.length ?? 0) > 0 ||
    !!(r.arc && Object.keys(r.arc).length > 0) ||
    (r.blockedReasons && Object.keys(r.blockedReasons).length > 0) ||
    (r.spawnedItemIds?.length ?? 0) > 0
  )
}

/**
 * End / night / review ritual phase.
 * Legacy rows without `endCompleted`: end body → done; morning/start-only shell → none;
 * empty Save Review with no morning/start → done (pre-rituals behavior).
 */
export function endRitualPhase(review: PeriodReview | undefined): RitualStatus {
  if (!review) return "none"
  if (review.endCompleted === true) return "done"
  if (review.endCompleted === false) return hasEndBody(review) ? "partial" : "none"
  if (hasEndBody(review)) return "done"
  if (review.morning || review.start) return "none"
  return "done"
}

export function startRitualPhase(start: PeriodStartRitual | undefined): RitualStatus {
  if (!start) return "none"
  if (start.completed === false) return "partial"
  if (start.completed === true) return "done"
  const legacy =
    !!start.priorities?.trim() ||
    !!start.mustDo?.trim() ||
    !!start.undoneNotes?.trim() ||
    !!start.summary?.trim() ||
    !!start.nextPlans?.trim() ||
    (start.gratitude?.length ?? 0) > 0 ||
    Object.keys(start.reflections ?? {}).length > 0 ||
    (start.pulledTaskIds?.length ?? 0) > 0 ||
    !!start.source ||
    !!start.resumeStep
  return legacy ? "done" : "none"
}

function findReview(
  reviews: PeriodReview[],
  period: ReviewPeriod,
  key: string,
): PeriodReview | undefined {
  return reviews.find((r) => r.period === period && r.periodKey === key)
}

function statusLabel(status: RitualStatus): string {
  if (status === "done") return "done"
  if (status === "partial") return "in progress"
  return "not yet"
}

/**
 * Every ritual slot the person can open for "now":
 * - Day morning + night for today
 * - Start rituals for the current week/month/quarter/year
 * - End rituals for the just-ended day/week/month/quarter/year
 */
export function listRitualSlots(reviews: PeriodReview[], now = new Date()): RitualSlot[] {
  const slots: RitualSlot[] = []
  const todayKey = localDayKey(now)

  const morningReview = findReview(reviews, "day", todayKey)
  const morningStatus = morningReviewPhase(morningReview?.morning)
  slots.push({
    id: `day-morning:${todayKey}`,
    kind: "day-morning",
    period: "day",
    phase: "start",
    dayRole: "morning",
    periodKey: todayKey,
    title: "Morning",
    periodTitle: periodLabel("day", todayKey),
    status: morningStatus,
    telegramCommand: "gm",
    appPath: "Header → Rituals → Day → sun",
  })

  const nightStatus = endRitualPhase(morningReview)
  slots.push({
    id: `day-night:${todayKey}`,
    kind: "day-night",
    period: "day",
    phase: "end",
    dayRole: "night",
    periodKey: todayKey,
    title: "Night",
    periodTitle: periodLabel("day", todayKey),
    status: nightStatus,
    telegramCommand: "gn",
    appPath: "Header → Rituals → Day → moon",
  })

  for (const period of REVIEW_PERIODS) {
    if (period === "day") {
      // Just-ended day night (yesterday) — distinct from today's night.
      const prevKey = getPeriodKey("day", previousPeriodDate("day", now))
      if (prevKey !== todayKey) {
        const prev = findReview(reviews, "day", prevKey)
        slots.push({
          id: `day-night-prev:${prevKey}`,
          kind: "day-night",
          period: "day",
          phase: "end",
          dayRole: "night",
          periodKey: prevKey,
          title: "Night (prior day)",
          periodTitle: periodLabel("day", prevKey),
          status: endRitualPhase(prev),
          telegramCommand: "review day",
          appPath: "Header → Rituals → Day → moon (pick prior day)",
        })
      }
      continue
    }

    const currentKey = getPeriodKey(period, now)
    const current = findReview(reviews, period, currentKey)
    slots.push({
      id: `${period}-start:${currentKey}`,
      kind: "period-start",
      period,
      phase: "start",
      periodKey: currentKey,
      title: "Start",
      periodTitle: periodLabel(period, currentKey),
      status: startRitualPhase(current?.start),
      telegramCommand: `ritual start ${period}`,
      appPath: `Header → Rituals → ${period} → Start ritual`,
    })

    const endKey = getPeriodKey(period, previousPeriodDate(period, now))
    const endReview = findReview(reviews, period, endKey)
    slots.push({
      id: `${period}-end:${endKey}`,
      kind: "period-end",
      period,
      phase: "end",
      periodKey: endKey,
      title: "Review",
      periodTitle: periodLabel(period, endKey),
      status: endRitualPhase(endReview),
      telegramCommand: `review ${period}`,
      appPath: `Header → Rituals → ${period} → Review ritual`,
    })
  }

  return slots
}

/** Rituals that are due or in progress (available / undone). */
export function listAvailableRituals(reviews: PeriodReview[], now = new Date()): RitualSlot[] {
  return listRitualSlots(reviews, now).filter((s) => s.status !== "done")
}

export function countAvailableRituals(reviews: PeriodReview[], now = new Date()): number {
  return listAvailableRituals(reviews, now).length
}

/** Format the BIM rituals board (available + how to open each). */
export function formatRitualsBoard(reviews: PeriodReview[], now = new Date()): string {
  const slots = listRitualSlots(reviews, now)
  const open = slots.filter((s) => s.status !== "done")
  const lines: string[] = ["Rituals board"]
  lines.push("")
  lines.push("Available / undone:")
  if (open.length === 0) {
    lines.push("  (none — all current slots done)")
  } else {
    for (const s of open) {
      lines.push(
        `  · ${s.title} · ${s.periodTitle} (${statusLabel(s.status)}) — text ${s.telegramCommand} · app ${s.appPath}`,
      )
    }
  }
  lines.push("")
  lines.push("All slots:")
  for (const s of slots) {
    lines.push(`  · ${s.title} · ${s.periodTitle}: ${statusLabel(s.status)}`)
  }
  lines.push("")
  lines.push("Open from Telegram:")
  lines.push("  gm / good morning — day morning (sun)")
  lines.push("  gn / good night / night — day night (moon) for today")
  lines.push("  review day|week|month|quarter|year — end/review ritual (just-ended period)")
  lines.push("  ritual start week|month|quarter|year — start/planning ritual (current period)")
  lines.push("  ritual end week|month|quarter|year — same as review <period>")
  lines.push("  ritual morning · ritual night — same as gm / gn")
  lines.push("  rituals / reviews — this board")
  lines.push("  cancel — leave an end/start walk; STOP (all caps) leaves morning")
  lines.push("")
  lines.push("In the app: Header → Rituals (sun/moon for day; Start / Review for other periods).")
  return lines.join("\n")
}

/** End-of-period pending map (just-ended keys) using endRitualPhase — drives legacy badges. */
export function endRitualNeeded(
  reviews: PeriodReview[],
  period: ReviewPeriod,
  now = new Date(),
): { key: string; needed: boolean } {
  const key = getPeriodKey(period, previousPeriodDate(period, now))
  const review = findReview(reviews, period, key)
  return { key, needed: endRitualPhase(review) !== "done" }
}
