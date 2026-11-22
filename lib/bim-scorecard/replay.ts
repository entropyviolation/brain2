/**
 * lib/bim-scorecard/replay.ts — Replay labelled lines through the real BIM chat turn and score them
 *
 * Each line goes through `sendToBim` (`lib/ingest/bim-chat.ts`), the same turn the console and the phone run:
 * every lane, the switchboard when `llm` is on, the executor, the follow-through read and the cues. Before each
 * line the caller's `reset` puts the stores back, so a line is scored alone, never on what the line before wrote.
 *
 * The bench is `lib/agents/bench.ts`: `runSuite` runs the lane check (pick = the observed lane, expect = the
 * labelled one), and `scorecardOf` makes the action and no-invented-write cards from the same turns. So the
 * scorecards compare with `compareCards` like any other bench run. Run in vitest (jsdom): the stores need it.
 */

import { runSuite, scorecardOf, type BenchCase, type Row, type Scorecard, type Variant } from "@/lib/agents/bench"
import { getTrace } from "@/lib/agents/trace-store"
import { BIM_CHAT_ID, sendToBim } from "@/lib/ingest/bim-chat"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { isWriteKind } from "@/lib/ingest/phone-undo"
import { useReportStore } from "@/lib/report-bimby/store"
import { scoreLine, scoreSocial, stagesOf, type LabelledLine, type LineScore, type Observed, type PlannedEffect, type SocialScore, type Stages } from "./score"

/** Lanes a text replay cannot judge: a photo line is only its caption here. */
export const SKIPPED_LANES = new Set(["photo"])

export interface ReplayRow {
  id: string
  line: LabelledLine
  observed: Observed
  score: LineScore
  stages: Stages
  /** Set for a line labelled with `expect.social`. */
  social?: SocialScore
}

export interface ReplayRun {
  variant: string
  at: string
  /** Lane, action and no-invented-write, each a bench scorecard. */
  lane: Scorecard
  action: Scorecard
  clean: Scorecard
  rows: ReplayRow[]
  skipped: number
}

/** A case id that stays the same when the file is reordered or grows: the minute and a short hash of the words. */
export function caseId(line: Pick<LabelledLine, "ts" | "text">): string {
  let h = 2166136261
  for (const ch of line.text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
  return `${line.ts.slice(0, 16)}#${h.toString(36)}`
}

/** The applied writes of this chat newer than `before` (the newest event id when the turn began), oldest first. */
function writesAfter(before: string | undefined): Observed["writes"] {
  const events = useIngestStore.getState().events
  const cut = before ? events.findIndex((e) => e.id === before) : -1
  const fresh = cut < 0 ? (before ? [] : events) : events.slice(0, cut)
  return fresh
    .filter((e) => e.chatId === BIM_CHAT_ID && e.status === "applied" && isWriteKind(e.kind))
    .reverse()
    .map((e) => ({ kind: e.kind, raw: e.raw, summary: e.summary }))
}

/** One line through the real turn. Never throws: a throw is an `error` reply. */
export async function replayLine(line: LabelledLine, opts: { llm: boolean; now?: Date }): Promise<Observed> {
  const before = useIngestStore.getState().events[0]?.id
  const t0 = Date.now()
  try {
    const reply = await sendToBim(line.text, opts.now ?? new Date(line.ts), { llm: opts.llm, origin: "eval" })
    const ms = Date.now() - t0
    const cards = [reply.reportId, reply.wireId, reply.dayId, reply.habitLineId ? `habit:${reply.habitLineId}` : undefined].filter((c): c is string => !!c)
    const card = reply.reportId ? useReportStore.getState().plans[reply.reportId] : undefined
    const plan: PlannedEffect[] | undefined = card?.effects.map((e) => ({ kind: e.kind, title: e.title, fields: Object.fromEntries(e.fields.map((f) => [f.key, f.value])) }))
    return {
      text: reply.text,
      status: reply.status ?? "ok",
      ...(reply.kind ? { kind: reply.kind } : {}),
      ...(reply.route ? { route: reply.route } : {}),
      cards,
      writes: writesAfter(before),
      trace: reply.traceId ? getTrace(reply.traceId) : undefined,
      ms,
      ...(plan ? { plan } : {}),
      ...(reply.choices?.length ? { choices: reply.choices.length } : {}),
    }
  } catch (error) {
    return { text: error instanceof Error ? error.message : String(error), status: "error", cards: [], writes: writesAfter(before), ms: Date.now() - t0 }
  }
}

/**
 * Replay every line and score it. `reset` runs before each line. `onRow` hears each scored line (for progress).
 * Photo lines are left out and counted in `skipped`.
 */
export async function replayLines(
  lines: LabelledLine[],
  opts: { variant: string; label?: string; llm: boolean; reset: () => void | Promise<void>; onRow?: (row: ReplayRow, done: number) => void },
): Promise<ReplayRun> {
  const kept = lines.map((line) => ({ line, id: caseId(line) })).filter((x) => !SKIPPED_LANES.has(x.line.expectedLane))
  const byId = new Map(kept.map((x) => [x.id, x]))
  const rows: ReplayRow[] = []
  // `runSuite` hands the variant the input only, so the cases carry the id as input and the text is looked up.
  const cases: BenchCase[] = kept.map((x) => ({ id: x.id, input: x.id, expect: x.line.expectedLane, tags: [x.line.expectedLane, x.line.source] }))
  const variant: Variant = {
    id: `${opts.variant}:lane`,
    label: `${opts.label ?? opts.variant} · lane`,
    run: async (id) => {
      const { line } = byId.get(id)!
      await opts.reset()
      const observed = await replayLine(line, { llm: opts.llm })
      const score = scoreLine(line, observed)
      const row: ReplayRow = { id, line, observed, score, stages: stagesOf(observed.trace, observed.ms), ...(line.expect?.social ? { social: scoreSocial(line.expect.social, observed) } : {}) }
      rows.push(row)
      opts.onRow?.(row, rows.length)
      // The bench passes a pick that equals the expected lane; an accepted near-lane (a dream filed as a log) counts as that.
      return { pick: score.laneRight ? line.expectedLane : score.lane, note: [score.lane, observed.route ?? observed.kind].filter(Boolean).join(" · ") }
    },
  }
  const lane = await runSuite(variant, cases)
  const by = new Map(rows.map((r) => [r.id, r]))
  const derive = (suffix: string, label: string, pass: (r: ReplayRow) => boolean): Scorecard =>
    scorecardOf(
      { id: `${opts.variant}:${suffix}`, label: `${opts.label ?? opts.variant} · ${label}` },
      lane.at,
      lane.rows.map((lr): Row => {
        const r = by.get(lr.caseId)
        return { ...lr, pick: r ? (pass(r) ? lr.expect : `not ${suffix}`) : null, pass: r ? pass(r) : false }
      }),
    )
  return {
    variant: opts.variant,
    at: lane.at,
    lane,
    action: derive("action", "action", (r) => r.score.actionRight),
    clean: derive("clean", "no invented write", (r) => !r.score.invented.length),
    rows,
    skipped: lines.length - kept.length,
  }
}
