/**
 * lib/mood-reading.ts — A mood stretch's three-part reading
 *
 * The pen is any name and paints the grid. `moodReading` is the report on
 * that stretch: the body, the story the hour is swimming in, and the heaps.
 * Marks are optional integers 1–10. A blank is omitted, never stored as zero.
 * The sentence is derived for the card and is not written into notes.
 */

/** Same palette and hash as `stablePenColor`, so a name lands on one swatch. */
const MOOD_PEN_PALETTE = [
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#8b5cf6",
  "#64748b",
] as const

export const MOOD_RANK_KEYS = [
  "energy",
  "tension",
  "loop",
  "sociability",
  "initiative",
  "cast",
  "enjoyment",
  "grasping",
  "knowing",
] as const

export type MoodRankKey = (typeof MOOD_RANK_KEYS)[number]

/** Leanings of the hour — the water plate. */
export const WATER_RANK_KEYS = ["cast", "sociability", "initiative"] as const

/** Means on the marks plate. Water ranks stay with the water. */
export const MARKS_PLATE_KEYS = ["energy", "tension", "loop", "enjoyment", "grasping", "knowing"] as const

export const MOOD_TONES = ["pleasant", "unpleasant", "neutral"] as const
export type MoodTone = (typeof MOOD_TONES)[number]

const TEXT_KEYS = ["word", "sensation", "vibe", "narrative", "reframe", "about"] as const

export const RANK_LABEL: Record<MoodRankKey, string> = {
  energy: "Energy",
  tension: "Tension",
  loop: "Loop",
  sociability: "Sociability",
  initiative: "Initiative",
  cast: "Cast",
  enjoyment: "Enjoyment",
  grasping: "Grasping",
  knowing: "Knowing",
}

export interface MoodReading {
  /** Spelling on this stretch. The pen is what the grid paints. */
  word?: string
  /** Body, under every name. */
  sensation?: string
  vibe?: string
  /** Shorthand the mind is offering. */
  narrative?: string
  /** Lighter map, stored only when accepted. */
  reframe?: string
  /** What the mind is doing with the state. */
  about?: string
  tone?: MoodTone
  energy?: number
  tension?: number
  loop?: number
  sociability?: number
  initiative?: number
  cast?: number
  enjoyment?: number
  grasping?: number
  knowing?: number
}

export interface MoodStretchSource {
  id: string
  date: string
  startMin: number
  endMin: number
  moodReading?: MoodReading
}

/** Unset unless the value is an integer from 1 to 10. A blank is not zero. */
export function clampMoodRank(value: number | undefined | null): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) return undefined
  return value
}

