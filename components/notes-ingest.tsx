/**
 * components/notes-ingest.tsx — Ingest from iPhone / Mac Apple Notes
 *
 * Date range → swipe Parse/Skip (title + content preview) → for each parsed note,
 * freely edit bulk-add syntax or park the full note on "notes to ingest" in the
 * auto-created iPhone Notes Ingest folder. Already-ingested Apple Note ids are skipped.
 */
"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Check, Loader2, Smartphone, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useTaskStore } from "@/lib/task-store"
import {
  NOTES_PERIOD_PRESETS,
  NOTES_TO_INGEST_LIST_NAME,
  canFetchAppleNotes,
  ensureIphoneNotesIngestDestination,
  fetchAppleNotes,
  filterNewNotes,
  ingestedAppleNoteIds,
  mergeNoteBodies,
  noteDisplayTitle,
  noteFullText,
  notePreviewSnippet,
  noteToBulkAddDraft,
  noteToParkedItem,
  notesPeriodRange,
  parseBulkAddText,
  persistIngestedNoteIds,
  summarizeBulkAdd,
  nextListColor,
  type AppleNote,
  type NotesPeriodPreset,
} from "@/lib/apple-notes"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { parseSmartCapture } from "@/lib/smart-parse"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { List } from "@/lib/types"

type Step = "period" | "loading" | "swipe" | "process" | "empty" | "error"

const SWIPE_THRESHOLD = 108

function formatNoteDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return format(d, "MMM d, yyyy")
}

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()
    const fallback = setTimeout(done, 32)
    if (typeof requestAnimationFrame !== "function") return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(fallback)
        done()
      })
    })
  })
}

