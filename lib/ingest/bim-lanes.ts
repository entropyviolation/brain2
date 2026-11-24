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
  // Right after: the GRAPH tab's "Tell BIM about Linda: …" names its item, so no shape lane may read the words as a dump, a plan or a fact.
  { id: "graph-tell", cost: "local-model", does: "“Tell BIM about Linda Gibbins Croft: …” (the GRAPH tab's Tell key, one node or several) becomes a card of changes to that item: the words as a note, facts, an address as a Location, relations to other people, days you saw them, To Dos or project parts, considerations, and a group list." },
  // Second: the line under "Paste the command" is kept word for word, so no lane may read it as a log line or a question.
  { id: "commands", agent: "commands-bimby", cost: "code", does: "“Remember this command to …” keeps a shell command (pasted with it, or as the next line); “what's the command to …?” says it back." },
  // Right after: only the line after a bare Spotify link ("favorite of the week"), which every later lane would read as a log line or a question.
  { id: "song", cost: "code", does: "The line after a Spotify link (“been listening to this a lot this week”, “favorite of the month”) puts that song on the week's or month's Songs." },
  // Before ask-back and every shape lane: while the Social BIMBY asks for a number or goes over texts with you, "go", "skip" and a note are its.
  { id: "social-follow", agent: "social-bimby", cost: "code", does: "After a Social card: answers to the numbered asks (“1 951… @handle 2 a and b”), then going over each person's texts and DMs with you, your notes kept on a card." },
  // Before ask-back and the day plan's answers: the line under "Where do you live?" is home, not an answer to them.
  { id: "web-home", cost: "code", does: "The line under BIM's “where do you live?”, or “I live in …”, is kept as home, and the held web question is run." },
  { id: "ask-back", cost: "code", does: "The line answers a question BIM asked (a check-in, or a fact it could not find) and is filed as that." },
  { id: "follow-through", cost: "code", does: "A one-tap follow-through answer, or “day's end”, “findings”, “mine follow-through”." },
  // Before the fact and tell shapes, which would read a booking's clocks as facts.
  { id: "flight-file", cost: "code", skipWhen: OPEN, does: "A pasted booking confirmation becomes Flight items and calendar events." },
  { id: "dump", cost: "code", skipWhen: OPEN, does: "A brain dump (one long message with several plans and no clocks) becomes a card: new plans as To Dos or Inbox items, plans already on your list as amendments to them, a dose, things on the way, notes to BIM, and the thought patterns it shows; “what are my thought patterns?” counts them." },
  { id: "owed", cost: "code", skipWhen: OPEN, does: "“Who do I need to text back?” lists who is waiting on a text (their last text, how long, their number) and your “text X back” to-dos; “already texted Ruggles at 3pm” checks those to-dos off with that time." },
  { id: "flight-ask", cost: "code", skipWhen: ["tell-open"], does: "“When am I flying to New York?” is answered from the Flight items." },
  // Before self, which would answer "can you log what I ate: …" as a question about BIM, and before money, day and
  // stream, which would read a list of meals as a spend, a plan or a stream of thought.
  { id: "food", agent: "food-bimby", cost: "local-model", skipWhen: OPEN, does: "A line about food eaten (“had a whole container of ravioli and 2 Red Bulls yesterday”, “log all this food”) is read into meals, each part looked up for nutrition (saved foods, USDA, Open Food Facts, then an estimate), and filed on the Food book with a plate; a homemade dish is saved as a recipe card." },
  // Before self, which would read "can you make my day log?" as a question about BIM, and before day and stream, which
  // would read "day log monday: I was at the gym 9–10" as a plan or a stream of thought.
  { id: "day-log", cost: "local-model", skipWhen: OPEN, does: "“Day log”, “make yesterday's masterlog” builds that day's Day Log doc from every source (Docs → LOG DOCS → DAY LOGS); “day log monday: the call with mom was at 3” keeps the correction word for word and rebuilds. “Week log”, “last week's week log” builds the Week Log from the seven Day Logs (Docs → LOG DOCS → WEEK LOGS); “week log: Tuesday I was sick all day” keeps it word for word and rebuilds the week." },
  // Before keep, web and the router: "can you answer questions that need a web search?" is about BIM, not a search or an Ask.
  { id: "self", cost: "code", skipWhen: OPEN, does: "“Can you …?”, “are you able to …?” or “what can you do?” about BIM itself is answered from a fixed sheet of what each lane does." },
  // Before keep, which leaves a timed "remind me to …" alone, and before the fact lane, which would keep "remember that I …" as a plain fact.
  { id: "remind", agent: "coach-bimby", cost: "code", skipWhen: OPEN, does: "“Remind me at 5pm to call mom”, “… tomorrow at 9”, “… in 20 minutes”, “… every day at 8am” makes a Reminder that texts you on Telegram when it is due." },
  { id: "coach", agent: "coach-bimby", cost: "local-model", skipWhen: OPEN, does: "Memory of you (“about me: …”, “my goals are …”, “what do you know about me?”, “forget …”), the Telegram brief and check-in switches, and coaching (“what should I do now?”, “coach me”, “morning brief”)." },
  // Before every lane that would read the same words as a plan, a fact or a log line: these two take only their own exact shapes.
  { id: "keep", cost: "local-model", skipWhen: OPEN, does: "“Don't forget to cancel Instacart” becomes a To Do, and “to do later X to do later Y” one To Do each (spelling mended by a model when LLM is on); “<fact>, remind me if <situation>” is kept and said back only in that situation." },
  // Before money and the router: "mark that I regretted …" is a log line, not a regret over a purchase or a correction.
  { id: "mark", cost: "code", skipWhen: PLAIN, does: "“Mark that …” / “note that …” logs what follows, without the laugh or the lead, and “that text” names whose text it was." },
  { id: "money", agent: "finance-bimby", cost: "local-model", skipWhen: PLAIN, does: "A line about money (spent, owes, paid back, a discount, regret over a purchase, who owes me) goes to the Financial BIMBY, which files it and says what your history shows." },
  { id: "day", agent: "plan-bimby", cost: "local-model", skipWhen: OPEN, does: "A list of the rest of the day becomes an editable plan card; while it is live, a line that changes it is taken here." },
  // After the flight lanes, so a pasted booking is still filed as a flight.
  { id: "stream", cost: "local-model", skipWhen: OPEN, does: "A stream of thought (timed lines, “add to inbox:”, a pasted link) becomes a card of filings." },
  // Before texts, fact and tell, which would read "dmd her yesterday" or "on Friday" as a question or a fact.
  { id: "social", agent: "social-bimby", cost: "code", skipWhen: OPEN, does: "A line about a person (a new friend, a DM, a hang-out you want, a birthday) becomes a plan card: the person, their Instagram, a note, a reminder and a plan-log entry." },
  { id: "texts", cost: "local-model", skipWhen: OPEN, does: "A question about someone's texts is read from the texts themselves." },
  // Before fact and tell, which would answer “what time does X close?” from your own data or a kept fact.
  { id: "web", cost: "local-model", skipWhen: OPEN, does: "A question about the outside world (opening hours, “find out”, “near my house”) is searched on the web through the Mac hub and answered from the pages, with the sources in the fold." },
  // Before the tell shapes, which would answer “when does X?” from events.
  { id: "fact", cost: "code", skipWhen: ["tell-open"], does: "A fact told in passing is kept; a question about a kept fact is answered from it." },
  { id: "tell", cost: "code", does: "Facts, questions and widget commands in plain words, and the answer to an open tell question." },
  { id: "wire", cost: "code", skipWhen: OWNED, does: "A request to wire a module to a habit becomes a checked plan card." },
  // After every lane with a shape of its own, before the report: a list of habits done is not a status report.
  { id: "habit-auto", agent: "habit-helper", cost: "local-model", skipWhen: OPEN, does: "A plain line that reads as daily habits done (“did skincare, stretched, drank water”) is handed to the Habits BIMBY, which proposes the cells." },
  { id: "report", cost: "code", skipWhen: OWNED, does: "A status report becomes a plan card, one block per change." },
  { id: "resistance-outcome", agent: "overcome-bimby", cost: "local-model", does: "The answer to an Overcome push: did it start, and why not." },
  { id: "resistance", agent: "overcome-bimby", cost: "local-model", skipWhen: ["question-open"], does: "“I can't start X” is logged as resistance and gets one push." },
  // Just before the router, after every lane with a shape of its own: the day-stream shapes are read in code, at no model's cost.
  { id: "grammar", cost: "code", skipWhen: PLAIN, does: "Day-stream shapes in plain words (“need to …”, “took another addy”, “starting dishes”, “done with shower”, “iso …”) become To Dos, intakes, activity starts and stops, and wants; a part that reads as none is logged." },
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
  opts: { is: (guard: LaneGuard) => boolean; rec?: TraceRecorder; note?: (line: Line) => string | undefined; onLane?: (lane: Id) => void },
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
    opts.onLane?.(lane.id)
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
