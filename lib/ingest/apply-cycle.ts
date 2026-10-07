/**
 * lib/ingest/apply-cycle.ts — `cycle:` day marks from a text message
 *
 * Sets or clears bleeding, spotting, or ovulation on the message's local
 * calendar day. Spotting is stored and does not change derived phase.
 * This is a calendar mark, not medical advice.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { isCycleFlag, setCycleFlag, type CycleFlag } from "@/lib/cycle-marks"
import type { ApplyResult } from "./types"

const EXAMPLE = "Example: cycle: bleeding"

/** `bleeding` / `spotting` / `ovulation`, optional `off` to clear. */
export function parseCyclePayload(payload: string): { flag: CycleFlag; on: boolean } | null {
  const line = payload.replace(/\r\n/g, "\n").split("\n")[0]?.trim() ?? ""
  const match = /^(bleeding|spotting|ovulation)(?:\s+(off))?$/i.exec(line)
  if (!match) return null
  const flag = match[1]!.toLowerCase()
  if (!isCycleFlag(flag)) return null
  return { flag, on: match[2] == null }
}

export function applyCycle(payload: string, now = new Date()): ApplyResult {
  const parsed = parseCyclePayload(payload)
  if (!parsed) {
    return {
      status: "error",
      kind: "cycle",
      reply: `Say bleeding, spotting, or ovulation. Add off to clear. ${EXAMPLE}`,
    }
  }
  const date = formatLocalDateKey(now)
  setCycleFlag(date, parsed.flag, parsed.on)
  const verb = parsed.on ? "Marked" : "Cleared"
  return {
    status: "ok",
    kind: "cycle",
    reply: `${verb} ${parsed.flag} for ${date}`,
    summary: `Cycle → ${parsed.flag} ${parsed.on ? "on" : "off"} ${date}`,
  }
}
