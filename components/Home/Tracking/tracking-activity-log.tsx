/**
 * components/Home/Tracking/tracking-activity-log.tsx — The day as a list of events
 *
 * The Time Grid answers "what shape was my day"; this answers "what actually
 * happened, in order". Same data, same occupancy totals (`lib/tracking-summary.ts`),
 * no second source of truth — a block edited here changes the grid and the Analytics
 * numbers in the same breath. Overlapping blocks count once, so "% of the day"
 * matches the grid rather than the sum of every block's length.
 *
 * It shows every scope at once rather than one at a time, because reading a day
 * back usually means reading Activity against Location and Mood together. Gaps
 * are listed too: untracked time you can see is untracked time you can fix, and
 * each gap paints in one click with the currently selected pen. **Log activity**
 * lives in this view’s period bar (Home chrome does not duplicate it on the grid
 * rail). It types a new block without filling a listed gap, and can create a
 * pen there (search or name + color) instead of only picking one that already
 * exists. Done items from To Do for this calendar day sit beside the log as a
 * reminder of what actually got finished.
 */
"use client"

import { useMemo, useState } from "react"
import { addDays, subDays } from "date-fns"
import { Pencil, Plus } from "lucide-react"
import { displayedPen, useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForDay,
  entriesForSpan,
  entryDisplayName,
  formatDuration,
  isInstant,
  minutesToLabel,
  spanMinutes,
  untrackedNoteKey,
  untrackedRanges,
  type TimeEntry as Entry,
} from "@/lib/time-entries"
import { penTotals, tagTotals as tagTotalsOf, totalsFor } from "@/lib/tracking-summary"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { LogActivityDialog } from "@/components/Home/Tracking/log-activity-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { TrkRibbon } from "@/components/Home/Tracking/trk-instrument"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import "./tracking-chrome.css"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { useTaskStore } from "@/lib/task-store"
import { buildDoneTodoItems } from "@/components/Home/ToDo/todo-utils"

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** A gap worth offering to fill. Shorter ones are noise between blocks. */
const MIN_GAP_MINUTES = 15

interface TrackingActivityLogProps {
  currentDate: Date
  setCurrentDate: (d: Date) => void
}