export function NotesIngest() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("period")
  const [preset, setPreset] = useState<NotesPeriodPreset>("24h")
  const [customFrom, setCustomFrom] = useState(() => formatLocalDateKey(new Date(Date.now() - 7 * 86400000)))
  const [customTo, setCustomTo] = useState(() => formatLocalDateKey(new Date()))
  const [notes, setNotes] = useState<AppleNote[]>([])
  const [decisions, setDecisions] = useState<Array<"keep" | "skip">>([])
  const [processIndex, setProcessIndex] = useState(0)
  const [draftText, setDraftText] = useState("")
  const [error, setError] = useState("")
  const [skippedExisting, setSkippedExisting] = useState(0)
  const [addedCount, setAddedCount] = useState(0)
  const [parkedCount, setParkedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [snippetLoading, setSnippetLoading] = useState(false)
  const fullIds = useRef(new Set<string>())
  const snippetRequested = useRef(new Set<string>())

  const addTask = useTaskStore((s) => s.addTask)
  const addList = useTaskStore((s) => s.addList)
  const notesRef = useRef(notes)
  notesRef.current = notes

  const range = useCallback(() => notesPeriodRange(preset, new Date(), customFrom, customTo), [preset, customFrom, customTo])

  const reset = useCallback(() => {
    setStep("period")
    setNotes([])
    setDecisions([])
    setProcessIndex(0)
    setDraftText("")
    setError("")
    setSkippedExisting(0)
    setAddedCount(0)
    setParkedCount(0)
    setBusy(false)
    setSnippetLoading(false)
    fullIds.current = new Set()
    snippetRequested.current = new Set()
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const openDialog = () => {
    reset()
    setOpen(true)
  }

  const mergeFetched = useCallback((incoming: AppleNote[], asFull: boolean) => {
    setNotes((prev) => {
      const merged = mergeNoteBodies(prev, incoming)
      return merged.length ? merged : incoming
    })
    if (asFull) {
      for (const n of incoming) if (n.id) fullIds.current.add(n.id)
    }
  }, [])

  const loadText = useCallback(
    async (ids: string[], mode: "snippet" | "bodies") => {
      const wanted = ids.filter((id) => {
        if (!id) return false
        if (mode === "bodies") return !fullIds.current.has(id)
        return true
      })
      if (wanted.length === 0) return
      const { since, until } = range()
      const result = await fetchAppleNotes({
        sinceISO: since.toISOString(),
        untilISO: until.toISOString(),
        mode,
        ids: wanted,
      })
      if (result.ok) mergeFetched(result.notes, mode === "bodies")
    },
    [range, mergeFetched],
  )

  const loadPreviews = async () => {
    setBusy(true)
    setStep("loading")
    setError("")
    await afterPaint()
    const { since, until } = range()
    const result = await fetchAppleNotes({
      sinceISO: since.toISOString(),
      untilISO: until.toISOString(),
      mode: "preview",
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      setStep("error")
      return
    }
    const existing = ingestedAppleNoteIds(useTaskStore.getState().tasks)
    const fresh = filterNewNotes(result.notes, existing)
    setSkippedExisting(result.notes.length - fresh.length)
    if (fresh.length === 0) {
      setNotes([])
      setStep("empty")
      return
    }
    setNotes(fresh)
    setDecisions([])
    setStep("swipe")
  }

  const index = decisions.length
  const current = notes[index]
  const keptNotes = useMemo(
    () => notes.filter((_, i) => decisions[i] === "keep"),
    [notes, decisions],
  )
  const processNote = keptNotes[processIndex]

  const decide = (choice: "keep" | "skip") => {
    if (!current) return
    setDecisions((d) => [...d, choice])
  }

  const undo = () => {
    setDecisions((d) => d.slice(0, -1))
    if (step === "process") {
      if (processIndex > 0) setProcessIndex((i) => i - 1)
      else setStep("swipe")
    }
  }

  // After the parse/skip deck, process kept notes one at a time.
  useEffect(() => {
    if (step !== "swipe") return
    if (notes.length === 0 || index < notes.length) return
    const kept = notes.filter((_, i) => decisions[i] === "keep")
    if (kept.length === 0) {
      setStep("empty")
      return
    }
    setProcessIndex(0)
    setStep("process")
  }, [step, notes, index, decisions])

  // Lazy-load a content snippet for the current swipe card (+ prefetch next).
  useEffect(() => {
    if (step !== "swipe" || !current?.id) return
    const ids = [current.id, notes[index + 1]?.id].filter((id): id is string => !!id)
    const missing = ids.filter((id) => {
      const row = notes.find((n) => n.id === id)
      if (row?.body) return false
      if (snippetRequested.current.has(id)) return false
      snippetRequested.current.add(id)
      return true
    })
    if (missing.length === 0) return
    setSnippetLoading(true)
    void loadText(missing, "snippet").finally(() => setSnippetLoading(false))
  }, [step, current?.id, index, notes, loadText])

  // Full body for the note being bulk-add / parked.
  useEffect(() => {
    if (step !== "process" || !processNote?.id) return
    const id = processNote.id
    const latest = notesRef.current.find((n) => n.id === id) ?? processNote
    setDraftText(noteToBulkAddDraft(latest))
    if (fullIds.current.has(id) && latest.body) return
    let cancelled = false
    setBusy(true)
    void loadText([id], "bodies")
      .then(() => {
        if (cancelled) return
        const row = notesRef.current.find((n) => n.id === id)
        if (row) setDraftText(noteToBulkAddDraft(row))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, processNote?.id, loadText])

  const markIngested = (noteId: string) => {
    if (noteId) persistIngestedNoteIds([noteId])
  }

  const destinationList = () => {
    const state = useTaskStore.getState()
    return ensureIphoneNotesIngestDestination({
      lists: state.lists,
      folders: state.folders,
      addList: state.addList,
      addFolder: state.addFolder,
      addListToFolder: state.addListToFolder,
    }).list
  }

  const saveForLater = () => {
    if (!processNote) return
    const list = destinationList()
    const latest = notes.find((n) => n.id === processNote.id) ?? processNote
    addTask(noteToParkedItem(latest, list))
    markIngested(latest.id)
    setParkedCount((n) => n + 1)
    advanceProcess()
  }

  const bulkAddNow = () => {
    if (!processNote || !draftText.trim()) return
    const blocks = parseBulkAddText(draftText)
    if (blocks.length === 0) return
    const state = useTaskStore.getState()
    const nameToList = new Map(state.lists.map((l) => [l.name.toLowerCase(), l]))
    let colorIndex = nameToList.size
    let created = 0

    for (const block of blocks) {
      let list = nameToList.get(block.listName.toLowerCase())
      if (!list) {
        const createdList: List = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: block.listName,
          color: nextListColor(colorIndex++),
          description: `Auto-created from Apple Notes bulk add`,
          createdAt: new Date(),
        }
        addList(createdList)
        nameToList.set(createdList.name.toLowerCase(), createdList)
        list = createdList
      }
      for (const line of block.items) {
        const { suggestion } = parseSmartCapture(line)
        const description = suggestion.description || line
        const base = withCategoryDefaults(createListItem(description, [list.id]), list)
        addTask({
          ...base,
          ...(suggestion.scheduledDate ? { scheduledDate: suggestion.scheduledDate } : {}),
          ...(suggestion.scheduledTime ? { scheduledTime: suggestion.scheduledTime } : {}),
          ...(suggestion.estimatedDuration ? { estimatedDuration: suggestion.estimatedDuration } : {}),
          ...(suggestion.urgency ? { urgency: suggestion.urgency } : {}),
          ...(suggestion.importance ? { importance: suggestion.importance } : {}),
          attributes: {
            ...(base.attributes || {}),
            source: "apple-notes",
            ...(processNote.id ? { appleNoteId: processNote.id } : {}),
          },
        })
        created += 1
      }
    }
    markIngested(processNote.id)
    setAddedCount((n) => n + created)
    advanceProcess()
  }

  const advanceProcess = () => {
    if (processIndex + 1 >= keptNotes.length) {
      setStep("empty")
      return
    }
    setProcessIndex((i) => i + 1)
  }

  const bulkSummary = useMemo(() => summarizeBulkAdd(draftText), [draftText])
  const notesAvailable = canFetchAppleNotes()
  const busyLabel = step === "loading" ? "Listing…" : step === "process" && busy ? "Loading…" : "Working…"
  const processLatest = processNote ? notes.find((n) => n.id === processNote.id) ?? processNote : undefined

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={openDialog} disabled={open || busy} aria-busy={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        <span>{busy && (step === "loading" || step === "period") ? busyLabel : "From Notes"}</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col z-[200]">
          <DialogHeader>
            <DialogTitle>Ingest from iPhone Notes</DialogTitle>
            <DialogDescription>
              Preview title and contents, mark notes to parse, then bulk-add or save to “{NOTES_TO_INGEST_LIST_NAME}”.
            </DialogDescription>
          </DialogHeader>

          {step === "period" && (
            <div className="space-y-4">
              {!notesAvailable && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Reading live Apple Notes needs the Mac desktop app (Notes.app, with iCloud). You can still set a period; listing will explain if Notes isn&apos;t reachable.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes-period">Date range</Label>
                <select
                  id="notes-period"
                  className="w-full border rounded-md h-9 px-2 bg-background text-sm"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as NotesPeriodPreset)}
                >
                  {NOTES_PERIOD_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              {preset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="notes-from">From</Label>
                    <input
                      id="notes-from"
                      type="date"
                      className="w-full border rounded-md h-9 px-2 bg-background text-sm"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes-to">To</Label>
                    <input
                      id="notes-to"
                      type="date"
                      className="w-full border rounded-md h-9 px-2 bg-background text-sm"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Already ingested Apple Notes are skipped. Parked notes land in the iPhone Notes Ingest folder, list “{NOTES_TO_INGEST_LIST_NAME}”.
              </p>
              <div className="flex justify-end">
                <Button type="button" onClick={() => void loadPreviews()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Preview notes
                </Button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Listing Apple Notes…</p>
              <p className="text-xs text-muted-foreground">
                Titles first, then a content preview on each card. macOS may ask to let COGS control Notes.
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>
                  Back
                </Button>
                <Button onClick={() => void loadPreviews()}>Retry</Button>
              </div>
            </div>
          )}

          {step === "swipe" && current && (
            <SwipeStage
              note={current}
              index={index}
              total={notes.length}
              kept={keptNotes.length}
              canUndo={decisions.length > 0}
              snippetLoading={snippetLoading && !current.body}
              onParse={() => decide("keep")}
              onSkip={() => decide("skip")}
              onUndo={undo}
              onSkipRest={() => setDecisions((d) => [...d, ...notes.slice(d.length).map(() => "skip" as const)])}
            />
          )}

          {step === "process" && processLatest && (
            <div className="space-y-3 overflow-hidden flex flex-col min-h-0">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Note {processIndex + 1} / {keptNotes.length}
                </span>
                <span>{formatNoteDate(processLatest.modifiedAt)}</span>
              </div>
              <h3 className="text-base font-semibold leading-snug">{noteDisplayTitle(processLatest)}</h3>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto border rounded-md p-2 bg-muted/40">
                {busy && !processLatest.body
                  ? "Loading contents…"
                  : notePreviewSnippet(processLatest, 600) || noteFullText(processLatest) || "Empty note."}
              </p>
              <div className="space-y-1 flex-1 min-h-0 flex flex-col">
                <Label htmlFor="notes-bulk-draft">Bulk add (edit before adding)</Label>
                <Textarea
                  id="notes-bulk-draft"
                  className="min-h-[140px] font-mono text-sm flex-1"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={"Groceries:\nMilk\nEggs\n\nErrands:\nPost office"}
                />
                <p className="text-xs text-muted-foreground">
                  Lines ending with “:” are list names. {bulkSummary.items} item{bulkSummary.items === 1 ? "" : "s"} in{" "}
                  {bulkSummary.lists} list{bulkSummary.lists === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={undo}>
                  <Undo2 className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={saveForLater} disabled={busy}>
                    Save for later ingestion
                  </Button>
                  <Button type="button" onClick={bulkAddNow} disabled={busy || bulkSummary.items === 0}>
                    Bulk add {bulkSummary.items || ""}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "empty" && (
            <div className="space-y-4">
              {addedCount > 0 || parkedCount > 0 ? (
                <p className="text-sm">
                  {addedCount > 0 ? `Bulk-added ${addedCount} item${addedCount === 1 ? "" : "s"}. ` : null}
                  {parkedCount > 0
                    ? `Saved ${parkedCount} note${parkedCount === 1 ? "" : "s"} to “${NOTES_TO_INGEST_LIST_NAME}”.`
                    : null}
                </p>
              ) : notes.length === 0 ? (
                <p className="text-sm">
                  No new notes in that period{skippedExisting ? ` (${skippedExisting} already ingested)` : ""}. iCloud notes from
                  your iPhone show up after Notes.app has synced.
                </p>
              ) : (
                <p className="text-sm">Nothing marked to parse. Preview again or pick another period.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>
                  New period
                </Button>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface SwipeStageProps {
  note: AppleNote
  index: number
  total: number
  kept: number
  canUndo: boolean
  snippetLoading?: boolean
  onParse: () => void
  onSkip: () => void
  onUndo: () => void
  onSkipRest: () => void
}

function SwipeStage({
  note,
  index,
  total,
  kept,
  canUndo,
  snippetLoading,
  onParse,
  onSkip,
  onUndo,
  onSkipRest,
}: SwipeStageProps) {
  const [dx, setDx] = useState(0)
  const [fly, setFly] = useState<null | "left" | "right">(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const lock = useRef(false)

  useEffect(() => {
    setDx(0)
    setFly(null)
    lock.current = false
  }, [note.id, index])

  const commit = useCallback(
    (dir: "left" | "right") => {
      if (lock.current) return
      lock.current = true
      setFly(dir)
      window.setTimeout(() => {
        if (dir === "right") onParse()
        else onSkip()
      }, 180)
    },
    [onParse, onSkip],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        commit("right")
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        commit("left")
      } else if (e.key === "Backspace" && canUndo) {
        e.preventDefault()
        onUndo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [commit, canUndo, onUndo])

  const onPointerDown = (e: React.PointerEvent) => {
    if (lock.current) return
    dragging.current = true
    startX.current = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || lock.current) return
    setDx(e.clientX - startX.current)
  }
  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (dx > SWIPE_THRESHOLD) commit("right")
    else if (dx < -SWIPE_THRESHOLD) commit("left")
    else setDx(0)
  }

  const x = fly === "right" ? 460 : fly === "left" ? -460 : dx
  const rot = x / 18
  const keepOpacity = Math.max(0, Math.min(1, x / SWIPE_THRESHOLD))
  const skipOpacity = Math.max(0, Math.min(1, -x / SWIPE_THRESHOLD))
  const title = noteDisplayTitle(note)
  const snippet = notePreviewSnippet(note, 420)
  const pct = total === 0 ? 0 : (index / total) * 100

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {index + 1} / {total}
          </span>
          <span>{kept} to parse</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="relative h-[320px] select-none touch-none">
        <div
          role="group"
          aria-label={title}
          className="absolute inset-0 rounded-xl border bg-card shadow-md overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            transform: `translateX(${x}px) rotate(${rot}deg)`,
            transition: dragging.current ? "none" : "transform 180ms ease",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border-2 border-emerald-500 bg-emerald-500/15 px-2 py-0.5 text-sm font-bold tracking-wide text-emerald-700"
            style={{ opacity: keepOpacity }}
          >
            PARSE
          </div>
          <div
            className="pointer-events-none absolute right-4 top-4 z-10 rounded-md border-2 border-red-500 bg-red-500/15 px-2 py-0.5 text-sm font-bold tracking-wide text-red-700"
            style={{ opacity: skipOpacity }}
          >
            SKIP
          </div>
          <div className="h-full flex flex-col p-4 pt-12">
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {note.account ? <span className="rounded bg-muted px-1.5 py-0.5">{note.account}</span> : null}
              {note.folder ? <span className="rounded bg-muted px-1.5 py-0.5">{note.folder}</span> : null}
              {note.modifiedAt ? <span className="rounded bg-muted px-1.5 py-0.5">{formatNoteDate(note.modifiedAt)}</span> : null}
            </div>
            <h3 className="mt-2 text-lg font-semibold leading-snug">{title}</h3>
            {note.passwordProtected ? (
              <p className="mt-2 text-sm text-muted-foreground">Locked in Notes — body not available.</p>
            ) : snippetLoading && !snippet ? (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading preview…
              </p>
            ) : snippet ? (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap overflow-y-auto flex-1">{snippet}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No extra content beyond the title.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => commit("left")} aria-label="Skip">
            <X className="h-4 w-4" />
            Skip
          </Button>
          <Button type="button" onClick={() => commit("right")} aria-label="Parse">
            <Check className="h-4 w-4" />
            Parse
          </Button>
        </div>
      </div>
      <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onSkipRest}>
        Skip remaining
      </button>
      <p className="text-[11px] text-muted-foreground">Swipe right to parse, left to skip. Arrow keys work too.</p>
    </div>
  )
}
