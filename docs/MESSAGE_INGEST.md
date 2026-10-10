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
| Read-back (`read:`, `lists`, `folders`, `info`, search/status, `/quicklists`) | ✅ |
| Grocery shortcuts (`groc` / `store` / `got:` / `pin`) + tracker notes (`n` / `day:`) | ✅ |
| `needed:`, `get:`, activity spans, `log:` / `intake:` / `intake food\|drink\|drug:` / `cycle:` / `switch:` / `log categories` / `st:` / `so:` / `transit:` | ✅ |
| Habit keywords behind `dh:` + Settings discrete triggers | ✅ |
| Telegram dedupe (`update_id` / `message_id`; missing ids are logged, not applied) | ✅ |
| Analytics **Text events** / **Text spans** | ✅ |
| Always-on phone hub (`npm run phone:hub`) + webhook | ✅ |
| Custom first-word shortcuts | ✅ |
| Photos / PDFs / receipt OCR (journal scan, grocery inventory) | ✅ |
| Other messengers / Atlas-backed ingest | 🕓 later |

## Why this shape

Brain2 is **offline-first**: Zustand + localStorage in the renderer is the source
of truth. Telegram **getUpdates** only reaches a process that is actually
running. A closed laptop cannot answer `groc` at the store. Two paths stay live:

1. **Pinned cards.** Every `groc` / `store` / `got:` / `pin` / grocery `read:` refreshes
   the grocery pin. `pin todo` and `read to do today` refresh a separate pin of
   **to do today** (Home → To Do for today, not Next Actions). Open the bot chat;
   each pin is the last card for that list even if nothing is polling. A reply to
   that pin is the only text that checks a line off. This is the laptop-off *read* path.
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
There is **no scheduled `gm` autotext**. Morning starts when you send `gm`, or
when a process that is actually running receives it. A sleeping laptop cannot
answer. Always-on means `npm run phone:hub` (long-poll, or
`COGS_TELEGRAM_WEBHOOK`) on a host that stays awake.

Inbox `createdAt`, tracking minutes, and other “when you sent this” fields use
Telegram `message.date` (`receivedAt`), never the clock when the poller woke.
That `createdAt` stays the arrival after the idea is clarified, filed, or edited
on the desktop; those saves do not replace it with now. Desktop **Transfer to log** is not a text verb: the inbox rows leave on the click,
and one later write paints a Tracking log instant at that same `createdAt` (the
row clock, even days later), and puts a clipped duration or clock chip back on
the note. It does not stamp the keypress. A failed write puts the rows back.
A backlog is applied in send order. The same update is not applied twice
(dedupe). The poll offset is written, and a webhook returns 200, only after
that update's vault write finishes. A failed write is left unconfirmed so
Telegram retries it. A photo album stays unconfirmed until the merged apply
finishes, not when the 1.1s timer is scheduled. Webhook applies for one chat
run one at a time. Electron waits for the renderer to flush, then advances
its offset. Clocks
such as `3:30` sit on that send date in the **process timezone** — there is no
separate user timezone. The machine running the bot should be in your zone.

Replies stay prompt while a consumer is up: the phone hub rehydrates the vault
once per poll batch (not before every message) and flushes the debounced
persist write before it snapshots, so a ritual answer is still pending for the
next text. Electron and the renderer apply a batch in send order on one queue.
A failed poll waits 1s, not 4s. The long-poll itself still returns as soon as
Telegram has an update.

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
notes that never sync here use the signed [iOS Shortcut recipe](shortcuts/dump-iphone-notes-to-brain2.md)
(`npm run shortcut:iphone-notes` writes `Dump iPhone Notes to Brain2.shortcut`;
that signed file is not in the repo, and `.wflow.json` will not import)
→ `iphone-notes:` → Lists **iPhone Notes Store** (**Phone Notes** in Settings and Lists settings).
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

## Telegram slash menu

Private chats only (`setMyCommands` scope `all_private_chats`). The menu is five commands. Groups and the default scope are cleared so the catalog is not published as slash commands.

| Command | Menu description |
|---------|------------------|
| `/start` | Pair this chat, or say hello |
| `/help` | Short phrase list |
| `/now` | Now capture: doing \| just did \| about to |
| `/quicklists` | Numbered lists to pull |
| `/info` | BIM basics |

`store`, `groc`, `undo`, and the rest still work when typed. They are not in the menu. `help`, `/help`, `/start`, `info`, `/info`, bare `now`, and `/now` keep the replies they already have.

Clarify (habit, pen, grocery line, and the other numbered name lists), duplicate `see` / `again` / `dismiss`, and receipt `inv` / `skip` also get inline buttons. `callback_data` is a short code (`n:1`, `w:see`, `w:inv`, `w:skip`), 1–64 bytes, not the item title. Typing the number or the word still answers. Ritual questions stay plain text. There is no reply keyboard on the composer.

