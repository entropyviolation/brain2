/**
 * components/Home/Tracking/entry-dialog.tsx — Edit one tracked block
 *
 * A painted block is an event, not a color: it has a start, an end, a primary
 * pen plus optional secondaries, a display name, any number of variants, and
 * notes. A Mood block also carries This stretch: any name, then the body,
 * the water, and the heaps. Activity blocks do not. **show in timegrid**
 * leaves this editor and scrolls that block into the Time Grid.
 * This is the one editor
 * for all of that, opened from the Time Grid,
 * the Activity Log, or the Day Log, so the views can never drift apart on what
 * a block means. It must open on the click — sleep/pen-action sync stays on
 * the views, not this dialog. It is a centered popup (`entry-dialog.css`).
 * Click outside, ×, or Escape runs the unsaved-changes guard, so a dirty
 * draft is not thrown away. The Pen section is one multi-select: chips for the
 * pens on the block (★ primary, × remove) and one search box that adds a pen
 * as an extra or as primary, or creates it. Company blocks can **Name this
 * group**. Double-click a pen color to open that pen's settings.
 *
 * Changing the times re-lays the block over the day and clears whatever it lands
 * on, exactly as painting would — so the grid can never end up double-booked.
 * Start/End default to the block's calendar day; one **Date** key reveals both
 * dates. A lock on start, end, or duration decides which of the other two
 * moves. Duration can be marked estimated on its own.
 *
 * A block derived from the sleep log is edited here like any other, and the edit
 * travels back: `lib/sleep-sync.ts` rereads the night from its blocks, so moving
 * this morning's block to 8 AM is simply how you say you got up at 8.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Lock, LockOpen, Scissors, Trash2 } from "lucide-react"
import { runAsAction } from "@/lib/action-history"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForSpan,
  entryDisplayName,
  applySpanEdit,
  calendarDaysBetween,
  formatDuration,
  parseDurationInput,
  readSpanClock,
  writeSpanClock,
  isInstant,
  isSleepBlock,
  minutesToLabel,
  minutesToTimeString,
  spanMinutes,
  timeStringToMinutes,
  type SpanLock,
} from "@/lib/time-entries"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"
import { CompanionSection } from "@/components/Home/Tracking/companion-section"
import {
  entryFieldValue,
  fieldInputText,
  fieldValuesPatch,
  fieldsForBlock,
  parseFieldInput,
  type FieldValue,
} from "@/lib/pen-fields"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { BlockPenSection } from "@/components/Home/Tracking/block-pen-section"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { CatalogTagChip } from "@/components/Home/Tracking/catalog-tag-chip"
import { TAG_OPEN_TITLE } from "@/components/Home/Tracking/open-tag-settings"
import { MoodStretchCard } from "@/components/Home/Tracking/mood-stretch-card"
import { compactMoodReading, moodPenColor, normalizeWord, type MoodReading } from "@/lib/mood-reading"
import {
  addCompletedNowObjective,
  addNowObjective,
  attachNowObjective,
  editNowObjectiveText,
  removeNowObjective,
  toggleNowObjectiveComplete,
  type NowObjective,
  setNowObjectiveCompletes,
  tieNowObjectiveToStep,
} from "@/lib/now-objective"
import {
  attachChoicesForPen,
  createTaskForObjective,
  homeForObjective,
  toParked,
} from "@/lib/unfinished-objectives"
import { useUnfinishedObjectivesStore } from "@/lib/unfinished-objectives-store"
import { useTaskStore } from "@/lib/task-store"
import { openStepChoices } from "@/lib/task-clock-log"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { isSpendEntry, parseSpendAmount, spendAmountInput, spendSourceOptions } from "@/lib/spend"
import { parseLocalDate } from "@/lib/date-utils"
import { OptionalClock } from "@/components/Home/Tracking/log-activity-dialog"
import { sleepClockEstimateBasis } from "@/lib/estimated-values"
import "./tracking-chrome.css"
import "./entry-dialog.css"
import "./tracking-settings.css"
import { CertaintyToggle, DriveCommuteSection, EdgeAnchor, NextBlockSection, TransitSection } from "@/components/Home/Tracking/entry-edges"
import { showBlockInTimegrid } from "@/components/Home/Tracking/show-in-timegrid"
import { certaintyPatch, edgeOf, surer, refitTransit, settleAnchors, worseOf, type EdgeState } from "@/lib/entry-edges"
import { transitPenOf } from "@/lib/transit-suggest"
import { travelMinutes } from "@/lib/transit-time"
import { isLocationScope, pinOf } from "@/lib/transit-suggest"

interface EntryDialogProps {
  entry: TimeEntry
  onClose: () => void
  /** Extra DialogContent classes (e.g. Analytics `an-popup` for crisp titles). */
  contentClassName?: string
  /** Open another block in this same dialog (the "Next timeblock" link). */
  onOpenEntry?: (entry: TimeEntry) => void
}

/** "the night ending Thu, Sep 17" — sleep is keyed by the morning it ended. */
function blockFloor(entry: Pick<TimeEntry, "date" | "startMin">): Date {
  const [year, month, day] = entry.date.split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1, Math.floor(entry.startMin / 60), entry.startMin % 60, 0, 0)
}

function SpanLockButton({
  edge,
  locked,
  onLock,
}: {
  edge: SpanLock
  locked: boolean
  onLock: () => void
}) {
  const name = edge === "start" ? "Start" : edge === "end" ? "End" : "Duration"
  return (
    <button
      type="button"
      className="trk-span-lock"
      data-no95=""
      aria-pressed={locked}
      aria-label={locked ? `${name} locked` : `Lock ${name}`}
      title={locked ? `${name} stays put when the others change` : `Lock ${name}. The other two follow each other.`}
      onClick={onLock}
    >
      {locked ? <Lock size={12} strokeWidth={2.25} aria-hidden /> : <LockOpen size={12} strokeWidth={2.25} aria-hidden />}
    </button>
  )
}

function initialSpanLock(entry: TimeEntry): SpanLock {
  if (entry.spanLock === "start" || entry.spanLock === "end" || entry.spanLock === "duration") return entry.spanLock
  const endLinked = Boolean(entry.endEventId || entry.endJoinId)
  const startLinked = Boolean(entry.startEventId || entry.startJoinId)
  if (endLinked && !startLinked) return "end"
  return "start"
}

function nightLabel(date: string): string {
  const parsed = parseLocalDate(date)
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : date
}

