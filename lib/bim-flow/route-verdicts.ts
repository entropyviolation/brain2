/**
 * lib/bim-flow/route-verdicts.ts — What the person said a chat line should have been
 *
 * When BIM takes a line the wrong way and the person says so ("that wasn't a question", "I was
 * asking"), the line and the lane it should have gone to are kept: on this device
 * (`bimroute-verdicts-v1`) and in the disk archive (`archive.ts`, kind `route-verdict`). The router
 * then uses them two ways (`lib/ingest/bim-switchboard.ts`, `chat-router.ts`): the same words again
 * go straight to the corrected lane, in code; and the newest few are shown to the routing model as
 * examples. Like `suggestion-verdicts.ts`, for routes.
 */

import { archive } from "./archive"

/** The lanes a correction can name. A subset of `ChatIntent` (`chat-router.ts`). */
export type TaughtIntent = "ask" | "log" | "chat"

export interface RouteVerdict {
  /** The line as the person sent it. */
  text: string
  /** How BIM took it: the route chip's first word, lowercased, or `ladder` when no model routed it. */
  was: string
  shouldBe: TaughtIntent
  at: string
}

const KEY = "bimroute-verdicts-v1"
const CAP = 200

const norm = (text: string) => text.trim().toLowerCase().replace(/[?.!\s]+$/, "").replace(/\s+/g, " ")

export function loadRouteVerdicts(): RouteVerdict[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]") as RouteVerdict[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

/** Adds one verdict, newest first. A later verdict on the same words replaces the earlier one. */
export function recordRouteVerdict(v: RouteVerdict): RouteVerdict[] {
  const next = [v, ...loadRouteVerdicts().filter((x) => norm(x.text) !== norm(v.text))].slice(0, CAP)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  archive("route-verdict", v)
  return next
}

/** The lane the person already said these exact words belong to, if they did. */
export function taughtRoute(text: string, verdicts = loadRouteVerdicts()): TaughtIntent | null {
  const key = norm(text)
  return key ? verdicts.find((v) => norm(v.text) === key)?.shouldBe ?? null : null
}

/** The newest few, as lines for the routing model's prompt. */
export function taughtExamples(verdicts = loadRouteVerdicts(), max = 6): string[] {
  return verdicts.slice(0, max).map((v) => `LINE: ${v.text.slice(0, 120)} → ${v.shouldBe}`)
}
