# Message ingest (Telegram first) — BIM

**BIM** = Brain2 Ingestion Messenger. He introduces himself as BIM (Brain2
Ingestion Messenger) and says you can call him BIM for short. Phone-message
capture for Brain2. Text BIM from your phone with short key
phrases; the same write paths as Quick Add, Bulk Add, Habits, and Tracking apply
the result. **Channel-agnostic command core; Telegram is the first adapter.**
Reads dump lists back as plain text. Grocery dumps **pin** a card in the chat so
you can read the list at the store even when the laptop is off. Live replies
around the clock need `npm run phone:hub` on a machine that stays on.

**Complete command catalog (every verb, alias, expansion, preset, GM reply, and
retired form):** [`BIM_COMMANDS.md`](BIM_COMMANDS.md) — same list as in-chat
`all commands` / `{prefix} commands` (source: `lib/ingest/command-catalog.ts`).

Replies describe what was recorded. They do not tell the person what they are.
A later check (Wave 13, GS-4) may answer an allness sentence ("I always forget
X") with the vault's count and leave the original text intact.
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

In chat manuals:
- `info` — basics + how to ask for more
- `{prefix} info` — deep dive for one family (e.g. `add info`, `bulk info`, `read info`)
- `{prefix} commands` — full glossary for that family
- `all commands` — every command and keyword

Spec mapping: [`SPEC_MAPPING.md`](SPEC_MAPPING.md) §4 (Message ingest).
Design: local-first, LLM-free, capture-first.

## Status

| Slice | Status |
|-------|--------|
| Command language (this doc) | ✅ |
| Parser + capture executor + ingest log | ✅ |
| Telegram poller, pairing, Settings | ✅ |
| Habits | ✅ |
| Tracking / location / mood / sleep / working now | ✅ |
| iPhone Screen Time (`screen:` / Shortcuts app-open) | ✅ |
| iPhone Calls / Texts (`call:` / `text:` / Share Sheet) | ✅ |
| Bulk add, ingest log UI, `help`, simulate | ✅ |
| Read-back (`read:`, `lists`, `folders`, `info`, search/status) | ✅ |
| Grocery shortcuts (`groc` / `got` / `pin`) + tracker notes (`n` / `day:`) | ✅ |
| `needed:`, `get:`, activity spans, discrete events + `log:` / `log-` | ✅ |
| Whole-message habit keywords + Settings discrete triggers | ✅ |
| Telegram dedupe (`update_id` / `message_id`) | ✅ |
| Analytics **Text events** / **Text spans** | ✅ |
| Always-on phone hub (`npm run phone:hub`) + webhook | ✅ |
| Custom first-word shortcuts | ✅ |
| Photos / PDFs / receipt OCR (journal scan, grocery inventory) | ✅ |
| Other messengers / Atlas-backed ingest | 🕓 later |

## Why this shape

Brain2 is **offline-first**: Zustand + localStorage in the renderer is the source
of truth. Telegram **getUpdates** only reaches a process that is actually
running. A closed laptop cannot answer `groc` at the store. Two paths stay live:

1. **Pinned grocery card.** Every `groc` / `got` / `pin` / grocery `read:` refreshes
   a Telegram pin. Open the bot chat; the pin is the last dump even if nothing is
   polling. This is the laptop-off *read* path.
2. **`npm run phone:hub`.** Headless Node process: hydrates from
   `data/shared-persist.json`, owns Telegram (long-poll or webhook), runs the
   same executor, writes the vault back, pins grocery. Desktop Electron **yields**
   when `data/phone-hub-status.json` is fresh so the two pollers do not 409.
   Settings **Sync vault** (and a 60s tick) pushes this profile’s persist keys
   to the hub URL (default `http://127.0.0.1:8787`). Hub merge **unions** Inbox
   tasks and Plan append-log entries by id (`lib/vault-guard.js`), so a desktop
   push that never saw the phone-hub write cannot drop a Telegram capture;
   shrink guards still refuse a 15-item seed wipe of a rich vault.
   Hard-deleted Inbox ids (and item-merge discards) stamp `removedTaskIds` so
   that union cannot resurrect them; discarded lists stamp `removedListIds`.

Telegram still keeps unclaimed updates about **24 hours**, so texts sent while
nothing is polling land the next time a poller runs. Older than that are dropped.

**Use one Telegram consumer:** `phone:hub` **or** Electron **or** `npm run ingest`.

## Architecture

```
Phone (Telegram)
  → Bot API getUpdates  |  webhook POST /telegram/webhook
  → Always-on hub (scripts/phone-hub.ts)     ← 24/7 when this process is up
      hydrates Zustand from data/shared-persist.json
      ingestIncomingAsync → stores → pin grocery / Docs / pantry
      flush vault
  → or Electron poller (getFile download) → renderer executor (when hub is not running)
  → Confirmation reply + optional pin
```

Apple Notes ingest is the sibling pattern (external source → apply in the
client; this Mac via Electron IPC or localhost `/api/notes`). **On My iPhone**
notes that never sync here use the signed [iOS Shortcut](shortcuts/dump-iphone-notes-to-brain2.md)
(`Dump iPhone Notes to Brain2.shortcut` — AirDrop; delete any old copy first,
then `npm run shortcut:iphone-notes` if the signed file is missing)
→ `iphone-notes:` → Lists **iPhone Notes Store** (header **Phone Notes**).
Use **Pick a note** when running from Shortcuts; **Shortcut Input** only after
Share from Notes. Date ranges use Find Notes “is in the last”, not Adjust Date.
Each note is sent as plain `iphone-notes:` text (never raw Notes share / %%lld).
iPhone Screen Time / Calls / Texts use the same AirDrop pattern:
[`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut),
[`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut),
[`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut).
The mobile hub (`data/mobile-sync.json`) is the sibling on-disk queue.

## Always-on hub

```bash
npm run phone:hub
```

Token from gitignored `.env.local` / `COGS_TELEGRAM_BOT_TOKEN` (never committed).

| Env | Role |
|-----|------|
| `COGS_PHONE_HUB_PORT` | HTTP port for persist + status + webhook (default **8787**) |
| `COGS_TELEGRAM_WEBHOOK` | Public URL, e.g. `https://host/telegram/webhook` — skip long-poll |
| `COGS_TELEGRAM_WEBHOOK_SECRET` | `X-Telegram-Bot-Api-Secret-Token` |

A VPS / NAS / always-on Mac is enough. Settings → **Always-on hub URL** + **Sync
vault** copies today’s lists onto that host. Pairing still happens in Settings;
the hub hydrates the allowlist from the vault.

The old `npm run ingest` script only *queues* Telegram into
`data/message-ingest.json` for the renderer. Prefer `phone:hub` when you want
replies without the desktop window.

## Command language

Case-insensitive. A verb may be followed by `:` or a space. **Prefix-less text
defaults to Inbox Quick Add**, except a multi-line list dump (`Name:` then one
item per line), which files onto that list. Ambiguous names get a one-step clarify reply
instead of a silent wrong write, but only among names that genuinely resemble
the query: a shared stopword (`to`, `my`, `the`, …) is not a match, so prose no
longer ties a handful of unrelated lists. A read that resembles **nothing**
is parked on **iPhone Notes Store** to sort in the app (header **Phone Notes**),
the same way Mac From Notes parks. Custom first-word aliases live in Settings
(e.g. `store` → `groc`). Bare **`g`** is retired — it captures to Inbox like
any other prefix-less line, not grocery.

### Matching precedence

Before any write, the executor applies this order (see `lib/ingest/executor.ts`):

1. **Dedupe** — same Telegram `update_id` or `(channel, chat_id, message_id)` is ignored once (`lib/ingest/dedupe.ts`).
2. **Help / start / info** — `help`, `/help`, `commands`; `/start` (pairing when followed by a code); `info`, `manual`, `cmds`, `instructions` (rewritten cheat-sheets in `lib/ingest/help.ts`).
3. **Explicit verbs** — grocery (`groc`, …), `needed:` / `get:`, `plan for rn`, `currently` / `stopped` / `switched to`, `log:` / `log-`, and the rest of the verb table below (habit `h`, `track:`, `read:`, …).
4. **Whole-message habit keywords** — only when the *entire* message matches an editable trigger on a habit (`lib/ingest/text-triggers.ts`, `apply-habit-trigger.ts`). Presets: `hemisync`, `read N pages`, `exercise N min`, `chess score N`. Edit on the habit form (**Text keywords (phone)**).
5. **Whole-message discrete events** — Settings → **Message ingest** → discrete triggers (defaults: `smoked weed`, `drank water`, `ate {item}`, `took {item}`) via `apply-discrete-event.ts`. Separate from `log:` / `log-`.
6. **Else** — remaining parsed verbs, multi-line list dumps, or Inbox capture.

Text-pipeline tracker rows (`generatedBy.kind === "text"`) feed Analytics → **Text events** (instants + switch markers) and **Text spans** (`currently` / `stopped` / `switched to` intervals).

| Phrase | Intent |
|--------|--------|
| `groc` / `grocery` / `groceries` / `shop` | Dump the grocery-ish list (Grocery list / Groceries / Shopping) and **pin** it |
| `groc milk` / `grocery: eggs` | Add onto that list (Inbox off). Several lines = bulk. An identical **open** line is skipped; reply `see`, `again`, or `dismiss` |
| `needed:` then lines · `get:` then lines · `get: batteries` | Add onto the list named **needed** (creates it if missing). Each item gets notes **sent from text** (`apply-needed.ts`). `get:` requires the colon (bare `get …` stays Inbox capture). Empty `get:` / `needed:` adds nothing |
| `got milk` / `x bread, eggs` / `bought:` / `check off oats` | Complete matching open grocery lines; refresh the pin |
| Snap a **receipt** (caption `receipt` if it might look like a page) | Local OCR → check off grocery + bump Inventory/Pantry/Fridge. Asks when a name is new (`inv` / skip / number) |
| Snap **journal pages** (album ok; caption `journal: morning`) | Deskew, PDF + searchable text → Docs note in folder **From phone** |
| Forward a **PDF** (caption `pdf: title` optional) | Docs item; extract text with pdfjs / desktop `extractPdfText` |
| `inv` / `inv oats` / `pantry` | Dump or bump the pantry list |
| `pin` / `live` / `snapshot` | Refresh the pinned grocery card (+ a one-line now) |
| `n stuck in aisle 4` / `note:` / `jot:` / `memo:` | Append onto the activity block covering *now* |
| `n loc: crowded` / `n mood: low` / `n activity: deep work` | Note on that Tracking scope |
| `day: tired` / `daynote:` / `n day:` | Tracking day jot (append log). Bare `day` → `today` |
| `pick up milk` / `qa:` / `add:` / `inbox:` / `idea:` / `quick add:` | Capture. Same smart-parse as Quick Add. Inbox on. `-mb` or `-monkey` on the line dumps it in **Monkey brain** (a separate Inbox pile for compulsive thoughts — not the Inbox you mean to revisit). |
| `Chores: milk` | One line: capture with a list path (still Inbox unless you use Bulk / `groc`) |
| `Grocery list:` then `eggs` / `rice` / `butter`, or `Grocery list: grocery list:` | Files onto the grocery **store** list (`groc` uses the same one). Does not create a second folder. Identical open lines are skipped |
| `before elijah gets home:` then the lines | That list, found or created, one item per line |
| `before 9/12:` / `before Friday:` / `before Sept 12:` | Following lines are **due that day** (`deadline` and `mustBeDoneBefore`). A past `M/D` rolls forward a year. Words after `before` stay a list name |
| `bulk:` then one item per line | Bulk Add. Header lines `list:` / `folder: list:` work. Files onto lists (Inbox off). `Home: Groceries:` keeps that folder. A grocery name with no other folder uses the store list |
| `iphone-notes:` / `inotes:` / `phone notes:` | Park an On My iPhone note dumped by the signed [iOS Shortcut](shortcuts/dump-iphone-notes-to-brain2.md) (`Dump iPhone Notes to Brain2.shortcut`). One note per message; long bodies `iphone-notes 2/3:`. Lands in Lists → **iPhone Notes Store** → **Parked** (header **Phone Notes**). Not the tracker `n` / `note:` jot. Mac **From Notes** is a different folder. |
| `habit: exercise 30` / `h stretch` / `did: stretch` | Habit for **today** (optional `yesterday`). Fuzzy-matches the habit name. Bare `h` → help. |
| `hemisync` / `read 12 pages` / `exercise 30 min` / `chess score 1200` | Whole-message **habit keywords** when configured on that habit (see precedence above). Not substring matches inside longer prose. |
| `smoked weed` / `drank water` / `ate lunch` / `took ibuprofen` | Whole-message **discrete events** (editable in Settings). `generatedBy.kind === "text"`. |
| `log: drink water` / `log-drink water` | Explicit instant log on Activity (same text-pipeline label; not a habit write). |
| `currently deep work` / `stopped` / `switched to email` | Open, close, or switch an **activity span** through end of day; Analytics → **Text spans**. |
| `at: gym` / `w gym` / `@ home` / `location:` / `here:` | Location **now** through tonight. Bare `w` / `@` → `where`. |
| `gps: Home` / a Telegram location or **Live Location** | Location pen from a place name and/or lat,lon. The same place stays quiet. AirDrop [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut) for Arrive / Leave (see [iPhone location](shortcuts/iphone-location-to-brain2.md)). |
| `plan for rn:` then lines | Append today's Plan log (Day tab) with stamp suffix **from text**. |
| `read plan for today` / `read plans for today` | Latest entry, or every entry in bulk plaintext. |
| `do: call dentist` / `next action:` | Next Actions → **General**. Not scheduled. |
| `to do today: call dentist` / `todo today:` / `do today:` | Home → To Do for today. |
| `read to do today` | That open list, numbered. |
| `gm` / `good morning` | Morning review with BIM: all nighter skips sleep Qs; 5 affirmations one-at-a-time (voice advances); to-do add + 3–5 priorities; 1–3 habit priorities; go through each to-do (six slots: tier duration points importance resistance excitement; dash = keep; skip = leave item); plaintext day plan stamped **from text**; circumstance branches; best day; 10 gratitude. `skip` / blank moves on. |
| `info` / `manual` / `cmds` / `instructions` | BIM basics + how to ask for `{prefix} info`, `{prefix} commands`, `all commands`. |
| `{prefix} info` | Deep dive for one family (groc, log, review, monitor, to do, …). |
| `{prefix} commands` | Full keyword glossary for that family. |
| `all commands` | Every command and keyword across BIM. |
| `ping` / `pong` | Liveness. Reply: **BIM is listening.** |
| `reviews` / `review` / `review today` / `review day` / `review week` | See what's due, or walk the period review. `cancel` quits. |
| `tt work` / `track: exercise 30m` / `doing: work 9-11` | Activity block (duration ending now, or an explicit clock window). |
| `screen: Instagram 30m` / `screentime:` / `phone-screen:` / `iphone:` / `ios:` | **iPhone Screen Time** only (estimated). Same duration / clock window as `track:`, or from now until the next ping. Auto-creates an app pen. Not Mac Screen Time. Apple cannot export Screen Time — typed phrase or AirDrop [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut) (Ask-for-app ping; attach a duplicate to App Is Opened for automation). |
| `call: Jane 12m` / `called:` / `phone-call:` | **iPhone Calls** interval (who + duration or `3:02-3:17`). Estimated. Apple cannot dump Phone recents. AirDrop [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut). |
| `text: Jane on my way` / `sms:` / `imessage:` / `sent:` | **iPhone Texts** instant at send time. First word is who; the rest is the body (title + notes). Shortcuts cannot read Messages — type it or AirDrop [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut) (Asks for body, then who). |
| `start: <name>` / `stop` / `pause` | Working now (operation match) or start/stop an Activity pen. |
| `mood: good` / `m good` / `state: tired` / `feel:` | Mood scope, same “until further notice” paint as location. |
| `sleep: 11:30-7:00` / `slept:` | Bed / wake on the current morning key. |
| `help` / `/help` / `commands` | Short phrase list. |
| `read: grocery list` / `show:` / `dump:` | Dump that list (or folder) in plain text. Grocery-ish dumps also pin. `read list: Name` / `read folder: Home` when the name is shared. A trailing “list” or “folder” word picks the kind. Matches nothing → parked on **iPhone Notes Store**, not a picker. |
| `lists` / `ls` | Catalog of lists, grouped by folder, with open counts. `list:` alone is still a capture path. |
| `folders` / `dirs` | Catalog of folders. `folder:` alone is still a capture path. |
| `read inbox` / `show inbox` / `dump inbox` | Dump Inbox, newest first, then Monkey brain if any. Bare `inbox:` still captures. |
| `search: milk` / `find:` / `? oat` | Ranked item search. |
| `today` / `tdy` | Snapshot: inbox count, habit %, location/activity, working now, today's plan. |
| `habits` / `hi` | Today's habit board. `habit:` still writes. |
| `where` / `status` / `now` | Location, activity, mood, working now, last night's sleep, inbox count. |
| `ops` / `operations` | Operation names. |
| `agenda` / `calendar` / `read: plan` | Today's calendar events. |
| `count` / `count: grocery` | Open-item sizes. |
| `tags` | Item tags in use. |
| `pair: 123456` / `/start 123456` | Pair this Telegram account. Send to **@brain2_phone_bot**, not BotFather. |

Confirmations are short: `Inbox: pick up milk`, `Groceries: eggs, rice, and butter.`,
`Got milk.`, `Noted on Work: stuck in aisle 4`. A duplicate open line asks
`see`, `again`, or `dismiss`. Read replies are numbered plain
text (open items, then a Done section). Long dumps are split across Telegram
messages (4096 cap). The grocery **pin** is the last dump card.

### Habits

**Two phone paths:** `habit:` / `h` / `did:` fuzzy-match a habit name and write
today's completion (optional `yesterday`). **Whole-message keywords** (`read 10
pages`, `hemisync`, …) match only when the entire Telegram body fits the trigger
on that habit — edit triggers on the habit form or accept name-based presets when
you save. Keywords run *after* explicit verbs and *before* Inbox capture.

Remainder after the name (for `habit:` writes):

- GOAL: a number sets today’s value; bare name / `done` fills the goal.
- BOOLEAN: `done` / `yes` / bare name checks it; `no` / `undo` unchecks.
- TEXT: remainder is the day’s text.
- INCREMENTAL: a number sets today’s value; bare name leaves a 1-unit bump via
  the existing increment helper when no value is given.

Prefer **painting tagged activity** over also logging a linked habit by hand, so
Tracking → habit sync is not double-counted. `habit:` writes the habit store
directly; `track: exercise` paints the Exercise pen (and the link fills the
habit if configured).

### Location / mood / open activity

Tracking is minute intervals, not events. “I’m at the gym” paints the Location
pen from *now* through the end of the local day. The next `at:` overwrites from
the new now, leaving the earlier hours intact.

Unknown names: the bot lists close pens (and operations, for `start:`) and
asks. Reply `1`, the name, or `new` to create a pen.

### iPhone Screen Time

Apple has no public Screen Time API. `screen: Instagram 30m` (aliases
`screentime`, `phone-screen`, `iphone`, `ios`) paints the **iPhone Screen Time**
view only — never Mac Screen Time, Activity, Location, or Mood. Unknown app
names become pens (`iphone-st-app-{slug}`) under category roots. Minutes are
estimated and have no `generatedBy.kind === "screentime"` stamp, so a Mac
ActivityWatch re-sync cannot delete them. AirDrop the signed [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut)
(Ask for the app name, or attach a duplicate to Automation → App Is Opened).
That is a start ping (from now until the next one). There is no reliable
app-close. Recipe:
[`shortcuts/screen-time-to-brain2.md`](shortcuts/screen-time-to-brain2.md).

### iPhone Calls and Texts

Stock iOS will not let Brain2 (or Shortcuts) silently watch Phone recents,
CallKit, or the Messages database. `call: Jane 12m` paints **iPhone Calls**
(interval, estimated). `text: Jane on my way` paints **iPhone Texts** (instant;
body is the display name). Neither writes Mac Screen Time or Activity. After
the call, Siri / Telegram the phrase, or AirDrop
[`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut).
Share a message into
[`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut)
to send `text: Name body`. Recipe:
[`shortcuts/iphone-calls-and-texts-to-brain2.md`](shortcuts/iphone-calls-and-texts-to-brain2.md).

### Tracker notes

`n …` appends onto the activity interval that covers now. If nothing is painted,
the line is saved as a Tracking **day note** instead. `day:` always uses the day
jot (`lib/day-notes-persist.ts`).

## Security

- Bot token is **never** committed. Electron stores it with `safeStorage` under
  userData, and also reads gitignored `.env.local` (`COGS_TELEGRAM_BOT_TOKEN`).
  The phone hub and ingest script use the same env file. Browser Settings does
  not keep a production token in localStorage.
- **Pairing, not open DMs.** Settings shows a 6-digit code (10 minutes). Only
  that Telegram user id is allowlisted. Unknown senders get **no reply**.
  A refused message is still logged, so Settings → **Texted but not paired**
  offers the same allowlisting in one click for a sender you recognize — no
  code, no TTL. There is deliberately no "trust whoever texts next": the bot
  address is guessable, an already-received message is evidence.
- **Pairing is permanent.** Only the 6-digit *code* expires. `allowedChats`
  stays in `brain2-ingest-store` until you revoke the chat in Settings. A
  refresh does not clear it. Zustand used to save the empty seed allowlist
  before rehydrate finished, so the next launch looked unpaired. A lower
  `allowlistRev`, or that empty seed, is refused. Revoke still removes a chat
  (`revokedChatIds` tombstone). A message is allowed when its chat id **or**
  user id is on the list.
- Groups are ignored unless Settings enables them.
- The ingest log (local) keeps source chat id + raw text for audit / undo.
- Webhook mode checks `COGS_TELEGRAM_WEBHOOK_SECRET` when set.

## Telegram setup

This repo’s bot is [t.me/brain2_phone_bot](https://t.me/brain2_phone_bot). The
token lives in gitignored `.env.local` on this machine (never the git tree).

1. Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
   (already done for `@brain2_phone_bot`).
2. Open Brain2 **desktop** → Settings → **Message ingest** → **Enable ingest**.
   If `.env.local` has `COGS_TELEGRAM_BOT_TOKEN`, you do not need to paste the
   token again (restart the desktop app once so main process picks it up). You
   can still paste in Settings to store it in `safeStorage` instead.
3. Click **Generate pairing code**, then in Telegram open
   [t.me/brain2_phone_bot](https://t.me/brain2_phone_bot) and send
   `/start 123456` (or `pair: 123456`). **Not** to BotFather.
   Missed the 10-minute window? Just text the bot anything, then use Settings →
   **Texted but not paired** → **Pair**. Either route is permanent.
4. Text `groc`, `help`, or `info`. Confirm grocery in Lists. Text `got milk` at the
   store after adding `groc milk`. Snap a receipt at the register, a journal page,
   or forward a PDF — they become pantry/checkout or a Docs note.
5. For 24/7 live replies: **Sync vault**, then `npm run phone:hub` on a host that
   does not sleep. Optional custom shortcuts (`store` → `groc`).

Without Electron: `npm run phone:hub` (preferred) or `npm run ingest` while
`npm run dev` is running. Settings still does pairing and **Simulate** (no token
required). **Do not run two pollers.**

## When the app is closed

| What is running | Grocery at the store |
|-----------------|----------------------|
| Desktop app | Applied within a few seconds; pin refreshes. |
| `npm run phone:hub` on a machine that stays on | Live replies + pin + vault write. |
| Nothing (laptop asleep) | Open the **pinned** grocery card for the last dump. New texts wait up to ~24h for the next poller. |
| `npm run ingest` only | Queued until a renderer drains `/api/ingest/pending`. Prefer the phone hub. |

## Photos, PDFs, receipts

The phone is a scanner for the second brain, not a chat toy. Pairing still
required; unknown senders still get no reply. **OCR is local** (`tesseract.js`)
— no hosted vision API.

1. **Journal pages.** Photo (or an album) of a handwritten / printed journal.
   Auto-scan (contrast + small-angle deskew when canvas is available), OCR each
   page, store a **PDF** on a Docs note via `lib/attachments.ts` / `FileValue`,
   and keep searchable HTML in the note body. Caption optional (`journal:` /
   `scan:`). Same parking idea as From Notes: a real Item in Docs folder
   **From phone**, not a camera-roll graveyard.
2. **PDFs.** Forward a PDF (research, a scanned notebook already in PDF, a
   statement). Keep the file; extract text with pdfjs (`lib/pdf-to-html.ts`) and,
   on desktop/hub, `window.desktop.extractPdfText` / `pdf-parse`. The note is
   searchable. Caption `pdf: title` optional.
3. **Grocery receipts.** Photo of the strip at the register → OCR → grocery
   checkout + pantry bump:
   - unique fuzzy matches (`lib/ingest/name-resolve.ts`) **check off** open
     grocery lines and **bump** Inventory / Pantry / Fridge (`qty`);
   - **ask** when a line is ambiguous or new (`needs_clarify`: number, `inv`,
     `skip`) — never silently delete grocery items.

Pollers download Telegram `getFile` bytes (Electron + `npm run phone:hub`).
Albums (`media_group_id`) wait ~1.1s so every page lands in one PDF / one OCR
pass. Settings → **Simulate a scan** uses the same path without Telegram.

## File map

| Path | Role |
|------|------|
| `lib/ingest/` | Parser, expansions, dedupe, text triggers, write/read executors, grocery/needed/notes/pin, activity spans + discrete events, receipt/journal/PDF media, `iphone-notes` park, iPhone Screen Time / Calls / Texts, log store, help/info text |
| `lib/ingest/dedupe.ts` | Telegram `update_id` / `message_id` dedupe at the executor gate |
| `lib/ingest/text-triggers.ts` | Whole-message habit + discrete trigger patterns (Settings + habit form) |
| `lib/ingest/apply-needed.ts` | `needed:` / `get:` → list **needed**, notes **sent from text** |
| `lib/ingest/apply-discrete-event.ts` | `log:` / `log-` + discrete trigger instants (`generatedBy.kind === "text"`) |
| `lib/ingest/apply-activity-span.ts` | `currently` / `stopped` / `switched to` activity intervals |
| `lib/ingest/apply-habit-trigger.ts` | Whole-message habit keyword completions |
| `lib/ingest/apply-phone-screen.ts` | `screen:` / `ios:` → **iPhone Screen Time** only (estimated; no Mac AW stamp). AirDrop `Screen Time to Brain2.shortcut`. |
| `lib/ingest/apply-phone-life.ts` | `call:` → **iPhone Calls** interval; `text:` → **iPhone Texts** instant. AirDrop `iPhone Call to Brain2.shortcut` / `iPhone Text to Brain2.shortcut`. |
| `lib/ingest/apply-iphone-notes.ts` | Parse Shortcut wire format, join `2/3` continuations, park on **iPhone Notes Store**; `parkLooseText` parks a read that named nothing |
| `lib/ingest/apply-plan-text.ts` | `plan for rn:` appends today's plan log. `read plan for today` / `read plans for today` |
| `lib/ingest/apply-todos.ts` | `do:` → Next Actions General. `to do today:` → Home To Do. `read to do today` |
| `lib/ingest/apply-ritual.ts` | `gm` and `review` / `reviews` over text. skip or a blank message leaves a step empty |
| `lib/ingest/apply-gps.ts` | `gps:` and Telegram location / Live Location. Same place stays quiet. AirDrop `Location to Brain2.shortcut`. |
| `lib/ingest/apply-media.ts` / `apply-receipt.ts` / `apply-scan-doc.ts` / `ocr.ts` / `scan-page.ts` / `jpeg-pdf.ts` | Local OCR, deskew, JPEG→PDF, Docs parking, receipt checkout |
| `hooks/useMessageIngest.ts` | Renderer drain (Electron IPC or `/api/ingest`); album buffer; yields to phone hub; vault push |
| `lib/ingest/pairing.ts` | Codes + `unpairedSenders` (one-click pairing of a logged refusal) |
| `components/Settings/MessageIngestPanel.tsx` | Token, pairing (code **or** Texted but not paired), hub URL, shortcuts, iPhone Notes / Screen Time / Call / Text / Location Shortcut AirDrop steps, cheat-sheet, simulate message + scan |
| `components/iphone-notes-store.tsx` | Header **Phone Notes** queue over the Parked list |
| `components/ingest-log-dialog.tsx` | Header **Ingest** log |
| `docs/shortcuts/Dump iPhone Notes to Brain2.shortcut` | Signed Shortcut (`--mode anyone`) — AirDrop onto the iPhone |
| `docs/shortcuts/Screen Time to Brain2.shortcut` | Signed Ask-for-app `screen:` ping (`--mode anyone`) — AirDrop; attach a duplicate to App Is Opened |
| `docs/shortcuts/iPhone Call to Brain2.shortcut` | Signed Ask who + duration `call:` ping (`--mode anyone`) — AirDrop |
| `docs/shortcuts/iPhone Text to Brain2.shortcut` | Signed `text:` ping (`--mode anyone`) — AirDrop |
| `docs/shortcuts/dump-iphone-notes-to-brain2.md` | Direct install (AirDrop / iCloud Shortcuts) + wire format |
| `scripts/build-iphone-notes-shortcut.mjs` | Writes + signs the Notes `.shortcut` (`npm run shortcut:iphone-notes`; Find Notes 1001 + Pick a note / Shortcut Input) |
| `scripts/build-iphone-phone-shortcuts.mjs` | Writes + signs Screen Time / Call / Text / Location (`.shortcut`) (`npm run shortcut:iphone-phone`) |
| `docs/shortcuts/Location to Brain2.shortcut` | Signed Get Current Location → `gps: Name` + lat,lon (`--mode anyone`) — AirDrop; attach to Arrive / Leave |
| `docs/shortcuts/screen-time-to-brain2.md` | AirDrop Screen Time Shortcut + app-open Personal Automation |
| `docs/shortcuts/iphone-calls-and-texts-to-brain2.md` | AirDrop Call + Text Shortcuts (not Recents or Messages DB) |
| `docs/shortcuts/iphone-location-to-brain2.md` | AirDrop Location Shortcut + Live Location + Arrive/Leave automations |
| `electron/telegram-ingest.js` / `telegram-file.js` | Main-process long poll + `getFile` download + pin + yield to phone hub |
| `scripts/phone-hub.ts` / `phone-hub.mjs` | Always-on executor (`npm run phone:hub`) including media |
| `scripts/telegram-file.mjs` | Shared Telegram photo/PDF download |
| `scripts/telegram-ingest.mjs` | Optional queue-only poller (`npm run ingest`) |
| `scripts/ingest-api.mjs` | Dev hub `/api/ingest/*` |

## Undo

Successful habit / tracking / capture writes go through the same stores the UI
uses. Tracking and habits already push `action-history`; Cmd/Ctrl-Z undoes the
last Home/Tracking action as usual.
