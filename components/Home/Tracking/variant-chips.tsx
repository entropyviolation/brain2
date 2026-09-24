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
 */
"use client"

import { useState } from "react"
import { Check, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { PenVariant, TrackPen } from "@/lib/time-tracking-store"

interface VariantChipsProps {
  pen: TrackPen
  selected: string[]
  onToggle: (variantId: string) => void
  /** Omit to hide the inline creator. */
  onCreate?: (name: string) => void
  size?: "sm" | "md"
  className?: string
}

export function variantChipColor(pen: TrackPen, variant: PenVariant): string {
  return variant.color || pen.color
}

export function VariantChips({ pen, selected, onToggle, onCreate, size = "md", className }: VariantChipsProps) {
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const variants = pen.variants ?? []
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
              onBlur={() => (draft.trim() ? create() : setAdding(false))}
              placeholder={pen.variantLabel || "Add detail"}
              className="h-7 w-32 text-xs"
            />
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
