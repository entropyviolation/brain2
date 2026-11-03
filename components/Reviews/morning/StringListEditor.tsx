/**
 * components/Reviews/morning/StringListEditor.tsx — Numbered lines.
 *
 * New to-dos and gratitude. Enter can move to the next line and keep the text.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function StringListEditor({
  values,
  onChange,
  placeholder,
  enterAdvances = false,
  max,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  /** Enter moves to the next line (adding one at the end) and keeps the text where it was. */
  enterAdvances?: boolean
  max?: number
}) {
  const rows = values.length ? values : [""]
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const [focusAt, setFocusAt] = useState<number | null>(null)
  useEffect(() => {
    if (focusAt === null) return
    refs.current[focusAt]?.focus()
    setFocusAt(null)
  }, [focusAt, rows.length])
  const advance = (i: number) => {
    if (i + 1 < rows.length) return setFocusAt(i + 1)
    if (max !== undefined && rows.length >= max) return
    onChange([...rows, ""])
    setFocusAt(i + 1)
  }
  return (
    <div className="mr-lines">
      {rows.map((v, i) => (
        <div key={i} className="mr-line" data-filled={v.trim() ? "true" : undefined}>
          <span className="mr-line-num" aria-hidden>
            {i + 1}
          </span>
          <Input
            ref={(el) => {
              refs.current[i] = el
            }}
            value={v}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={
              enterAdvances
                ? (e) => {
                    if (e.key !== "Enter" || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    advance(i)
                  }
                : undefined
            }
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {max === undefined || rows.length < max ? (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...rows, ""])}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      ) : null}
    </div>
  )
}
