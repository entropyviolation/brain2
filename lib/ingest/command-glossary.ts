/**
 * lib/ingest/command-glossary.ts — In-chat manuals for BIM
 *
 * `info` — basics + how to ask for more
 * `{prefix} info` — deep dive for one input family
 * `{prefix} commands` — every command/keyword for that family (from command-catalog)
 * `all commands` — every command and keyword across the bot (from command-catalog)
 *
 * Catalog source: `command-catalog.ts` (parser verbs, expansions, presets, GM, retired g).
 */
import { BIM_FULL, BIM_INTRO, BIM_SHORT } from "./bim"
import { formatAllCommandsBody, formatFamilyCommands } from "./command-catalog"

export type GlossaryPrefix =
  | "groc"
  | "grocery"
  | "needed"
  | "plan"
  | "habit"
  | "habits"
  | "log"
  | "event"
  | "monitor"
  | "activity"
  | "currently"
  | "todo"
  | "to do"
  | "to-do"
  | "do"
  | "add"
  | "bulk"
  | "ingest"
  | "capture"
  | "inbox"
  | "review"
  | "reviews"
  | "gm"
  | "morning"
  | "track"
  | "tracking"
  | "note"
  | "sleep"
  | "gps"
  | "screen"
  | "call"
  | "text"
  | "pin"
  | "inv"
  | "inventory"
  | "receipt"
  | "journal"
  | "pdf"
  | "read"
  | "lists"
  | "folders"
  | "search"
  | "help"
  | "mood"
  | "start"
  | "stop"
  | "iphone-notes"
  | "iphone"

const PREFIX_ALIASES: Record<string, GlossaryPrefix> = {
  g: "groc",
  groc: "groc",
  grocery: "grocery",
  groceries: "grocery",
  shop: "grocery",
  shopping: "grocery",
  needed: "needed",
  plan: "plan",
  plans: "plan",
  agenda: "plan",
  calendar: "plan",
  habit: "habit",
  habits: "habits",
  log: "log",
  event: "event",
  events: "event",
  monitor: "monitor",
  activity: "activity",
  currently: "currently",
  stopped: "currently",
  switched: "currently",
  todo: "todo",
  "to do": "to do",
  "to-do": "to-do",
  tdt: "todo",
  do: "do",
  add: "add",
  qa: "add",
  bulk: "bulk",
  "bulk add": "bulk",
  ingest: "ingest",
  capture: "capture",
  inbox: "inbox",
  review: "review",
  reviews: "reviews",
  gm: "gm",
  morning: "morning",
  track: "track",
  tracking: "tracking",
  note: "note",
  n: "note",
  sleep: "sleep",
  gps: "gps",
  geo: "gps",
  screen: "screen",
  screentime: "screen",
  call: "call",
  text: "text",
  pin: "pin",
  inv: "inv",
  inventory: "inventory",
  pantry: "inventory",
  receipt: "receipt",
  journal: "journal",
  pdf: "pdf",
  read: "read",
  lists: "lists",
  folders: "folders",
  search: "search",
  help: "help",
  info: "help",
  mood: "mood",
  start: "start",
  stop: "stop",
  "iphone-notes": "iphone-notes",
  "iphone notes": "iphone-notes",
  inotes: "iphone-notes",
  iphone: "iphone",
}

function familyOf(prefix: GlossaryPrefix): string {
  switch (prefix) {
    case "groc":
    case "grocery":
      return "grocery"
    case "needed":
      return "needed"
    case "plan":
      return "plan"
    case "habit":
    case "habits":
      return "habits"
    case "log":
    case "event":
      return "log"
    case "monitor":
    case "activity":
    case "currently":
      return "monitor"
    case "todo":
    case "to do":
    case "to-do":
    case "do":
      return "todo"
    case "add":
    case "ingest":
    case "capture":
    case "inbox":
    case "bulk":
      return "ingest"
    case "review":
    case "reviews":
    case "gm":
    case "morning":
      return "review"
    case "track":
    case "tracking":
    case "mood":
    case "start":
    case "stop":
      return "track"
    case "note":
      return "note"
    case "sleep":
      return "sleep"
    case "gps":
      return "gps"
    case "screen":
    case "iphone":
      return "screen"
    case "call":
      return "call"
    case "text":
      return "text"
    case "pin":
      return "pin"
    case "inv":
    case "inventory":
      return "inventory"
    case "receipt":
      return "receipt"
    case "journal":
    case "pdf":
      return "journal"
    case "iphone-notes":
      return "iphone-notes"
    case "read":
    case "lists":
    case "folders":
    case "search":
      return "read"
    case "help":
      return "help"
  }
}

