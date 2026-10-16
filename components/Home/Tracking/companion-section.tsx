/**
 * components/Home/Tracking/companion-section.tsx — "Also happening" in the block editor
 *
 * One block of time is usually several true statements at once: 1–5pm was *Ian's
 * House* in Location, *Social* in Activity, and *Great* in Mood. Painting each
 * scope by hand is three trips through the grid for one afternoon, so this
 * section does all of it from the block already open.
 *
 * Each other scope gets a row showing what it currently says about these exact
 * minutes, and one click to fill in what it does not. Attaching paints an
 * ordinary block (`lib/entry-links.ts`), so nothing downstream needs to know this
 * screen exists.
 *
 * Three strengths of the same gesture, in the order they get used:
 *
 * - **Attach** — this instance only. The default, because most pairings are.
 * - **Annotate** — the companion's variants are editable inline ("who was at the
 *   BBQ"), so the detail lands while the memory is fresh rather than after a
 *   second trip to the other scope.
 * - **Always** — promotes the pairing to a rule on the pen, applied to every
 *   future stroke. Offered only once a pairing exists, so a rule is something you
 *   confirm rather than something you predict.
 *
 * Suggestions come from the user's own history of painting these two pens over
 * the same minutes — no heuristics about what activities "usually" go together.
 *
 * Company takes several people at once: the picker toggles pens and **Attach**
 * paints one Company block with the first as primary and the rest as extra
 * pens. A Company block already here shows its people and **+ Someone** adds
 * another. Every change here, and every Save of the block, runs
 * `mirrorDetails` so a cross-view detail (Hanging out · Elijah) and the view it
 * names (Company · Elijah) agree.
 *
 * **Logs** lists every log instant inside the block's minutes — intake, thought
 * process, text log, switch, spent — from `discreteLogInstants`.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link2, Pin, PinOff, Plus } from "lucide-react"
import { useTimeTrackingStore, type TimeEntry, type TrackPen } from "@/lib/time-tracking-store"
import { companionsFor, suggestedCompanions } from "@/lib/entry-links"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { discreteLogInstants, penNameById } from "@/components/Home/Tracking/discrete-log-instants"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"

interface CompanionSectionProps {
  entry: TimeEntry
  /**
   * The editor's time fields have been changed but not saved. Attaching now
   * would copy the *stored* window, not the one on screen, so the controls step
   * aside and say so rather than quietly using the wrong minutes.
   */
  pendingTimes?: boolean
}

