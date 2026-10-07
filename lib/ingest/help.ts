/**
 * lib/ingest/help.ts — Phrase lists for `help` (short) and `info` (full)
 *
 * Keep accurate to the executor. Order is scan-friendly: grocery / needed,
 * capture, habits & events, activity spans, plan, track, read.
 *
 * The live `info` reply is `BIM_MAIN_INFO` in command-glossary.ts (via
 * apply-glossary). INGEST_INFO remains a readable mirror for docs/tests.
 */
import { BIM_SHORT, BIM_FULL, BIM_PAIR_OK } from "./bim"

export { BIM_PAIR_OK }

export const INGEST_HELP = `${BIM_SHORT} (${BIM_FULL}) — phone commands (short)
You can call me BIM for short. Send info for the basics, {prefix} info / {prefix} commands for one family, or all commands for everything.

Grocery / needed
• groc  — dump grocery list (pins it). Old g no longer adds groceries.
• groc milk  /  grocery: eggs  — add
• needed: batteries  /  get: then lines  — list "needed" (notes: sent from text)
• got milk  /  x bread  — check off grocery
• pin  — refresh the pinned grocery card
Habits (dh: then the keyword)
• dh: hemisync  — mark that daily habit done
• dh: read 30 pages  ·  dh: exercise 15 min  ·  dh: chess score 355
• habit: exercise 30  — by habit name (optional yesterday)
• A bare keyword is not a habit log
Events (whole message, or log: / intake:)
• smoked weed  ·  drank water  ·  ate egg salad  ·  took 2 adderall
• log: left room  ·  log: left room at 3:30 loc: home  ·  log: shower 10m  ·  log: START walk
  A line under the event is the note. The clock stays on the first line.
  est / estimated / ~ is estimated. unknown keeps the minute. loc: names a Location pen.
• log: went outside  ·  log went outside 12:04  ·  log: went outside 7/4/26 1:00
  Saved phrases are added in Tracking settings (the gear). Longest phrase wins. log keywords lists them and does not log a row.
  A bare phrase with no log prefix is not a log.
  On a log line, no am/pm means military time: 12:04 is noon, 18:37 is 6:37pm, 1:00 is 1:00am.
  1pm, 1:00pm, 1 PM, 1:00 PM, and 1:00 p.m. are 1:00pm. 7/4/26 is July 4, 2026.
  Log lines, switch lines, and tracking-note clocks share that reader. Ordinary inbox text is not parsed this way.
• intake: coffee  — point only, no duration. intake food: / drink: / drug: sets the class
• cycle: bleeding  ·  cycle: spotting  ·  cycle: ovulation  ·  cycle: bleeding off
• switch: location from: home to: ralphs  ·  switch: to cleaning  ·  switch: company Elijah
• log categories  — numbered tracking views (a reply, not an event)
• st: / switch task: cleaning  ·  so: / switch objective: / switch goal: read  ·  transit: the store
• note: left room  ·  n left room  ·  jot:  ·  memo:  — Text log instant. day: stays the day jot
• tp: opening the editor to fix the clock  ·  thought process:  ·  log: tp:  — a specialized note: the crystallized thought of this moment, not a general note. Colon required. Same clocks as a log line.
Activity spans
• currently deep work  ·  stopped deep work  ·  switched to cooking
Plan / capture
• plan for rn:  lines…  — today's plan log (stamped “from text”)
• plain text → Inbox  ·  -mb / -monkey → Monkey brain
• gm — morning review · help  ·  info  ·  all commands
Pair: pair: 123456  ·  Settings → Message ingest`

