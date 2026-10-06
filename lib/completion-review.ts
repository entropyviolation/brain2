/**
 * lib/completion-review.ts — Completion-review clock, reflections, and points
 *
 * The quick review on a finished task can name a length and a start. Each is
 * exact, estimated, or unknown. Unknown stores no value.
 * Unknown is the absence of a number or a time — not zero, not midnight, and
 * not an estimate. Estimated minutes stay out of exact totals. `timeRough` is
 * set only when the length or the start is estimated. Agreeing to the review
 * awards 3 points plus 0.1 per word in
 * the quick-review notes, through the points ledger. A later Reflect note
 * (`reflectNotes`) is not that string and does not change the award.
 *
 * A word is a whitespace-separated non-empty token. Punctuation stays on the
 * token it touches ("well-known" is one word). Only the quick-review `notes`
 * field counts.
 */
import type {
  CompletionReflections,
  DurationCertainty,
  FieldEstimate,
  StartCertainty,
  Task,
  TaskCompletionReview,
} from "@/lib/types"
import { isEstimated, confirmEstimates, clearEstimates } from "@/lib/estimated-values"
import { usePointsStore } from "@/lib/points-store"

/** Awarded for turning the quick review on, before any words. */
export const QUICK_REVIEW_BASE_POINTS = 3
/** One point per ten words, stored as tenths so the sum stays exact. */
export const POINTS_PER_REVIEW_WORD = 0.1

export const REFLECTION_SCORE_KEYS = [
  "expectedDifficulty",
  "actualDifficulty",
  "enjoyment",
  "resistance",
  "energy",
  "focus",
  "meaning",
] as const

export type ReflectionScoreKey = (typeof REFLECTION_SCORE_KEYS)[number]

export const REFLECTION_SCALES: { key: ReflectionScoreKey; label: string; hint: string }[] = [
  { key: "expectedDifficulty", label: "Expected difficulty", hint: "How hard you thought it would be" },
  { key: "actualDifficulty", label: "Actual difficulty", hint: "How hard it was" },
  { key: "enjoyment", label: "Enjoyment", hint: "How much you enjoyed it" },
  { key: "resistance", label: "Resistance", hint: "How hard it was to start" },
  { key: "energy", label: "Energy", hint: "The energy you had" },
  { key: "focus", label: "Focus", hint: "How absorbed you were" },
  { key: "meaning", label: "Meaning", hint: "Whether it was worth it" },
]

export function reviewPointsTaskId(taskId: string): string {
  return `review:${taskId}`
}

/** Whitespace-separated non-empty tokens. Empty and whitespace-only text are 0. */
export function reviewWordCount(text: string | undefined | null): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter((token) => token.length > 0).length
}

/** 3 + 0.1 per word. 0 words is 3. 10 words is 4. Tenths, no float drift. */
export function quickReviewPoints(wordCount: number): number {
  const words = Number.isFinite(wordCount) ? Math.max(0, Math.trunc(wordCount)) : 0
  return (QUICK_REVIEW_BASE_POINTS * 10 + words) / 10
}

export function formatReviewPoints(points: number): string {
  if (!Number.isFinite(points)) return "0"
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

export function clampReflectionScore(value: number | undefined | null): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) return undefined
  return value
}

export function pickReflectionScores(
  source: Partial<CompletionReflections> | undefined | null,
): Partial<CompletionReflections> {
  const scores: Partial<CompletionReflections> = {}
  if (!source) return scores
  for (const key of REFLECTION_SCORE_KEYS) {
    const n = clampReflectionScore(source[key])
    if (n !== undefined) scores[key] = n
  }
  return scores
}

export function positiveMinutes(value: number | undefined | null): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined
  return value
}

type ClockCarrier = {
  actualDuration?: number
  durationCertainty?: DurationCertainty
  timeRough?: boolean
  estimates?: FieldEstimate[]
}

/**
 * Minutes safe to add into an exact-time total.
 * Estimated, unknown, rough legacy rows, and non-positive numbers are omitted.
 */
export function exactDurationMinutes(task: ClockCarrier): number | undefined {
  if (task.durationCertainty === "unknown" || task.durationCertainty === "estimated") return undefined
  if (task.durationCertainty === "exact") return positiveMinutes(task.actualDuration)
  if (task.timeRough) return undefined
  if (isEstimated(task.estimates, "actualDuration")) return undefined
  return positiveMinutes(task.actualDuration)
}

