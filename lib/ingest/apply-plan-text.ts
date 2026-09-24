/**
 * lib/ingest/apply-plan-text.ts — Append / read today's Plan log via ingest
 */
import { formatAppendLog } from "@/lib/append-log"
import { appendPlanEntry, getPlanEntries } from "@/lib/plan-text"
import { localDayKey } from "@/lib/reviews-store"
import type { ApplyResult } from "./types"

export function applyPlanForNow(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) {
    return {
      status: "error",
      kind: "plan-now" as ApplyResult["kind"],
      reply: "Send the plan after plan for rn:",
    } as ApplyResult
  }

  const dayKey = localDayKey(now)
  appendPlanEntry("day", dayKey, text, now, { stampSuffix: "from text" })
  return {
    status: "ok",
    kind: "plan-now" as ApplyResult["kind"],
    reply: `Plan for ${dayKey} (from text)`,
    summary: `Plan for ${dayKey} from text`,
  } as ApplyResult
}

export function applyReadPlanToday(
  now = new Date(),
  mode: "latest" | "all" = "latest",
): ApplyResult {
  const dayKey = localDayKey(now)
  const entries = getPlanEntries("day", dayKey)
  if (entries.length === 0) {
    return {
      status: "ok",
      kind: "read-plan" as ApplyResult["kind"],
      reply: "No plan for today yet.",
      summary: `No plan for ${dayKey}`,
    } as ApplyResult
  }

  const reply = formatAppendLog(entries, mode, now)
  return {
    status: "ok",
    kind: "read-plan" as ApplyResult["kind"],
    reply,
    summary: mode === "latest" ? `Latest plan for ${dayKey}` : `Plan for ${dayKey}`,
  } as ApplyResult
}
