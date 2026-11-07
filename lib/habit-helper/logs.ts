/**
 * lib/habit-helper/logs.ts — The person's own BIM lines, with times, for the BIMBY to read
 *
 * Two places keep them: the BIM chat transcript (`bimchat-transcript`) and the ingest log
 * (Telegram and shortcuts). Only what the person sent, once per minute and text. Reads, never writes.
 */
"use client"

import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import type { BimLog } from "./evidence"

export function bimLogs(): BimLog[] {
  const seen = new Set<string>()
  const out: BimLog[] = []
  const add = (text: string | undefined, at: string | undefined) => {
    const t = text?.trim()
    const ms = at ? Date.parse(at) : NaN
    if (!t || !Number.isFinite(ms)) return
    const key = `${t.toLowerCase()}:${Math.floor(ms / 60_000)}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ text: t, at: new Date(ms).toISOString() })
  }
  for (const l of useBimChatStore.getState().lines) if (l.who === "you") add(l.text, l.at)
  for (const e of useIngestStore.getState().events) if (!e.status || e.status === "applied") add(e.raw, e.at)
  return out
}
