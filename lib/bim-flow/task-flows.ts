/**
 * lib/bim-flow/task-flows.ts — Flows that answer instead of log
 *
 * `askFlow`: a question about the person ("when did I last shower?", "what
 * shirt do I wear most when I'm with Elijah?"). `topicFlow`: summarize what
 * the notes say about a topic. `dayFlow`: recap one day.
 *
 * Each one is a plan (an extract that turns the question into a subject,
 * a person, and a time span), related words, one or more code-only
 * retrievals, then an `answer` node whose instructions are written for that
 * kind of question, then a `check` that re-reads the draft against the
 * evidence. The routing gates pick the instructions; code does the counting.
 */

import type { Flow, FlowEdge, FlowNode, FlowPort, RetrieveConfig } from "./types"

const COL = 230
const ROW = 118

function n(id: string, kind: FlowNode["kind"], label: string, col: number, row: number, config: FlowNode["config"] = {}): FlowNode {
  return { id, kind, label, x: 30 + col * COL, y: 30 + row * ROW, config }
}

function e(from: string, to: string, port: FlowPort = "out"): FlowEdge {
  return { id: `${from}>${to}:${port}`, from, to, port }
}

const read = (id: string, label: string, col: number, row: number, retrieve: RetrieveConfig) => n(id, "retrieve", label, col, row, { retrieve })

const PLAN_SYSTEM =
  "You turn a question a person asks about their own notes into a small search plan. " +
  "subject: the thing asked about in one to three words, as the person would have written it in a note ('shower', 'shirt', 'garlic confit'). No question words, no time words, no names. " +
  "person: a first name if the question names someone, else empty. days: how far back to look (today 1, this week 7, this month 30, this year 365), 0 when it says nothing. " +
  "intent: last_time, first_time, count, duration, most_common, with_person, fact, or summary. JSON only."

const PLAN_FIELDS: FlowNode["config"]["fields"] = [
  { name: "intent", type: "enum", options: ["last_time", "first_time", "count", "duration", "most_common", "with_person", "fact", "summary"] },
  { name: "subject", type: "string", hint: "one to three words the notes would contain" },
  { name: "person", type: "string", hint: "a first name only if the question names someone" },
  { name: "days", type: "number", hint: "days back to look; 0 for all time" },
]

const CHECK = (id: string, col: number, row: number) =>
  n(id, "answer", "Check against evidence", col, row, { mode: "check" })

/**
 * The plain lane every Ask flow falls back to: read messages and notes, then tracked entries, over the
 * plain words, then answer from them and check. With nothing in the notes, SAY says so.
 */
function plainLane(from: string, col: number, row: number): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: [
      read("r-fb-t", "Messages and notes", col, row, { kind: "text", limit: 10 }),
      read("r-fb-e", "Tracked entries", col + 1, row, { kind: "entries", limit: 6 }),
      n("a-fb", "answer", "Answer: a fact", col + 2, row, { mode: "answer", fromNodeIds: ["r-fb-t", "r-fb-e"] }),
    ],
    edges: [e(from, "r-fb-t"), e("r-fb-t", "r-fb-e"), e("r-fb-e", "a-fb"), e("a-fb", "chk")],
  }
}

