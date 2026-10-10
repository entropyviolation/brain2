/**
 * components/Home/Tracking/entry-dialog.tsx — Edit one tracked block
 *
 * A painted block is an event, not a color: it has a start, an end, a primary
 * pen plus optional secondaries, a display name, any number of variants, and
 * notes. A Mood block also carries This stretch: any name, then the body,
 * the water, and the heaps. Activity blocks do not. This is the one editor
 * for all of that, opened from the Time Grid,
 * the Activity Log, or the Day Log, so the views can never drift apart on what
 * a block means. It must open on the click — sleep/pen-action sync stays on
 * the views, not this dialog. It is a centered popup (`entry-dialog.css`).
 * Click outside, ×, or Escape runs the unsaved-changes guard, so a dirty
 * draft is not thrown away. The Pen section shows colors already on the
 * block; **add pen color** unfolds the catalog. Double-click a pen color to
 * open that pen's settings.
 *
 * Changing the times re-lays the block over the day and clears whatever it lands
 * on, exactly as painting would — so the grid can never end up double-booked.
 * Start/End default to the block's calendar day; a **Date** latch is optional.
 *
 * A block derived from the sleep log is edited here like any other, and the edit
 * travels back: `lib/sleep-sync.ts` rereads the night from its blocks, so moving
 * this morning's block to 8 AM is simply how you say you got up at 8.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Scissors, Trash2 } from "lucide-react"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForSpan,
  entryDisplayName,
  formatDuration,
  isInstant,
  isSleepBlock,
  minutesToLabel,
  minutesToTimeString,
  spanMinutes,
  timeStringToMinutes,
} from "@/lib/time-entries"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"
import { CompanionSection } from "@/components/Home/Tracking/companion-section"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { BlockPenSection } from "@/components/Home/Tracking/block-pen-section"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { MoodStretchCard } from "@/components/Home/Tracking/mood-stretch-card"
import { compactMoodReading, moodPenColor, normalizeWord, type MoodReading } from "@/lib/mood-reading"
import { isSpendEntry, parseSpendAmount, spendAmountInput, spendSourceOptions } from "@/lib/spend"
import { parseLocalDate } from "@/lib/date-utils"
import { OptionalClock } from "@/components/Home/Tracking/log-activity-dialog"
import "./tracking-chrome.css"
import "./entry-dialog.css"

interface EntryDialogProps {
  entry: TimeEntry
  onClose: () => void
  /** Extra DialogContent classes (e.g. Analytics `an-popup` for crisp titles). */
  contentClassName?: string
}

/** "the night ending Thu, Sep 17" — sleep is keyed by the morning it ended. */
function nightLabel(date: string): string {
  const parsed = parseLocalDate(date)
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : date
}

export function EntryDialog(props: EntryDialogProps) {
  // A new block must remount the draft. The same instance would keep the
  // previous block's fields when the grid click only swaps `entry`.
  return <EntryDialogForm key={props.entry.id} {...props} />
}