export function CompanionSection({ entry, pendingTimes = false }: CompanionSectionProps) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const attachCompanion = useTimeTrackingStore((s) => s.attachCompanion)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const setPenLinks = useTimeTrackingStore((s) => s.setPenLinks)
  const addPen = useTimeTrackingStore((s) => s.addPen)

  const mirrorDetails = useTimeTrackingStore((s) => s.mirrorDetails)
  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [newPenName, setNewPenName] = useState("")
  // Company: people picked before Attach.
  const [picked, setPicked] = useState<string[]>([])
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const blockWindow = { date: entry.date, startMin: entry.startMin, endMin: entry.endMin }
  const mirror = (scopeId: string) => {
    mirrorDetails({ ...blockWindow, scopeId })
    if (scopeId !== entry.scopeId) mirrorDetails({ ...blockWindow, scopeId: entry.scopeId })
  }

  const logs = useMemo(() => {
    if (entry.kind === "instant") return []
    return discreteLogInstants(entries, penNameById(scopes), entry.date).filter(
      (log) => log.startMin >= entry.startMin && log.startMin < entry.endMin,
    )
  }, [entries, scopes, entry.date, entry.startMin, entry.endMin, entry.kind])
  const penName = (scopeId: string, penId: string) =>
    scopes.find((sc) => sc.id === scopeId)?.pens.find((p) => p.id === penId)?.name ?? ""

  const companions = useMemo(() => companionsFor(entries, entry, scopes), [entries, entry, scopes])
  const suggestions = useMemo(
    () => suggestedCompanions(entries, scopes, { scopeId: entry.scopeId, penId: entry.penId, id: entry.id }),
    [entries, scopes, entry.scopeId, entry.penId, entry.id],
  )

  const sourcePen = scopes.find((s) => s.id === entry.scopeId)?.pens.find((p) => p.id === entry.penId)
  const links = sourcePen?.links ?? []

  const isLinked = (scopeId: string, penId: string) => links.some((l) => l.scopeId === scopeId && l.penId === penId)

  const toggleAlways = (scopeId: string, penId: string, variantIds?: string[]) => {
    if (!sourcePen) return
    setPenLinks(
      entry.scopeId,
      sourcePen.id,
      isLinked(scopeId, penId)
        ? links.filter((l) => !(l.scopeId === scopeId && l.penId === penId))
        : [...links, { scopeId, penId, variantIds: variantIds?.length ? variantIds : undefined }],
    )
  }

  const attach = (scopeId: string, penId: string, more: string[] = []) => {
    attachCompanion(entry.id, { scopeId, penId, secondaryPenIds: more.length ? more : undefined })
    mirror(scopeId)
    setOpenPicker(null)
    setPicked([])
  }

  const addPerson = (other: TimeEntry, penId: string) => {
    if (penId === other.penId || (other.secondaryPenIds ?? []).includes(penId)) return
    updateEntry(other.id, { secondaryPenIds: [...(other.secondaryPenIds ?? []), penId] })
    mirror(other.scopeId)
    setAddingTo(null)
  }

  const removePerson = (other: TimeEntry, penId: string) => {
    updateEntry(other.id, { secondaryPenIds: (other.secondaryPenIds ?? []).filter((id) => id !== penId) })
  }

  const createAndAttach = (scopeId: string) => {
    const name = newPenName.trim()
    if (!name) return
    const scope = scopes.find((s) => s.id === scopeId)
    const penId = addPen(scopeId, { name, color: penColorFor(scope?.pens.length ?? 0) })
    if (penId && scopeId === COMPANY_SCOPE_ID) setPicked((current) => [...current, penId])
    else if (penId) attach(scopeId, penId)
    setNewPenName("")
  }

  if (companions.length === 0 && logs.length === 0) return null

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        Also happening
      </Label>
      <p className="text-xs text-muted-foreground">
        What the other scopes say about {minutesToLabel(entry.startMin)} – {minutesToLabel(entry.endMin)}. Attaching
        fills only the minutes they left blank — nothing you already logged gets overwritten. Changes here save
        straight away, since they belong to the other block.
      </p>
      {pendingTimes && (
        <p className="text-xs text-amber-600">Save the new start and end first — attaching uses the saved window.</p>
      )}

      <div className="space-y-2">
        {companions.map(({ scope, covering, freeMinutes, windowMinutes }) => {
          const scopeSuggestions = suggestions.filter(
            (s) => s.scopeId === scope.id && !covering.some((c) => c.entry.penId === s.penId),
          )
          const picking = openPicker === scope.id

          return (
            <div key={scope.id} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">{scope.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {covering.length === 0
                    ? "nothing here yet"
                    : freeMinutes === 0
                      ? "covers all of it"
                      : `${formatDuration(freeMinutes)} of ${formatDuration(windowMinutes)} still blank`}
                </span>
              </div>

              {covering.map(({ entry: other, pen, minutes }) => (
                <CompanionRow
                  key={other.id}
                  entry={other}
                  pen={pen}
                  minutes={minutes}
                  always={isLinked(scope.id, other.penId)}
                  onToggleAlways={() => toggleAlways(scope.id, other.penId, other.variantIds)}
                  onToggleVariant={(variantId) => {
                    updateEntry(other.id, {
                      variantIds: (other.variantIds ?? []).includes(variantId)
                        ? (other.variantIds ?? []).filter((v) => v !== variantId)
                        : [...(other.variantIds ?? []), variantId],
                    })
                    mirror(other.scopeId)
                  }}
                  people={
                    scope.id === COMPANY_SCOPE_ID
                      ? {
                          extra: (other.secondaryPenIds ?? []).map((id) => ({
                            id,
                            name: penName(scope.id, id),
                            color: scope.pens.find((p) => p.id === id)?.color,
                          })),
                          candidates: scope.pens.filter(
                            (p) => p.id !== other.penId && !(other.secondaryPenIds ?? []).includes(p.id),
                          ),
                          adding: addingTo === other.id,
                          onStartAdding: () => setAddingTo(addingTo === other.id ? null : other.id),
                          onAdd: (penId) => addPerson(other, penId),
                          onRemove: (penId) => removePerson(other, penId),
                        }
                      : undefined
                  }
                  onCreateVariant={(name) => {
                    const id = addVariant(scope.id, other.penId, name)
                    if (id) updateEntry(other.id, { variantIds: [...(other.variantIds ?? []), id] })
                  }}
                />
              ))}

              {freeMinutes > 0 && !pendingTimes && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {scopeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.penId}
                      type="button"
                      onClick={() => attach(scope.id, suggestion.penId)}
                      aria-label={`Attach ${suggestion.penName} — your usual pairing`}
                      title={`You have logged ${formatDuration(suggestion.minutes)} of ${
                        sourcePen?.name ?? "this pen"
                      } alongside ${suggestion.penName}`}
                      className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
                      style={{ borderColor: suggestion.color }}
                    >
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: suggestion.color }} />
                      {suggestion.penName}
                      <span className="text-muted-foreground">usual</span>
                    </button>
                  ))}

                  {picking ? (
                    <div className="flex w-full flex-wrap items-center gap-1.5">
                      {scope.id === COMPANY_SCOPE_ID ? (
                        <p className="w-full text-[11px] text-muted-foreground">
                          Pick everyone who was there, then Attach — one Company block, all of them on it.
                        </p>
                      ) : null}
                      {scope.pens.map((pen) => {
                        const multi = scope.id === COMPANY_SCOPE_ID
                        const on = picked.includes(pen.id)
                        return (
                          <button
                            key={pen.id}
                            type="button"
                            aria-pressed={multi ? on : undefined}
                            onClick={() =>
                              multi
                                ? setPicked((current) => (on ? current.filter((id) => id !== pen.id) : [...current, pen.id]))
                                : attach(scope.id, pen.id)
                            }
                            className={`rounded border px-2 py-0.5 text-[11px] hover:bg-muted ${on ? "bg-foreground text-background" : ""}`}
                            style={{ borderColor: pen.color }}
                          >
                            {pen.name}
                          </button>
                        )
                      })}
                      <span className="flex items-center gap-1">
                        <Input
                          value={newPenName}
                          onChange={(e) => setNewPenName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return
                            e.preventDefault()
                            createAndAttach(scope.id)
                          }}
                          placeholder={`New ${scope.name.toLowerCase()} pen…`}
                          aria-label={`New ${scope.name} pen`}
                          className="h-6 w-36 text-[11px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5"
                          disabled={!newPenName.trim()}
                          onClick={() => createAndAttach(scope.id)}
                        >
                          <Plus className="h-3 w-3" />
                          <span className="sr-only">Add and attach pen</span>
                        </Button>
                      </span>
                      {scope.id === COMPANY_SCOPE_ID ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          disabled={picked.length === 0}
                          onClick={() => attach(scope.id, picked[0]!, picked.slice(1))}
                        >
                          Attach {picked.length > 1 ? `${picked.length} people` : picked.length === 1 ? penName(scope.id, picked[0]!) : ""}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                      onClick={() => setOpenPicker(scope.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Attach {scope.name.toLowerCase()}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {logs.length ? (
        <div className="trk-block-logs" data-testid="block-logs">
          <Label className="trk-section-title">Logs · {logs.length}</Label>
          <ul>
            {logs.map((log) => {
              const name = penName(log.scopeId, log.penId)
              return (
                <li key={log.id}>
                  <span className="trk-block-log-clock">{minutesToLabel(log.startMin)}</span>
                  <span className="trk-block-log-kind">{logKind(log, name)}</span>
                  <span className="trk-block-log-title">{log.title?.trim() || name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** What kind of log a log instant is, in the words the composer uses. */
export function logKind(log: TimeEntry, penName: string): string {
  if (log.intakeClass) return `Intake · ${log.intakeClass}`
  const kind = log.eventKind ?? ""
  if (kind === "thought-process") return "Thought process"
  if (kind === "spend" || typeof log.spendAmount === "number") return "Spent"
  if (kind.startsWith("intake")) return "Intake"
  if (kind.startsWith("switch") || log.switchFrom || log.switchTo) return "Switch"
  const pen = penName.trim().toLowerCase()
  if (pen === "text log") return "Log"
  return penName || "Log"
}

/** One companion block: what it is, plus its detail, editable in place. */
function CompanionRow({
  entry,
  pen,
  minutes,
  always,
  onToggleAlways,
  onToggleVariant,
  onCreateVariant,
  people,
}: {
  entry: TimeEntry
  pen: TrackPen | undefined
  minutes: number
  always: boolean
  onToggleAlways: () => void
  onToggleVariant: (variantId: string) => void
  onCreateVariant: (name: string) => void
  /** Company only: the extra people on this block, and a way to add more. */
  people?: {
    extra: { id: string; name: string; color?: string }[]
    candidates: TrackPen[]
    adding: boolean
    onStartAdding: () => void
    onAdd: (penId: string) => void
    onRemove: (penId: string) => void
  }
}) {
  return (
    <div className="mt-1.5 rounded bg-muted/40 p-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: pen?.color }} />
        <span className="text-xs font-medium">{pen?.name ?? "Unknown pen"}</span>
        <span className="text-[11px] text-muted-foreground">{formatDuration(minutes)} of this block</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`ml-auto h-6 gap-1 px-1.5 text-[11px] ${always ? "text-primary" : "text-muted-foreground"}`}
          aria-pressed={always}
          onClick={onToggleAlways}
          title={
            always
              ? "This pairing is a standing rule — click to stop applying it to new blocks"
              : "Apply this pairing automatically whenever this pen is painted"
          }
        >
          {always ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          {always ? "Always" : "Make it always"}
        </Button>
      </div>

      {people ? (
        <div className="trk-company-people" role="group" aria-label="People on this Company block">
          {people.extra.map((person) => (
            <span key={person.id} className="trk-company-person">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: person.color }} aria-hidden />
              {person.name}
              <button type="button" data-no95="" aria-label={`Remove ${person.name}`} onClick={() => people.onRemove(person.id)}>
                ×
              </button>
            </span>
          ))}
          <button type="button" data-no95="" className="trk-company-add" onClick={people.onStartAdding}>
            + Someone
          </button>
          {people.adding ? (
            <div className="trk-company-candidates">
              {people.candidates.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">Everyone in Company is already here.</span>
              ) : (
                people.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    data-no95=""
                    style={{ borderColor: candidate.color }}
                    onClick={() => people.onAdd(candidate.id)}
                  >
                    {candidate.name}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {pen && (
        <VariantChips
          className="mt-1"
          size="sm"
          pen={pen}
          selected={entry.variantIds ?? []}
          onToggle={onToggleVariant}
          onCreate={onCreateVariant}
        />
      )}
    </div>
  )
}

const FALLBACK_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#ef4444", "#84cc16"]
function penColorFor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}
