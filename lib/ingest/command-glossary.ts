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
• Rituals — gm / gn / rituals / review / ritual start week
• Habits — dh: keyword, habit: / did: / h (bare keywords do not log)
• Grocery — groc (dump/add/pin); got / x / bought / check off
• Needed — needed: batteries · get: then lines → list "needed"
• To-do — to do today:, do: / next action:, read to do today
• Log — switch: (view, from:, to:) / log categories / log: or log (colon optional; loc: place) / tp: / thought process: / log: tp: (Thought process: a guiding strand of this moment — why you are doing something, what you expect next, and how it lands; not a general note, a one-word mood, or a short activity log such as brushed teeth) / intake: / intake food|drink|drug: / cycle: / st: / switch task: / so: / switch objective: / switch goal: / transit:; saved keywords (log: went outside, log keywords); smoked weed, drank water, ate …, took …
  On a log line, a switch line, or a tracking-note clock, no am/pm means military time (12:04 is noon, 1:00 is 1:00am, 1pm is 1:00pm). Ordinary inbox text is not parsed this way.
• Monitor — currently / stopped / switched to
• Capture / add — plain text, qa:, add:, inbox:, idea:, quick add: (-mb / -monkey → Monkey brain; -p / -plain → as written)
• Bulk — bulk: / bulk add; Name: dumps; before 9/12:
• Track — at:, track:, mood:, sleep:, start:/stop, gps:, screen:/call:/text:
• Notes — n / note: (optional clock, est or unknown), day:, memo:, jot:. Thought process is tp: / thought process: / log: tp: — a guiding strand of this moment: why you are doing something, what you expect next, and how it lands. Not this general note, not a one-word mood, and not a short activity log such as brushed teeth
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
• dh: hemisync — done (preset). Bare hemisync is not a habit log
• dh: read 30 pages  ·  dh: exercise 15 min …  ·  dh: chess score 355
• habit: exercise 30  |  did: stretch  |  h stretch
• habits  |  hi  |  habit board — dump today's board
Optional yesterday. Notes stamp: from text message at {time}.

Send "habit commands" for the glossary.`,

  log: `${BIM_SHORT} · Discrete event log
What it is
  Tracking notes on Activity. Points are vertical lines. Ranges are blocks.
  Click either one to edit the note and the time. Always labeled from text pipeline.
  Clocks use the machine's timezone on the send date.

How to use it
• log: left room  |  log: left room at 3:30  |  log: left room at 3:30 loc: home
• log: shower 10m  — just finished (end is send time)
• log: START walk  |  log: END walk 5:00
• log: left room at 3:30 est  ·  log: left room unknown  — estimated or unknown clock
• log: went outside  |  log went outside 12:04  |  log: went outside 7/4/26 1:00
  Added in Tracking settings (the gear). Longest phrase wins. The remainder is the date and time, not the title.
  log keywords and log: keywords list them and do not create a row. A bare phrase is not a log.
• On a log line, no am/pm means military time: 12:04 is noon, 18:37 is 6:37pm, 1:00 is 1:00am.
  1pm, 1:00pm, 1 PM, 1:00 PM, and 1:00 p.m. are 1:00pm. 7/4/26 and 7/4/2026 are July 4, 2026.
  at 3:30 still works. Log lines, switch lines, and tracking-note clocks share that reader. Ordinary inbox text is not parsed this way.
• loc: home on a log reuses or creates that Location pen (the place is last)
• intake: coffee  — point only, no duration. Bare intake leaves the class unset
• intake food: egg salad  ·  intake drink: coffee at 8:15 est  ·  intake drug: tablet
• cycle: bleeding  ·  cycle: spotting  ·  cycle: ovulation  ·  cycle: bleeding off
• switch: location from: home to: ralphs  ·  switch: activity from: working on brain2 to: working on foxtide 6:37pm
• switch: company Elijah  — destination Elijah on Company, at the message’s local time
• switch: to cleaning  ·  switch: from email to cleaning  — Activity when the view word is omitted
  The clock and date are the same reader as a log line. A bare integer is not a clock.
  Activity stores started … on the Switch pen. Another view paints that scope.