/** Estimated minutes. Never folded into `exactDurationMinutes`. */
export function estimatedDurationMinutes(task: ClockCarrier): number | undefined {
  if (task.durationCertainty === "unknown" || task.durationCertainty === "exact") return undefined
  if (task.durationCertainty === "estimated") return positiveMinutes(task.actualDuration)
  if (task.timeRough || isEstimated(task.estimates, "actualDuration")) return positiveMinutes(task.actualDuration)
  return undefined
}

export function isUnknownDuration(task: ClockCarrier): boolean {
  return task.durationCertainty === "unknown"
}

export interface ClockDraft {
  /** `unspecified` means the person has not marked a length yet. */
  durationCertainty: DurationCertainty | "unspecified"
  durationMinutes: string
  /** `unspecified` means the person has not marked a start yet. */
  startCertainty: StartCertainty | "unspecified"
  /** `HH:mm`, or empty. Cleared when the start is unknown. */
  startTime: string
}

/** Older reviews stored `"known"` for what is now `exact`. */
export function readStartCertainty(value: string | null | undefined): StartCertainty | undefined {
  if (value === "known" || value === "exact") return "exact"
  if (value === "estimated" || value === "unknown") return value
  return undefined
}

export function formatHm(date: Date | string | undefined | null): string {
  if (!date) return ""
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function applyHm(base: Date, hm: string): Date | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  const next = new Date(base)
  next.setHours(hours, minutes, 0, 0)
  return next
}

export function clockDraftFromTask(task: Task | undefined | null): ClockDraft {
  if (!task) {
    return { durationCertainty: "unspecified", durationMinutes: "", startCertainty: "unspecified", startTime: "" }
  }
  const review = task.completionReview
  const certainty = review?.durationCertainty ?? task.durationCertainty
  const minutes = positiveMinutes(review?.actualDuration ?? task.actualDuration)
  let durationCertainty: ClockDraft["durationCertainty"] = "unspecified"
  if (certainty === "unknown") durationCertainty = "unknown"
  else if (minutes !== undefined && (certainty === "estimated" || certainty === "exact")) durationCertainty = certainty
  else if (minutes !== undefined && (task.timeRough || isEstimated(task.estimates, "actualDuration"))) {
    durationCertainty = "estimated"
  } else if (minutes !== undefined) durationCertainty = "exact"

  const started = review?.startedAt ?? task.startedAt
  const startCertainty = readStartCertainty(review?.startCertainty ?? task.startCertainty)
  let draftStart: ClockDraft["startCertainty"] = "unspecified"
  if (startCertainty === "unknown") draftStart = "unknown"
  else if (started && startCertainty === "estimated") draftStart = "estimated"
  else if (started && startCertainty === "exact") draftStart = "exact"
  else if (started && isEstimated(task.estimates, "startedAt")) draftStart = "estimated"
  else if (started) draftStart = "exact"

  return {
    durationCertainty,
    durationMinutes: durationCertainty === "unknown" || minutes === undefined ? "" : String(Math.round(minutes)),
    startCertainty: draftStart,
    startTime: draftStart === "unknown" || !started ? "" : formatHm(started),
  }
}

export interface ClockWrite {
  actualDuration?: number
  durationCertainty?: DurationCertainty
  startedAt?: Date
  startCertainty?: StartCertainty
  timeRough?: boolean
  estimates?: FieldEstimate[]
  /** True when the length fields should replace whatever the task already has. */
  writeDuration: boolean
  /** True when the start fields should replace whatever the task already has. */
  writeStart: boolean
}

/**
 * Turn the review's clock draft into task fields.
 * Unknown clears the length or the start. Estimated stores the value apart from exact totals.
 * An empty exact/est. field does not invent a number or a time.
 * `timeRough` is set only when the length or the start is estimated.
 */