export function askFlow(): Flow {
  const nodes: FlowNode[] = [
    n("msg", "message", "Question", 0, 2.5),
    n("x-plan", "extract", "Plan the search", 1, 2.5, { system: PLAN_SYSTEM, question: "Make the search plan for this question.", fields: PLAN_FIELDS }),
    n("rel", "related", "Related words", 2, 2.5, { max: 8 }),

    // One front door instead of four yes/no gates. Code settles the plain shapes by pattern, so a
    // question like "when was the last time…" or "how many…" costs no model call at all.
    n("r-kind", "route", "What is asked?", 3, 1.5, {
      question: "What does this question ask for?",
      maxRoutes: 1,
      routes: [
        { key: "last", label: "when last or first", hint: "asks WHEN something last, first, or most recently happened", pattern: "\\b(last time|when (did|was) (i|the|it)\\b.*\\b(last|first)\\b|when was the (last|first)|most recently|how long (has it been )?since)\\b" },
        { key: "count", label: "how many or how long", hint: "asks HOW MANY times, HOW OFTEN, or HOW LONG in total", pattern: "\\b(how many|how often|how long|how much time)\\b" },
        { key: "with", label: "while with someone", hint: "asks what the person does, wears, eats, or says WHEN they are with a named person or at a named place", pattern: "\\bwhen i('m| am| was)? (hang|hung|out|with)\\b.*\\bwith\\b|\\bwhen i('m| am)? with\\b" },
      ],
    }),
    read("r-last-e", "Tracked entries", 4, 0, { kind: "entries", limit: 8 }),
    read("r-last-t", "Messages and notes", 5, 0, { kind: "text", limit: 8 }),
    n("a-last", "answer", "Answer: last time", 6, 0, {
      mode: "answer",
      fromNodeIds: ["r-last-e", "r-last-t"],
      extra:
        "For this question, list the single most recent matching row across all evidence by its date and time, and say how many days before TODAY it was. " +
        "A tracked entry and a message about the same moment are one event.",
    }),

    read("r-count-e", "Tracked entries", 4, 1, { kind: "entries", limit: 10 }),
    read("r-count-t", "Messages and notes", 5, 1, { kind: "text", limit: 6 }),
    n("a-count", "answer", "Answer: counts", 6, 1, {
      mode: "answer",
      fromNodeIds: ["r-count-e", "r-count-t"],
      extra:
        "For this question, lead with the numbers from FACTS COUNTED BY CODE (rows, different days, minutes) and name the time span they cover. " +
        "Do not add the rows together yourself; if the facts do not give the number asked, say so.",
    }),

    read("r-with", "Days with them", 4, 2, { kind: "overlap", limit: 14 }),
    n("a-with", "answer", "Answer: with a person", 5, 2, {
      mode: "answer",
      fromNodeIds: ["r-with"],
      extra:
        "For this question, the evidence is rows from days that include the named person. Name the most repeated answer from the tally and the rows, " +
        "say how many days with that person the notes show, and say plainly when it is a small sample. If the subject never appears on those days, say the notes do not record it.",
    }),

    // No route fired (any other question about the person, or one nothing fits): read plainly, then say.
    n("fb", "fallback", "Nothing fired", 3, 3.2),
    ...plainLane("fb", 4, 3.2).nodes,

    CHECK("chk", 7, 1.5),
  ]
  const edges: FlowEdge[] = [
    e("msg", "x-plan"), e("x-plan", "rel"),
    e("rel", "r-kind"), e("rel", "fb"),
    e("r-kind", "r-last-e", "r:last"), e("r-last-e", "r-last-t"), e("r-last-t", "a-last"), e("a-last", "chk"),
    e("r-kind", "r-count-e", "r:count"), e("r-count-e", "r-count-t"), e("r-count-t", "a-count"), e("a-count", "chk"),
    e("r-kind", "r-with", "r:with"), e("r-with", "a-with"), e("a-with", "chk"),
    ...plainLane("fb", 4, 3.2).edges,
  ]
  return { version: 1, nodes, edges }
}

export function topicFlow(): Flow {
  const nodes: FlowNode[] = [
    n("msg", "message", "Topic", 0, 1),
    n("x-plan", "extract", "Plan the search", 1, 1, {
      system: PLAN_SYSTEM,
      question: "Make the search plan for summarizing this topic. intent is summary.",
      fields: PLAN_FIELDS,
    }),
    n("rel", "related", "Related words", 2, 1, { max: 10 }),
    read("r-text", "Messages and notes", 3, 1, { kind: "text", limit: 16 }),
    read("r-ent", "Tracked entries", 4, 1, { kind: "entries", limit: 8 }),
    n("g-person", "gate", "Is it a person?", 5, 1, {
      question: "Is the topic a person (a name)? Yes: 'elijah', 'summarize what i said about rebecca'. No: projects, things, places, ideas.",
    }),
    read("r-over", "Days with them", 6, 0, { kind: "overlap", limit: 10 }),
    n("a-person", "answer", "Summary: a person", 7, 0, {
      mode: "summarize",
      fromNodeIds: ["r-text", "r-ent", "r-over"],
      extra:
        "The topic is a person. Say how often and over what dates they show up, what the person did with them, " +
        "and anything the notes say the person feels, plans, or owes them. Do not describe who they are beyond the rows.",
    }),
    n("a-topic", "answer", "Summary: a topic", 6, 2, {
      mode: "summarize",
      fromNodeIds: ["r-text", "r-ent"],
      extra:
        "The topic is a project or idea. Split into: what was done (dates), what was decided, and what is still open or a to-do. Say how much time was tracked if the facts give minutes.",
    }),
    CHECK("chk", 8, 1),
  ]
  const edges: FlowEdge[] = [
    e("msg", "x-plan"), e("x-plan", "rel"), e("rel", "r-text"), e("r-text", "r-ent"), e("r-ent", "g-person"),
    e("g-person", "r-over", "yes"), e("r-over", "a-person"), e("a-person", "chk"),
    e("g-person", "a-topic", "no"), e("a-topic", "chk"),
  ]
  return { version: 1, nodes, edges }
}

