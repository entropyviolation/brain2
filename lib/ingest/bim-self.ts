/**
 * lib/ingest/bim-self.ts — the Self BIMBY: BIM says what it can do
 *
 * "can you answer random questions that require web search?" is a question about BIM, not about the vault.
 * Before this lane it went to the Ask flow, which searched the person's logs for "random questions" and timed
 * out. Here code reads the shape ("can you …", "are you able to …", "what can you do?") and answers from a
 * fixed sheet of what each lane does. No model, no store, no network.
 *
 * Keep the sheet true: when a lane changes what it can do, change its sentence here (and its `does` in
 * `bim-lanes.ts`, which the fold lists word for word).
 */

import { CHAT_LANES } from "./bim-lanes"

export interface SelfAnswer {
  text: string
  route: string
  /** Every lane's `does`, in order: the whole of what BIM does, for the fold. */
  evidence: string[]
}

interface Topic {
  id: string
  words: RegExp
  say: (llm: boolean) => string
}

const LLM_OFF_GENERAL = "LLM is off right now, so a general question gets no answer; turn LLM on for those."

/** One per thing BIM does. The first topics win when a line names several; at most two are said. */
const TOPICS: Topic[] = [
  {
    id: "coach",
    words: /\b(?:coach(?:ing)?|life coach|motivat\w*|remember (?:me|who i am|my goals|things about me)|know (?:me|about me)|my goals|text me|telegram|check[- ]?ins?|briefs?|remind me (?:by|on|over) (?:text|telegram))\b/i,
    say: (llm) =>
      [
        "Yes, through the Coach BIMBY. Tell me about yourself (“about me: …”, “remember that I …”, “my goals are …”) and I keep it; with LLM on I also pick up lasting things as we talk. “What do you know about me?” lists it, “forget …” drops one.",
        "“Remind me at 5pm to call mom” (or “… tomorrow at 9”, “… in 20 minutes”, “… every day at 8am”) texts you on Telegram when it's due, from the Mac hub even with the app closed. A morning brief (9:00) and an evening check-in (21:30) come by Telegram too: “morning brief at 8am”, “stop the evening check-in”.",
        `“What should I do now?” or “coach me” gives one next step from your goals and today's To Do.${llm ? "" : " With LLM off, code writes it from the list."}`,
      ].join("\n"),
  },
  {
    id: "web",
    words: /\b(?:web|internet|online|google|googl(?:e|ing)|search(?:es|ing)?|look(?:ing)? (?:things |stuff )?up|news|current events)\b/i,
    say: (llm) =>
      [
        "Yes, through the Web BIMBY. A question about the outside world is searched on the web from the Mac hub (one DuckDuckGo search, the first three pages read) and answered from those pages, with the sources in the fold. Only the search words leave the Mac.",
        "Words like “find out”, “look up”, “near me” or “is X open now?” always search. With LLM on, a question whose answer may be newer than the model (a price, a score, “the latest”, “right now”) is searched too. Other general questions (“what is the boiling point of nitrogen?”) are answered by the local model from what it already knows, so those can be out of date.",
        llm ? "" : "LLM is off right now, so a search gives you the matching passages, not a written answer.",
      ]
        .filter(Boolean)
        .join("\n"),
  },
  {
    id: "general",
    words: /\b(?:random|general|trivia|any question|questions about anything|anything)\b/i,
    say: (llm) =>
      [
        "With LLM on, yes. A question that names nothing in your vault goes to the local model and is answered from what it knows; one whose answer may be newer than the model (a price, a score, “the latest”) is searched on the web first.",
        llm ? "" : LLM_OFF_GENERAL,
      ]
        .filter(Boolean)
        .join("\n"),
  },
  {
    id: "texts",
    words: /\b(?:texts?|messages?|imessages?|dms?)\b/i,
    say: () => "Yes, I can read them. “What was Marilyn talking about in her last text to me?” is answered from the texts themselves.",
  },
  {
    id: "todo",
    words: /\b(?:to ?dos?|tasks?|remind(?:ers?)?|lists?)\b/i,
    say: () =>
      "Yes. “Don't forget to X” or “need to X” goes on To Do, and “to do later X to do later Y” makes one each. “Remind me at 5pm to X” makes a Reminder that texts you on Telegram. “<fact>, remind me if <situation>” is kept and said back only in that situation. “Have to do before leaving for New York:” with a line per thing makes a trip list.",
  },
  {
    id: "habits",
    words: /\bhabits?\b/i,
    say: () => "Yes. “Did skincare, stretched, drank water” goes to the Habits BIMBY, which proposes the cells. “X so counts as skincare” checks the habit for today with X as the note.",
  },
  {
    id: "money",
    words: /\b(?:money|spend(?:ing)?|spent|budget|owe[sd]?|paid|financ(?:e|es|ial))\b/i,
    say: () => "Yes. A line about money (spent, owes, paid back, a discount, regret over a purchase) goes to the Financial BIMBY, which files it and says what your history shows.",
  },
  {
    id: "plan",
    words: /\b(?:plan(?:ning)?|schedule|my day)\b/i,
    say: () => "Yes. A list of the rest of the day becomes a plan card you can edit; “help me plan the rest of my day” makes me ask for the list.",
  },
  {
    id: "people",
    words: /\b(?:people|friends?|birthdays?|instagram|hang ?outs?)\b/i,
    say: () => "Yes. A line about a person (a new friend, a DM, a hang-out you want, a birthday) becomes a card with the person, a note and a reminder. “When did I last see Marilyn?” reads their Last seen.",
  },
  {
    id: "flights",
    words: /\b(?:flights?|flying|trips?|travel(?:ing)?|bookings?)\b/i,
    say: () => "Yes. Paste a booking confirmation and I make the Flight items and calendar events; “when am I flying to New York?” is answered from them.",
  },
  {
    id: "commands",
    words: /\b(?:commands?|shell|terminal)\b/i,
    say: () => "Yes. “Remember this command to …” keeps a shell command, and “what's the command to …?” says it back.",
  },
  {
    id: "food",
    words: /\b(?:food|meals?|ate|eaten|calories|kcal|nutrition(?:al)?|macros|recipes?)\b/i,
    say: () => "Yes. Tell me what you ate, as loosely as you like (“yesterday a whole container of ravioli with cheddar and 2 Red Bulls”), and the Food BIMBY reads it into meals, looks up each part (your saved foods, USDA, Open Food Facts, then an estimate), and files each on the Food book with the numbers. A homemade dish is saved as a recipe card. “Undo that” takes it back.",
  },
  {
    id: "tracking",
    words: /\b(?:track(?:ing)?|log(?:s|ging)?|food|mood|meds?|sleep|intakes?)\b/i,
    say: () => "Yes. Plain lines are filed as logs: “took another addy”, “starting dishes”, “done with shower”. “Mark that …” logs what follows, and the **ask me** key asks what you're doing or how you feel.",
  },
  {
    id: "data",
    words: /\b(?:my (?:data|notes|logs|history|vault|stuff)|about me|remember(?: things)?|what i (?:did|said|ate))\b/i,
    say: (llm) =>
      `Yes. Ask about your own data (“when did I last see Marilyn?”, “how often was I nauseous this month?”) and I read your logs, notes, tasks and habits and answer with the rows in the fold.${llm ? "" : " With LLM off, code looks for the rows that name the question's words."}`,
  },
]