export function clockWriteFromDraft(task: Task, draft: ClockDraft): ClockWrite {
  const write: ClockWrite = { writeDuration: false, writeStart: false }
  let estimates = task.estimates

  if (draft.durationCertainty === "unknown") {
    write.writeDuration = true
    write.actualDuration = undefined
    write.durationCertainty = "unknown"
    estimates = clearEstimates(estimates, ["actualDuration"])
  } else if (draft.durationCertainty === "exact" || draft.durationCertainty === "estimated") {
    const minutes = positiveMinutes(Number.parseInt(draft.durationMinutes, 10))
    if (minutes !== undefined) {
      write.writeDuration = true
      write.actualDuration = Math.round(minutes)
      write.durationCertainty = draft.durationCertainty
      estimates = confirmEstimates(estimates, ["actualDuration"])
    }
  }

  if (draft.startCertainty === "unknown") {
    write.writeStart = true
    write.startedAt = undefined
    write.startCertainty = "unknown"
    estimates = clearEstimates(estimates, ["startedAt"])
  } else if (draft.startCertainty === "exact" || draft.startCertainty === "estimated") {
    const baseRaw = task.startedAt ?? task.completedDate ?? new Date()
    const base = baseRaw instanceof Date ? baseRaw : new Date(baseRaw)
    const startedAt = applyHm(Number.isNaN(base.getTime()) ? new Date() : base, draft.startTime)
    if (startedAt) {
      write.writeStart = true
      write.startedAt = startedAt
      write.startCertainty = draft.startCertainty
      estimates = confirmEstimates(estimates, ["startedAt"])
    }
  }

  const nextDuration = write.writeDuration ? write.durationCertainty : task.durationCertainty
  const nextStart = write.writeStart ? write.startCertainty : readStartCertainty(task.startCertainty)
  write.timeRough = nextDuration === "estimated" || nextStart === "estimated" ? true : undefined
  write.estimates = estimates?.length ? estimates : undefined
  return write
}

export function applyClockWrite(task: Task, write: ClockWrite): Task {
  const next: Task = {
    ...task,
    ...(write.writeDuration
      ? { actualDuration: write.actualDuration, durationCertainty: write.durationCertainty }
      : {}),
    ...(write.writeStart ? { startedAt: write.startedAt, startCertainty: write.startCertainty } : {}),
    timeRough: write.timeRough,
    estimates: write.estimates,
  }
  // A spread only replaces keys that are present. Unknown must set the value
  // to undefined so a later merge drops the stale time.
  if (write.writeDuration && write.actualDuration === undefined) next.actualDuration = undefined
  if (write.writeStart && write.startedAt === undefined) next.startedAt = undefined
  if (write.timeRough === undefined) next.timeRough = undefined
  return next
}

export function composeCompletionReview(args: {
  taskId: string
  completedAt: Date
  notes?: string
  clock: ClockWrite
  scores?: Partial<CompletionReflections>
  satisfaction?: number
  distraction?: number
  awardQuickReview?: boolean
  existing?: TaskCompletionReview
}): TaskCompletionReview {
  const notes = args.notes?.trim() || undefined
  const scores = pickReflectionScores(args.scores)
  const satisfaction = clampReflectionScore(args.satisfaction)
  const distraction = clampReflectionScore(args.distraction)
  const review: TaskCompletionReview = {
    taskId: args.taskId,
    completedAt: args.completedAt,
    ...scores,
    ...(notes ? { notes } : {}),
    ...(satisfaction !== undefined ? { satisfaction } : {}),
    ...(distraction !== undefined ? { distraction } : {}),
  }

  if (args.clock.writeDuration && args.clock.durationCertainty === "unknown") {
    review.durationCertainty = "unknown"
  } else if (args.clock.writeDuration && args.clock.actualDuration && args.clock.durationCertainty) {
    review.actualDuration = args.clock.actualDuration
    review.durationCertainty = args.clock.durationCertainty
  } else if (args.existing?.durationCertainty === "unknown") {
    review.durationCertainty = "unknown"
  } else if (args.existing?.actualDuration && args.existing.actualDuration > 0) {
    review.actualDuration = args.existing.actualDuration
    if (args.existing.durationCertainty) review.durationCertainty = args.existing.durationCertainty
  }

  if (args.clock.writeStart && args.clock.startCertainty === "unknown") {
    delete review.startedAt
    review.startCertainty = "unknown"
  } else if (args.clock.writeStart && args.clock.startedAt && args.clock.startCertainty) {
    review.startedAt = args.clock.startedAt
    review.startCertainty = readStartCertainty(args.clock.startCertainty) ?? args.clock.startCertainty
  } else if (!args.clock.writeStart && readStartCertainty(args.existing?.startCertainty) === "unknown") {
    delete review.startedAt
    review.startCertainty = "unknown"
  } else if (!args.clock.writeStart && args.existing?.startedAt) {
    review.startedAt = args.existing.startedAt
    const startCertainty = readStartCertainty(args.existing.startCertainty)
    if (startCertainty) review.startCertainty = startCertainty
  }

  if (args.existing?.reflectNotes) review.reflectNotes = args.existing.reflectNotes

  if (args.awardQuickReview) {
    review.reviewWordCount = reviewWordCount(notes)
    review.reviewPoints = quickReviewPoints(review.reviewWordCount)
  } else if (args.existing?.reviewPoints != null) {
    if (args.existing.reviewWordCount != null) review.reviewWordCount = args.existing.reviewWordCount
    review.reviewPoints = args.existing.reviewPoints
  }

  return review
}