export function EntryDialog(props: EntryDialogProps) {
  // A new block must remount the draft. The same instance would keep the
  // previous block's fields when the grid click only swaps `entry`.
  // "Next timeblock" jumps to that block in place; closing returns to the grid.
  const [jumpId, setJumpId] = useState<string | null>(null)
  const jumped = useTimeTrackingStore((s) => (jumpId ? s.entries.find((e) => e.id === jumpId) : undefined))
  const entry = jumped ?? props.entry
  return <EntryDialogForm key={entry.id} {...props} entry={entry} onOpenEntry={(e) => setJumpId(e.id)} />
}

function EntryDialogForm({ entry, onClose, contentClassName, onOpenEntry }: EntryDialogProps) {
  // Sleep / pen-action sync lives on the Tracking views, not on this click path.
  // Deriving every night here made the dialog lag ~1s and minted new Sleep ids.
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const allEntries = useTimeTrackingStore((s) => s.entries)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const mirrorDetails = useTimeTrackingStore((s) => s.mirrorDetails)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const addPenGroup = useTimeTrackingStore((s) => s.addPenGroup)
  const addCrossViewDetail = useTimeTrackingStore((s) => s.addCrossViewDetail)
  const addTag = useTimeTrackingStore((s) => s.addTag)
  const setPenTags = useTimeTrackingStore((s) => s.setPenTags)
  const penSort = useTimeTrackingStore((s) => s.penSort)

  const chain = useMemo(
    () => (entry.spanId ? entriesForSpan(allEntries, entry.spanId) : [entry]),
    [allEntries, entry],
  )
  const origin = chain[0] ?? entry
  const last = chain[chain.length - 1] ?? entry
  const crossesMidnight = chain.length > 1
  const durationMin = entry.spanId ? spanMinutes(allEntries, entry.spanId) : last.endMin - origin.startMin

  const scope = scopes.find((s) => s.id === entry.scopeId)
  const [penId, setPenId] = useState(entry.penId)
  const [secondaryPenIds, setSecondaryPenIds] = useState<string[]>(entry.secondaryPenIds ?? [])
  const sleep = isSleepBlock(entry)
  const [from, setFrom] = useState(minutesToTimeString(origin.startMin))
  const [to, setTo] = useState(minutesToTimeString(last.endMin % 1440))
  const [fromDate, setFromDate] = useState(origin.date)
  const [toDate, setToDate] = useState(last.date)
  const [showDates, setShowDates] = useState(origin.date !== last.date)
  const [spanLock, setSpanLock] = useState<SpanLock>(initialSpanLock(entry))
  const [durationEstimated, setDurationEstimated] = useState(entry.durationEstimated === true)
  const [splitAt, setSplitAt] = useState(
    minutesToTimeString(Math.round((entry.startMin + entry.endMin) / 2)),
  )
  const [variantIds, setVariantIds] = useState<string[]>(entry.variantIds ?? [])
  // The pen `variantIds` were ticked for. Naming a group switches both at once.
  const [variantsFor, setVariantsFor] = useState(entry.penId)
  const [tagIds, setTagIds] = useState<string[]>(entry.tagIds ?? [])
  const [newTag, setNewTag] = useState("")
  const [title, setTitle] = useState(entry.title ?? "")
  // Detail fields come from the block's pens and tags (`lib/pen-fields.ts`); drafts by field id.
  const [fieldTexts, setFieldTexts] = useState<Record<string, string>>(() => {
    const texts: Record<string, string> = {}
    for (const row of fieldsForBlock([], [], entry)) texts[row.field.id] = fieldInputText(entryFieldValue(entry, row.field.id))
    return texts
  })
  const [notes, setNotes] = useState(entry.notes ?? "")
  const [nowObjectives, setNowObjectives] = useState<NowObjective[] | undefined>(entry.nowObjectives)
  const tasks = useTaskStore((s) => s.tasks)
  const attachChoices = useMemo(
    () => attachChoicesForPen(tasks, entry.penId, entry.taskId),
    [tasks, entry.penId, entry.taskId],
  )
  const [reading, setReading] = useState<MoodReading>(entry.moodReading ?? {})
  const [assumed, setAssumed] = useState(entry.precision === "estimated")
  // Per-end certainty. An older block that only has a block-wide value reads as both ends.
  const [startC, setStartC] = useState(edgeOf(entry, "start").c)
  const [endC, setEndC] = useState(edgeOf(entry, "end").c)
  // Re-clicking the lit button clears the mark; a cleared edge saves as the default, exact.
  const [startOff, setStartOff] = useState(false)
  const [endOff, setEndOff] = useState(false)
  const [endEventId, setEndEventId] = useState(entry.endEventId)
  const [startEventId, setStartEventId] = useState(entry.startEventId)
  const [startJoinId, setStartJoinId] = useState(entry.startJoinId)
  const [endJoinId, setEndJoinId] = useState(entry.endJoinId)
  const [alsoOthers, setAlsoOthers] = useState(true)
  const spendEntry = isSpendEntry(entry)
  const [amountText, setAmountText] = useState(spendAmountInput(entry.spendAmount))
  const [spentOn, setSpentOn] = useState(entry.spendOn ?? (spendEntry ? (entry.title ?? "") : ""))
  const [spentSource, setSpentSource] = useState(entry.spendSource ?? "")
  const [spendError, setSpendError] = useState("")

  // The store may replace this block (a split, or a neighbour merging into it);
  // follow whatever it becomes rather than editing a stale copy.
  useEffect(() => {
    setVariantIds(entry.variantIds ?? [])
  }, [entry.variantIds])

  useEffect(() => {
    setTagIds(entry.tagIds ?? [])
  }, [entry.tagIds])

  useEffect(() => {
    setNowObjectives(entry.nowObjectives)
  }, [entry.nowObjectives])

  useEffect(() => {
    setSecondaryPenIds(entry.secondaryPenIds ?? [])
  }, [entry.secondaryPenIds])

  const pen = scope?.pens.find((p) => p.id === penId)
  const assigned = assignedPenIds({ penId, secondaryPenIds })
  const assignedPens = (scope?.pens ?? []).filter((p) => assigned.includes(p.id))
  const penTagIds = [...new Set(assignedPens.flatMap((p) => p.tags ?? []))]
  const penTags = tags.filter((t) => penTagIds.includes(t.id))
  // Switching pens mid-edit invalidates the variants, which belong to the old pen.
  const liveVariantIds = penId === variantsFor ? variantIds : []

  const extraTagIds = tagIds.filter((id) => !penTagIds.includes(id))
  const extraTagNames = tags
    .filter((t) => extraTagIds.includes(t.id))
    .map((t) => t.name)
    .join(", ")

  const displayName = entryDisplayName({ title }, pen?.name)
  const blockFields = fieldsForBlock(assignedPens, tags, { ...entry, tagIds })
  const fieldsPatch = () => {
    const values: Record<string, FieldValue | undefined> = {}
    for (const row of blockFields) values[row.field.id] = parseFieldInput(row.field, fieldTexts[row.field.id] ?? "")
    return fieldValuesPatch(values)
  }

  const createAndAttachTag = () => {
    const name = newTag.trim()
    if (!name) return
    const id = addTag(name)
    if (id) setTagIds((current) => (current.includes(id) ? current : [...current, id]))
    setNewTag("")
  }

  const isMood = entry.scopeId === "mood"

  const resolvePenId = () => {
    if (!isMood || !scope) return penId
    const word = compactMoodReading(reading)?.word
    if (!word) return penId
    const key = normalizeWord(word)
    const existing = scope.pens.find((item) => normalizeWord(item.name) === key)
    if (existing) return existing.id
    const created = addPen(scope.id, { name: word, color: moodPenColor(word) })
    return created || penId
  }

  const save = () => runAsAction("edit block", saveNow)
  const saveNow = () => {
    const startMin = timeStringToMinutes(from)
    if (startMin === null) return
    if (!isInstant(entry) && timeStringToMinutes(to) === null) return
    const savedPenId = resolvePenId()
    const moodPatch = isMood ? { moodReading: compactMoodReading(reading) } : {}
    let spendPatch: Partial<Omit<TimeEntry, "id">> = {}
    if (spendEntry) {
      const amount = parseSpendAmount(amountText)
      const on = spentOn.trim()
      const source = spentSource.trim()
      if (amount == null || !on || !source) {
        setSpendError(
          amount == null
            ? "Amount is dollars and cents, such as 4.50."
            : "Amount, what it was spent on, and the source each need a value.",
        )
        return
      }
      setSpendError("")
      spendPatch = {
        spendAmount: amount,
        spendOn: on,
        spendSource: source,
        eventKind: "spend",
        title: on,
      }
    }
    if (isInstant(entry)) {
      updateEntry(origin.id, {
        date: fromDate,
        penId: savedPenId,
        secondaryPenIds,
        startMin,
        endMin: startMin,
        kind: "instant",
        variantIds: liveVariantIds,
        tagIds: tagIds.filter((id) => !penTagIds.includes(id)),
        title: title.trim() || undefined,
        ...fieldsPatch(),
        notes: notes.trim() || undefined,
        nowObjectives,
        ...certaintyPatch(startC, startC),
        precision: assumed || startC !== "exact" ? "estimated" : undefined,
        ...moodPatch,
        ...spendPatch,
      })
      settle()
      onClose()
      return
    }
    const parsedEnd = timeStringToMinutes(to)
    if (parsedEnd === null) return
    // After Calculate the store holds the priced length; a different length is the user's own.
    const liveOrigin = useTimeTrackingStore.getState().entries.find((e) => e.id === origin.id) ?? origin
    const sameDay = toDate === fromDate
    const endMin = sameDay && parsedEnd === 0 ? 1440 : parsedEnd
    const wrapEndDate = sameDay ? undefined : toDate
    updateEntry(
      origin.id,
      {
        date: fromDate,
        penId: savedPenId,
        secondaryPenIds,
        startMin,
        endMin,
        variantIds: liveVariantIds,
        tagIds: tagIds.filter((id) => !penTagIds.includes(id)),
        title: title.trim() || undefined,
        ...fieldsPatch(),
        notes: notes.trim() || undefined,
        nowObjectives,
        ...certaintyPatch(startC, endC),
        precision: assumed || durationEstimated || worseOf(startC, endC) !== "exact" ? "estimated" : undefined,
        spanLock,
        durationEstimated: durationEstimated || undefined,
        startEventId,
        endEventId,
        startJoinId,
        endJoinId,
        ...(origin.transitMin != null || origin.transitFrom || origin.penId === (scope && transitPenOf(scope)?.id)
          ? endMin - startMin !== (liveOrigin.transitMin ?? liveOrigin.endMin - liveOrigin.startMin)
            ? { transitManual: true, transitMin: endMin - startMin }
            : {}
          : {}),
        ...moodPatch,
        ...spendPatch,
      },
      wrapEndDate,
    )
    afterEndsSaved(endMin)
    // Cross-view details and the views they name agree over the saved window.
    if (!wrapEndDate) mirrorDetails({ date: fromDate, scopeId: entry.scopeId, startMin, endMin })
    onClose()
  }

  /** Anchored events and joined blocks agree with the saved ends; other-view blocks sharing the old end follow; transit refits. */
  const afterEndsSaved = (endMin: number) => {
    const live = useTimeTrackingStore.getState().entries
    const moved = { id: origin.id, startMin: timeStringToMinutes(from) ?? origin.startMin, endMin }
    // A seam is stored on both blocks; unlinking here clears the other side too.
    for (const [prev, next, back] of [
      [origin.endJoinId, endJoinId, "startJoinId"],
      [origin.startJoinId, startJoinId, "endJoinId"],
    ] as const) {
      if (prev && prev !== next && live.find((e) => e.id === prev)?.[back] === origin.id) updateEntry(prev, { [back]: undefined })
      if (next) updateEntry(next, { [back]: origin.id })
    }
    if (endEventId && alsoOthers) {
      for (const o of overlapping) updateEntry(o.id, { endEventId, endMin })
    }
    settle()
    const patches = refitTransit(useTimeTrackingStore.getState().entries, moved)
    for (const [id, patch] of Object.entries(patches)) updateEntry(id, patch)
    void repriceTransit(moved)
  }

  const settle = () => {
    for (const [id, patch] of Object.entries(settleAnchors(useTimeTrackingStore.getState().entries, origin.id))) updateEntry(id, patch)
  }

  /** Anchor an edge to an event or a neighbouring block; the surer side's time and certainty win. */
  const linkEdge = (edge: "start" | "end", kind: "event" | "join", partner: TimeEntry) => {
    const theirs = edgeOf(partner, kind === "event" || edge === "end" ? "start" : "end")
    const mine: EdgeState = { min: (timeStringToMinutes(edge === "start" ? from : to) ?? 0) || (edge === "end" ? 1440 : 0), c: edge === "start" ? startC : endC }
    if (mine.c === theirs.c && mine.min === theirs.min) {
      /* already agrees */
    } else if (surer(theirs.c, mine.c) || (mine.min === theirs.min && theirs.c !== mine.c)) takeEdge(edge, theirs)
    if (edge === "start") {
      setStartEventId(kind === "event" ? partner.id : undefined)
      setStartJoinId(kind === "join" ? partner.id : undefined)
    } else {
      setEndEventId(kind === "event" ? partner.id : undefined)
      setEndJoinId(kind === "join" ? partner.id : undefined)
    }
  }
  const unlinkEdge = (edge: "start" | "end") => {
    if (edge === "start") {
      setStartEventId(undefined)
      setStartJoinId(undefined)
    } else {
      setEndEventId(undefined)
      setEndJoinId(undefined)
    }
  }
  const takeEdge = (edge: "start" | "end", to: EdgeState) => {
    if (edge === "start") {
      setFrom(minutesToTimeString(to.min % 1440))
      setStartC(to.c)
      setStartOff(false)
    } else {
      setTo(minutesToTimeString(to.min % 1440))
      setEndC(to.c)
      setEndOff(false)
    }
  }

  /**
   * A Location transit block between two pinned places takes the drive time as its
   * length, unless the user set it by hand. Runs for blocks touching `moved`.
   */
  const repriceTransit = async (moved: { id: string; startMin: number; endMin: number }) => {
    const transitPen = scope && isLocationScope(scope) ? transitPenOf(scope) : undefined
    if (!scope || !transitPen) return
    const live = useTimeTrackingStore.getState().entries
    for (const t of live) {
      if (t.penId !== transitPen.id || t.scopeId !== entry.scopeId || t.transitManual || isInstant(t)) continue
      const aId = t.transitFrom ?? t.startJoinId
      const bId = t.transitTo ?? t.endJoinId
      if (![t.id, aId, bId].includes(moved.id)) continue
      const a = live.find((e) => e.id === aId)
      const b = live.find((e) => e.id === bId)
      const from = pinOf(scope.pens.find((p) => p.id === a?.penId))
      const to = pinOf(scope.pens.find((p) => p.id === b?.penId))
      if (!a || !b || !from || !to) continue
      const start = a.id === moved.id ? moved.endMin : a.endMin
      const cap = b.id === moved.id ? moved.startMin : b.startMin
      const mins = await travelMinutes(from, to, t.date, start)
      if (mins == null || cap <= start) continue
      const len = Math.max(1, Math.round(mins))
      const end = Math.min(start + len, cap)
      const now = useTimeTrackingStore.getState().entries.find((e) => e.id === t.id)
      if (!now || (now.startMin === start && now.endMin === end && now.transitMin === len)) continue
      updateEntry(t.id, { startMin: start, endMin: end, transitMin: len })
    }
  }

  const [driveBusy, setDriveBusy] = useState(false)
  const [driveMsg, setDriveMsg] = useState("")
  const transitPenId = scope && isLocationScope(scope) ? transitPenOf(scope)?.id : undefined
  const driveEnds = (() => {
    if (!scope || !transitPenId || entry.penId !== transitPenId || isInstant(entry)) return null
    const a = allEntries.find((e) => e.id === (entry.transitFrom ?? entry.startJoinId))
    const b = allEntries.find((e) => e.id === (entry.transitTo ?? entry.endJoinId))
    const from = pinOf(scope.pens.find((p) => p.id === a?.penId))
    const to = pinOf(scope.pens.find((p) => p.id === b?.penId))
    return a && b && from && to ? { a, b, from, to } : null
  })()

  /** Drive time between the neighbours becomes this block's length; empty Activity minutes in it read as driving. */
  const calculateDrive = async () => {
    if (!driveEnds) return
    setDriveBusy(true)
    setDriveMsg("")
    const { a, b, from, to } = driveEnds
    const mins = await travelMinutes(from, to, entry.date, a.endMin)
    setDriveBusy(false)
    if (mins == null) return setDriveMsg("No route found.")
    const start = a.endMin
    const end = Math.min(start + Math.max(1, Math.round(mins)), b.startMin)
    if (end <= start) return setDriveMsg("No room between the two blocks.")
    runAsAction("calculate driving commute", () => {
      const st = useTimeTrackingStore.getState()
      st.updateEntry(entry.id, { startMin: start, endMin: end, transitMin: Math.round(mins), transitManual: undefined, ...certaintyPatch(edgeOf(a, "end").c, edgeOf(b, "start").c), precision: "estimated" })
      const act = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")
      if (!act) return
      const penId = act.pens.find((p) => /^driving$/i.test(p.name.trim()))?.id ?? st.addPen(act.id, { name: "Driving", color: "#64748b" } as never)
      if (!penId) return
      const taken = useTimeTrackingStore
        .getState()
        .entries.filter((e) => e.date === entry.date && e.scopeId === "activity" && !isInstant(e) && e.endMin > start && e.startMin < end)
        .sort((x, y) => x.startMin - y.startMin)
      let at = start
      for (const e of taken) {
        if (e.startMin > at) useTimeTrackingStore.getState().paintMinutes(entry.date, "activity", at, e.startMin, penId, [], undefined, "estimated")
        at = Math.max(at, e.endMin)
      }
      if (at < end) useTimeTrackingStore.getState().paintMinutes(entry.date, "activity", at, end, penId, [], undefined, "estimated")
    })
    setFrom(minutesToTimeString(start))
    setTo(minutesToTimeString(end % 1440))
    const clipped = Math.round(mins) > end - start
    setDriveMsg(
      `About ${Math.round(mins)} min leaving ${minutesToLabel(start)}${clipped ? `, but only ${end - start} min fit between the blocks` : ""}. Edit Start, End or Duration to set your own.`,
    )
  }

  const addTransit = ({ from: a, to: b, minutes, label }: { from: TimeEntry; to: TimeEntry; minutes: number; label: string }) => {
    const pen = scope ? transitPenOf(scope) : undefined
    const endMin = timeStringToMinutes(to) ?? a.endMin
    if (!pen) return
    const stop = Math.min(endMin + Math.max(1, Math.round(minutes)), b.startMin)
    const paint = useTimeTrackingStore.getState().paintMinutes
    paint(a.date, a.scopeId, endMin, stop, pen.id, [], undefined, endC === "exact" ? "definite" : "estimated", { title: label })
    const made = useTimeTrackingStore
      .getState()
      .entries.find((e) => e.date === a.date && e.scopeId === a.scopeId && e.penId === pen.id && e.startMin === endMin)
    if (made) {
      // Anchored both ways: the trip leaves where this block ends and arrives where the next one starts.
      updateEntry(made.id, {
        transitFrom: a.id,
        transitTo: b.id,
        transitMin: Math.round(minutes),
        startJoinId: a.id,
        endJoinId: b.id,
        ...certaintyPatch(endC, edgeOf(b, "start").c),
        precision: endC === "exact" && edgeOf(b, "start").c === "exact" ? undefined : "estimated",
      })
      updateEntry(a.id, { endJoinId: made.id })
      updateEntry(b.id, { startJoinId: made.id })
    }
    onClose()
  }

  // One of start, end, or duration is locked. Editing either free value
  // rewrites the other. Unknown ends have no length.
  const [durDraft, setDurDraft] = useState<string | null>(null)
  const startLinked = Boolean(startEventId || startJoinId)
  const endLinked = Boolean(endEventId || endJoinId)
  const durationApplies = !isInstant(entry) && (startOff || startC !== "unknown") && (endOff || endC !== "unknown")
  const currentSpan = () => {
    const s = timeStringToMinutes(from)
    const e = timeStringToMinutes(to)
    if (s === null || e === null) return null
    return readSpanClock(fromDate, s, toDate, e)
  }
  const draftDurationMin = currentSpan() ? (currentSpan()!.end - currentSpan()!.start) : null
  const placeSpan = (startAbs: number, endAbs: number) => {
    const written = writeSpanClock(fromDate, startAbs, endAbs)
    if (!written) return
    const startMoved = written.from !== from || written.fromDate !== fromDate
    const endMoved = written.to !== to || written.toDate !== toDate
    setFrom(written.from)
    setFromDate(written.fromDate)
    setTo(written.to)
    setToDate(written.toDate)
    setDurDraft(null)
    if (startMoved && (startEventId || startJoinId)) {
      setStartEventId(undefined)
      setStartJoinId(undefined)
    }
    if (endMoved && (endEventId || endJoinId)) {
      setEndEventId(undefined)
      setEndJoinId(undefined)
    }
  }
  const editSpan = (edit: SpanLock, value: number) => {
    const cur = currentSpan()
    if (!cur) return false
    const next = applySpanEdit({ lock: spanLock, start: cur.start, end: cur.end, edit, value })
    if (!next) return false
    placeSpan(next.start, next.end)
    return true
  }
  const onStartTime = (time: string) => {
    const clock = timeStringToMinutes(time)
    if (clock === null || !durationApplies || !editSpan("start", clock)) {
      setFrom(time)
      setDurDraft(null)
    }
  }
  const onEndTime = (time: string) => {
    const clock = timeStringToMinutes(time)
    if (clock === null || !durationApplies) {
      setTo(time)
      setDurDraft(null)
      return
    }
    const days = calendarDaysBetween(fromDate, toDate)
    const endAbs = days === 0 && clock === 0 ? 1440 : clock + days * 1440
    if (!editSpan("end", endAbs)) {
      setTo(time)
      setDurDraft(null)
    }
  }
  const onStartDate = (date: string) => {
    const clock = timeStringToMinutes(from)
    if (!date || clock === null || spanLock !== "duration" || !durationApplies) {
      setFromDate(date)
      return
    }
    const shift = calendarDaysBetween(fromDate, date)
    if (!editSpan("start", clock + shift * 1440)) setFromDate(date)
  }
  const onEndDate = (date: string) => {
    const clock = timeStringToMinutes(to)
    if (!date || clock === null || spanLock !== "duration" || !durationApplies) {
      setToDate(date)
      return
    }
    const days = calendarDaysBetween(fromDate, date)
    const endAbs = days === 0 && clock === 0 ? 1440 : clock + days * 1440
    if (!editSpan("end", endAbs)) setToDate(date)
  }
  const durationHelp = (() => {
    if (durDraft !== null && parseDurationInput(durDraft) === null) {
      return "Use minutes or hours, such as 45, 1:30 or 1h 30m."
    }
    const linked = startLinked || endLinked ? " A linked clock lets go when it has to move." : ""
    if (spanLock === "end") return `Calculated from the clocks. End is locked, so a typed length moves Start.${linked}`
    if (spanLock === "duration") return `Length is locked. Changing Start or End moves the other clock.${linked}`
    return `Calculated from the clocks. Start is locked, so a typed length moves End.${linked}`
  })()
  const commitDuration = () => {
    const text = durDraft
    setDurDraft(null)
    const d = text === null ? null : parseDurationInput(text)
    if (d === null) return
    editSpan("duration", d)
  }
  const heroMin =
    durDraft !== null && parseDurationInput(durDraft) !== null ? parseDurationInput(durDraft) : draftDurationMin

  const splitHere = () => {
    const at = timeStringToMinutes(splitAt)
    if (at === null) return
    splitEntryAt(entry.id, at)
    onClose()
  }

  const startForSentence = timeStringToMinutes(from) ?? origin.startMin
  const endForSentence = isInstant(entry)
    ? startForSentence
    : (timeStringToMinutes(to) ?? last.endMin % 1440)

  const overlapping = useMemo(
    () =>
      endEventId
        ? allEntries.filter(
            (e) => e.date === entry.date && e.scopeId !== entry.scopeId && !isInstant(e) && e.endMin === last.endMin && e.endEventId !== endEventId,
          )
        : [],
    [allEntries, endEventId, entry.date, entry.scopeId, last.endMin],
  )

  const draft = {
    penId,
    secondaryPenIds,
    from,
    to,
    fromDate,
    toDate,
    spanLock,
    durationEstimated,
    title,
    fieldTexts,
    notes,
    nowObjectives,
    reading,
    assumed,
    startC,
    endC,
    endEventId,
    startEventId,
    startJoinId,
    endJoinId,
    amountText,
    spentOn,
    spentSource,
    variantIds: liveVariantIds,
    tagIds,
  }
  const [baseline] = useState(draft)
  const isDirty = !snapshotsEqual(draft, baseline)
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: () => {
      // Saving from the unsaved-changes prompt: close first so the 1000-line form (and the
      // prompt) are not re-rendered by every store write the save makes, then save on the
      // next task. A spend block validates in the dialog, so it saves in place.
      if (spendEntry) {
        save()
        return
      }
      onClose()
      window.setTimeout(save, 0)
    },
  })

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className={["trk95 trk-dialog trk-entry", contentClassName].filter(Boolean).join(" ")}
        aria-describedby={undefined}
        data-ui-name="Tracking entry"
        data-ui-docs="components/Home/Tracking/README.md"
        {...unsavedDismissProps(guard.requestClose)}
      >
        <DialogHeader className="trk-entry-head">
          <DialogTitle className="trk-entry-title">
            {displayName} · {minutesToLabel(origin.startMin)} – {minutesToLabel(last.endMin)}
            {crossesMidnight ? " (next day)" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="trk-help">
            {formatDuration(!isInstant(entry) && draftDurationMin != null ? draftDurationMin : durationMin)} in {scope?.name ?? "this scope"}
            {crossesMidnight ? " · continues past midnight" : ""}
            {pen && title.trim() && title.trim() !== pen.name ? ` · pen ${pen.name}` : ""}
          </p>

          {entry.generatedBy?.kind === "sleep" && (
            <p className="trk-section text-xs">
              Part of the night logged for {nightLabel(entry.generatedBy.id)}. Retime or delete it here and the sleep
              log, the Done row and the Analytics Sleep tab all follow — this block is the record, not a copy of it.
              Notes are a good place for dreams.
            </p>
          )}

          <div className="trk-section trk-entry-clocks">
            <div className={`trk-clock-grid${isInstant(entry) ? " is-one" : ""}`}>
              <OptionalClock
                id="entry-from"
                label={isInstant(entry) ? "When" : sleep ? "Fell asleep" : "Start"}
                time={from}
                date={fromDate}
                showDate={false}
                hideDateToggle
                labelAdornment={
                  durationApplies ? (
                    <SpanLockButton edge="start" locked={spanLock === "start"} onLock={() => setSpanLock("start")} />
                  ) : undefined
                }
                onTime={onStartTime}
                onDate={onStartDate}
                onToggleDate={() => setShowDates((open) => !open)}
                estimateBasis={
                  sleep && assumed
                    ? sleepClockEstimateBasis(
                        entry.generatedBy?.kind === "sleep" ? "remembered" : "painted",
                        "asleep",
                      )
                    : undefined
                }
              />
              {!isInstant(entry) && (
                <OptionalClock
                  id="entry-to"
                  label={sleep ? "Woke up" : "End"}
                  time={to}
                  date={toDate}
                  showDate={false}
                  hideDateToggle
                  labelAdornment={
                    durationApplies ? (
                      <SpanLockButton edge="end" locked={spanLock === "end"} onLock={() => setSpanLock("end")} />
                    ) : undefined
                  }
                  onTime={onEndTime}
                  onDate={onEndDate}
                  onToggleDate={() => setShowDates((open) => !open)}
                  estimateBasis={
                    sleep && assumed
                      ? sleepClockEstimateBasis(
                          entry.generatedBy?.kind === "sleep" ? "remembered" : "painted",
                          "awake",
                        )
                      : undefined
                  }
                />
              )}
            </div>
            <div className={`trk-edge-row trk-cert-row${isInstant(entry) ? " is-one" : ""}`}>
              <CertaintyToggle edge="start" value={startOff ? null : startC} onChange={(v) => { setStartOff(v === null); setStartC(v ?? "exact") }} />
              {!isInstant(entry) ? <CertaintyToggle edge="end" value={endOff ? null : endC} onChange={(v) => { setEndOff(v === null); setEndC(v ?? "exact") }} /> : null}
            </div>
            <div className="trk-entry-clock-foot">
              <button
                type="button"
                className="trk-entry-key is-compact"
                data-no95=""
                aria-pressed={showDates}
                onClick={() => setShowDates((open) => !open)}
              >
                {showDates ? "Hide date" : "Date"}
              </button>
              {showDates ? (
                <div className={`trk-clock-dates${isInstant(entry) ? " is-one" : ""}`}>
                  <Input
                    id="entry-from-date"
                    className="trk-clock-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => onStartDate(e.target.value)}
                    aria-label={`${isInstant(entry) ? "When" : sleep ? "Fell asleep" : "Start"} date`}
                  />
                  {!isInstant(entry) ? (
                    <Input
                      id="entry-to-date"
                      className="trk-clock-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => onEndDate(e.target.value)}
                      aria-label={`${sleep ? "Woke up" : "End"} date`}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {durationApplies ? (
            <div className="trk-section trk-duration-edit">
              <div className="trk-dur-kicker">
                <Label htmlFor="entry-duration" className="trk-section-title">
                  Duration
                </Label>
                <SpanLockButton edge="duration" locked={spanLock === "duration"} onLock={() => setSpanLock("duration")} />
                <button
                  type="button"
                  className="trk-entry-key is-compact trk-dur-est"
                  data-no95=""
                  aria-pressed={durationEstimated}
                  aria-label="Duration estimated"
                  title="The length is a guess. The clocks can still be exact."
                  onClick={() => setDurationEstimated((on) => !on)}
                >
                  ~ Est.
                </button>
              </div>
              <p className="trk-dur-hero" data-testid="entry-duration-readout" data-estimated={durationEstimated ? "true" : "false"}>
                {durationEstimated ? "~ " : ""}
                {heroMin === null ? "—" : formatDuration(heroMin)}
              </p>
              <Input
                id="entry-duration"
                aria-label="Duration"
                inputMode="text"
                placeholder="1h 30m, 90, 1:30"
                value={durDraft ?? (draftDurationMin === null ? "" : formatDuration(draftDurationMin))}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDurDraft(e.target.value)}
                onBlur={commitDuration}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitDuration()
                  }
                }}
              />
              <p className="trk-help">{durationHelp}</p>
            </div>
          ) : null}

          {spendEntry ? (
            <div className="trk-section trk-spend-edit">
              <Label htmlFor="entry-spend-amount" className="trk-section-title">
                Amount
              </Label>
              <Input
                id="entry-spend-amount"
                aria-label="Amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
              <Label htmlFor="entry-spend-on" className="trk-section-title">
                Spent on
              </Label>
              <Input
                id="entry-spend-on"
                aria-label="Spent on"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
              <Label htmlFor="entry-spend-source" className="trk-section-title">
                Source
              </Label>
              <Input
                id="entry-spend-source"
                aria-label="Source"
                list="entry-spend-sources"
                value={spentSource}
                onChange={(e) => setSpentSource(e.target.value)}
              />
              <datalist id="entry-spend-sources">
                {spendSourceOptions(allEntries).map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
              <p className="trk-help">
                {spendError || "Dollars and cents. The source is where the money came from."}
              </p>
            </div>
          ) : null}

          {spendEntry ? null : (
          <div className="trk-section">
            <Label htmlFor="entry-title" className="trk-section-title">
              Display name
            </Label>
            <p className="trk-help">
              Optional. Defaults to the pen name. Surfaces that show this block use this; counting still uses pens
              and tags.
            </p>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pen?.name ?? "Same as pen"}
            />
          </div>
          )}

          {isMood && scope && (
            <MoodStretchCard
              reading={reading}
              onChange={setReading}
              pens={scope.pens}
              onUsePen={setPenId}
              date={fromDate}
              startLabel={minutesToLabel(startForSentence)}
              endLabel={minutesToLabel(endForSentence)}
            />
          )}

          <div className="trk-section trk-assumed-row">
            <div className="trk-assumed-copy">
              <Label htmlFor="entry-assumed" className="trk-section-title cursor-pointer">
                Assumed / reconstructed
              </Label>
              <p className="trk-help">
                Off means this is certain — you painted what happened. On hides it when Analytics excludes speculative
                time.
              </p>
            </div>
            <Switch id="entry-assumed" className="trk-assumed-switch" checked={assumed} onCheckedChange={setAssumed} />
          </div>

          {!isInstant(entry) && (
            <>
              <EdgeAnchor
                edge="start"
                entries={allEntries}
                scopes={scopes}
                entry={entry}
                own={{ min: startForSentence, c: startC }}
                eventId={startEventId}
                joinId={startJoinId}
                onLink={(kind, p) => linkEdge("start", kind, p)}
                onUnlink={() => unlinkEdge("start")}
                onTake={(st) => takeEdge("start", st)}
              />
              <EdgeAnchor
                edge="end"
                entries={allEntries}
                scopes={scopes}
                entry={entry}
                own={{ min: timeStringToMinutes(to) ?? last.endMin, c: endC }}
                eventId={endEventId}
                joinId={endJoinId}
                onLink={(kind, p) => linkEdge("end", kind, p)}
                onUnlink={() => unlinkEdge("end")}
                onTake={(st) => takeEdge("end", st)}
              >
                {endEventId && overlapping.length > 0 && (
                  <label className="trk-edge-also">
                    <input type="checkbox" checked={alsoOthers} onChange={(e) => setAlsoOthers(e.target.checked)} />
                    Also end {overlapping.length} overlapping block{overlapping.length === 1 ? "" : "s"} in other views here
                  </label>
                )}
              </EdgeAnchor>
            </>
          )}
          <NextBlockSection entries={allEntries} entry={last} scope={scope} onOpen={(e) => onOpenEntry?.(e)} />
          {driveEnds && <DriveCommuteSection ready busy={driveBusy} message={driveMsg} onCalculate={() => void calculateDrive()} />}
          <TransitSection
            entries={allEntries}
            entry={last}
            scope={scope}
            endMin={timeStringToMinutes(to) ?? last.endMin}
            endCertainty={endC}
            onAdd={addTransit}
          />

          {scope && (
            <BlockPenSection
              pens={scope.pens}
              tags={tags}
              primaryId={penId}
              secondaryPenIds={secondaryPenIds}
              onPrimary={setPenId}
              onSecondaries={setSecondaryPenIds}
              onCreate={(name, color) => addPen(scope.id, { name, color })}
              onOpenPen={(id) => openPenSettings(entry.scopeId, id)}
              sortMode={penSort}
              onNameGroup={
                entry.scopeId === COMPANY_SCOPE_ID
                  ? (name, color, memberIds) => {
                      const groupId = addPenGroup(scope.id, name, color, memberIds)
                      if (!groupId) return
                      const group = useTimeTrackingStore
                        .getState()
                        .scopes.find((s) => s.id === scope.id)
                        ?.pens.find((p) => p.id === groupId)
                      const ticked = (group?.variants ?? [])
                        .filter((v) => v.penId && memberIds.includes(v.penId))
                        .map((v) => v.id)
                      setPenId(groupId)
                      setSecondaryPenIds([])
                      setVariantsFor(groupId)
                      setVariantIds(ticked)
                    }
                  : undefined
              }
            />
          )}

          {pen && (
            <div className="trk-section space-y-1.5">
              <Label className="trk-section-title">{pen.variantLabel || "Detail"}</Label>
              <p className="trk-help">
                Tick every one that applies. Each option is a pen that counts as {pen.name} — add one here or nest a
                pen under it, and it shows in both places. Double-click an option to open that pen. Analytics shows{" "}
                {pen.name} as a whole first, then splits it by these. Typing under Add also lists pens from other
                views — a Company person can be a detail of an Activity pen.
              </p>
              <VariantChips
                pen={pen}
                selected={liveVariantIds}
                onToggle={(id) => {
                  setVariantsFor(pen.id)
                  setVariantIds(
                    liveVariantIds.includes(id) ? liveVariantIds.filter((v) => v !== id) : [...liveVariantIds, id],
                  )
                }}
                onCreate={(name) => {
                  const id = addVariant(entry.scopeId, pen.id, name)
                  if (!id) return
                  setVariantsFor(pen.id)
                  setVariantIds([...liveVariantIds.filter((v) => v !== id), id])
                }}
                onOpenPen={(id, viewId) => openPenSettings(viewId ?? entry.scopeId, id)}
                ownerScopeId={entry.scopeId}
                onAddCrossView={(viewId, otherPenId) => {
                  const id = addCrossViewDetail(entry.scopeId, pen.id, viewId, otherPenId)
                  if (!id) return
                  setVariantsFor(pen.id)
                  setVariantIds([...liveVariantIds.filter((v) => v !== id), id])
                }}
              />
            </div>
          )}

          {/* A tag on a block, not on the pen: four hours at the zoo were also
              four hours of walking, without every zoo visit becoming exercise. */}
          <div className="trk-section space-y-1.5">
            <Label className="trk-section-title">Also counts as</Label>
            <p className="trk-help">
              Tags decide which habits this time feeds, across every scope.{" "}
              {assignedPens.length
                ? assignedPens.map((p) => p.name).join(" + ")
                : "This block"}{" "}
              always counts as {penTags.length ? penTags.map((t) => t.name).join(", ") : "nothing yet"}.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const always = penTagIds.includes(tag.id)
                const on = always || tagIds.includes(tag.id)
                return (
                  <CatalogTagChip
                    key={tag.id}
                    tag={tag}
                    pressed={on}
                    aria-label={`Tag: ${tag.name}`}
                    title={always ? `Assigned pens always count as ${tag.name}. ${TAG_OPEN_TITLE}` : TAG_OPEN_TITLE}
                    className={`trk-tag${always ? " opacity-85" : ""}`}
                    onClick={() => {
                      if (always) return
                      setTagIds((current) =>
                        current.includes(tag.id) ? current.filter((t) => t !== tag.id) : [...current, tag.id],
                      )
                    }}
                    mark={always ? <span className="trk-tag-always">always</span> : undefined}
                  />
                )
              })}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag…"
                aria-label="New tag for this block"
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  createAndAttachTag()
                }}
              />
              <button type="button" className="trk-entry-key is-compact" data-no95="" onClick={createAndAttachTag} disabled={!newTag.trim()}>
                Add tag
              </button>
            </div>
            {pen && extraTagIds.length > 0 && (
              <button
                type="button"
                className="trk-entry-key is-compact"
                data-no95=""
                onClick={() => {
                  setPenTags(entry.scopeId, pen.id, [...(pen.tags ?? []), ...extraTagIds])
                  setTagIds([])
                }}
              >
                Always tag {pen.name} as {extraTagNames}
              </button>
            )}
          </div>

          <CompanionSection
            entry={entry}
            pendingTimes={
              timeStringToMinutes(from) !== entry.startMin ||
              timeStringToMinutes(to) !== entry.endMin % 1440
            }
          />

          {blockFields.length ? (
            <div className="trk-section trk-entry-fields" data-testid="entry-fields">
              <Label className="trk-section-title">Details</Label>
              <div className="trk-entry-fields-grid">
                {blockFields.map((row) => (
                  <div key={row.field.id} className={row.field.kind === "text" ? "trk-entry-field is-wide" : "trk-entry-field"}>
                    <Label htmlFor={`entry-field-${row.field.id}`} className="trk-section-title">
                      {row.field.name}
                      <span className="trk-entry-field-from">
                        {row.source === "kept" ? " · kept" : row.source === "tag" ? ` · ${row.sourceName} tag` : ""}
                      </span>
                    </Label>
                    <Input
                      id={`entry-field-${row.field.id}`}
                      type={row.field.kind === "number" ? "number" : "text"}
                      inputMode={row.field.kind === "number" ? "decimal" : undefined}
                      placeholder={row.field.unit ?? ""}
                      value={fieldTexts[row.field.id] ?? ""}
                      onChange={(e) => setFieldTexts((current) => ({ ...current, [row.field.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {pen && !isMood && !spendEntry ? (
            <button
              type="button"
              className="trk-entry-key is-compact trk-entry-fields-door"
              data-no95=""
              onClick={() => openPenSettings(scope?.id ?? entry.scopeId, pen.id)}
            >
              {blockFields.some((row) => row.source !== "kept") ? "Edit detail fields" : `Add a detail field to ${pen.name}…`}
            </button>
          ) : null}

          {entry.scopeId === COMPANY_SCOPE_ID ? <PersonPipelinesEditor mode="entry" entryId={entry.id} /> : null}

          <NowObjectivesList
            mode="inline"
            objectives={nowObjectives}
            onAdd={(text) => setNowObjectives((list) => addNowObjective(list, text))}
            onAddCompleted={(text) =>
              setNowObjectives((list) => addCompletedNowObjective(list, text, blockFloor(entry)))
            }
            onEditText={(id, text) => setNowObjectives((list) => editNowObjectiveText(list, id, text))}
            onToggleComplete={(id) => setNowObjectives((list) => toggleNowObjectiveComplete(list, id))}
            onRemove={(id) => setNowObjectives((list) => removeNowObjective(list, id))}
            onSaveForLater={(id) => {
              const row = (nowObjectives ?? []).find((item) => item.id === id)
              if (row && !row.completedAt) {
                const home = homeForObjective(row, {
                  taskId: entry.taskId,
                  stepId: entry.stepId,
                  scopeId: entry.scopeId,
                  penId: entry.penId,
                })
                const parked = home ? toParked(row, home) : null
                if (parked) useUnfinishedObjectivesStore.getState().upsert([parked])
              }
              setNowObjectives((list) => removeNowObjective(list, id))
            }}
            onAttach={(id, target) => {
              const taskId =
                "createName" in target
                  ? createTaskForObjective(target.createName, { scopeId: entry.scopeId, penId: entry.penId })
                  : target.taskId
              if (!taskId) return
              const stepId = "createName" in target ? undefined : target.stepId
              setNowObjectives((list) => attachNowObjective(list, id, { taskId, stepId }))
            }}
            attachChoices={attachChoices}
            stepChoices={entry.taskId ? openStepChoices(entry.taskId) : undefined}
            onTieStep={
              entry.taskId
                ? (id, stepId) =>
                    setNowObjectives((list) =>
                      stepId === "new"
                        ? list
                        : setNowObjectiveCompletes(tieNowObjectiveToStep(list, id, stepId), id, false),
                    )
                : undefined
            }
            onSetCompletes={(id, completes) => setNowObjectives((list) => setNowObjectiveCompletes(list, id, completes))}
          />

          <div>
            <Label htmlFor="entry-notes" className="trk-section-title">Notes</Label>
            <Textarea id="entry-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="trk-entry-tools">
            {!isInstant(entry) && (
              <>
                <Label htmlFor="entry-split" className="sr-only">
                  Split at
                </Label>
                <ClockPicker
                  id="entry-split"
                  value={splitAt}
                  onChange={setSplitAt}
                  className="h-9 w-[7.5rem]"
                  title="Minute to split at"
                  aria-label="Split at"
                />
                <button
                  type="button"
                  className="trk-entry-key is-mod trk-entry-icon"
                  data-no95=""
                  title="Split this block at the chosen minute into two blocks of the same pen"
                  onClick={splitHere}
                  disabled={entry.endMin - entry.startMin < 2}
                >
                  <Scissors className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Split block</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="trk-entry-key is-mod trk-entry-icon"
              data-no95=""
              onClick={() => {
                removeEntry(entry.id)
                onClose()
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">Delete block</span>
            </button>
          </div>
          <div className="trk-entry-actions">
            <button type="button" className="trk-entry-key is-primary" data-no95="" onClick={save}>
              Save {isInstant(entry) ? "event" : "block"}
            </button>
            <button
              type="button"
              className="trk-entry-key"
              data-no95=""
              title="Open this block on the Time Grid"
              onClick={() => {
                if (!entry.id) return
                const id = entry.id
                guard.guardAction(() => {
                  window.setTimeout(() => showBlockInTimegrid(id), 0)
                  onClose()
                })
              }}
            >
              show in timegrid
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
