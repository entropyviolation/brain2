/**
 * components/Home/Tracking/entry-dialog/entry-dialog-form.tsx — Edit one tracked block
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
 * A discrete log instant names its door under the help line (`Added from …`).
 *
 * Sections and plain helpers live in this folder. Callers import `EntryDialog`
 * from `../entry-dialog.tsx`.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { runAsAction } from "@/lib/action-history"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForSpan,
  entryDisplayName,
  isInstant,
  isSleepBlock,
  minutesToLabel,
  minutesToTimeString,
  spanMinutes,
  timeStringToMinutes,
  type SpanLock,
} from "@/lib/time-entries"
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
import { MoodStretchCard } from "@/components/Home/Tracking/mood-stretch-card"
import { compactMoodReading, moodPenColor, normalizeWord, type MoodReading } from "@/lib/mood-reading"
import type { NowObjective } from "@/lib/now-objective"
import { attachChoicesForPen } from "@/lib/unfinished-objectives"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { useTaskStore } from "@/lib/task-store"
import { isSpendEntry, spendAmountInput } from "@/lib/spend"
import { edgeOf } from "@/lib/entry-edges"
import { isLocationScope, transitPenOf } from "@/lib/transit-suggest"
import "../tracking-chrome.css"
import "../entry-dialog.css"
import "../tracking-settings.css"
import { entryDraftSnapshot } from "./draft"
import { afterEndsSaved as afterEndsSavedAction, linkEdge as linkEdgeAction, settle as settleAction, takeEdge as takeEdgeAction, unlinkEdge as unlinkEdgeAction, type EdgeSetters } from "./edge-actions"
import { EdgeAnchorsSection } from "./edge-anchors-section"
import { EntryAssumed } from "./entry-assumed"
import { EntryClocks } from "./entry-clocks"
import { EntryDisplayName } from "./entry-display-name"
import { EntryDuration } from "./entry-duration"
import { EntryFields } from "./entry-fields"
import { EntryDialogHead, EntryIntroCopy } from "./entry-intro"
import { EntryNotes } from "./entry-notes"
import { EntryObjectives } from "./entry-objectives"
import { EntryPenBlock } from "./entry-pen-block"
import { EntrySpend } from "./entry-spend"
import { EntryTags } from "./entry-tags"
import { EntryTools } from "./entry-tools"
import { EntryVariants } from "./entry-variants"
import { initialSpanLock } from "./labels"
import { saveBlock } from "./save-block"
import {
  commitDuration as commitDurationEdit,
  currentSpan,
  durationHelp,
  onEndDate as onEndDateEdit,
  onEndTime as onEndTimeEdit,
  onStartDate as onStartDateEdit,
  onStartTime as onStartTimeEdit,
  readHeroMin,
  type SpanClockFields,
  type SpanClockSetters,
} from "./span-edits"
import { addTransit as addTransitAction, calculateDrive as calculateDriveAction, lookupDriveEnds, repriceTransit as repriceTransitAction } from "./transit-actions"
import type { EntryDialogProps } from "./types"

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
  const penLiveIds = usePenColorSessionStore((s) => s.session?.trackingEntryIds)
  const workLiveIds = useWorkSessionStore((s) => s.session?.trackingEntryIds)
  const objectivesLive =
    (penLiveIds ?? []).includes(entry.id) || (workLiveIds ?? []).includes(entry.id)
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

  const repriceTransit = (moved: { id: string; startMin: number; endMin: number }) =>
    repriceTransitAction(moved, scope, entry, updateEntry)

  const [driveBusy, setDriveBusy] = useState(false)
  const [driveMsg, setDriveMsg] = useState("")
  const transitPenId = scope && isLocationScope(scope) ? transitPenOf(scope)?.id : undefined
  const driveEnds = lookupDriveEnds(scope, transitPenId, entry, allEntries)

  const calculateDrive = () =>
    calculateDriveAction({ driveEnds, setDriveBusy, setDriveMsg, entry, setFrom, setTo })

  const addTransit = (spec: { from: typeof entry; to: typeof entry; minutes: number; label: string }) =>
    addTransitAction(spec, scope, to, endC, updateEntry, onClose)

  // One of start, end, or duration is locked. Editing either free value
  // rewrites the other. Unknown ends have no length.
  const [durDraft, setDurDraft] = useState<string | null>(null)
  const startLinked = Boolean(startEventId || startJoinId)
  const endLinked = Boolean(endEventId || endJoinId)
  const durationApplies = !isInstant(entry) && (startOff || startC !== "unknown") && (endOff || endC !== "unknown")
  const spanFields: SpanClockFields = {
    from,
    to,
    fromDate,
    toDate,
    spanLock,
    durationApplies,
    durDraft,
    startLinked,
    endLinked,
    startEventId,
    startJoinId,
    endEventId,
    endJoinId,
  }
  const spanSet: SpanClockSetters = {
    setFrom,
    setTo,
    setFromDate,
    setToDate,
    setDurDraft,
    setStartEventId,
    setStartJoinId,
    setEndEventId,
    setEndJoinId,
  }
  const draftDurationMin = currentSpan(spanFields) ? (currentSpan(spanFields)!.end - currentSpan(spanFields)!.start) : null
  const onStartTime = (time: string) => onStartTimeEdit(spanFields, spanSet, time)
  const onEndTime = (time: string) => onEndTimeEdit(spanFields, spanSet, time)
  const onStartDate = (date: string) => onStartDateEdit(spanFields, spanSet, date)
  const onEndDate = (date: string) => onEndDateEdit(spanFields, spanSet, date)
  const durationHelpText = durationHelp(spanFields)
  const commitDuration = () => commitDurationEdit(spanFields, spanSet)
  const heroMin = readHeroMin(durDraft, draftDurationMin)

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

  const draft = entryDraftSnapshot({
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
  })
  const [baseline] = useState(draft)
  const isDirty = !snapshotsEqual(draft, baseline)

  const settle = () => settleAction(origin.id, updateEntry)
  const afterEndsSaved = (endMin: number) =>
    afterEndsSavedAction({
      endMin,
      origin,
      from,
      endJoinId,
      startJoinId,
      updateEntry,
      endEventId,
      alsoOthers,
      overlapping,
      settle,
      repriceTransit,
    })
  const edgeSet: EdgeSetters = {
    setFrom,
    setTo,
    setStartC,
    setEndC,
    setStartOff,
    setEndOff,
    setStartEventId,
    setStartJoinId,
    setEndEventId,
    setEndJoinId,
  }
  const linkEdge = (edge: "start" | "end", kind: "event" | "join", partner: typeof entry) =>
    linkEdgeAction(edge, kind, partner, { from, to, startC, endC }, edgeSet)
  const unlinkEdge = (edge: "start" | "end") => unlinkEdgeAction(edge, edgeSet)
  const takeEdge = (edge: "start" | "end", state: { min: number; c: typeof startC }) =>
    takeEdgeAction(edge, state, edgeSet)

  const saveNow = () =>
    saveBlock({
      entry,
      origin,
      scope,
      from,
      to,
      fromDate,
      toDate,
      penId,
      secondaryPenIds,
      liveVariantIds,
      tagIds,
      penTagIds,
      title,
      notes,
      nowObjectives,
      reading,
      assumed,
      durationEstimated,
      spanLock,
      startC,
      endC,
      startEventId,
      endEventId,
      startJoinId,
      endJoinId,
      amountText,
      spentOn,
      spentSource,
      setSpendError,
      updateEntry,
      mirrorDetails,
      onClose,
      fieldsPatch,
      resolvePenId,
      settle,
      afterEndsSaved,
    })
  const save = () => runAsAction("edit block", saveNow)

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
        <EntryDialogHead
          displayName={displayName}
          startMin={origin.startMin}
          endMin={last.endMin}
          crossesMidnight={crossesMidnight}
        />

        <div className="space-y-3">
          <EntryIntroCopy
            entry={entry}
            draftDurationMin={draftDurationMin}
            durationMin={durationMin}
            scopeName={scope?.name}
            crossesMidnight={crossesMidnight}
            penName={pen?.name}
            title={title}
          />

          <EntryClocks
            entry={entry}
            sleep={sleep}
            from={from}
            to={to}
            fromDate={fromDate}
            toDate={toDate}
            showDates={showDates}
            spanLock={spanLock}
            durationApplies={durationApplies}
            assumed={assumed}
            startC={startC}
            endC={endC}
            startOff={startOff}
            endOff={endOff}
            onStartTime={onStartTime}
            onEndTime={onEndTime}
            onStartDate={onStartDate}
            onEndDate={onEndDate}
            onToggleDates={() => setShowDates((open) => !open)}
            onLockStart={() => setSpanLock("start")}
            onLockEnd={() => setSpanLock("end")}
            onStartCertainty={(v) => { setStartOff(v === null); setStartC(v ?? "exact") }}
            onEndCertainty={(v) => { setEndOff(v === null); setEndC(v ?? "exact") }}
          />

          {durationApplies ? (
            <EntryDuration
              spanLock={spanLock}
              durationEstimated={durationEstimated}
              heroMin={heroMin}
              durDraft={durDraft}
              draftDurationMin={draftDurationMin}
              durationHelp={durationHelpText}
              onLockDuration={() => setSpanLock("duration")}
              onToggleEstimated={() => setDurationEstimated((on) => !on)}
              onDurDraft={setDurDraft}
              onCommit={commitDuration}
            />
          ) : null}

          {spendEntry ? (
            <EntrySpend
              amountText={amountText}
              spentOn={spentOn}
              spentSource={spentSource}
              spendError={spendError}
              allEntries={allEntries}
              onAmount={setAmountText}
              onSpentOn={setSpentOn}
              onSource={setSpentSource}
            />
          ) : null}

          {spendEntry ? null : (
            <EntryDisplayName title={title} penName={pen?.name} onTitle={setTitle} />
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

          <EntryAssumed assumed={assumed} onAssumed={setAssumed} />

          <EdgeAnchorsSection
            instant={isInstant(entry)}
            allEntries={allEntries}
            scopes={scopes}
            entry={entry}
            last={last}
            scope={scope}
            startForSentence={startForSentence}
            startC={startC}
            endC={endC}
            startEventId={startEventId}
            startJoinId={startJoinId}
            endEventId={endEventId}
            endJoinId={endJoinId}
            to={to}
            overlapping={overlapping}
            alsoOthers={alsoOthers}
            driveEnds={driveEnds}
            driveBusy={driveBusy}
            driveMsg={driveMsg}
            onLink={linkEdge}
            onUnlink={unlinkEdge}
            onTake={takeEdge}
            onAlsoOthers={setAlsoOthers}
            onOpenEntry={onOpenEntry}
            onCalculate={() => void calculateDrive()}
            onAddTransit={addTransit}
          />

          {scope && (
            <EntryPenBlock
              scope={scope}
              entry={entry}
              tags={tags}
              penId={penId}
              secondaryPenIds={secondaryPenIds}
              penSort={penSort}
              onPrimary={setPenId}
              onSecondaries={setSecondaryPenIds}
              onCreate={(name, color) => addPen(scope.id, { name, color })}
              addPenGroup={addPenGroup}
              onNamedGroup={(groupId, ticked) => {
                setPenId(groupId)
                setSecondaryPenIds([])
                setVariantsFor(groupId)
                setVariantIds(ticked)
              }}
            />
          )}

          {pen && (
            <EntryVariants
              pen={pen}
              liveVariantIds={liveVariantIds}
              scopeId={entry.scopeId}
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
              onAddCrossView={(viewId, otherPenId) => {
                const id = addCrossViewDetail(entry.scopeId, pen.id, viewId, otherPenId)
                if (!id) return
                setVariantsFor(pen.id)
                setVariantIds([...liveVariantIds.filter((v) => v !== id), id])
              }}
            />
          )}

          <EntryTags
            tags={tags}
            penTagIds={penTagIds}
            tagIds={tagIds}
            assignedPens={assignedPens}
            penTags={penTags}
            newTag={newTag}
            pen={pen}
            extraTagIds={extraTagIds}
            extraTagNames={extraTagNames}
            onToggleTag={(tagId, always) => {
              if (always) return
              setTagIds((current) =>
                current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId],
              )
            }}
            onNewTag={setNewTag}
            onCreateTag={createAndAttachTag}
            onPromote={() => {
              if (!pen) return
              setPenTags(entry.scopeId, pen.id, [...(pen.tags ?? []), ...extraTagIds])
              setTagIds([])
            }}
          />

          <CompanionSection
            entry={entry}
            pendingTimes={
              timeStringToMinutes(from) !== entry.startMin ||
              timeStringToMinutes(to) !== entry.endMin % 1440
            }
          />

          <EntryFields
            blockFields={blockFields}
            fieldTexts={fieldTexts}
            pen={pen}
            isMood={isMood}
            spendEntry={spendEntry}
            scopeId={scope?.id}
            entryScopeId={entry.scopeId}
            onField={(fieldId, value) => setFieldTexts((current) => ({ ...current, [fieldId]: value }))}
          />

          {entry.scopeId === COMPANY_SCOPE_ID ? <PersonPipelinesEditor mode="entry" entryId={entry.id} /> : null}

          {objectivesLive || (nowObjectives?.length ?? 0) > 0 ? (
            <EntryObjectives
              entry={entry}
              objectivesLive={objectivesLive}
              nowObjectives={nowObjectives}
              setNowObjectives={setNowObjectives}
              attachChoices={attachChoices}
            />
          ) : null}

          <EntryNotes notes={notes} onNotes={setNotes} />

          <EntryTools
            entry={entry}
            splitAt={splitAt}
            onSplitAt={setSplitAt}
            onSplit={splitHere}
            onSave={save}
            removeEntry={removeEntry}
            onClose={onClose}
            guardAction={guard.guardAction}
          />
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