export function dayFlow(): Flow {
  const nodes: FlowNode[] = [
    n("msg", "message", "Day", 0, 1),
    n("x-theme", "extract", "Main topics", 1, 1, {
      question: "Name the main topics in this day of messages, as single words a person would search for.",
      fields: [
        { name: "subject", type: "string", hint: "the one topic that took the most messages, one to three words" },
        { name: "days", type: "number", hint: "always 1" },
      ],
    }),
    read("r-day", "Everything that day", 2, 0, { kind: "day", limit: 60 }),
    read("r-more", "Earlier on the topic", 2, 2, { kind: "text", limit: 8, days: 14 }),
    n("a-day", "answer", "Recap the day", 3, 1, {
      mode: "summarize",
      fromNodeIds: ["r-day", "r-more"],
      extra:
        "This is one day. Say when it started and ended, what took the time (use the minutes the facts give), where the person was, who they were with, " +
        "and how they felt if a mood is tracked. End with one line on what carried over from earlier days if the notes show it.",
    }),
    CHECK("chk", 4, 1),
  ]
  const edges: FlowEdge[] = [
    e("msg", "x-theme"), e("x-theme", "r-day"), e("r-day", "r-more"), e("r-more", "a-day"), e("a-day", "chk"),
  ]
  return { version: 1, nodes, edges }
}

/**
 * What was I doing, read from one day of phone texts. Code counts when the person
 * was sending and where the quiet stretches were; the model only reads the lines
 * and says what each stretch suggests, naming the text it used. Tracked blocks
 * for the same day come along so a confirmed block is never contradicted.
 */
export function textsDayFlow(): Flow {
  const nodes: FlowNode[] = [
    n("msg", "message", "Day of texts", 0, 1, { entry: "texts-day" }),
    read("r-texts", "That day's texts", 1, 0, { kind: "texts", days: 1, limit: 70 }),
    read("r-day", "Tracked that day", 1, 2, { kind: "day", limit: 40 }),
    n("a-doing", "answer", "What was I doing", 2, 1, {
      mode: "summarize",
      fromNodeIds: ["r-texts", "r-day"],
      extra:
        "This is one day of the person's phone texts (the lines marked 'text to' are what they sent) plus whatever was tracked. " +
        "Say what they were probably doing, stretch by stretch, from what they wrote: errands, meals, travel, work, who they were with. " +
        "A stretch with no text from them is unknown, not asleep and not idle, unless a tracked row says otherwise. " +
        "Do not turn what someone else wrote into something the person did. Quote the clock of the text you used.",
    }),
    CHECK("chk", 3, 1),
    n("x-mood", "extract", "Mood hint (weak)", 1, 3, {
      system:
        "You read one day of a person's phone texts and say how they seemed to feel, in a few words, only from their own words. If the texts are just logistics, answer neutral and none.",
      question: "How did the person seem to feel today?",
      fields: [
        { name: "mood", type: "string", hint: "a few words, or neutral" },
        { name: "sure", type: "enum", options: ["clear", "weak", "none"] },
      ],
    }),
  ]
  const edges: FlowEdge[] = [e("msg", "r-texts"), e("r-texts", "r-day"), e("r-day", "a-doing"), e("a-doing", "chk"), e("msg", "x-mood")]
  return { version: 1, nodes, edges }
}