## Command language

Case-insensitive. A verb may be followed by `:` or a space. **Prefix-less text
defaults to Inbox Quick Add**, except a multi-line list dump (`Name:` then one
item per line), which files onto that list. An inbox capture stores
`captureOrigin` once (`kind: "telegram"`, labeled **BIM** on the Walk sheet):
the Telegram sender and message id when the update carried them, plus the raw
line. Simulate has no chat, so the detail is the line alone. Clarify does not
replace it. `createdAt` stays the send time. A colon path (`list: item`,
`folder: list: item`) creates the list. `folder: all: item` (also `all items`) files on that folder's All Items, not a list named all. A name may contain digits (`brain2: item`
is the list brain2). A date, time, duration, or priority is
applied and left in the title. `-p` or `-plain` stores that line as written. Ambiguous names get a one-step clarify reply
instead of a silent wrong write, but only among names that genuinely resemble
the query: a shared stopword (`to`, `my`, `the`, `store`, `list`, …) is not a match, and a unique fuzzy hit is refused when the query and the name each have a content word the other does not (a longer line that contains the name still matches), so prose no
longer ties a handful of unrelated lists. A read that resembles **nothing**
is parked on **iPhone Notes Store** to sort in the app (**Phone Notes** in Settings and Lists settings),
the same way Mac From Notes parks. Custom first-word aliases live in Settings.
Built-in **`store`** dumps the live grocery list even when that shortcut map is empty; the Settings example `store` → `groc` is only a shortcut you add yourself. Bare **`g`** is retired — it captures to Inbox like
any other prefix-less line, not grocery. A Telegram update with neither `update_id` nor `message_id` is logged with a null dedupe key and is not applied.

### Matching precedence

Before any write, the executor applies this order (see `lib/ingest/executor.ts`):

1. **Dedupe** — a text message is claimed by chat plus `message_id`, and also by `update_id` for the first delivery (`lib/ingest/dedupe.ts`). A later edit keeps the message id and is ignored. Live Location is the edit that re-applies, one sample per `update_id`. The event stores `telegramMessageId`. Neither id → log a null dedupe key and do not apply.
2. **Help / start / info** — `help`, `/help`, `commands`; `/start` (pairing when followed by a code); `info`, `manual`, `cmds`, `instructions` (rewritten cheat-sheets in `lib/ingest/help.ts`).
3. **Explicit verbs** — grocery (`groc`, …), `needed:` / `get:`, `plan for rn`, `currently` / `stopped` / `switched to`, `log:` / `log-`, and the rest of the verb table below (habit `h`, `track:`, `read:`, …).
4. **`dh:` habit keywords** — the text after `dh:` must match an editable trigger on a habit (`lib/ingest/text-triggers.ts`, `apply-habit-trigger.ts`). Presets: `hemisync`, `read N pages`, `exercise N min`, `chess score N`. A few filler words may sit before the number (`dh: studied for 20 min`). Quantity **adds** to the day’s total; a score replaces it. The habit form’s **Try a phrase** box previews the same parser and writes nothing. A BIM keyword source (`lib/habit-keyword-source.ts`) counts messages the ingest path already stored. The whole message must be the phrase: “drank water” counts, “drank water please” does not. On that source row the count is true if one arrives, true after a set number, or a logged phrase such as `read {n} pages of {bookname}` or `cleaned for {x} minutes`, which writes the parsed amount and any name on that period. `{x}` and `{minutes}` are the same kind of number as `{n}`. A minutes or hours pattern also paints the prior span on the habit’s tracking activity (`lib/habit-logged-span.ts`). No clock ends that span at the message time and marks it estimated. A trailing clock such as `1:11` is the end; a bare clock is military and stays on the message’s date even when it is still ahead. A tracking link owns the cell number so those minutes are not added twice. With no link, the summed amount is written on the cell. The same message in the same minute counts once. The phrase list can still hold the words. The mode and the pattern live on the source row. A hit with no timestamp is not copied onto every period. A bare keyword, with no `dh:`, is still stored (Inbox, or a discrete trigger such as `drank water`) and that stored line is what the source counts.
5. **Whole-message discrete events** — Settings → **Message ingest** → discrete triggers (defaults: `smoked weed`, `drank water`, `ate {item}`, `took {item}`) via `apply-discrete-event.ts`. Separate from `log:` / `log-`. These stay unprefixed.
6. **Else** — remaining parsed verbs, multi-line list dumps, or Inbox capture.