export const INGEST_INFO = `BIM (Brain2 Ingestion Messenger) — full guide mirror

Live replies use info / {prefix} info / {prefix} commands / all commands
(from command-glossary + command-catalog). Complete on-disk list:
docs/BIM_COMMANDS.md

Case-insensitive. A verb may be followed by : or a space.
Matching order (first match wins — never also Inbox):
  1. Deduped Telegram updates (retries do not double-write)
  2. help / start / info
  3. Explicit: groc, needed, plan for rn, currently, stopped, switched to, log:/log-
  4. Whole-message habit keywords & discrete-event triggers
  5. Everything else (other verbs, or Inbox capture)

Ambiguous names get a numbered list — reply with the number or the name.
Custom first-word shortcuts: Settings → Message ingest (e.g. store → groc).
Habit keywords: edit on each habit (Habits → edit). Discrete triggers: same Settings panel.

────────────────────────────────
GROCERY  (shortcut is groc — bare g is retired)
• groc  |  grocery  |  groceries  |  shop  — dump the grocery-ish list and pin it
• groc milk  |  grocery: eggs — add (Inbox off). Several lines = bulk.
• got milk  |  x bread, eggs  |  bought: milk  |  check off oats — complete open lines
• pin  |  live  |  snapshot — refresh the pin
Retired: bare “g” no longer means grocery (use groc). Re-map custom shortcuts that still expand to g.

NEEDED
• needed: batteries  |  needed batteries
• get:  then lines  |  get: batteries  (colon required; bare get is not this command)
  Files onto the list named “needed” (created if missing). Inbox off.
  Each item’s detail notes include: sent from text
  Empty get: / needed: → nothing added

────────────────────────────────
HABIT KEYWORDS  (whole message only)
One-word keywords do NOT fire inside a longer Inbox note.
Examples that ship as editable presets (Habits → edit that habit):
• hemisync — marks the Hemisync daily habit done; Done today logs “hemisync”
• read 30 pages — writes 30 into that daily task’s count
• exercise 15 min walked to the cliffs — writes 15; notes include the detail
  plus “from text message at {time}”
• chess score 355 — logs the score the same way
Also: habit: exercise 30  |  did: stretch  |  h stretch
  GOAL: a number. BOOLEAN: done/yes/no/undo. TEXT: the rest. Optional yesterday.

DISCRETE EVENTS  (tracker instants, labeled from text pipeline)
Editable patterns: Settings → Message ingest → Discrete event triggers.
Presets:
• smoked weed
• drank water
• ate {item}     →  ate egg salad
• took {item}    →  took 2 adderall
• log: left room  |  log- left room  |  log went outside  |  log: left room at 3:30 est  |  log: left room unknown
  |  log: left room at 3:30 loc: home
  Whatever follows is the event title, unless it is a saved keyword. A line under it is the note.
  The phrase is also an eventKind slug so repeats group. A clock with no word is exact.
  est / estimated / ~ is estimated. unknown keeps the minute for placement.
  loc: at the end reuses or creates that Location pen and paints a Location instant.
  Saved keywords (added in Tracking settings, the gear; empty until you add them): log: went outside, log went outside 12:04,
  log: went outside 7/4/26 1:00. The word log works with or without the colon. Longest phrase wins.
  The remainder is the optional date and time, not part of the title. log keywords and log: keywords
  list the phrases and do not create a row. A bare phrase with no log prefix is not a log.
  On a log line, a clock with no am/pm is military time: 12:04 is noon, 18:37 is 6:37pm, and 1:00 is
  1:00am, not 1pm. 1pm, 1:00pm, 1 PM, 1:00 PM, and 1:00 p.m. are 1:00pm. 7/4/26 and 7/4/2026 are
  July 4, 2026 (month/day/year). at 3:30 still marks that minute. Log lines, switch lines, and
  tracking-note clocks share that reader. Ordinary inbox text is not parsed this way.
  Bare “o” is NOT a log unless you send log: o or set “o” as a trigger.
• intake: coffee  |  intake food: egg salad  |  intake drink: coffee at 8:15 est  |  intake drug: tablet
  Bare intake: leaves the class unset and sets eventKind intake. Classed lines set intake.food / intake.drink / intake.drug. Pen stays Intake.
• switch: location from: home to: ralphs
  |  switch: activity from: working on brain2 to: working on foxtide 6:37pm
  |  switch: company Elijah  |  switch: to cleaning  |  switch: from email to cleaning
  Colon right after switch. The next word is the view; omit it and the view is Activity.
  from: / to: are labeled. A bare name after the view is the destination.
  The clock and date are the same reader as a log line. A bare integer is not a clock.
  at marks the clock and is not part of the destination.
  Activity stores started … on the Switch pen. Another view paints that scope.
• log categories  |  log: categories  — numbered views from the store. Not an event.
• st: cleaning  |  switch task: cleaning at 3:30 est  — alias of Switch on Activity
• so: read  |  switch objective: read  |  switch goal: read at 8:00 unknown  — Objective pen, title “objective …”
  est / estimated / ~ / unknown still mark the clock. A tracking-note clock with no am/pm is military.
• note: left room at 8:15  |  n left room at 8:15 est  — Text log instant. day: stays the day jot.
• tp: opening the editor to fix the clock  |  TP:  |  thought process:  |  log: tp:
  A specialized note: the crystallized thought of this moment, not a general note.
  Colon required on the verb, so bare tp and bare thought process stay capture.
  Activity instant, pen Text log, eventKind thought-process. First line is the title; lines under it are the note.
  Clocks are the same reader as a log line (parseExpectedWhen): bare clock is military, 1pm / 1:00 PM / 1:00 p.m. are 13:00, 7/4/26 is July 4, 2026.
  est / estimated / ~ is estimated. unknown keeps the minute for placement.
• cycle: bleeding  |  cycle: spotting  |  cycle: ovulation  |  cycle: bleeding off
  That flag on the send date. Spotting does not change phase.

ACTIVITY SPANS  (Activity scope, labeled from text pipeline)
• currently deep work — start this activity now (open until end of day)
• stopped deep work   — close the open interval at now
• switched to cooking — stop previous, start new, log a “switch” instant
Aliases for the forms live with the other keywords in Settings / info.

────────────────────────────────
PLAN / TO-DO / MORNING
• plan for rn:  then lines — today’s Plan log (Day tab), stamped now
  Entries from Telegram show “from text” after the date and time
• read plan for today  ·  read plans for today
• do: call dentist — Next Actions → General
• to do today: call dentist — Home → To Do, today
• read to do today
• gm — morning review over text (skip or next leaves a question open; blank waits; STOP quits and saves)
• rituals  ·  reviews  ·  gm  ·  gn  ·  review  ·  ritual start week  ·  cancel (end/start; morning uses STOP)

CAPTURE / LISTS
• plain text or qa: → Inbox
• -mb or -monkey on the line → Monkey brain (dump; less than Inbox)
• Name: then lines — that list. Grocery list: lands on the store list.
• before 9/12: — following lines due that day
• bulk: same headers, one item per line
• lists  ·  folders  ·  today  ·  where  ·  search: milk

TRACK / LOCATION / NOTES
• n stuck in aisle 4 — a point at send time; also on the block covering that minute
• note: left room at 8:15 est — same clock words as log (exact unless est / estimated / ~ / unknown)
• tp: opening the editor to fix the clock  ·  thought process:  ·  log: tp: — specialized note, the crystallized thought of this moment, not a general note. Colon required. eventKind thought-process.
• day: tired — day jot, not a tick, and not a clock
• at: gym  ·  tt work  ·  track: exercise 30m
• start: write paper  ·  stop (working-now / pause)
• mood: good  ·  sleep: 11:30-7:00
• screen: Instagram 30m  ·  call: Jane 12m  ·  text: Jane on my way
• gps: Home  ·  Telegram Live Location

SCAN / PANTRY
• photo of a receipt — OCR, grocery check-off, pantry bump
• journal photo / PDF → Docs (From phone)
• inv  |  inv oats — pantry dump / bump

READ
• read: grocery list  ·  show: Groceries  ·  dump: chores
• habits  ·  hi  ·  agenda  ·  count  ·  tags  ·  ping
• help  ·  info  |  manual  |  instructions

ALWAYS ON
Pinned grocery card survives a closed laptop. For live replies 24/7:
  npm run phone:hub
Webhook: COGS_TELEGRAM_WEBHOOK on the hub. One Telegram poller at a time.

PAIR
• pair: 123456  |  /start 123456 — from Settings → Message ingest
  Send to @brain2_phone_bot, never BotFather.
Unknown senders get no reply.`

export const INGEST_PAIR_OK = BIM_PAIR_OK