/** Grouping key only. The stored spelling stays as written. */
export function normalizeWord(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Stable swatch for a name. Case and extra space do not change the color. */
export function moodPenColor(name: string): string {
  const key = normalizeWord(name) || name
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return MOOD_PEN_PALETTE[hash % MOOD_PEN_PALETTE.length]
}

export function toneLabel(tone: MoodTone): string {
  return tone === "neutral" ? "neither" : tone
}

/** Drop blanks, out-of-range marks, and unknown tones. Undefined when nothing remains. */
export function compactMoodReading(raw: Partial<MoodReading> | undefined | null): MoodReading | undefined {
  if (!raw) return undefined
  const next: MoodReading = {}
  for (const key of TEXT_KEYS) {
    const value = typeof raw[key] === "string" ? raw[key].trim() : ""
    if (value) next[key] = value
  }
  if (raw.tone === "pleasant" || raw.tone === "unpleasant" || raw.tone === "neutral") next.tone = raw.tone
  for (const key of MOOD_RANK_KEYS) {
    const n = clampMoodRank(raw[key])
    if (n !== undefined) next[key] = n
  }
  return Object.keys(next).length ? next : undefined
}

export function sameMoodReading(a: MoodReading | undefined, b: MoodReading | undefined): boolean {
  const left = compactMoodReading(a)
  const right = compactMoodReading(b)
  if (!left && !right) return true
  if (!left || !right) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

export interface SetMark {
  key: MoodRankKey
  label: string
  value: number
}

export function setMarks(reading: MoodReading | undefined, keys: readonly MoodRankKey[]): SetMark[] {
  const packed = compactMoodReading(reading)
  if (!packed) return []
  const marks: SetMark[] = []
  for (const key of keys) {
    const value = packed[key]
    if (value === undefined) continue
    marks.push({ key, label: RANK_LABEL[key], value })
  }
  return marks
}

/**
 * Quotes the name, dates the stretch, lists only marks that were set,
 * and ends with etc. when anything was filled. Empty when nothing was.
 */
export function moodSentence(
  reading: MoodReading | undefined,
  when: { date: string; startLabel: string; endLabel: string },
): string {
  const packed = compactMoodReading(reading)
  if (!packed) return ""
  let sentence = `On ${when.date}, ${when.startLabel}–${when.endLabel}`
  if (packed.word) sentence += `, the word "${packed.word}"`
  const marks = setMarks(packed, MOOD_RANK_KEYS)
  sentence += marks.length ? `. ${marks.map((mark) => `${mark.label} ${mark.value}`).join(", ")}` : ""
  return `${sentence}. etc.`
}

/** Bare word after an identity ("I am …" / "I'm …"). Null when it is not one. */
export function identityRewrite(text: string): string | null {
  const match = text.match(/\b(?:i'm|i am)\s+(.+)$/i)
  if (!match) return null
  const bare = match[1].replace(/[.!?"']+$/g, "").trim()
  return bare || null
}

const FOREVER_WORDS = ["always", "never", "everything", "nothing"] as const
type ForeverWord = (typeof FOREVER_WORDS)[number]

function foreverWord(text: string): ForeverWord | null {
  for (const word of FOREVER_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return word
  }
  return null
}

function aboutThisStretch(text: string, date: string): boolean {
  if (/\bthis stretch\b/i.test(text)) return true
  return Boolean(date) && text.includes(date)
}

function storyClause(identity: boolean, forever: ForeverWord | null): string | null {
  if (identity || forever === "everything") return "it covers everything"
  if (forever === "nothing") return "it is nothing"
  if (forever === "always") return "it is always so"
  if (forever === "never") return "it never is"
  return null
}

/**
 * One sentence that is still true and a degree lighter, or null.
 * Offered only for an identity or a forever. Refused when the shorthand
 * already dates this stretch. The body is used as written. Enjoyment is untouched.
 */
export function lighterMap(
  reading: Pick<MoodReading, "narrative" | "sensation" | "word"> | undefined,
  date: string,
): string | null {
  const narrative = reading?.narrative?.trim() ?? ""
  if (!narrative || aboutThisStretch(narrative, date)) return null
  const identity = /\b(?:i'm|i am)\b/i.test(narrative)
  const forever = foreverWord(narrative)
  const clause = storyClause(identity, forever)
  if (!clause) return null
  const sensation = reading?.sensation?.trim()
  const word = reading?.word?.trim() || identityRewrite(narrative) || ""
  const parts: string[] = []
  if (sensation) parts.push(sensation)
  if (word) parts.push(`the word "${word}"`)
  parts.push(`a story that ${clause}`)
  if (parts.length === 1) return `This stretch, ${date}: ${parts[0]}.`
  const head = parts.slice(0, -1).join(", ")
  const last = parts[parts.length - 1]!
  const joined = word ? `${head.replace(/"$/, ",\"")} and ${last}` : `${head}, and ${last}`
  return `This stretch, ${date}: ${joined}.`
}

export interface SameWordRow {
  id: string
  date: string
  startMin: number
  endMin: number
  word: string
  sensation?: string
  tone?: MoodTone
  vibe?: string
  marks: SetMark[]
}

export interface SameWordGroup {
  key: string
  /** Newest spelling in the group. Each row still shows its own word. */
  label: string
  rows: SameWordRow[]
}

/** Stretches that share a normalized word. A painted color with no word stays out. */
export function groupSameWord(entries: MoodStretchSource[]): SameWordGroup[] {
  const groups = new Map<string, SameWordRow[]>()
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  for (const entry of ordered) {
    const packed = compactMoodReading(entry.moodReading)
    const word = packed?.word
    if (!word) continue
    const key = normalizeWord(word)
    if (!key) continue
    const row: SameWordRow = {
      id: entry.id,
      date: entry.date,
      startMin: entry.startMin,
      endMin: entry.endMin,
      word,
      sensation: packed?.sensation,
      tone: packed?.tone,
      vibe: packed?.vibe,
      marks: setMarks(packed, MOOD_RANK_KEYS),
    }
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, rows]) => ({ key, label: rows[rows.length - 1]?.word ?? key, rows }))
}

export const SAME_WORD_NOTE = "These share a word. They are not the same stretch."

export interface RankMean {
  key: MoodRankKey
  label: string
  mean: number
  n: number
}

export interface VibePhrase {
  vibe: string
  dates: string[]
}

export interface WaterSummary {
  phrases: VibePhrase[]
  means: RankMean[]
}

export interface ToneCount {
  tone: MoodTone
  label: string
  n: number
}

export interface MarksSummary {
  means: RankMean[]
  tones: ToneCount[]
  graspingWithAbout: RankMean | null
  graspingWithoutAbout: RankMean | null
}

function meanOf(key: MoodRankKey, values: number[]): RankMean | null {
  if (!values.length) return null
  const raw = values.reduce((sum, n) => sum + n, 0) / values.length
  return { key, label: RANK_LABEL[key], mean: Math.round(raw * 10) / 10, n: values.length }
}

function meansFor(entries: MoodReading[], keys: readonly MoodRankKey[]): RankMean[] {
  const means: RankMean[] = []
  for (const key of keys) {
    const values: number[] = []
    for (const reading of entries) {
      const n = reading[key]
      if (n !== undefined) values.push(n)
    }
    const mean = meanOf(key, values)
    if (mean) means.push(mean)
  }
  return means
}

function packedReadings(entries: MoodStretchSource[]): MoodReading[] {
  const readings: MoodReading[] = []
  for (const entry of entries) {
    const packed = compactMoodReading(entry.moodReading)
    if (packed) readings.push(packed)
  }
  return readings
}

/** Distinct vibe phrases with their dates, and the hour's leanings with n. */
export function waterOf(entries: MoodStretchSource[]): WaterSummary {
  const readings = packedReadings(entries)
  const phrases = new Map<string, VibePhrase>()
  for (const entry of entries) {
    const packed = compactMoodReading(entry.moodReading)
    const vibe = packed?.vibe
    if (!vibe) continue
    const key = normalizeWord(vibe)
    const existing = phrases.get(key)
    if (!existing) phrases.set(key, { vibe, dates: [entry.date] })
    else if (!existing.dates.includes(entry.date)) existing.dates.push(entry.date)
  }
  const listed = [...phrases.values()].sort((a, b) => a.vibe.localeCompare(b.vibe))
  for (const phrase of listed) phrase.dates.sort()
  return { phrases: listed, means: meansFor(readings, WATER_RANK_KEYS) }
}

/** Means, tone counts that occurred, and grasping with or without About that. */
export function marksOf(entries: MoodStretchSource[]): MarksSummary {
  const readings = packedReadings(entries)
  const toneCounts = new Map<MoodTone, number>()
  for (const reading of readings) {
    if (!reading.tone) continue
    toneCounts.set(reading.tone, (toneCounts.get(reading.tone) ?? 0) + 1)
  }
  const tones: ToneCount[] = MOOD_TONES.flatMap((tone) => {
    const n = toneCounts.get(tone) ?? 0
    return n > 0 ? [{ tone, label: toneLabel(tone), n }] : []
  })
  const withAbout: number[] = []
  const withoutAbout: number[] = []
  for (const reading of readings) {
    if (reading.grasping === undefined) continue
    if (reading.about) withAbout.push(reading.grasping)
    else withoutAbout.push(reading.grasping)
  }
  return {
    means: meansFor(readings, MARKS_PLATE_KEYS),
    tones,
    graspingWithAbout: meanOf("grasping", withAbout),
    graspingWithoutAbout: meanOf("grasping", withoutAbout),
  }
}