const OVERVIEW = [
  "Here is what I do:",
  "• Answer questions about your own data (logs, notes, tasks, habits, texts), with the rows in the fold.",
  "• Search the web for questions about the outside world, through the Mac hub.",
  "• Answer general questions from the local model when LLM is on.",
  "• File what you tell me: To Dos, logs, habits, money, people, flights, facts.",
  "• Turn a list of the rest of your day into a plan card.",
  "• Keep shell commands and say them back.",
  "• Remember who you are and your goals, text you reminders and a daily brief on Telegram, and coach you to the next step.",
  "Ask “can you …?” about any of these for more.",
].join("\n")

// "hey bim, so can you …" → "can you …"
const LEAD = /^(?:(?:hey|hi|ok(?:ay)?|so|also|and|but|wait|quick question|question)\b[\s,:-]*)*(?:bim\b[\s,:-]*)?/i

/** "what can you do?", "how do you work?", "what are your features?": the overview. */
const ASKS_ALL =
  /^(?:what (?:(?:all|else|exactly) )?(?:can|could) (?:you|bim|u) (?:do|help (?:me )?with)|what (?:are|r) (?:you|u) (?:able|capable) (?:to do|of)|what (?:do|does) (?:you|bim|u) do|how do (?:you|u) work|what (?:are|r) your (?:capabilities|features|skills|abilities)|what can i (?:ask|tell|say to) (?:you|bim|u))\b/i