export function resolveGlossaryPrefix(raw: string): GlossaryPrefix | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ")
  return PREFIX_ALIASES[key] ?? null
}

export const BIM_MAIN_INFO = `${BIM_INTRO}

────────────────────────────────
Basics
• Pair once from Settings → Message ingest (pair: 123456 or /start 123456).
• Case-insensitive. A verb may be followed by : or a space.
• Ambiguous names get a numbered list — reply with the number or the name.
• Retries are deduped so Telegram does not double-write.
• Pinned grocery survives a closed laptop. Live replies 24/7 need: npm run phone:hub

What you can do (families)
• Plans — plan for rn:, read plan(s) for today, agenda
• Reviews — gm / good morning, review, reviews
• Habits — hemisync, habit keywords, habit: / did: / h
• Grocery — groc (dump/add/pin); got / x / bought / check off
• Needed — needed: batteries · get: then lines → list "needed"
• To-do — to do today:, do: / next action:, read to do today
• Log — log: / log- events; smoked weed, drank water, ate …, took …
• Monitor — currently / stopped / switched to
• Capture / add — plain text, qa:, add:, inbox:, idea:, quick add: (-mb / -monkey → Monkey brain)
• Bulk — bulk: / bulk add; Name: dumps; before 9/12:
• Track — at:, track:, mood:, sleep:, start:/stop, gps:, screen:/call:/text:
• Notes — n …, day:, memo:, jot:
• Read — read: / show: / dump: / peek:, lists, folders, search, today, count, tags, ops
• Scan — receipt photo, journal/PDF → Docs, inv pantry
• iPhone Notes — iphone-notes: park from Shortcut

How to see more (from inside this chat)
• {prefix} info — detailed instructions for one family
  Examples: groc info · log info · review info · to do info · add info · bulk info · read info
• {prefix} commands — every command & keyword for that family (full explanations)
  Examples: grocery commands · habit commands · plan commands · capture commands
• all commands — one glossary of every command and keyword, every type
  (includes legacy aliases and retired bare g)

Also: help (short sheet) · ping (is ${BIM_SHORT} awake?)
On disk: docs/BIM_COMMANDS.md · docs/MESSAGE_INGEST.md`