/** Write the quick-review award into the points ledger. Re-saving the same day replaces it. */
export function recordQuickReviewPoints(
  taskId: string,
  title: string,
  notes: string | undefined,
  date: Date = new Date(),
): { reviewWordCount: number; reviewPoints: number } {
  const words = reviewWordCount(notes)
  const points = quickReviewPoints(words)
  usePointsStore.getState().upsertPoints(reviewPointsTaskId(taskId), points, `Quick review: ${title}`, date)
  return { reviewWordCount: words, reviewPoints: points }
}

export function clearQuickReviewPoints(taskId: string, date?: Date) {
  usePointsStore.getState().removePointsForTask(reviewPointsTaskId(taskId), date)
}

export interface GoalTexture {
  id: string
  title: string
  n: number
  exactMinutes: number
  estimatedMinutes: number
  difficultyN: number
  meanActualDifficulty?: number
  enjoymentN: number
  meanEnjoyment?: number
}

export interface ScoreMean {
  key: ReflectionScoreKey
  label: string
  n: number
  mean: number
}

export interface DifficultyPair {
  taskId: string
  title: string
  expected: number
  actual: number
}

export interface CompletionReviewSummary {
  doneCount: number
  reviewedCount: number
  exactMinutes: number
  exactCount: number
  estimatedMinutes: number
  estimatedCount: number
  unknownCount: number
  unspecifiedCount: number
  paintedMinutes: number
  startExact: number
  startEstimated: number
  startUnknown: number
  startUnspecified: number
  wordCount: number
  reviewPoints: number
  agreedCount: number
  scoreMeans: ScoreMean[]
  difficultyPairs: DifficultyPair[]
  /** Mean actual minus mean expected, when both exist on the same reviews. */
  difficultyGap?: number
  goals: GoalTexture[]
  objectives: GoalTexture[]
}

export interface SummaryLink {
  id: string
  title: string
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

interface TaskClock {
  certainty: DurationCertainty | "unspecified"
  minutes?: number
}

function clockOfTask(task: Task): TaskClock {
  const review = task.completionReview
  const certainty = review?.durationCertainty ?? task.durationCertainty
  const minutes = positiveMinutes(review?.durationCertainty ? review.actualDuration : (review?.actualDuration ?? task.actualDuration))
  if (certainty === "unknown") return { certainty: "unknown" }
  if (certainty === "estimated" || certainty === "exact") {
    return minutes === undefined ? { certainty: "unspecified" } : { certainty, minutes }
  }
  const carrier: ClockCarrier = {
    actualDuration: review?.actualDuration ?? task.actualDuration,
    timeRough: task.timeRough,
    estimates: task.estimates,
  }
  const exact = exactDurationMinutes(carrier)
  if (exact !== undefined) return { certainty: "exact", minutes: exact }
  const estimated = estimatedDurationMinutes(carrier)
  if (estimated !== undefined) return { certainty: "estimated", minutes: estimated }
  return { certainty: "unspecified" }
}

function startOfTask(task: Task): "exact" | "estimated" | "unknown" | "unspecified" {
  const review = task.completionReview
  const started = review?.startedAt ?? task.startedAt
  const certainty = readStartCertainty(review?.startCertainty ?? task.startCertainty)
  if (certainty === "unknown") return "unknown"
  if (!started) return "unspecified"
  if (certainty === "estimated" || isEstimated(task.estimates, "startedAt")) return "estimated"
  return "exact"
}

function textureFor(
  links: SummaryLink[],
  tasks: Task[],
  idsOf: (task: Task) => string[] | undefined,
): GoalTexture[] {
  return links
    .map((link) => {
      const rows = tasks.filter((task) => (idsOf(task) ?? []).includes(link.id))
      if (rows.length === 0) return null
      const difficulties: number[] = []
      const joys: number[] = []
      let exactMinutes = 0
      let estimatedMinutes = 0
      for (const task of rows) {
        const clock = clockOfTask(task)
        if (clock.certainty === "exact" && clock.minutes) exactMinutes += clock.minutes
        if (clock.certainty === "estimated" && clock.minutes) estimatedMinutes += clock.minutes
        const actual = clampReflectionScore(task.completionReview?.actualDifficulty)
        const joy = clampReflectionScore(task.completionReview?.enjoyment)
        if (actual !== undefined) difficulties.push(actual)
        if (joy !== undefined) joys.push(joy)
      }
      const meanActualDifficulty = mean(difficulties)
      const meanEnjoyment = mean(joys)
      return {
        id: link.id,
        title: link.title,
        n: rows.length,
        exactMinutes,
        estimatedMinutes,
        difficultyN: difficulties.length,
        ...(meanActualDifficulty !== undefined ? { meanActualDifficulty } : {}),
        enjoymentN: joys.length,
        ...(meanEnjoyment !== undefined ? { meanEnjoyment } : {}),
      }
    })
    .filter((row): row is GoalTexture => row !== null)
    .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title))
}

