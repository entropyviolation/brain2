/**
 * lib/ingest/apply-nfc.ts — `nfc:{id}` from a phone tap
 *
 * Looks up the tag, ignores a second read inside 20 seconds, paints a Tracking
 * instant (intake or a log line), and an optional block ending at the scan.
 * A bound daily habit is marked done or gains 1. The BIM line stays `nfc:…`,
 * so a keyword source does not count the same tap again.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyDiscreteLog, applyIntake } from "./apply-discrete-event"
import { writeHabit } from "./apply-habit"
import { useIngestStore } from "./ingest-store"
import { nfcSlug, nfcTapIsDebounced, type NfcTag } from "./nfc-tag"
import { minutesPastMidnight } from "./times"
import type { ApplyResult } from "./types"

const ACTIVITY = "activity"

export function applyNfcScan(payload: string, now = new Date()): ApplyResult {
  const id = nfcSlug(payload)
  if (!id) {
    return {
      status: "error",
      kind: "nfc",
      reply: "Which tag? Example: nfc:vitamin-d",
    }
  }
  const tag = useIngestStore.getState().nfcTags.find((row) => row.id === id)
  if (!tag) {
    return {
      status: "error",
      kind: "nfc",
      reply: `No NFC tag “${id}”. Add it in Settings → Message ingest.`,
    }
  }
  if (nfcTapIsDebounced(tag.lastAt, now)) {
    return {
      status: "ignored",
      kind: "nfc",
      reply: `Already logged ${tag.name}.`,
      summary: `NFC double-read ${tag.name}`,
    }
  }

  const goingOut = tag.kind === "toggle" && tag.lastSide !== "out"
  const title =
    tag.kind === "toggle" ? (goingOut ? tag.leftTitle : tag.backTitle) : tag.title
  const painted = tag.intakeClass
    ? applyIntake(title, now, tag.intakeClass)
    : applyDiscreteLog(title, now, { keywordQuery: false })
  if (painted.status !== "ok") {
    return { ...painted, kind: "nfc" }
  }

  const stamp = `nfc:${tag.id}:${now.toISOString()}`
  stampGenerated(painted.itemIds, stamp)
  const spanId = tag.kind === "instant" && tag.minutes ? paintDuration(title, tag.minutes, now, tag.id) : undefined
  const habitNote = tag.habitId ? creditHabit(tag.habitId, tag.habitCredit, now) : null

  useIngestStore.getState().touchNfcTag(tag.id, {
    lastAt: now.toISOString(),
    ...(tag.kind === "toggle" ? { lastSide: goingOut ? "out" : "in" } : {}),
  })

  const reply = [`Logged ${title}`, habitNote, tag.minutes ? `${tag.minutes} min` : null]
    .filter((part): part is string => Boolean(part))
    .join(" · ")
  const itemIds = [...(painted.itemIds ?? []), ...(spanId ? [spanId] : [])]
  return {
    status: "ok",
    kind: "nfc",
    reply,
    summary: `NFC → ${title}`,
    itemIds: itemIds.length ? itemIds : undefined,
  }
}

function stampGenerated(ids: string[] | undefined, stamp: string): void {
  const store = useTimeTrackingStore.getState()
  for (const id of ids ?? []) {
    store.updateEntry(id, { generatedBy: { kind: "text", id: stamp } })
  }
}

function creditHabit(habitId: string, credit: NfcTag["habitCredit"], now: Date): string {
  const habit = useHabitsStore.getState().tasks.find((row) => row.id === habitId)
  if (!habit) return "That habit disappeared."
  if (habit.frequency && habit.frequency !== "daily") {
    return "That habit is not daily, so today’s cell was left alone."
  }
  if (credit === "add" && habit.type !== TaskType.BOOLEAN) {
    const dateKey = formatLocalDateKey(now)
    const previous = useHabitsStore.getState().weeklyData[dateKey]?.[habit.id]
    const goal = habit.goal ?? previous?.goal ?? 0
    const value = (previous?.value ?? 0) + 1
    useHabitsStore.getState().updateCompletion(habit.id, now, {
      value,
      goal,
      completed: goal > 0 ? value >= goal : true,
    })
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return `${habit.name}: +1 (total ${value}${unit})`
  }
  const result = writeHabit(habit, "", now)
  return "reply" in result && result.reply ? result.reply : habit.name
}

function paintDuration(title: string, minutes: number, end: Date, tagId: string): string | undefined {
  const penId = ensureActivityPen(title)
  if (!penId) return undefined
  const start = new Date(end.getTime() - minutes * 60_000)
  const date = formatLocalDateKey(start)
  const startMin = minutesPastMidnight(start)
  const endMin = minutesPastMidnight(end)
  const stamp = `nfc:${tagId}:span:${end.toISOString()}`
  const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
  useTimeTrackingStore.getState().paintMinutes(
    date,
    ACTIVITY,
    startMin,
    endMin,
    penId,
    undefined,
    stamp,
    "estimated",
    {
      title,
      notes: `NFC tag · ${title}`,
      clockCertainty: "estimated",
    },
  )
  const created = useTimeTrackingStore
    .getState()
    .entries.filter((entry) => !before.has(entry.id) && entry.penId === penId && entry.kind !== "instant")
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (!created) return undefined
  useTimeTrackingStore.getState().updateEntry(created.id, {
    generatedBy: { kind: "text", id: stamp },
    title,
    notes: `NFC tag · ${title}`,
    precision: "estimated",
    clockCertainty: "estimated",
  })
  return created.id
}

function ensureActivityPen(name: string): string | null {
  const store = useTimeTrackingStore.getState()
  const scope =
    store.scopes.find((row) => row.id === ACTIVITY) ??
    store.scopes.find((row) => row.name.trim().toLowerCase() === "activity") ??
    store.scopes[0]
  if (!scope) return null
  const existing = scope.pens.find((pen) => pen.name.trim().toLowerCase() === name.trim().toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name: name.trim(),
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length] ?? PEN_PALETTE[0],
  })
}