const INFO_BY_FAMILY: Record<string, string> = {
  grocery: `${BIM_SHORT} · Grocery
What it is
  Your shopping list on the phone. Dump it, add lines, check off what you bought.
  A grocery dump pins a card in the chat so you can read it at the store offline.

How to use it
• groc  |  grocery  |  groceries  |  shop | shopping — dump and pin
• groc milk  |  grocery: eggs — add (Inbox off). Several lines = bulk.
• got milk  |  x bread, eggs  |  bought: milk | check off oats — complete open lines
• pin  |  live  |  snapshot — refresh the pin

Format tips
• One item per line for bulk.
• Bare "g" is RETIRED — use groc (or a custom shortcut). Old shortcuts to g remap to groc.
• Identical open titles ask see / again / dismiss instead of double-adding.

Send "groc commands" for every alias with explanations.`,

  needed: `${BIM_SHORT} · Needed
What it is
  A catch-all list named "needed" (created if missing).

How to use it
• needed: batteries
• needed batteries
• Several lines under needed: for bulk.
• get: then lines · get: batteries (colon required; bare get is not this command)

Each item's detail notes include: sent from text
Empty get: / needed: → nothing added.

Send "needed commands" for the glossary.`,

  plan: `${BIM_SHORT} · Plans
What it is
  Today's Plan log on Home → Plan, plus calendar agenda read-back.

How to use it
• plan for rn: then lines — appends with a time stamp ("from text")
• plan for now:  ·  plan now:  ·  plan rn:
• read plan for today  ·  latest plan
• read plans for today  ·  read plans
• agenda  ·  calendar  ·  plan — today's calendar events

Send "plan commands" for every alias.`,

  habits: `${BIM_SHORT} · Habits
What it is
  Mark daily habits done or log a count/score from a whole-message keyword
  (editable on each habit) or habit: / did: / h.

How to use it
• hemisync — done (preset)
• read 30 pages  ·  exercise 15 min …  ·  chess score 355
• habit: exercise 30  |  did: stretch  |  h stretch
• habits  |  hi  |  habit board — dump today's board
Optional yesterday. Notes stamp: from text message at {time}.

Send "habit commands" for the glossary.`,

  log: `${BIM_SHORT} · Discrete event log
What it is
  Instant tracker events (not painted intervals). Always labeled from text pipeline.

How to use it
• log: drink water  |  log-something happening
• Presets (Settings → Discrete event triggers):
  smoked weed · drank water · ate {item} · took {item}

Bare "o" is NOT a log unless you send log: o or set "o" as a trigger.

Send "log commands" for every form.`,

  monitor: `${BIM_SHORT} · Activity monitor
What it is
  Start/stop Activity-scope intervals from the phone (text pipeline).

How to use it
• currently deep work  ·  current cooking
• stopped deep work
• switched to cooking  ·  switch to email  ·  switched email

Send "monitor commands" for aliases.`,

  todo: `${BIM_SHORT} · To-do
What it is
  Home → To Do for today, plus Next Actions → General via do:.

How to use it
• to do today: call dentist  ·  todo today:  ·  do today:  ·  tdt
• do: call dentist  ·  next action: …
• read to do today
• During gm: add items (notes: logged from text), then pick 3–5 priorities

Send "to do commands" for the glossary.`,

  ingest: `${BIM_SHORT} · Capture / add / bulk / Inbox
What it is
  Free-form capture when no other verb matches, plus bulk list dumps.

How to use it
• plain text or qa: / add: / inbox: / idea: / quick add: / capture: → Inbox
• -mb or -monkey on that line → Monkey brain (a dump, not the Inbox you revisit)
• bulk: / bulk add — headers and one item per line
• Name: then lines — that list (grocery headers → store list)
• before 9/12: — following lines due that day
• Custom first-word shortcuts: Settings → Message ingest
• Built-ins: w/@ → at/where · h → help/habit · m → mood · tt/trk → track · day → today/n day · pause → stop

Send "ingest commands" or "add commands" or "bulk commands".`,

  review: `${BIM_SHORT} · Reviews & morning (GM)
What it is
  Start-of-day morning review over text, and end-of-period reviews.

Morning — text gm or good morning
1. Sleep (bed / wake / dream) — or reply "all nighter" to lift habits with an all-nighter block
2. Five affirmations, one at a time (Lists "affirmations") — voice note advances
3. Today's to-do: add items (or no/skip), then pick 3–5 priorities
4. Daily habits: optionally pick 1–3 to prioritize (or skip / no / n)
5. Go through to do list — one item at a time. Six slots:
     tier  duration  points  importance  resistance  excitement
   Dash keeps a slot unchanged. Example (points 30, duration 10m already set):
     A+ - 40 - 10 0
   Or skip that item. Empty list: BIM says so and moves on.
6. Plaintext day plan — appends today's Plan log stamped "from text" (or skip / no / n)
7. Circumstances — numbers 1–4 (must-do, must-not, events, excitement)
8. Why is today going to be the best day ever?
9. Ten things you are grateful for today

Also
• reviews — board · review / review today / review day|week|month|quarter|year
• cancel / quit / nevermind — stop a ritual
• skip or blank moves a step on

Desktop Morning Review mirrors the same flow.

Send "review commands" or "gm commands".`,

  track: `${BIM_SHORT} · Tracking
What it is
  Paint location, activity, mood, sleep, and working-now from short phrases.

How to use it
• at: gym  ·  location:  ·  here:  ·  loc:  ·  w gym  ·  @ home
• track: exercise 30m  ·  doing:  ·  tt work  ·  trk …
• mood: good  ·  m good  ·  feeling:  ·  feel:  ·  state:
• sleep: 11:30-7:00  ·  slept:
• start: write paper  ·  stop  ·  /stop  ·  pause
• where  ·  status  ·  now  ·  working now

Send "track commands" for the glossary.`,

  note: `${BIM_SHORT} · Notes
• n stuck in aisle 4  ·  note:  ·  memo:  ·  jot:
• day: tired  ·  daynote:  ·  dnote:  ·  n day:
• day alone → today

Send "note commands".`,

  sleep: `${BIM_SHORT} · Sleep
• sleep: 11:30-7:00  ·  slept:
• Inside gm: bed / wake / dream, or all nighter
• Analytics → Sleep shows nights and all-nighter days (text pipeline labeled)

Send "sleep commands".`,

  gps: `${BIM_SHORT} · GPS / location pin
• gps: Home  ·  geo:
• Telegram Live Location in the bot chat
• Arrive/Leave Shortcut → gps: lines

Send "gps commands".`,

  screen: `${BIM_SHORT} · iPhone Screen Time
• screen: Instagram 30m  ·  screentime:  ·  phone-screen:  ·  iphone:  ·  ios:
  Estimated. Signed Shortcut available.
  (iphone-notes: still wins over bare iphone when dumping Notes.)

Send "screen commands".`,

  call: `${BIM_SHORT} · iPhone Calls
• call: Jane 12m  ·  called:  ·  phone-call:

Send "call commands".`,

  text: `${BIM_SHORT} · iPhone Texts
• text: Jane on my way  ·  sms:  ·  imessage:  ·  sent:

Send "text commands".`,

  "iphone-notes": `${BIM_SHORT} · iPhone Notes park
• iphone-notes:  ·  iphone notes:  ·  phone notes:  ·  inotes:
• Continuations: iphone-notes 2/3:
Parks on Lists → iPhone Notes Store → Parked (header Phone Notes).

Send "iphone-notes commands".`,

  pin: `${BIM_SHORT} · Pin
• pin  ·  live  ·  snapshot — refresh the pinned grocery card`,

  inventory: `${BIM_SHORT} · Pantry / inventory
• inv  |  inventory  |  pantry — dump
• inv oats — bump a line

Often follows a receipt photo. Send "inv commands".`,

  receipt: `${BIM_SHORT} · Receipt OCR
• Photo of a receipt (or receipt: / slip: / reciept: caption)
  OCR → grocery check-off + pantry bump`,

  journal: `${BIM_SHORT} · Journal / PDF scan
• Journal photo or PDF → Docs folder "From phone"
• journal:  ·  notebook:  ·  pages:  ·  scan:  ·  pdf (with file)`,

  read: `${BIM_SHORT} · Read-back
• read: grocery list  ·  show:  ·  dump:  ·  peek:
• lists  ·  ls  ·  folders  ·  dirs
• read inbox  ·  show inbox  ·  dump inbox
• search: milk  ·  find:  ·  ?
• today  ·  tdy  ·  habits  ·  hi  ·  where  ·  status
• count  ·  tags  ·  ops  ·  agenda  ·  calendar
A read that matches nothing parks on iPhone Notes Store.

Send "read commands".`,

  help: `${BIM_SHORT} · Help & manuals
• help  ·  /help  ·  ?help  ·  commands — short sheet
• info  ·  /info  ·  manual  ·  instructions  ·  cmds — basics + how to dig deeper
• {prefix} info  ·  {prefix} commands
• all commands  ·  all cmds — complete catalog
• ping  ·  pong
• pair:  ·  /start {code}
On disk: docs/BIM_COMMANDS.md`,
}