An open walkthrough is earlier than this ladder: the reply belongs to that question. `gm` during night, start, or end still opens the morning ritual. `cancel` still quits those walks. Morning ignores `gm` as a command and keeps the current question until `STOP`. Each step edits one bot message for that chat. The person's messages stay as sent. `undo` reverts the last text write for this chat when that write is still the one the store can name. It does not rewind an open ritual. `undo the laundry` stays inbox.

Text-pipeline tracker rows (`generatedBy.kind === "text"`) feed Analytics → **Text events** (instants + switch markers) and **Text spans** (`currently` / `stopped` / `switched to` intervals). A habit duration span uses that stamp only as an idempotency key (`generatedBy.id` starts with `kw:`) and is left out of those canvases.

| Phrase | Intent |
|--------|--------|
| `groc` / `store` / `grocery` / `groceries` / `shop` | Dump the **live** grocery list (Settings picker; otherwise Grocery / Groceries / Shopping) and **pin** that card. Other open shopping-list counts are on the card once. The dump reply is the same card, so the chat is not sent the list twice. Bare `store` is this dump. |
| `groc milk` / `store milk` / `grocery: eggs` | Add onto that list (Inbox off). Several lines = bulk. An identical **open** line is skipped; reply `see`, `again`, or `dismiss`. `grocery` / `groceries` / `shop` / `shopping` need a colon before an item, so `grocery list` and `grocery store` stay inbox. |
| `needed:` then lines · `get:` then lines · `get: batteries` | Add onto the list named **needed** (creates it if missing). Each item gets notes **sent from text** (`apply-needed.ts`). `get:` requires the colon (bare `get …` stays Inbox capture). Empty `get:` / `needed:` adds nothing |
| `got: milk` / `bought: milk` / `x bread, eggs` / `check off oats` | Complete matching open grocery lines; refresh the pin. `got` and `bought` without a colon check off only when every phrase matches an open line. `Got back from walk` stays inbox. A reply to the grocery pin checks that text off the same way. A reply to any other message does not. |
| Snap a **receipt** (caption `receipt` if it might look like a page) | Local OCR → check off grocery + bump Inventory/Pantry/Fridge. Asks when a name is new (`inv` / skip / number) |
| Snap **journal pages** (album ok; caption `journal: morning`) | Deskew, PDF + searchable text → Docs note in folder **From phone** |
| Forward a **PDF** (caption `pdf: title` optional) | Docs item; extract text with pdfjs / desktop `extractPdfText` |
| `inv` / `inv oats` / `pantry` | Dump or bump the pantry list |
| `pin` / `live` / `snapshot` | Refresh the pinned grocery card (+ a one-line now). The reply is that card. |
| `n stuck in aisle 4` / `note: left room at 8:15` / `jot:` / `memo:` | Text log instant, the Tracking log Note row. No clock uses send time. `at 8:15` is that minute. A clock with no word is exact. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: "estimated"`). `unknown` keeps that minute for placement. Also appended onto the block covering that minute. A second line is the note. |
| `tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix` / `TP:` / `thought process:` / `log: tp:` | Thought process: a guiding strand of this moment, from what you are doing, to what it leads to, to how it feels. Why you are doing something, what you expect to do next, and how it lands. Not a general note, a one-word mood, or a short activity log such as brushed teeth. Colon required, so bare `tp` and bare `thought process` stay capture. Activity instant, pen **Text log**, `eventKind` `thought-process`. The first line is the title; lines under it are the note. No time uses send time. Clocks are `parseExpectedWhen`, the same reader as a log line: a bare clock is military, `1pm` / `1:00 PM` / `1:00 p.m.` are 13:00, `7/4/26` is July 4, 2026. `est` / `unknown` still work. |
| `n loc: crowded` / `n mood: low` / `n activity: deep work` | Same tick on that Tracking scope, and on the block covering that minute |
| `day: tired` / `daynote:` / `n day:` | Tracking day jot (append log). Bare `day` → `today` |
| `pick up milk` / `qa:` / `add:` / `inbox:` / `idea:` / `quick add:` | Capture. Same smart-parse as Quick Add. Only `add:` strips the verb; bare `add` stays inbox with the full sentence. Inbox on. `list: item` and `folder: list: item` create the list if needed. `folder: all: item` (also `all items`) files on that folder's **All Items**, not a list named all. A name may contain digits (`brain2: item` is the list brain2). A date, time, duration, or priority is applied and **left in the title**. `-mb` or `-monkey` on the line dumps it in **Monkey brain** (a separate Inbox pile for compulsive thoughts — not the Inbox you mean to revisit). `-p` or `-plain` stores the line as written: no list, folder, date, time, duration, priority, or Monkey brain. |
| `Chores: milk` | One line: capture with a list path (still Inbox unless you use Bulk / `groc`). A list created by this stays out of the Scheduler until List Settings → **Send to Scheduler** |
| `Grocery list:` then `eggs` / `rice` / `butter`, or `Grocery list: grocery list:` | Files onto the grocery **store** list (`groc` uses the same one). Does not create a second folder. Identical open lines are skipped |
| `before elijah gets home:` then the lines | That list, found or created, one item per line. A new list is not sent to the Scheduler |
| `before 9/12:` / `before Friday:` / `before Sept 12:` | Following lines are **due that day** (`deadline` and `mustBeDoneBefore`). A past `M/D` rolls forward a year. Words after `before` stay a list name |
| `bulk:` then one item per line | Bulk Add. Header lines `list:` / `folder: list:` / `folder: all:` work. `folder: all:` files the following lines on that folder's All Items. Files onto lists (Inbox off). `Home: Groceries:` keeps that folder. A grocery name with no other folder uses the store list. A list created here is not sent to the Scheduler, even when the folder is |
| `iphone-notes:` / `inotes:` / `phone notes:` | Park an On My iPhone note dumped by the signed [iOS Shortcut](shortcuts/dump-iphone-notes-to-brain2.md) (generate with `npm run shortcut:iphone-notes`; the `.shortcut` is not in the repo). One note per message; long bodies `iphone-notes 2/3:`. Lands in Lists → **iPhone Notes Store** → **Parked** (**Phone Notes** in Settings and Lists settings). Not the tracker `n` / `note:` jot. Mac **From Notes** is a different folder. |
| `habit: exercise 30` / `h stretch` / `did: stretch` | Habit for **today** (optional `yesterday`). Fuzzy-matches the habit name. Bare `h` → help. Bare `did` stays inbox; `did:` still logs the habit. |
| `dh: hemisync` / `dh: read 12 pages` / `dh: exercise 30 min` / `dh: chess score 1200` / `drank water` / `cleaned for 9 minutes` / `cleaned for 9 minutes 1:11` | Habit keywords. `dh:` still runs the phrase after the colon. A BIM keyword source also counts an exact whole message the bot already stored: “drank water” counts, a longer line does not. True if one arrives, true after N, or a logged phrase `read {n} pages of {bookname}` writes 3 and Dune. `cleaned for {x} minutes` writes 9 and paints the prior 9 minutes on the habit’s tracking activity. No clock ends at the message time and is estimated. `1:11` is the end (1:02–1:11); a bare clock is military. The same words without `dh:` are still stored (Inbox, or a discrete trigger) and that stored line is the count. |
| `smoked weed` / `drank water` / `ate egg salad` / `took 2 adderall` | Whole-message **discrete events** (editable in Settings). `generatedBy.kind === "text"`. `ate` → food, `drank` → drink, `took` → drug (`intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`). Pen stays **Text log**. Other triggers, including `smoked weed`, do not set a class. |
| `log: left room` / `log left room` / `log: left room at 3:30` / `log: left room at 3:30 loc: home` / `log: shower 7:30 - 7:45` / `log: shower 10m` / `log: START walk` / `log: END walk 5:00` / `log: went outside` / `log went outside 12:04` / `log: went outside 7/4/26 1:00` / `log keywords` | Tracking note on Activity, the Event row. The word `log` works with or without the colon. No time → a point at send time. `at 3:30` is a point that day. A clock range is a block. `10m` / `10 min` just finished (end = send time). `START` stays open until `END` of the same name, which becomes the range. A line under the event is the note; the clock stays on the first line. A later block over that minute leaves the point. Pens: **Text log**. The phrase is the title and `eventKind` (lowercase, spaces collapsed, punctuation removed) so `left room` groups with the next `left room`. Trailing `loc: home` reuses or creates that Location pen and paints a Location instant at the same minute. The place is the last suffix. Saved keywords (added in Tracking settings, the gear; `brain2-log-keywords`, empty until you add them) match the longest phrase. The remainder is the optional date and time, not part of the title. `log keywords` and `log: keywords` list the phrases and do not create a row. A bare phrase with no `log` prefix is not a log. On a log line, a clock with no am/pm is military time: `12:04` is noon, `18:37` is 6:37pm, and `1:00` is 1:00am, not 1pm. `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 1:00pm. `7/4/26` and `7/4/2026` are July 4, 2026 (month/day/year). Those forms apply when a log or switch line expects a time (`parseExpectedWhen`). A bare clock is military. A date alone does not invent a clock. Ordinary inbox text is not scanned. Desktop Quick Add uses this same write: a leading `log:` shows a dark blue **LOG** mark and does not go to Inbox. |
| `log: left room at 3:30 est` / `log: left room ~8:15` / `log: left room unknown` / `log: left room at 3:30 est loc: home` | Clock certainty on log, intake, switch, and note lines. No token, and a plain clock, are exact (`clockCertainty` omitted). `est`, `estimated`, or `~` is estimated and also sets `precision: "estimated"`. `unknown` stores the named minute for placement and does not treat that minute as observed. On a log, the word may sit before or after `loc:`. |
| `intake: coffee` / `intake food: egg salad` / `intake drink: coffee at 8:15 est` / `intake drug: tablet` | Food, drink, medicine, or any intake. Food is a subset of intake. Always a point. No time → send time. A trailing clock uses that time on the send date. Duration words stay in the title. A line under the event is the note. Pen: **Intake**. Bare `intake:` leaves `intakeClass` unset and sets `eventKind` to `intake`. `intake food:` / `drink:` / `drug:` set `intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`. Same clock words as `log:`. A later block leaves the point. |
| `cycle: bleeding` / `cycle: spotting` / `cycle: ovulation` / `cycle: bleeding off` | Sets or clears that flag on the message's local calendar day (`brain2-cycle-marks`). Spotting is stored and does not change phase. Colon required. A calendar mark, not medical advice. Phase (`menstrual` / `follicular` / `ovulatory` / `luteal` / `unknown`) is derived by `phaseForDate`, not stored. |
| `switch: location from: home to: ralphs` / `switch: activity from: working on brain2 to: working on foxtide 6:37pm` / `switch: company Elijah` / `switch: to cleaning` / `switch: from email to cleaning` | Switch. The colon sits right after `switch`. The next word is a tracking view when it names one you have; omit it and the view is Activity. `from:` is what you left and `to:` is the destination. A bare name after the view is the destination, not a search (`switch: company Elijah` is to=Elijah on Company, at the message’s local date and time, no from). Activity-default lines may say `from` and `to` without colons. Optional clock, else the send time. Log lines, switch lines, and tracking-note clocks (`intake:`, `st:`, `so:`, `note:`) use `parseExpectedWhen`. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37, `1:00` is 1:00am). `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 13:00. A bare integer is not a clock. Optional `7/4/26` or `7/4/2026` on a log or switch line is month/day/year; a date with no clock keeps the send clock. `at` marks the clock and is not part of the destination. Ordinary inbox text is not parsed this way. `est` / `estimated` / `~` is estimated. `unknown` keeps the minute for placement. Activity stores the same instant as `st:`: pen **Switch**, title `started …` or `stopped … · started …`, plus `switchFrom` / `switchTo`. Any other view paints an instant on that scope. `to` is that scope’s pen. `from` is found or created and stored; the tick color is the destination. There is no Goal view. |
| `log categories` / `log: categories` | Reply only. A numbered list of the tracking views in the store: display name, the id you type after `switch:`, and `depth N` when that view’s display depth is a number. Not a logged event. |
| `st:` / `switch task:` · `so:` / `switch objective:` / `switch goal:` · `transit:` | Aliases. Colon required, so bare words stay capture. `st:` and `switch task:` are Switch on Activity (pen **Switch**, `started …`). `so:`, `switch objective:`, and `switch goal:` still write the Objective pen on Activity (`objective …` or `left … · objective …`). `transit:` stays the Transit pen. New switch rows fill `switchFrom` / `switchTo`; older rows omit them. Same `est` / `unknown` words. Example: `st: from: email to: cleaning` · `switch goal: read at 8:00 est`. |
| `currently deep work` / `stopped` / `switched to email` | Open, close, or switch an **activity span** through end of day; Analytics → **Text spans**. |
| `at: gym` / `w gym` / `@ home` / `location:` / `here:` | Location **now** through tonight. Bare `w` / `@` → `where`. |
| `gps: Home` / `gps-log:` / a Telegram **Live Location** | Location up to the sample minute, not the rest of the day. A pin inside a place named on Analytics → Places (seen more than once, within 80 m) uses that name; otherwise the same coordinates keep the current pen. A venue pin (a restaurant card) is not where you are. `at:` stamps the sample. Points stay on Location and off the header ingest log unless you **Show GPS**. AirDrop [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut) — it keeps a log on the phone and sends the backlog when Telegram can (see [iPhone location](shortcuts/iphone-location-to-brain2.md)). |
| `plan for rn:` then lines | Append today's Plan log (Day tab) with stamp suffix **from text**. |
| `read plan for today` / `read plans for today` | Latest entry, or every entry in bulk plaintext. |
| `do: call dentist` / `next action:` | Next Actions → **General**. Not scheduled. |
| `to do today: call dentist` / `todo today:` / `do today:` | Home → To Do for today. Refreshes the to-do pin. The reply is the add line, not a second copy of the list. |
| `read to do today` | That open list, numbered, and pins it. The reply is the same card. |
| `pin todo` / `pin to do` / `pin today` | Pin **to do today** (Home → To Do for this day). Not Next Actions (`do:`). Its own pin, separate from grocery. |
| Reply to the **to-do pin** | Adds a line when the text has no leading item number. A number, or `1. 3 pm` / `5. 4pm`, marks that numbered line done. No clock uses the current time. A date `parseExpectedWhen` already understands stays on that day; otherwise the clock is today in the machine zone. `-est` or `-e` after the time stores the finish as estimated (`completedDate` plus a `logged` estimate on that field, and `completionReview.completedAt`). The pin shows `~` on that done line. A bad number is named and the other lines in the message still apply. A reply to any other message is not this. |
| `gm` / `good morning` | Morning ritual (sun). Opens with last night's wake-up reminder, what matters most, and focus goals when those were saved. Then all nighter or sleep; 5 affirmations one-at-a-time (voice advances); to-do add (`rm 1 3`); required (`1,8` or `1, 8` — a line of only numbers; any other line is a new to-do); 3–5 priorities; 1–3 habit priorities; each to-do as six slots (tier, duration, points, importance, resistance, excitement — the last three are 0–10 and may be `6.5`; a bad line stays on that item; `SKIP` one; `SKIP ALL` the rest); plaintext day plan stamped **from text**; circumstance branches; best day; 10 gratitude. `skip` / blank moves on. |
| `gn` / `good night` / `night` | Night ritual (moon) for today — unfinished (done / push / why blocked, Other plus a note); assumed times; how the day was spent; summary; gratitude; plan; went well / improve / learned; wake-up reminder; what matters most; goals to focus; tomorrow's plan. Week and longer reviews add the period stats and the longer reflection before the summary. |
| `rituals` / `reviews` | Rituals board: every available/undone slot with status, Telegram command, and in-app path (Header → Rituals). |
| `review` / `ritual` / `review today` / `review week` / `ritual start week` / `ritual end week` | Open a ritual (first available, named end, or start). `cancel` quits night/start/end; morning uses `STOP`. |
| `tt work` / `track: exercise 30m` / `doing: work 9-11` | Activity block (duration ending now, or an explicit clock window). |
| `screen: Instagram 30m` / `screentime:` / `phone-screen:` / `iphone:` / `ios:` | **iPhone Screen Time** only (estimated). Same duration / clock window as `track:`, or from now until the next ping. Auto-creates an app pen. Not Mac Screen Time. Apple cannot export Screen Time — typed phrase or AirDrop [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut) (Ask-for-app ping; attach a duplicate to App Is Opened for automation). |
| `call: Jane 12m` / `called:` / `phone-call:` | **iPhone Calls** interval (who + duration or `3:02-3:17`). Estimated. Colon required, so `call gran points-100` stays inbox. Apple cannot dump Phone recents. AirDrop [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut). |
| `text: Jane on my way` / `sms:` / `imessage:` / `sent:` | **iPhone Texts** instant at send time. Colon required, so `Text shelby back` stays inbox with the full sentence. First word after the colon is who; the rest is the body (title + notes). Shortcuts cannot read Messages — type it or AirDrop [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut) (Asks for body, then who). |
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
| `where` / `status` / `now` | Status readout when that is the whole message: location, activity, mood, working now, last night's sleep, inbox count. |
| `now putting laundry away \| smoked \| outfit store` / `/now` | Now capture. Segments split on `\|`: doing now (Activity, the future of the day cleared), just did (Tracking log event), about to do (a 30-minute header plan). Empty segments are skipped. One segment, as in `Now been putting laundry away…`, keeps that prose as doing-now. `/now` alone replies with the template and the current lanes. Distinct from `currently`, which paints through midnight. |
| `/quicklists` / `/quicklists 5` / a bare number | Numbered lists. 1 to do today, 2 this week, 3 this month, 4 open next actions, 5 the live grocery list, 6 a shopping list when it is a different list (otherwise another grocery-scored list, then the list named needed, then the next other list), 7 the list named ISO, 8 undone habits. `grocery list`, `grocery store`, and `to do list` stay inbox. |
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
today's completion (optional `yesterday`). **`dh:` keywords** (`dh: read 10
pages`, `dh: hemisync`, …) match only when the text after `dh:` fits the trigger
on that habit — edit triggers on the habit form or accept name-based presets when
you save. Quantity keywords add (`dh: studied for 20 min` on top of time already
logged). A score replaces. `dh:` runs with explicit verbs. A BIM keyword source
counts exact whole messages already in the ingest log for that period: true if
one arrives, true after a set number, or a logged phrase such as
`read {n} pages of {bookname}` or `cleaned for {x} minutes`, which writes the parsed amount and the name. A minutes or hours phrase also paints the prior tracking span.
“drank water please” does not count. A hit with no timestamp is not copied onto
every period. The same words without `dh:` are still stored and that stored line
is what the source counts.

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

`n` / `note:` / `jot:` / `memo:` write a Text log instant, the Tracking log
Note row. No clock uses send time. `note: left room at 8:15` uses that minute.
A clock with no word is exact. `est` / `estimated` / `~` is estimated. `unknown`
keeps that minute for placement. The first line is the title; lines under it
are the note. If a block covers that minute, the same text is also appended
there. `day:` / `n day:` stay the Tracking day jot (`lib/day-notes-persist.ts`)
and do not become a tick, and do not read a clock. A later paint or erase of
those minutes leaves the point.

`tp:` / `TP:` / `thought process:` / `log: tp:` are a Thought process: a guiding
strand of this moment, from what you are doing, to what it leads to, to how it
feels. It is why you are doing something, what you expect to do next, and how
it lands. It is not a general note, not a one-word mood, and not a short
activity log such as brushed teeth. Colon required.
They paint the same Text log instant with `eventKind` `thought-process`.
The first line is the title; lines under it are the note. Clocks use
`parseExpectedWhen`, the same reader as a log line. Example:
`tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix`.

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
- The ingest log (local) keeps source chat id + raw text for audit / undo. GPS tracking points are not stored in that 200-line log (a live stream was burying everything else). Location still collects them. **Show GPS** on the header log reveals points this window collected. A failed `gps:` and an unpaired refusal stay on the log.
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
4. Text `groc`, `store`, `help`, or `info`. Confirm grocery in Lists. Text `got: milk` at the
   store after adding `groc milk`. Snap a receipt at the register, a journal page,
   or forward a PDF — they become pantry/checkout or a Docs note.
5. For 24/7 live replies: **Sync vault**, then `npm run phone:hub` on a host that
   does not sleep. Pick the **live grocery list** in that same Settings panel.
   Built-in `store` dumps it. A custom shortcut such as `store` → `groc` is optional
   and only runs when you add it.

Without Electron: `npm run phone:hub` (preferred) or `npm run ingest` while
`npm run dev` is running. Settings still does pairing and **Simulate** (no token
required). **Do not run two pollers.**

## Timed reminders

The built-in **Reminders** list (`lib/reminders.ts`) is outbound, not a new
command. While the desktop app is open, a due reminder is copied into the
Inbox. **Text me** defaults on, so it is also texted to the latest paired
chat. The desktop path is the existing `sendMessage` bridge
(`window.desktop.telegram.send`, token already stored for ingest). When that
bridge is absent, the text is posted to `/api/ingest/reply` for the phone hub
to send. Text me off does not call send; the Inbox copy is still written and
`reminder.telegramNote` is `Text me is off`. No paired chat, no token, or a
failed send still writes the Inbox and stores the reason on
`reminder.telegramNote`. The same occurrence is not sent twice, including
after Dismiss. There is still no cron for a sleeping laptop: reminders wait
until the app is open again, then catch up once. **Persistent** defaults on:
that occurrence stays in the header bell until dismissed. Off still inboxes
and, when Text me is on, still texts — it just does not nag. Dismiss is not
delete. Once is gone from the bell; daily, weekly, and lunar (new moon / full moon)
return on the next cycle. The app seeds **new moon tonight** and **full moon
tonight** on the calendar day of that phase: the header bell from local midnight,
Inbox and Text me at 18:00 local.

## When the app is closed

| What is running | Grocery at the store |
|-----------------|----------------------|
| Desktop app | Applied within a few seconds; pin refreshes. |
| `npm run phone:hub` on a machine that stays on | Live replies + pin + vault write. |
| Nothing (laptop asleep) | Open the **pinned** grocery card for the last dump. New texts, including `gm` and a walkthrough already in progress, wait up to ~24h for the next poller. There is no outbound morning cron. Timed reminders also wait: they fire only while the app is open. |
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
| `lib/ingest/telegram-ui.mjs` | Private slash menu (`start`, `help`, `now`, `quicklists`, `info`) and inline buttons on clarify, duplicate, and receipt questions |
| `lib/ingest/dedupe.ts` | Telegram `update_id` / `message_id` dedupe at the executor gate. A null key is logged and not applied. |
| `lib/ingest/text-triggers.ts` | Whole-message habit + discrete trigger patterns (Settings + habit form) |
| `lib/ingest/apply-needed.ts` | `needed:` / `get:` → list **needed**, notes **sent from text** |
| `lib/ingest/apply-discrete-event.ts` | `log:` / `intake:` / `switch:` / `log categories` / `st:` / `so:` / `switch goal:` / `transit:` + discrete trigger instants (`generatedBy.kind === "text"`). A line under the event is the note. Log ranges are blocks. Points stay when a later block covers that minute. `log:` sets `eventKind`. Trailing `loc:` paints a Location instant on that pen. Classed intake and `ate` / `drank` / `took` set `intakeClass`. Estimated clocks also set `precision`. `switch:` is the labeled form (view, then `from:` / `to:`, or a bare destination). Activity stays the Switch pen (`started …`). Other views paint on that scope. `so:` / `switch goal:` still store `objective …`. `log categories` replies with the store’s views and writes no event. `tp:` / `thought process:` / `log: tp:` paint a Text log instant with `eventKind` `thought-process` (Thought process: a guiding strand of this moment — why you are doing something, what you expect next, and how it lands; not a general note, a one-word mood, or a short activity log such as brushed teeth). |
| `lib/ingest/apply-cycle.ts` | `cycle:` bleeding / spotting / ovulation (and `off`) on the send date. |
| `lib/ingest/apply-activity-span.ts` | `currently` / `stopped` / `switched to` activity intervals |
| `lib/ingest/apply-habit-trigger.ts` | `dh:` habit keyword completions. A BIM keyword source counts an exact whole message already stored by ingest (`lib/habit-keyword-source.ts`): true if received, true after N, or a logged phrase that writes the parsed amount. A minutes or hours phrase paints the prior span (`lib/habit-logged-span.ts`). |
| `lib/ingest/apply-phone-screen.ts` | `screen:` / `ios:` → **iPhone Screen Time** only (estimated; no Mac AW stamp). AirDrop `Screen Time to Brain2.shortcut`. |
| `lib/ingest/apply-phone-life.ts` | `call:` → **iPhone Calls** interval; `text:` → **iPhone Texts** instant. AirDrop `iPhone Call to Brain2.shortcut` / `iPhone Text to Brain2.shortcut`. |
| `lib/ingest/apply-iphone-notes.ts` | Parse Shortcut wire format, join `2/3` continuations, park on **iPhone Notes Store**; `parkLooseText` parks a read that named nothing |
| `lib/ingest/apply-plan-text.ts` | `plan for rn:` appends today's plan log. `read plan for today` / `read plans for today` |
| `lib/ingest/apply-todos.ts` | `do:` → Next Actions General. `to do today:` → Home To Do for today, which is the to-do pin. `read to do today` / `pin todo` pin that card once. A reply to the pin adds or checks off by number. Finish time is `completedDate` and `completionReview.completedAt`; `-est` / `-e` is a `logged` estimate on `completedDate` |
| `lib/ingest/apply-ritual.ts` | `gm` and `review` / `reviews` over text. Morning moves on skip or next; a blank message waits. Live Location is paused until the ritual ends, then the same share resumes |
| `lib/ingest/apply-gps.ts` | `gps:` / `gps-log:` and Telegram Live Location. Paints up to the sample, not through midnight. A named repeated place (80 m, `gps-places.ts`) wins; otherwise the same coordinates keep the pen. A venue pin is ignored. AirDrop `Location to Brain2.shortcut` (on-phone log). Points stay off the persisted ingest log. |
| `lib/ingest/gps-places.ts` | Samples and names for coordinates seen more than once. Named on Analytics → Places. |
| `lib/ingest/gps-log.ts` | Memory-only ring for those GPS points. Header **Show GPS** reveals what this window collected. |
| `lib/ingest/apply-media.ts` / `apply-receipt.ts` / `apply-scan-doc.ts` / `ocr.ts` / `scan-page.ts` / `jpeg-pdf.ts` | Local OCR, deskew, JPEG→PDF, Docs parking, receipt checkout |
| `hooks/useMessageIngest.ts` | Renderer drain (Electron IPC or `/api/ingest`); album buffer; yields to phone hub; vault push |
| `lib/ingest/pairing.ts` | Codes + `unpairedSenders` (one-click pairing of a logged refusal) |
| `components/Settings/MessageIngestPanel.tsx` | Token, pairing (code **or** Texted but not paired), hub URL, shortcuts, iPhone Notes / Screen Time / Call / Text / Location Shortcut AirDrop steps, cheat-sheet, simulate message + scan |
| `components/iphone-notes-store.tsx` | **Phone Notes** queue over the Parked list (Settings and Lists settings) |
| `components/ingest-log-dialog.tsx` | **Ingest** log (Settings and Lists settings). GPS tracking points hidden unless **Show GPS**. |
| `docs/shortcuts/dump-iphone-notes-to-brain2.md` | Recipe. `npm run shortcut:iphone-notes` writes the signed shortcut. The `.shortcut` is not in the repo. `Dump iPhone Notes to Brain2.wflow.json` will not import. |
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
