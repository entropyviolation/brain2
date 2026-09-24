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

  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [newPenName, setNewPenName] = useState("")

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

  const attach = (scopeId: string, penId: string) => {
    attachCompanion(entry.id, { scopeId, penId })
    setOpenPicker(null)
  }

  const createAndAttach = (scopeId: string) => {
    const name = newPenName.trim()
    if (!name) return
    const scope = scopes.find((s) => s.id === scopeId)
    const penId = addPen(scopeId, { name, color: penColorFor(scope?.pens.length ?? 0) })
    if (penId) attach(scopeId, penId)
    setNewPenName("")
  }

  if (companions.length === 0) return null

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
                  onToggleVariant={(variantId) =>
                    updateEntry(other.id, {
                      variantIds: (other.variantIds ?? []).includes(variantId)
                        ? (other.variantIds ?? []).filter((v) => v !== variantId)
                        : [...(other.variantIds ?? []), variantId],
                    })
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
                      {scope.pens.map((pen) => (
                        <button
                          key={pen.id}
                          type="button"
                          onClick={() => attach(scope.id, pen.id)}
                          className="rounded border px-2 py-0.5 text-[11px] hover:bg-muted"
                          style={{ borderColor: pen.color }}
                        >
                          {pen.name}
                        </button>
                      ))}
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
    </div>
  )
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
}: {
  entry: TimeEntry
  pen: TrackPen | undefined
  minutes: number
  always: boolean
  onToggleAlways: () => void
  onToggleVariant: (variantId: string) => void
  onCreateVariant: (name: string) => void
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