export const ALL_COMMANDS = `${BIM_SHORT} (${BIM_FULL}) — every command & keyword

Every phrase below is taken from the live parser, expansions, presets, bulk dumps,
morning GM replies, and retired aliases. Retired forms are marked [RETIRED].

${formatAllCommandsBody()}

Tip: send "{prefix} info" for a deep dive on one family.
On disk: docs/BIM_COMMANDS.md`

export function glossaryInfoFor(prefixRaw: string): string | null {
  const resolved = resolveGlossaryPrefix(prefixRaw)
  if (!resolved) return null
  return INFO_BY_FAMILY[familyOf(resolved)] ?? null
}

export function glossaryCommandsFor(prefixRaw: string): string | null {
  const resolved = resolveGlossaryPrefix(prefixRaw)
  if (!resolved) return null
  const family = familyOf(resolved)
  const body = formatFamilyCommands(family)
  if (!body) return null
  return `${BIM_SHORT} · ${family} — commands & keywords\n\n${body}`
}

export function knownGlossaryPrefixes(): string[] {
  return [
    "groc",
    "needed",
    "plan",
    "habit",
    "log",
    "monitor",
    "to do",
    "add",
    "bulk",
    "ingest",
    "review",
    "gm",
    "track",
    "note",
    "sleep",
    "gps",
    "screen",
    "call",
    "text",
    "iphone-notes",
    "pin",
    "inv",
    "receipt",
    "journal",
    "read",
    "help",
  ]
}