/** "can you …", "are you able to …", "do you know how to …", "is BIM able to …". */
const OPENER =
  /^(?:can|could|will) (?:you|bim|u)(?: ever| also| even| actually)?\b|^(?:are|r) (?:you|u) (?:able|capable)(?: to| of)?\b|^(?:is|does) bim\b|^do (?:you|u) (?:know how to|have access to|support|handle|ever)\b|^is it possible for (?:you|u|bim) to\b|^(?:do|does) (?:you|u|bim) have (?:web|internet) access\b/i

/** The rest names a kind of thing, not one thing: a question about BIM, not a request. */
const GENERIC = /\b(?:questions|things|stuff|in general|generally|kinds? of|types? of|random|access|ever)\b/i

/** The rest starts like a request ("can you add milk", "can you tell me when …"): the lanes that do it should have it. */
const REQUEST = /^(?:tell me|show me|give me|add|put|log|file|mark|make|send|order|buy|text|call|move|delete|remove|check|set|change|plan my|find (?:out|me)|look (?:it|that|this) up|what|when|where|who|how (?:much|many|long))\b/i

const BROAD = new Set(["general", "tracking"])

export type SelfAsk = { kind: "all" } | { kind: "can"; topics: Topic[] }

/** Whether a line asks what BIM can do, and about which topics. Null when it is anything else. */
export function readSelfQuestion(text: string): SelfAsk | null {
  const t = text.trim().replace(LEAD, "").replace(/\s+/g, " ")
  if (t.length < 4 || t.length > 200 || t.includes("\n")) return null
  if (ASKS_ALL.test(t) && (t.split(" ").length <= 9 || /\?\s*$/.test(t))) return { kind: "all" }
  const m = OPENER.exec(t)
  if (!m) return null
  const rest = t.slice(m[0].length).trim().replace(/[?.!\s]+$/, "")
  if (REQUEST.test(rest)) return null
  const topics = TOPICS.filter((topic) => topic.words.test(rest))
  const generic = GENERIC.test(rest) || /\bdo you have (?:web|internet) access\b/i.test(t)
  // A short "can you search the web?" is about BIM; "can you search the web for laundromats near me" is a request.
  const short = rest.split(" ").length <= 5 && !/\b(?:for|about|near|at|on|by|in)\b/i.test(rest)
  if (generic || (short && topics.length)) return { kind: "can", topics }
  return null
}

/** The reply to a question about BIM itself, or null when the line is not one. */
export function answerSelf(text: string, opts: { llm: boolean }): SelfAnswer | null {
  const asked = readSelfQuestion(text)
  if (!asked) return null
  const evidence = CHAT_LANES.map((l) => `${l.id}: ${l.does}`)
  if (asked.kind === "all") return { text: OVERVIEW, route: "SELF · overview · code", evidence }
  // "general" and "tracking" are the broad ones: said only when nothing narrower was named ("track habits" is habits).
  const narrow = asked.topics.filter((t) => !BROAD.has(t.id))
  const picked = (narrow.length ? narrow : asked.topics).slice(0, 2)
  if (!picked.length) return { text: `I can't tell which part you mean. ${OVERVIEW}`, route: "SELF · overview · code", evidence }
  return { text: picked.map((t) => t.say(opts.llm)).join("\n\n"), route: `SELF · ${picked.map((t) => t.id).join(", ")} · code`, evidence }
}