// ---------------------------------------------------------------------------
// Routed flows: a front door picks one lane instead of asking every lane at once
// ---------------------------------------------------------------------------

import { defaultFlow } from "./default-flow"
import type { RouteDef } from "./types"

const route = (id: string, label: string, col: number, row: number, routes: RouteDef[], question: string) =>
  n(id, "route", label, col, row, { routes, question, maxRoutes: 1 })

const start = (id: string, label: string, entry: string, row: number) => n(id, "message", label, 0, row, { entry })

const handoff = (id: string, label: string, flowId: string, col: number, row: number) => n(id, "handoff", label, col, row, { flowId })

/**
 * The log flow, routed. Three start nodes (BIM text, phone capture, time-grid
 * note). BIM text asks one coarse question first (doing / keeping / self /
 * people), then one narrow one inside that family, so a line reaches one or two
 * lanes instead of all ten. Reuses the lane nodes of the starter log flow.
 */
function routedLogMaster(): Flow {
  const lanes = new Map(defaultFlow().nodes.map((x) => [x.id, x]))
  const lane = (id: string, col: number, row: number): FlowNode => ({ ...lanes.get(id)!, x: 30 + col * COL, y: 30 + row * ROW })

  const nodes: FlowNode[] = [
    start("s-bim", "BIM text", "bim-text", 3),
    start("s-phone", "Phone capture", "phone-capture", 7.5),
    start("s-grid", "Time-grid note", "time-grid", 11),

    n("g-cmd", "gate", "A command or question?", 1, 7.5, {
      question: "Is it a request or question to the app (remind me, add, make, create, build, set up, what is, when did I) rather than a note about the person's own day? A request asks the app to make or keep something, or to look something up. Yes: 'remind me to call mom', 'when did i last shower', 'add milk to my groceries', 'make a new list for movies'. No: 'making pasta', 'tired'.",
      // Taught from the build-request test failures (the gate said no to all four). Worded differently from the test inputs on purpose.
      examples: [
        { text: "Make me a new habit called drink more water that tracks itself from my steps", answer: "yes" },
        { text: "Add 'buy stamps' to my errands list", answer: "yes" },
        { text: "Make a list called 'books to read' in a new folder 'reading'", answer: "yes" },
        { text: "I keep losing track of recipes I want to try, I need a place for those", answer: "yes" },
        { text: "I need a place to track my water", answer: "yes" },
        { text: "Create a folder for recipes", answer: "yes" },
        { text: "Remind me to call mom tomorrow", answer: "yes" },
        { text: "What did I eat on Tuesday?", answer: "yes" },
        { text: "Making pasta", answer: "no" },
        { text: "Need more macbook bricks", answer: "no" },
        { text: "Made a list of errands earlier and finished three", answer: "no" },
        { text: "Tired, the list is too long", answer: "no" },
      ],
    }),
    handoff("h-ask", "Hand to Ask", "ask", 2, 6.8),

    route("r-family", "What kind of line?", 1, 2, [
      { key: "doing", label: "doing or place", hint: "what the person is doing, started, finished, or where they are", pattern: "\\b(starting|started|since \\d|finished|done with|back (home|from))\\b" },
      { key: "keeping", label: "keep on a list", hint: "an idea, task, or thing to buy worth keeping" },
      { key: "self", label: "body or mind", hint: "ate or took something, a feeling, a symptom, a dream", pattern: "\\b(dream|dreamt|dreamed)\\b" },
      { key: "people", label: "people", hint: "names a person, or says who they are with" },
    ], "What kind of line is this?"),

    route("r-doing", "Doing which?", 2, 0, [
      { key: "activity", label: "an activity", hint: "starts, ends, or is in the middle of something" },
      { key: "habit", label: "a habit", hint: "exercise, cleaning, water, stretching, going outside, brushing teeth" },
      { key: "place", label: "a place", hint: "says where they are or went" },
    ], "Which of these is the line about?"),
    route("r-self", "Body or mind?", 2, 3.2, [
      { key: "intake", label: "ate / drank / took", hint: "food, drink, a substance" },
      { key: "mood", label: "a feeling", hint: "how they feel emotionally" },
      { key: "body", label: "a body state", hint: "a symptom, pain, tired, hungry" },
      { key: "dream", label: "a dream", hint: "from sleep" },
    ], "Which of these is the line about?"),
    route("r-people", "Who?", 2, 5.4, [
      { key: "person", label: "names a person", hint: "a specific other person" },
      { key: "with", label: "is with someone", hint: "hanging out, lunch with" },
    ], "Which of these is the line about?"),

    route("r-grid", "Grid note about?", 1, 11, [
      { key: "with", label: "who with", hint: "says who the person was with" },
      { key: "intake", label: "ate / drank / took", hint: "food, drink, a substance" },
      { key: "mood", label: "a feeling", hint: "how they felt" },
      { key: "person", label: "mentions a person", hint: "a name" },
    ], "The pen for this entry is already known. What does the note add?"),

    lane("s-pens", 3, 0), lane("c-pen", 4, 0), lane("x-time", 5, 0), lane("blocks", 6, 0),
    lane("s-habit", 3, 1), lane("c-habit", 4, 1), lane("p-habit", 5, 1),
    lane("s-loc", 3, 2), lane("c-loc", 4, 2), lane("p-loc", 5, 2),
    lane("s-items", 3, 3.4), lane("c-list", 4, 3.4), lane("p-list", 5, 3.4),
    lane("x-intake", 3, 4.4), lane("p-intake", 4, 4.4),
    lane("x-mood", 3, 5.4), lane("p-mood", 4, 5.4),
    lane("p-body", 3, 6.4), lane("p-dream", 3, 7.4),
    lane("s-people", 3, 8.6), lane("c-person", 4, 8.6), lane("p-person", 5, 8.6),
    lane("s-comp", 3, 9.6), lane("c-comp", 4, 9.6), lane("p-comp", 5, 9.6),
  ]
  const edges: FlowEdge[] = [
    e("s-bim", "r-family"),
    e("s-phone", "g-cmd"), e("g-cmd", "h-ask", "yes"), e("g-cmd", "r-family", "no"),
    e("s-grid", "r-grid"),
    e("r-family", "r-doing", "r:doing"), e("r-family", "s-items", "r:keeping"), e("r-family", "r-self", "r:self"), e("r-family", "r-people", "r:people"),
    e("r-doing", "s-pens", "r:activity"), e("r-doing", "s-habit", "r:habit"), e("r-doing", "s-loc", "r:place"),
    e("r-self", "x-intake", "r:intake"), e("r-self", "x-mood", "r:mood"), e("r-self", "p-body", "r:body"), e("r-self", "p-dream", "r:dream"),
    e("r-people", "s-people", "r:person"), e("r-people", "s-comp", "r:with"),
    e("r-grid", "s-comp", "r:with"), e("r-grid", "x-intake", "r:intake"), e("r-grid", "x-mood", "r:mood"), e("r-grid", "s-people", "r:person"),
    e("s-pens", "c-pen"), e("c-pen", "x-time"), e("x-time", "blocks"),
    e("s-habit", "c-habit"), e("c-habit", "p-habit"),
    e("s-loc", "c-loc"), e("c-loc", "p-loc"),
    e("s-items", "c-list"), e("c-list", "p-list"),
    e("x-intake", "p-intake"), e("x-mood", "p-mood"),
    e("s-people", "c-person"), e("c-person", "p-person"),
    e("s-comp", "c-comp"), e("c-comp", "p-comp"),
  ]
  return { version: 1, nodes, edges }
}

