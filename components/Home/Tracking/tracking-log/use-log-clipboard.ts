/**
 * components/Home/Tracking/tracking-log/use-log-clipboard.ts — Copy one log row
 *
 * One selected row. Cmd/Ctrl+C remembers it. Cmd/Ctrl+V calls
 * `duplicateLogEntry` with no target list, so the copy stays on that shelf,
 * date, and minute. Paste selects the new row and does not open it.
 * A field that is taking text keeps the key.
 */
"use client"

import { useEffect, useRef } from "react"
import { duplicateLogEntry } from "@/lib/tracking-log-ops"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA"
}

export function useLogClipboard(selectedId: string | null, onPasted: (id: string) => void): void {
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const copiedRef = useRef<string | null>(null)
  const onPastedRef = useRef(onPasted)
  onPastedRef.current = onPasted

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === "c") {
        const id = selectedRef.current
        if (!id) return
        copiedRef.current = id
        event.preventDefault()
        return
      }
      if (key !== "v") return
      const id = copiedRef.current
      if (!id) return
      event.preventDefault()
      const next = duplicateLogEntry(id)
      if (next) onPastedRef.current(next)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
