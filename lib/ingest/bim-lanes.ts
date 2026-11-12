/**
 * lib/ingest/bim-lanes.ts — BIM chat's lanes, as a list
 *
 * A line typed in BIM chat is offered to each lane in this order. The first lane that answers takes it; the
 * last lane (`ladder`) always does. The order and the guards are data here, so a new BIMBY in chat is one row
 * plus its body in `bim-chat.ts`, and the same table is what the Agents desk and a Trace show.
 *
 * Pure: no stores, no models. `bim-chat.ts` binds a body to every id (the compiler refuses a missing one) and
 * says what each guard means right now. Each lane tried is one event on the turn's Trace (`lib/agents/trace.ts`).
 */

import type { TraceRecorder } from "@/lib/agents/trace"

/**
 * Why a lane is kept out of a turn. Read at the moment the lane comes up, not at the start of the turn: an
 * earlier lane may have closed the question it guards on.
 * - `tell-open`: BIM asked about a told fact and waits for the answer.
 * - `question-open`: the executor holds a ritual or a clarify question for this chat.
 * - `verb`: the line starts with one of BIM's own commands (`log:`, `groc`), which the executor owns.
 */
export type LaneGuard = "tell-open" | "question-open" | "verb"

export interface LaneDef<Id extends string = string> {
  id: Id
  /** The Blueprint that does the work, when one is registered (`lib/agents/registry.ts`). */
  agent?: string
  /** What the lane does, in one sentence. */
  does: string
  /** Whether the lane may ask a model. `code` lanes work with LLM off. */
  cost: "code" | "local-model"
  skipWhen?: readonly LaneGuard[]
}

const OPEN = ["tell-open", "question-open"] as const
const OWNED = ["question-open", "verb"] as const
const PLAIN = ["tell-open", "question-open", "verb"] as const

/** The lanes, in the order a line meets them. The reason for each place is beside it. */
export const CHAT_LANES = [
  { id: "handoff", cost: "code", does: "“Send this to tracking bimby: …” hands the words, unread, to that BIMBY's own chat." },
  { id: "ask-back", cost: "code", does: "The line answers a question BIM asked (a check-in, or a fact it could not find) and is filed as that." },
  { id: "follow-through", cost: "code", does: "A one-tap follow-through answer, or “day's end”, “findings”, “mine follow-through”." },
  // Before the fact and tell shapes, which would read a booking's clocks as facts.
  { id: "flight-file", cost: "code", skipWhen: OPEN, does: "A pasted booking confirmation becomes Flight items and calendar events." },
  { id: "flight-ask", cost: "code", skipWhen: ["tell-open"], does: "“When am I flying to New York?” is answered from the Flight items." },
  // Before every lane that would read the same words as a plan, a fact or a log line: these two take only their own exact shapes.
  { id: "keep", cost: "code", skipWhen: OPEN, does: "“Don't forget to cancel Instacart” becomes a To Do; “<fact>, remind me if <situation>” is kept and said back only in that situation." },
  { id: "money", agent: "finance-bimby", cost: "local-model", skipWhen: PLAIN, does: "A line about money (spent, owes, paid back, a discount, regret over a purchase, who owes me) goes to the Financial BIMBY, which files it and says what your history shows." },
  { id: "day", agent: "plan-bimby", cost: "local-model", skipWhen: OPEN, does: "A list of the rest of the day becomes an editable plan card; while it is live, a line that changes it is taken here." },
  // After the flight lanes, so a pasted booking is still filed as a flight.
  { id: "stream", cost: "local-model", skipWhen: OPEN, does: "A stream of thought (timed lines, “add to inbox:”, a pasted link) becomes a card of filings." },
  // Before texts, fact and tell, which would read "dmd her yesterday" or "on Friday" as a question or a fact.
  { id: "social", agent: "social-bimby", cost: "code", skipWhen: OPEN, does: "A line about a person (a new friend, a DM, a hang-out you want, a birthday) becomes a plan card: the person, their Instagram, a note, a reminder and a plan-log entry." },
  { id: "texts", cost: "local-model", skipWhen: OPEN, does: "A question about someone's texts is read from the texts themselves." },
  // Before the tell shapes, which would answer “when does X?” from events.
  { id: "fact", cost: "code", skipWhen: ["tell-open"], does: "A fact told in passing is kept; a question about a kept fact is answered from it." },
  { id: "tell", cost: "code", does: "Facts, questions and widget commands in plain words, and the answer to an open tell question." },
  { id: "wire", cost: "code", skipWhen: OWNED, does: "A request to wire a module to a habit becomes a checked plan card." },
  // After every lane with a shape of its own, before the report: a list of habits done is not a status report.
  { id: "habit-auto", agent: "habit-helper", cost: "local-model", skipWhen: OPEN, does: "A plain line that reads as daily habits done (“did skincare, stretched, drank water”) is handed to the Habits BIMBY, which proposes the cells." },
  { id: "report", cost: "code", skipWhen: OWNED, does: "A status report becomes a plan card, one block per change." },
  { id: "resistance-outcome", agent: "overcome-bimby", cost: "local-model", does: "The answer to an Overcome push: did it start, and why not." },
  { id: "resistance", agent: "overcome-bimby", cost: "local-model", skipWhen: ["question-open"], does: "“I can't start X” is logged as resistance and gets one push." },
  // Last: it always answers. With LLM on the router goes first (ask, chat); everything else is the executor's ladder.
  { id: "ladder", cost: "local-model", does: "The router (LLM on) and then the Telegram bot's executor: commands run, lines are filed." },
] as const satisfies readonly LaneDef[]

export type ChatLaneId = (typeof CHAT_LANES)[number]["id"]

/** A lane's body: the reply when the lane takes the line, null to leave it for the next lane. */
export type LaneBody<Ctx, Line> = (ctx: Ctx) => Promise<Line | null> | Line | null

export interface LaneHit<Id extends string, Line> {
  lane: Id
  line: Line
}

/**
 * Offers `ctx` to each lane in order and returns the first reply. A lane whose guard holds is skipped. Each
 * lane leaves one `decision` event on `rec`: `skip` with the guard, `pass`, or `ok` with `note(line)`. A lane
 * that throws leaves an `error` event and the throw goes on to the caller, as before the list existed.
 */
export async function runLanes<Id extends string, Ctx, Line>(
  lanes: readonly LaneDef<Id>[],
  bodies: Record<Id, LaneBody<Ctx, Line>>,
  ctx: Ctx,
  opts: { is: (guard: LaneGuard) => boolean; rec?: TraceRecorder; note?: (line: Line) => string | undefined },
): Promise<LaneHit<Id, Line> | null> {
  const { rec } = opts
  for (const lane of lanes) {
    const agent = lane.agent ? { agent: lane.agent } : {}
    const guard = lane.skipWhen?.find(opts.is)
    if (guard) {
      rec?.add({ kind: "decision", actor: lane.id, status: "skip", note: guard, ...agent })
      continue
    }
    const t0 = rec?.clock()
    let line: Line | null
    try {
      line = await bodies[lane.id](ctx)
    } catch (error) {
      rec?.add({ kind: "error", actor: lane.id, status: "error", t0, note: error instanceof Error ? error.message : String(error), ...agent })
      throw error
    }
    if (line === null) {
      rec?.add({ kind: "decision", actor: lane.id, status: "pass", t0, ...agent })
      continue
    }
    const note = opts.note?.(line)
    rec?.add({ kind: "decision", actor: lane.id, status: "ok", t0, ...(note ? { note } : {}), ...agent })
    return { lane: lane.id, line }
  }
  return null
}