/**
 * Ritual and reason intake. Three start nodes, each with its own first step:
 * a reason typed beside a task is compared with the earlier reasons for that
 * same task; a night ritual is routed by what the person wrote; a morning
 * intention is compared with earlier plans.
 */
function ritualMaster(): Flow {
  const nodes: FlowNode[] = [
    start("s-reason", "Why-blocked reason", "miss-reason", 0),
    start("s-night", "Night ritual", "ritual-night", 3),
    start("s-morning", "Morning ritual", "ritual-morning", 6),

    n("x-reason", "extract", "Read the reason", 1, 0, {
      question: "A task title, then the reason the person typed. Pull out the task and what the reason really says.",
      system:
        "You read a reason a person gave for not doing a task. subject: the task's own words, one to three words. " +
        "preset: the closest preset reason. said: what the words say is really in the way (energy, no clear first step, waiting on someone, fear of the result, too big, no time, unclear). JSON only.",
      fields: [
        { name: "subject", type: "string", hint: "the task, one to three words" },
        { name: "preset", type: "enum", options: ["no-energy", "missing-input", "procrastination", "no-time", "blocked-by-other", "other"] },
        { name: "said", type: "enum", options: ["energy", "no_first_step", "waiting_on_someone", "fear_of_result", "too_big", "no_time", "unclear"] },
      ],
    }),
    n("r-same", "retrieve", "Earlier reasons, same task", 2, 0, { retrieve: { kind: "dataset", datasetId: "miss-reasons", limit: 12 } }),
    n("r-pushed", "retrieve", "Push history", 3, 0, { retrieve: { kind: "dataset", datasetId: "pushed-tasks", limit: 6 } }),
    n("a-reason", "answer", "Same reason again?", 4, 0, {
      mode: "insight",
      fromNodeIds: ["r-same", "r-pushed"],
      insightKinds: ["pattern", "question"],
      maxInsights: 2,
      minRows: 1,
      lens: "Compare the reason just given with the earlier reasons for this same task. Is it the same reason again, a changed reason, or a reason that does not match what the words say? Ask the one question that would find what is really in the way.",
    }),

    route("r-night", "What did they write?", 1, 3, [
      { key: "worry", label: "a worry or 'should'", hint: "worry, guilt, 'I keep…', 'I should have'", pattern: "\\b(keep (saying|putting|pushing)|again|should have|worried|guilt)\\b" },
      { key: "plan", label: "a plan", hint: "what they will do tomorrow or next" },
      { key: "thanks", label: "gratitude", hint: "grateful, thankful, appreciated" },
      { key: "judge", label: "a judgment of the day", hint: "good day, bad day, wasted, productive" },
    ], "What is the main thing in this ritual answer?"),
    n("r-worry", "retrieve", "Same worry before", 2, 2.2, { retrieve: { kind: "dataset", datasetId: "ritual-answers", limit: 14 } }),
    n("a-worry", "answer", "Has this come up?", 3, 2.2, {
      mode: "insight", fromNodeIds: ["r-worry"], insightKinds: ["pattern", "thought_pattern", "question"], maxInsights: 2, minRows: 3,
      lens: "Has this worry or 'I keep…' appeared in earlier ritual answers? Say how often, in what words, and ask one question about what has been tried.",
    }),
    n("r-plans", "retrieve", "Earlier plans", 2, 3.2, { retrieve: { kind: "dataset", datasetId: "ritual-answers", sources: ["Next plans"], limit: 14 } }),
    n("a-plan", "answer", "Plan vs earlier plans", 3, 3.2, {
      mode: "insight", fromNodeIds: ["r-plans"], insightKinds: ["pattern", "question", "idea"], maxInsights: 2, minRows: 3,
      lens: "Does this plan repeat earlier plans that were not done? Name the repeats, and propose one smaller first step.",
    }),
    n("r-judge", "retrieve", "How days were judged", 2, 4.2, { retrieve: { kind: "dataset", datasetId: "ritual-answers", sources: ["Look back", "Summary"], limit: 14 } }),
    n("a-judge", "answer", "Self-judgment wording", 3, 4.2, {
      mode: "insight", fromNodeIds: ["r-judge"], insightKinds: ["thought_pattern", "question"], maxInsights: 2, minRows: 3,
      lens: "How does the person judge their days, in their own words? Quote the wording that repeats and what it measures against.",
    }),

    n("r-intent", "retrieve", "Earlier plans", 1, 6, { retrieve: { kind: "dataset", datasetId: "ritual-answers", sources: ["Next plans", "morning"], limit: 14 } }),
    n("a-intent", "answer", "Is today's plan new?", 2, 6, {
      mode: "insight", fromNodeIds: ["r-intent"], insightKinds: ["pattern", "idea", "question"], maxInsights: 2, minRows: 3,
      lens: "Compare this morning's intentions with earlier plans and intentions. Which repeat without evidence they were done? Suggest one change to how today's list is written.",
    }),
  ]
  const edges: FlowEdge[] = [
    e("s-reason", "x-reason"), e("x-reason", "r-same"), e("r-same", "r-pushed"), e("r-pushed", "a-reason"),
    e("s-night", "r-night"),
    e("r-night", "r-worry", "r:worry"), e("r-worry", "a-worry"),
    e("r-night", "r-plans", "r:plan"), e("r-plans", "a-plan"),
    e("r-night", "r-judge", "r:judge"), e("r-judge", "a-judge"),
    e("s-morning", "r-intent"), e("r-intent", "a-intent"),
  ]
  return { version: 1, nodes, edges }
}

