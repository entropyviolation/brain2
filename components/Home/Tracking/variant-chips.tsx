/**
 * components/Home/Tracking/variant-chips.tsx — Multi-select for a pen's variants
 *
 * Variants cut a pen finer without splitting it into separate pens: "Hanging out"
 * stays one activity, and Elijah / Rebecca are labels on top of it. Several can
 * be on at once, because an hour can genuinely be with both — which is the whole
 * point, and why this is a multi-select rather than a radio group.
 *
 * Used in three places, always meaning the same thing: the TimeGrid palette
 * (what the next stroke will be labeled), the entry editor (what this block was),
 * and the pen settings dialog (managing the list itself).
 *
 * Each option is a pen that counts as this one. Double-click a chip to open
 * that pen's settings. A single click still toggles it; the second click of a
 * double-click toggles back, so the selection is unchanged.
 *
 * An option can also be a pen from **another view** (`variant.scopeId`): an
 * Activity pen broken down by Company people. Those chips carry a small view
 * name. With `ownerScopeId` + `onAddCrossView`, typing in the inline adder
 * lists matching pens from other views to add as details; Enter still makes a
 * plain detail in this view.
 */
"use client"

import { useMemo, useState } from "react"
import { Check, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTimeTrackingStore, type PenVariant, type TrackPen } from "@/lib/time-tracking-store"

interface VariantChipsProps {
  pen: TrackPen
  selected: string[]
  onToggle: (variantId: string) => void
  /** Omit to hide the inline creator. */
  onCreate?: (name: string) => void
  /** Double-click opens the pen this detail is; `scopeId` is set for a pen in another view. */
  onOpenPen?: (penId: string, scopeId?: string) => void
  /** The view `pen` lives in. Needed to offer pens from other views. */
  ownerScopeId?: string
  /** Add a pen from another view as a detail. Omit to keep the adder this-view only. */
  onAddCrossView?: (scopeId: string, penId: string) => void
  size?: "sm" | "md"
  className?: string
}

export function variantChipColor(pen: TrackPen, variant: PenVariant): string {
  return variant.color || pen.color
}

export function VariantChips({
  pen,
  selected,
  onToggle,
  onCreate,
  onOpenPen,
  ownerScopeId,
  onAddCrossView,
  size = "md",
  className,
}: VariantChipsProps) {
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const variants = useMemo(() => pen.variants ?? [], [pen.variants])
  const viewName = (id?: string) => (id ? scopes.find((s) => s.id === id)?.name ?? id : undefined)
  const needle = draft.trim().toLowerCase()
  const crossMatches = useMemo(() => {
    if (!onAddCrossView || !ownerScopeId || !needle) return []
    const linked = new Set(variants.filter((v) => v.scopeId).map((v) => `${v.scopeId}:${v.penId}`))
    const out: { scopeId: string; scopeName: string; pen: TrackPen }[] = []
    for (const scope of scopes) {
      if (scope.id === ownerScopeId) continue
      for (const other of scope.pens) {
        if (!other.name.toLowerCase().includes(needle) || linked.has(`${scope.id}:${other.id}`)) continue
        out.push({ scopeId: scope.id, scopeName: scope.name, pen: other })
      }
    }
    return out.slice(0, 8)
  }, [onAddCrossView, ownerScopeId, needle, scopes, variants])
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"

  const create = () => {
    const name = draft.trim()
    if (!name || !onCreate) return
    onCreate(name)
    setDraft("")
    setAdding(false)
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {variants.length === 0 && !adding && (
        <span className="text-xs text-muted-foreground">
          No {pen.variantLabel ? pen.variantLabel.toLowerCase().replace(/\?$/, "") : "detail"} options yet
        </span>
      )}
      {variants.map((variant) => {
        const on = selected.includes(variant.id)
        const color = variantChipColor(pen, variant)
        return (
          <button
            key={variant.id}
            type="button"
            onClick={() => onToggle(variant.id)}
            onDoubleClick={(event) => {
              if (!variant.penId || !onOpenPen) return
              event.preventDefault()
              event.stopPropagation()
              onOpenPen(variant.penId, variant.scopeId)
            }}
            title={
              variant.penId
                ? `${variant.name}${variant.scopeId ? ` (${viewName(variant.scopeId)})` : ""}. Double-click to open this pen`
                : variant.name
            }
            aria-pressed={on}
            className={`flex items-center gap-1 rounded border ${pad} ${on ? "text-white" : "bg-background hover:bg-muted"}`}
            style={on ? { background: color, borderColor: color } : { borderColor: `${color}80` }}
          >
            {on ? (
              <Check className="h-3 w-3" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            )}
            {variant.name}
            {variant.scopeId ? <span className="trk-variant-view">{viewName(variant.scopeId)}</span> : null}
          </button>
        )
      })}

      {onCreate &&
        (adding ? (
          <span className="flex items-center gap-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  create()
                }
                if (e.key === "Escape") setAdding(false)
              }}
              onBlur={(e) => {
                // Picking a pen from another view must not first mint a same-name detail here.
                if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.dataset.crossView) return
                if (draft.trim()) create()
                else setAdding(false)
              }}
              placeholder={pen.variantLabel || "Add detail"}
              className="h-7 w-32 text-xs"
            />
            {crossMatches.map((match) => (
              <button
                key={`${match.scopeId}:${match.pen.id}`}
                type="button"
                data-cross-view="true"
                className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                style={{ borderColor: `${match.pen.color}80` }}
                title={`Add ${match.pen.name} from ${match.scopeName} as a detail`}
                onClick={() => {
                  onAddCrossView?.(match.scopeId, match.pen.id)
                  setDraft("")
                  setAdding(false)
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: match.pen.color }} />
                {match.pen.name}
                <span className="trk-variant-view">{match.scopeName}</span>
              </button>
            ))}
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" />
            {variants.length === 0 ? `Add ${pen.variantLabel ? "option" : "detail"}` : "Add"}
          </Button>
        ))}
    </div>
  )
}
