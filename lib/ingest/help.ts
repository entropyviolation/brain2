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
Habits (whole message = the command)
• hemisync  — mark that daily habit done
• read 30 pages  ·  exercise 15 min walked…  ·  chess score 355
• habit: exercise 30  — by habit name (optional yesterday)
Events (whole message, or log:)
• smoked weed  ·  drank water  ·  ate egg salad  ·  took 2 adderall
• log: drink water  ·  log-something happening
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
• log: drink water  |  log-drink water
  Whatever follows is the event title. Bare “o” is NOT a log unless you
  send log: o or set “o” as a trigger.

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
• gm — morning review over text (skip or blank moves on)
• reviews  ·  review  ·  cancel

CAPTURE / LISTS
• plain text or qa: → Inbox
• -mb or -monkey on the line → Monkey brain (dump; less than Inbox)
• Name: then lines — that list. Grocery list: lands on the store list.
• before 9/12: — following lines due that day
• bulk: same headers, one item per line
• lists  ·  folders  ·  today  ·  where  ·  search: milk

TRACK / LOCATION / NOTES
• n stuck in aisle 4  ·  day: tired
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
