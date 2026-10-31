/**
 * components/Home/Tracking/entry-dialog/llm-block-note.tsx — The line on a block the BIM LLM flow detected
 *
 * Says the block was autodetected and that its reasons and evidence are in Notes. Lists the other
 * LLM blocks it still overlaps (`llmOverlaps`), since those are guesses waiting for true bounds.
 */
"use client"

import { useMemo } from "react"
import { isLlmBlock, llmOverlaps } from "@/lib/bim-flow/accept"
import { minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function LlmBlockNote({ entry }: { entry: TimeEntry }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const others = useMemo(
    () => llmOverlaps(entries).flatMap((o) => (o.a.id === entry.id ? [o.b] : o.b.id === entry.id ? [o.a] : [])),
    [entries, entry.id],
  )
  if (!isLlmBlock(entry)) return null
  const pen = (id: string) => scopes.find((s) => s.id === entry.scopeId)?.pens.find((p) => p.id === id)?.name ?? "another block"
  return (
    <div className="trk-section text-xs">
      <p>Autodetected by the BIM LLM flow. Its reasons and evidence lines are in Notes. The times are a guess: set the true start and end here.</p>
      {others.map((o) => (
        <p key={o.id}>
          Overlaps {pen(o.penId)} {minutesToLabel(o.startMin)} – {minutesToLabel(o.endMin)} (also autodetected). Moving an edge over it trims that block.
        </p>
      ))}
    </div>
  )
}