/** Nodes reachable from one start node, packed so the screen shows a single routing with no gaps. */
function only(master: Flow, startId: string): Flow {
  const keep = new Set<string>([startId])
  for (let grew = true; grew; ) {
    grew = false
    for (const ed of master.edges) if (keep.has(ed.from) && !keep.has(ed.to)) (keep.add(ed.to), (grew = true))
  }
  const nodes = master.nodes.filter((x) => keep.has(x.id))
  const ys = [...new Set(nodes.map((x) => x.y))].sort((a, b) => a - b)
  const xs = [...new Set(nodes.map((x) => x.x))].sort((a, b) => a - b)
  return {
    version: 1,
    nodes: nodes.map((x) => ({ ...x, x: 30 + xs.indexOf(x.x) * COL, y: 30 + ys.indexOf(x.y) * ROW * 0.85 })),
    edges: master.edges.filter((ed) => keep.has(ed.from) && keep.has(ed.to)),
  }
}

// One screen per door. Each has a single start node; pick the view, then try inputs against it.
export const routedLogFlow = () => only(routedLogMaster(), "s-bim")
export const phoneCaptureFlow = () => only(routedLogMaster(), "s-phone")
export const timeGridNoteFlow = () => only(routedLogMaster(), "s-grid")
export const reasonFlow = () => only(ritualMaster(), "s-reason")
export const nightRitualFlow = () => only(ritualMaster(), "s-night")
export const morningRitualFlow = () => only(ritualMaster(), "s-morning")

