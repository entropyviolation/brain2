/**
 * lib/stream-bimby/apply.ts — File one accepted stream line through the BIM executor
 *
 * A Stream BIMBY filing is one command line. Accept sends the line (as the person left it on the
 * card) through the same executor BIM chat uses, so Lists, Tracking, Inbox, Links and To Do are
 * written by the writers that already exist. A line that would open a question is not left
 * hanging in chat: the question is dropped and the filing fails with the reason.
 */
"use client"

import { BIM_CHAT_ID, BIM_CHAT_SOURCE } from "@/lib/ingest/bim-chat"
import { ingestIncomingAsync } from "@/lib/ingest/executor"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { fieldValue, type Effect } from "@/lib/report-bimby/types"

export interface StreamApplied {
  ok: boolean
  message: string
}

export async function applyStreamLine(effect: Effect, now = new Date()): Promise<StreamApplied> {
  const line = fieldValue(effect, "line").trim()
  if (!line) return { ok: false, message: "The line is empty." }
  const result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: line, receivedAt: now.toISOString() }, now)
  if (result.status === "needs_clarify") {
    useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
    return { ok: false, message: `BIM needed more than this line: ${result.reply}. Edit the line and accept again.` }
  }
  const message = "reply" in result && result.reply ? result.reply : "summary" in result && result.summary ? result.summary : result.status
  return { ok: result.status === "ok", message }
}