export function TrackingActivityLog({ currentDate, setCurrentDate }: TrackingActivityLogProps) {
  useHabitTrackingSync()
  usePenActionSync()
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const tasks = useTaskStore((s) => s.tasks)
  const folders = useTaskStore((s) => s.folders)

  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [logging, setLogging] = useState<{ startMin: number; endMin: number } | false>(false)
  const untrackedNotes = useTimeTrackingStore((s) => s.untrackedNotes)
  const setUntrackedNote = useTimeTrackingStore((s) => s.setUntrackedNote)
  const dk = dateKey(currentDate)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]

  const dayEntries = useMemo(
    () => (scope ? entriesForDay(entries, dk, scope.id) : []),
    [entries, dk, scope],
  )
  const gaps = useMemo(
    () =>
      scope
        ? untrackedRanges(entries, dk, scope.id).filter((g) => g.endMin - g.startMin >= MIN_GAP_MINUTES)
        : [],
    [entries, dk, scope],
  )
  const totals = useMemo(() => totalsFor(dayEntries, [dk]), [dayEntries, dk])
  const pens = useMemo(() => penTotals(dayEntries, scope, [dk]), [dayEntries, scope, dk])
  const dayTags = useMemo(
    () => tagTotalsOf(entries.filter((e) => e.date === dk), scopes, tags, [dk]),
    [entries, dk, scopes, tags],
  )
  const doneItems = useMemo(
    () => buildDoneTodoItems(tasks, "day", currentDate, folders),
    [tasks, currentDate, folders],
  )

  const logWindow = useMemo(() => {
    const nine = 9 * 60
    const ten = 10 * 60
    const occupiesNine = dayEntries.some((e) => e.startMin < ten && e.endMin > nine)
    if (!occupiesNine) return { startMin: nine, endMin: ten }
    const gap = gaps[0]
    if (gap) return { startMin: gap.startMin, endMin: Math.min(gap.startMin + 60, gap.endMin) }
    return { startMin: nine, endMin: ten }
  }, [dayEntries, gaps])

  /** What the other scopes said about the same stretch of time. */
  const overlapsFor = (entry: Entry): { scopeName: string; penName: string; color: string }[] => {
    const out: { scopeName: string; penName: string; color: string }[] = []
    for (const other of scopes) {
      if (other.id === entry.scopeId) continue
      const seen = new Set<string>()
      for (const candidate of entries) {
        if (candidate.date !== dk || candidate.scopeId !== other.id) continue
        if (candidate.endMin <= entry.startMin || candidate.startMin >= entry.endMin) continue
        const pen = displayedPen(other, candidate.penId) ?? other.pens.find((p) => p.id === candidate.penId)
        if (!pen || seen.has(pen.id)) continue
        seen.add(pen.id)
        out.push({ scopeName: other.name, penName: pen.name, color: pen.color })
      }
    }
    return out
  }

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const rows: ({ kind: "entry"; entry: TimeEntry } | { kind: "gap"; startMin: number; endMin: number })[] = [
    ...dayEntries.map((entry) => ({ kind: "entry" as const, entry })),
    ...gaps.map((g) => ({ kind: "gap" as const, ...g })),
  ].sort((a, b) => (a.kind === "entry" ? a.entry.startMin : a.startMin) - (b.kind === "entry" ? b.entry.startMin : b.startMin))

  return (
    <div className="trk95 trk-canvas">
      <TrackingPeriodNav
        label={currentDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        previousLabel="Previous day"
        nextLabel="Next day"
        onPrevious={() => setCurrentDate(subDays(currentDate, 1))}
        onNext={() => setCurrentDate(addDays(currentDate, 1))}
        onToday={() => setCurrentDate(new Date())}
        meta={`${dayEntries.length} block${dayEntries.length === 1 ? "" : "s"} · ${formatDuration(totals.tracked)} tracked · ${Math.round(totals.coverage)}% of the day`}
        trailing={
          <button type="button" className="trk-latch trk-latch-log" onClick={() => setLogging(logWindow)}>
            <span className="trk-led" aria-hidden />
            <Plus />
            Log activity
          </button>
        }
      />

      {totals.tracked === 0 && <ScreenTimeEmptyHint date={dk} scopeId={scope.id} />}

      {rows.length === 0 ? (
        <p className="trk-aside-empty">
          Nothing tracked in {scope.name} for this day. Log a block or paint the Time Grid.
        </p>
      ) : (
        <div className="trk-log">
          {rows.map((row) => {
            if (row.kind === "gap") {
              const noteKey = untrackedNoteKey(dk, scope.id, row.startMin, row.endMin)
              return (
                <div
                  key={`gap-${row.startMin}`}
                  className="trk-log-row trk-log-gap"
                >
                  <span className="trk-log-when">
                    {minutesToLabel(row.startMin)} – {minutesToLabel(row.endMin)}
                  </span>
                  <span className="trk-log-pad" aria-hidden />
                  <span className="trk-gap-label">Untracked · {formatDuration(row.endMin - row.startMin)}</span>
                  <input
                    className="trk-gap-note"
                    value={untrackedNotes[noteKey] ?? ""}
                    placeholder="Note this gap…"
                    aria-label={`Note for untracked ${minutesToLabel(row.startMin)} to ${minutesToLabel(row.endMin)}`}
                    onChange={(e) => setUntrackedNote(dk, scope.id, row.startMin, row.endMin, e.target.value)}
                  />
                  {selectedPenId && selectedPenId !== "ERASE" && selectedPenId !== "SCISSORS" && (
                    <button
                      type="button"
                      className="trk-gap-fill"
                      onClick={() =>
                        paintMinutes(dk, scope.id, row.startMin, row.endMin, selectedPenId, selectedVariantIds)
                      }
                    >
                      Fill with {scope.pens.find((p) => p.id === selectedPenId)?.name}
                    </button>
                  )}
                  <button
                    type="button"
                    className="trk-gap-add"
                    title="Log activity in this gap"
                    aria-label="Log activity in this gap"
                    onClick={() => setLogging({ startMin: row.startMin, endMin: row.endMin })}
                  >
                    <Plus />
                  </button>
                </div>
              )
            }

            const { entry } = row
            const chain = entry.spanId ? entriesForSpan(entries, entry.spanId) : [entry]
            const first = chain[0] ?? entry
            const last = chain[chain.length - 1] ?? entry
            const crossesMidnight = chain.length > 1
            const blockMinutes = entry.spanId ? spanMinutes(entries, entry.spanId) : entry.endMin - entry.startMin
            const pen = displayedPen(scope, entry.penId)
            const leaf = scope.pens.find((p) => p.id === entry.penId)
            const alsoPens = assignedPenIds(entry)
              .slice(1)
              .map((id) => scope.pens.find((p) => p.id === id))
              .filter(Boolean)
            const assumed = entry.precision === "estimated"
            const variants = (entry.variantIds ?? [])
              .map((id) => leaf?.variants?.find((v) => v.id === id))
              .filter(Boolean)
            const standingTagIds = new Set(
              assignedPenIds(entry).flatMap((id) => scope.pens.find((p) => p.id === id)?.tags ?? []),
            )
            const blockOnlyTagIds = (entry.tagIds ?? []).filter((id) => !standingTagIds.has(id))
            const entryTags = tags
              .filter((t) => standingTagIds.has(t.id) || blockOnlyTagIds.includes(t.id))
              .map((t) => ({ ...t, blockOnly: blockOnlyTagIds.includes(t.id) }))
            const overlaps = overlapsFor(entry)
            const label = entryDisplayName(entry, leaf?.name)

            return (
              <button
                key={entry.id}
                onClick={() => setOpenEntryId(entry.id)}
                className="trk-log-row"
              >
                <span className="trk-log-when">
                  {isInstant(entry)
                    ? minutesToLabel(entry.startMin)
                    : `${minutesToLabel(first.startMin)} – ${minutesToLabel(last.endMin)}${crossesMidnight ? " +" : ""}`}
                </span>
                <span
                  className="trk-log-pad"
                  style={{ background: pen?.color }}
                  aria-hidden
                />
                <span className="trk-log-copy">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{label}</span>
                    {leaf && label !== leaf.name && (
                      <span className="text-[11px] text-muted-foreground">{leaf.name}</span>
                    )}
                    {leaf && leaf.id !== pen?.id && (
                      <span className="text-[11px] text-muted-foreground">{pen?.name}</span>
                    )}
                    {alsoPens.map((p) => (
                      <span key={p!.id} className="text-[11px] text-muted-foreground">
                        + {p!.name}
                      </span>
                    ))}
                    {assumed && (
                      <span className="rounded border px-1 text-[10px] text-muted-foreground">assumed</span>
                    )}
                    {variants.map((v) => (
                      <span
                        key={v!.id}
                        className="rounded px-1.5 text-[11px] text-white"
                        style={{ background: v!.color || leaf?.color || pen?.color }}
                      >
                        {v!.name}
                      </span>
                    ))}
                    {crossesMidnight && (
                      <span className="text-[11px] text-muted-foreground">continues past midnight</span>
                    )}
                  </span>
                  {(entry.notes || entry.project || entryTags.length > 0 || overlaps.length > 0) && (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {entry.project && <span>{entry.project}</span>}
                      {entry.notes && <span className="truncate">{entry.notes}</span>}
                      {entryTags.length > 0 && (
                        <span>
                          counts as{" "}
                          {entryTags
                            .map((t) => (t.blockOnly ? `${t.name} (this block)` : t.name))
                            .join(", ")}
                        </span>
                      )}
                      {overlaps.map((o, i) => (
                        <span key={`${o.scopeName}-${i}`} className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: o.color }} />
                          {o.scopeName}: {o.penName}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="trk-log-mins">
                  {formatDuration(blockMinutes)}
                </span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )
          })}
        </div>
      )}

      <TrkRibbon pens={pens} untracked={totals.untracked} />

      {dayTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground">By tag (all scopes)</span>
          {dayTags.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t.color }} />
              {t.name}: <span className="font-medium">{formatDuration(t.minutes)}</span>
            </span>
          ))}
        </div>
      )}

      {doneItems.length > 0 && (
        <div className="trk-aside-well">
          <p className="trk-silk">
            Done this day · {doneItems.length} item{doneItems.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1">
            {doneItems.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.description}</span>
                {item.estimatedDuration ? (
                  <span className="trk-log-mins shrink-0">
                    {formatDuration(item.estimatedDuration)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="trk-help">
            Finished To Do items for this calendar day — useful when reconstructing what happened. They are not
            auto-painted (that pipeline will land later as assumed blocks).
          </p>
        </div>
      )}

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
      {logging && (
        <LogActivityDialog
          dateKey={dk}
          scopeId={scope.id}
          defaultStartMin={logging.startMin}
          defaultEndMin={logging.endMin}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  )
}