/**
 * Ask, counted by code. A premise guard stops a question about something the
 * notes never mention. A plan names the subject and span, a `compute` node does
 * the counting (minutes, streaks, gaps, week over week), and the model only
 * phrases the facts it is handed. A name that fits two people is asked about
 * instead of guessed.
 */
export function askCalcFlow(): Flow {
  const compute = (id: string, label: string, row: number, fn: NonNullable<FlowNode["config"]["compute"]>["fn"]) => n(id, "compute", label, 5, row, { compute: { fn } })
  const gate = (id: string, label: string, row: number, question: string) => n(id, "gate", label, 4, row, { question })
  const nodes: FlowNode[] = [
    n("msg", "message", "Question", 0, 2),
    n("c-who", "clarify", "Which person?", 1, 2, { clarifyKind: "person" }),
    n("x-plan", "extract", "Plan the search", 2, 2, { system: PLAN_SYSTEM, question: "Make the search plan for this question.", fields: PLAN_FIELDS }),
    n("k-known", "guard", "Ever written down?", 3, 2),
    gate("g-minutes", "How long in total?", 0, "Does it ask how long, how many hours or minutes in total? Yes: 'how many hours did i work this week'. No: 'how many times', 'when last'."),
    gate("g-streak", "In a row?", 1, "Does it ask about a streak, days in a row, or how consistent? Yes: 'how many days in a row did i go outside'. No: single totals."),
    gate("g-since", "How long since?", 2, "Does it ask how long it has been since something, or when it last happened? Yes: 'how long since i showered'. No: totals or streaks."),
    gate("g-gap", "Longest without?", 3, "Does it ask for the longest time or number of days the person went WITHOUT something, or the biggest gap between times? Yes: 'what is the longest i went without walking', 'longest i have gone without the gym this month', 'biggest gap between showers'. No: 'how long since i last showered', 'how many days in a row'."),
    gate("g-compare", "Versus before?", 4, "Does it compare to before: more or less than last week, trending up or down? Yes: 'am i walking more than last week'. No: otherwise."),
    gate("g-count", "How many times?", 5, "Does it ask how many times or how often something happened? Yes: 'how many times did i cook'. No: otherwise."),
    compute("c-minutes", "Minutes", 0, "minutes"),
    compute("c-streak", "Streak", 1, "streak"),
    compute("c-since", "Days since", 2, "days-since"),
    compute("c-gap", "Longest gap", 3, "longest-gap"),
    compute("c-compare", "Compare", 4, "compare"),
    compute("c-count", "Count", 5, "count"),
    n("a-calc", "answer", "Say the numbers", 6, 2.5, {
      mode: "answer",
      fromNodeIds: ["c-minutes", "c-streak", "c-since", "c-gap", "c-compare", "c-count"],
      extra: "Every number comes from FACTS COUNTED BY CODE. Repeat them as given and name the span they cover. Never add, subtract, or round them yourself.",
    }),
    // None of the six counting gates said yes: read plainly instead of ending with no answer.
    n("fb", "fallback", "No count fired", 5, 6.5),
    ...plainLane("fb", 6, 6.5).nodes,
    CHECK("chk", 7, 2.5),
  ]
  const lanes = ["minutes", "streak", "since", "gap", "compare", "count"]
  const edges: FlowEdge[] = [
    e("msg", "c-who"),
    e("c-who", "x-plan", "no"),
    e("x-plan", "k-known"),
    ...lanes.map((l) => e("k-known", `g-${l}`, "yes")),
    ...lanes.flatMap((l) => [e(`g-${l}`, `c-${l}`, "yes"), e(`c-${l}`, "a-calc")]),
    e("a-calc", "chk"),
    e("k-known", "fb", "yes"),
    ...plainLane("fb", 6, 6.5).edges,
  ]
  return { version: 1, nodes, edges }
}