/**
 * Window summary of done tasks and their reviews.
 * Unknown lengths add to `unknownCount` only. They do not add 0 to either minute total.
 * Unknown starts add to `startUnknown` only. They are not a time.
 * Estimated minutes stay in `estimatedMinutes`.
 */
export function summarizeCompletionReviews(args: {
  tasks: Task[]
  goals: SummaryLink[]
  objectives: SummaryLink[]
  inWindow: (date: Date | string | undefined | null) => boolean
  titleOf: (task: Task) => string
}): CompletionReviewSummary {
  const done = args.tasks.filter(
    (task) => task.completed && args.inWindow(task.completedDate ?? task.completionReview?.completedAt),
  )
  const reviewed = done.filter((task) => task.completionReview && args.inWindow(task.completionReview.completedAt))

  let exactMinutes = 0
  let exactCount = 0
  let estimatedMinutes = 0
  let estimatedCount = 0
  let unknownCount = 0
  let unspecifiedCount = 0
  let paintedMinutes = 0
  let startExact = 0
  let startEstimated = 0
  let startUnknown = 0
  let startUnspecified = 0

  for (const task of done) {
    const clock = clockOfTask(task)
    if (clock.certainty === "exact" && clock.minutes) {
      exactMinutes += clock.minutes
      exactCount += 1
    } else if (clock.certainty === "estimated" && clock.minutes) {
      estimatedMinutes += clock.minutes
      estimatedCount += 1
    } else if (clock.certainty === "unknown") unknownCount += 1
    else unspecifiedCount += 1

    const start = startOfTask(task)
    if (start === "exact") startExact += 1
    else if (start === "estimated") startEstimated += 1
    else if (start === "unknown") startUnknown += 1
    else startUnspecified += 1

    for (const log of task.timeLogs ?? []) {
      if (!args.inWindow(log.date)) continue
      if (log.durationMinutes > 0) paintedMinutes += log.durationMinutes
    }
  }

  const scoreBuckets = new Map<ReflectionScoreKey, number[]>()
  const difficultyPairs: DifficultyPair[] = []
  let wordCount = 0
  let reviewPoints = 0
  let agreedCount = 0

  for (const task of reviewed) {
    const review = task.completionReview!
    for (const key of REFLECTION_SCORE_KEYS) {
      const n = clampReflectionScore(review[key])
      if (n === undefined) continue
      const bucket = scoreBuckets.get(key) ?? []
      bucket.push(n)
      scoreBuckets.set(key, bucket)
    }
    const expected = clampReflectionScore(review.expectedDifficulty)
    const actual = clampReflectionScore(review.actualDifficulty)
    if (expected !== undefined && actual !== undefined) {
      difficultyPairs.push({
        taskId: task.id,
        title: args.titleOf(task),
        expected,
        actual,
      })
    }
    if (review.reviewPoints != null) {
      agreedCount += 1
      wordCount += review.reviewWordCount ?? reviewWordCount(review.notes)
      reviewPoints += review.reviewPoints
    }
  }

  const scoreMeans: ScoreMean[] = REFLECTION_SCALES.flatMap((scale) => {
    const values = scoreBuckets.get(scale.key) ?? []
    const avg = mean(values)
    if (avg === undefined) return []
    return [{ key: scale.key, label: scale.label, n: values.length, mean: avg }]
  })

  const expectedMean = mean(difficultyPairs.map((pair) => pair.expected))
  const actualMean = mean(difficultyPairs.map((pair) => pair.actual))

  return {
    doneCount: done.length,
    reviewedCount: reviewed.length,
    exactMinutes,
    exactCount,
    estimatedMinutes,
    estimatedCount,
    unknownCount,
    unspecifiedCount,
    paintedMinutes,
    startExact,
    startEstimated,
    startUnknown,
    startUnspecified,
    wordCount,
    reviewPoints,
    agreedCount,
    scoreMeans,
    difficultyPairs,
    ...(expectedMean !== undefined && actualMean !== undefined ? { difficultyGap: actualMean - expectedMean } : {}),
    goals: textureFor(args.goals, done, (task) => task.contributesToGoalIds),
    objectives: textureFor(args.objectives, done, (task) => task.contributesToObjectiveIds),
  }
}