• log categories  ·  log: categories  — numbered tracking views. A reply, not an event.
• st: cleaning  ·  switch task: cleaning at 3:30  — alias of Switch on Activity, title “started …”
• so: read  ·  switch objective: read  ·  switch goal: read  — alias, Objective pen, title “objective …”
• transit: the store  — same clock words (est / estimated / ~ / unknown)
• tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix  |  TP:  |  thought process:  |  log: tp:
  Thought process: a guiding strand of this moment, from what you are doing, to what it leads to, to how it feels.
  Why you are doing something, what you expect next, and how it lands. Not a general note, a one-word mood, or a short activity log such as brushed teeth.
  Colon required, so bare tp and bare thought process are not this. Pen Text log. eventKind thought-process.
  First line is the title; a line under it is the note. Same clocks as a log line.
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
• -p or -plain → stored as written (no list, folder, date, time, duration, or priority)
• list: item and folder: list: item create the list. Dates, times, duration, and priority stay in the title
• bulk: / bulk add — headers and one item per line
• Name: then lines — that list (grocery headers → store list)
• before 9/12: — following lines due that day
• Custom first-word shortcuts: Settings → Message ingest
• Built-ins: w/@ → at/where · h → help/habit · m → mood · tt/trk → track · day → today/n day · pause → stop

Send "ingest commands" or "add commands" or "bulk commands".`,

  review: `${BIM_SHORT} · Rituals (morning / night / start / end)
What it is
  Period rituals over text and in the app. Day: morning (sun) + night (moon).
  Week–year: Start ritual (plan) + Review ritual (end).

Board — text rituals or reviews
  Lists every available/undone slot with status, the Telegram command, and the
  in-app path (Header → Rituals).

Morning — text gm or good morning (same as ritual morning)
1. Sleep (bed / wake / dream) — or reply "all nighter" to lift habits with an all-nighter block
2. Five affirmations, one at a time (Lists "affirmations") — voice note advances
3. Today's to-do: add lines and/or "rm 1 3" to take numbers off today, then required tasks (numbers and/or new lines, or skip), then pick 3–5 priorities
4. Daily habits: optionally pick 1–3 to prioritize (or skip / no / n)
5. Go through to do list — one item at a time. Six slots:
     tier  duration  points  importance  resistance  excitement
   Dash keeps a slot unchanged. Example (points 30, duration 10m already set):
     A+ - 40 - 10 0
   Or skip that item. Empty list: BIM says so and moves on.
6. Plaintext day plan — appends today's Plan log stamped "from text" (or skip / no / n)
7. Circumstances — numbers 1–3 (must-not, events, excitement). Required tasks are asked with the to-do list.
8. Why is today going to be the best day ever?
9. Ten things you are grateful for today

Night — text gn / good night / night / ritual night / review today
  End-of-day walk: unfinished → summary → gratitude → plan → went well / improve / learned → tomorrow.

Start — text ritual start week|month|quarter|year
  Plan the current period: undone from last → priorities → must-do → intentions → plan → gratitude.

End / Review — text review week|month|quarter|year · ritual end <period>
  Clarify, push, document, and evaluate the just-ended period.

Also
• Each morning answer is saved immediately. Send skip or next to leave a question empty. A blank message waits. Live Location is paused during the review and resumes when it ends.
• If today already has morning answers, gm asks: 1 start over · 2 continue · 3 jump (that menu only)
• STOP (all caps) quits morning and saves. Shortcuts stay off until then — m, mood, inbox, and cancel are just text
• cancel / quit / nevermind — leave a night / start / end walk (not morning)
• Legacy reviews / review still work; rituals / ritual are preferred

Desktop: Header → Rituals (sun/moon for day; Start / Review for other periods).

Send "review commands" or "ritual commands" or "gm commands".`,

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
• n stuck in aisle 4  ·  note: left room at 8:15  ·  note: left room at 8:15 est
  A clock with no word is exact. est / estimated / ~ is estimated. unknown keeps the minute.
  Also appended to the block covering that minute. A second line is the note.
• day: tired  ·  daynote:  ·  dnote:  ·  n day: — day jot, not a tick, and not a clock
• tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix  ·  thought process:  ·  log: tp:
  Thought process: a guiding strand of this moment, from what you are doing to what it leads to and how it feels. Not a general note, a one-word mood, or a short activity log such as brushed teeth. Colon required. eventKind thought-process.
• day alone → today

Send "note commands".`,

  sleep: `${BIM_SHORT} · Sleep
• sleep: 11:30-7:00  ·  slept:
• Inside gm: bed / wake / dream, or all nighter
• Analytics → Sleep shows nights and all-nighter days (text pipeline labeled)

Send "sleep commands".`,

  gps: `${BIM_SHORT} · GPS / location pin
• gps: Home  ·  geo:  ·  gps-log:
• at: 2026-10-05T19:04:00  stamps the sample
• Paints up to that minute, not the rest of the day
• Telegram Live Location in the bot chat
• A venue pin is a shared place, not where you are
• Arrive/Leave Shortcut stores a log and sends it when it can
• Message ingest hides these unless you show GPS

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