function EntryDialogForm({ entry, onClose, contentClassName }: EntryDialogProps) {
  // Sleep / pen-action sync lives on the Tracking views, not on this click path.
  // Deriving every night here made the dialog lag ~1s and minted new Sleep ids.
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const allEntries = useTimeTrackingStore((s) => s.entries)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const addPen = useTimeTrackingStore((s) => s.addPen)
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
  const [showFromDate, setShowFromDate] = useState(false)
  const [showToDate, setShowToDate] = useState(false)
  const [splitAt, setSplitAt] = useState(
    minutesToTimeString(Math.round((entry.startMin + entry.endMin) / 2)),
  )
  const [variantIds, setVariantIds] = useState<string[]>(entry.variantIds ?? [])
  const [tagIds, setTagIds] = useState<string[]>(entry.tagIds ?? [])
  const [newTag, setNewTag] = useState("")
  const [title, setTitle] = useState(entry.title ?? "")
  const [project, setProject] = useState(entry.project ?? "")
  const [books, setBooks] = useState(entry.books ?? "")
  const [pages, setPages] = useState(entry.pages?.toString() ?? "")
  const [notes, setNotes] = useState(entry.notes ?? "")
  const [reading, setReading] = useState<MoodReading>(entry.moodReading ?? {})
  const [assumed, setAssumed] = useState(entry.precision === "estimated")
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
    setSecondaryPenIds(entry.secondaryPenIds ?? [])
  }, [entry.secondaryPenIds])

  const pen = scope?.pens.find((p) => p.id === penId)
  const assigned = assignedPenIds({ penId, secondaryPenIds })
  const assignedPens = (scope?.pens ?? []).filter((p) => assigned.includes(p.id))
  const penTagIds = [...new Set(assignedPens.flatMap((p) => p.tags ?? []))]
  const penTags = tags.filter((t) => penTagIds.includes(t.id))
  // Switching pens mid-edit invalidates the variants, which belong to the old pen.
  const liveVariantIds = penId === entry.penId ? variantIds : []

  const extraTagIds = tagIds.filter((id) => !penTagIds.includes(id))
  const extraTagNames = tags
    .filter((t) => extraTagIds.includes(t.id))
    .map((t) => t.name)
    .join(", ")

  const displayName = entryDisplayName({ title }, pen?.name)

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

  const save = () => {
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
        project: project.trim() || undefined,
        books: books.trim() || undefined,
        pages: pages.trim() ? Number.parseInt(pages, 10) || undefined : undefined,
        notes: notes.trim() || undefined,
        precision: assumed ? "estimated" : undefined,
        ...moodPatch,
        ...spendPatch,
      })
      onClose()
      return
    }
    const parsedEnd = timeStringToMinutes(to)
    if (parsedEnd === null) return
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
        project: project.trim() || undefined,
        books: books.trim() || undefined,
        pages: pages.trim() ? Number.parseInt(pages, 10) || undefined : undefined,
        notes: notes.trim() || undefined,
        precision: assumed ? "estimated" : undefined,
        ...moodPatch,
        ...spendPatch,
      },
      wrapEndDate,
    )
    onClose()
  }

  const splitHere = () => {
    const at = timeStringToMinutes(splitAt)
    if (at === null) return
    splitEntryAt(entry.id, at)
    onClose()
  }

  const isActivity = entry.scopeId === "activity"
  const startForSentence = timeStringToMinutes(from) ?? origin.startMin
  const endForSentence = isInstant(entry)
    ? startForSentence
    : (timeStringToMinutes(to) ?? last.endMin % 1440)

  const draft = {
    penId,
    secondaryPenIds,
    from,
    to,
    fromDate,
    toDate,
    title,
    project,
    books,
    pages,
    notes,
    reading,
    assumed,
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
      save()
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
            {formatDuration(durationMin)} in {scope?.name ?? "this scope"}
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

          <div className="grid grid-cols-2 gap-2">
            <OptionalClock
              id="entry-from"
              label={isInstant(entry) ? "When" : sleep ? "Fell asleep" : "Start"}
              time={from}
              date={fromDate}
              showDate={showFromDate}
              onTime={setFrom}
              onDate={setFromDate}
              onToggleDate={() => setShowFromDate((open) => !open)}
            />
            {!isInstant(entry) && (
              <OptionalClock
                id="entry-to"
                label={sleep ? "Woke up" : "End"}
                time={to}
                date={toDate}
                showDate={showToDate}
                onTime={setTo}
                onDate={setToDate}
                onToggleDate={() => setShowToDate((open) => !open)}
              />
            )}
          </div>

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

          <div className="flex items-center justify-between gap-2 trk-section">
            <div>
              <Label htmlFor="entry-assumed" className="cursor-pointer text-sm">
                Assumed / reconstructed
              </Label>
              <p className="trk-help">
                Off means this is certain — you painted what happened. On hides it when Analytics excludes speculative
                time.
              </p>
            </div>
            <Switch id="entry-assumed" checked={assumed} onCheckedChange={setAssumed} />
          </div>

          {scope && (
            <BlockPenSection
              pens={scope.pens}
              tags={tags}
              primaryId={penId}
              secondaryPenIds={secondaryPenIds}
              onPrimary={setPenId}
              onSecondaries={setSecondaryPenIds}
              onCreate={(name, color) => {
                const id = addPen(scope.id, { name, color })
                if (id) {
                  setPenId(id)
                  setSecondaryPenIds((current) => current.filter((x) => x !== id))
                }
              }}
              onOpenPen={(id) => openPenSettings(entry.scopeId, id)}
              sortMode={penSort}
            />
          )}

          {pen && (
            <div className="trk-section space-y-1.5">
              <Label>{pen.variantLabel || "Detail"}</Label>
              <p className="trk-help">
                Tick every one that applies. Each option is a pen that counts as {pen.name} — add one here or nest a
                pen under it, and it shows in both places. Double-click an option to open that pen. Analytics shows{" "}
                {pen.name} as a whole first, then splits it by these.
              </p>
              <VariantChips
                pen={pen}
                selected={liveVariantIds}
                onToggle={(id) =>
                  setVariantIds((current) =>
                    current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
                  )
                }
                onCreate={(name) => {
                  const id = addVariant(entry.scopeId, pen.id, name)
                  if (id) setVariantIds((current) => [...current, id])
                }}
                onOpenPen={(id) => openPenSettings(entry.scopeId, id)}
              />
            </div>
          )}

          {/* A tag on a block, not on the pen: four hours at the zoo were also
              four hours of walking, without every zoo visit becoming exercise. */}
          <div className="trk-section space-y-1.5">
            <Label>Also counts as</Label>
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
                  <button
                    key={tag.id}
                    type="button"
                    disabled={always}
                    aria-pressed={on}
                    aria-label={`Tag: ${tag.name}`}
                    title={always ? `Assigned pens always count as ${tag.name}` : undefined}
                    onClick={() =>
                      setTagIds((current) =>
                        current.includes(tag.id) ? current.filter((t) => t !== tag.id) : [...current, tag.id],
                      )
                    }
                    className={`trk-tag${always ? " opacity-85" : ""}`}
                    style={on ? { background: tag.color, color: "#fff" } : undefined}
                  >
                    {tag.name}
                    {always && <span className="text-[9px]">always</span>}
                  </button>
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
              <Button size="sm" variant="outline" className="h-7" onClick={createAndAttachTag} disabled={!newTag.trim()}>
                Add tag
              </Button>
            </div>
            {pen && extraTagIds.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setPenTags(entry.scopeId, pen.id, [...(pen.tags ?? []), ...extraTagIds])
                  setTagIds([])
                }}
              >
                Always tag {pen.name} as {extraTagNames}
              </Button>
            )}
          </div>

          <CompanionSection
            entry={entry}
            pendingTimes={
              timeStringToMinutes(from) !== entry.startMin ||
              timeStringToMinutes(to) !== entry.endMin % 1440
            }
          />

          {isActivity && (
            <div className="grid grid-cols-2 gap-2 trk-section">
              <div className="col-span-2">
                <Label htmlFor="entry-project">Project / context</Label>
                <Input id="entry-project" value={project} onChange={(e) => setProject(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="entry-books">Book(s)</Label>
                <Input id="entry-books" value={books} onChange={(e) => setBooks(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="entry-pages">Pages read</Label>
                <Input id="entry-pages" type="number" value={pages} onChange={(e) => setPages(e.target.value)} />
              </div>
            </div>
          )}

          {entry.scopeId === COMPANY_SCOPE_ID ? <PersonPipelinesEditor mode="entry" entryId={entry.id} /> : null}

          <div>
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea id="entry-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="flex-1" onClick={save}>
              Save {isInstant(entry) ? "event" : "block"}
            </Button>
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
                <Button
                  variant="outline"
                  title="Split this block at the chosen minute into two blocks of the same pen"
                  onClick={splitHere}
                  disabled={entry.endMin - entry.startMin < 2}
                >
                  <Scissors className="h-4 w-4" />
                  <span className="sr-only">Split block</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                removeEntry(entry.id)
                onClose()
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete block</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