/**
 * Grammar first. BIM's own command grammar (`lib/ingest/parse-message.ts`) already
 * knows `log:`, `intake:`, `dh:`, a link as the first word, and the read
 * commands (`groc`, `lists`, `info`). A line that matches one is decided by
 * code with no model call and no second reading. Only a verb-less line goes on
 * to the routed log flow, the way the executor logs it.
 */
export function grammarFirstFlow(): Flow {
  const routes: RouteDef[] = [
    { key: "read", label: "read command", pattern: "^\\s*(groc|lists|info|ping|commands|all commands|status|habits|inbox|folders)\\s*[?!.]*$" },
    { key: "link", label: "a link first", pattern: "^\\s*(https?://|www\\.)\\S+" },
    { key: "habit", label: "dh: habit", pattern: "^\\s*dh:\\s*\\S" },
    { key: "intake", label: "intake:", pattern: "^\\s*intake:\\s*\\S" },
    { key: "log", label: "log:", pattern: "^\\s*log:\\s*\\S" },
    { key: "free", label: "no verb: a plain line", hint: "everything else", pattern: "." },
  ]
  const nodes: FlowNode[] = [
    start("s-bim", "BIM text", "bim-text", 2),
    route("r-verb", "Explicit verb?", 1, 2, routes, "Does the line start with one of BIM's verbs?"),
    n("p-link", "propose", "Inbox → Links", 2, 1, { action: "add-to-list" }),
    n("p-habit", "propose", "Habit keyword", 2, 2, { action: "habit-done" }),
    n("p-intake", "propose", "Intake line", 2, 3, { action: "intake" }),
    handoff("h-log", "Log line", "log-routed", 2, 4),
    handoff("h-free", "Plain line", "log-routed", 2, 5),
  ]
  const edges: FlowEdge[] = [e("s-bim", "r-verb"), e("r-verb", "p-link", "r:link"), e("r-verb", "p-habit", "r:habit"), e("r-verb", "p-intake", "r:intake"), e("r-verb", "h-log", "r:log"), e("r-verb", "h-free", "r:free")]
  return { version: 1, nodes, edges }
}
