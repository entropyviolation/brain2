# `lib/ingest/` — Phone-message ingest

Channel-agnostic command core that turns short phrases into the same capture,
habit, and tracking writes the desktop UI uses. Telegram is the first adapter.
See [`docs/MESSAGE_INGEST.md`](../../docs/MESSAGE_INGEST.md).

The Electron poller never writes Zustand. `npm run phone:hub` *does* run this
folder headlessly against `data/shared-persist.json` so grocery reads work when
the laptop is closed. Write commands reuse capture / habit / tracking paths.
Inbox captures and `plan for rn` appends land through the same stores as the UI
(`-mb` / `-monkey` files a capture in Monkey brain, the dump partition of Inbox;
`-p` / `-plain` stores that line as written).
Hub merge unions those rows by id so a later desktop Sync cannot erase them.
Read commands dump lists, folders, inbox, habits, and status as plain text
(`groc`, `read: grocery list`, `lists`, `info`; `ping` replies that **BIM** is
listening). The bot introduces himself as **BIM** (Brain2 Ingestion Messenger) —
you can call him BIM for short. `info` covers basics plus how to ask for
`{prefix} info`, `{prefix} commands`, and `all commands`. Full catalog:
[`docs/BIM_COMMANDS.md`](../../docs/BIM_COMMANDS.md). Bare `g` is retired
(Inbox capture). Matching order: dedupe → help/start/info → explicit verbs →
whole-message discrete triggers → else. Habit keywords need `dh:` first
(`dh: hemisync`); a bare keyword is still stored and a BIM keyword source counts
that exact whole message (`lib/habit-keyword-source.ts`): true if one arrives,
true after a set number, or a logged phrase such as `read {n} pages of {bookname}` or `cleaned for {x} minutes`,
which writes the parsed amount. `{x}` and `{minutes}` are the same kind of number as `{n}`. A minutes or hours phrase also paints the prior span on the habit’s tracking activity (`lib/habit-logged-span.ts`): no clock ends at the message time and is estimated; a trailing clock is the end. A longer line does not count. A quantity keyword adds
to the day’s total (`dh: studied for 20 min`); a score replaces. The habit
form previews the same parse. An open walkthrough owns the reply (a `log:`
mid-ritual is an answer). Morning stays until the message is exactly `STOP`.
During night, start, or end, `gm` still opens the morning ritual and `cancel`
still quits. Blank morning messages wait. Live Location is paused until the
ritual ends, then the same share is recorded again. Writes use Telegram
`message.date` (send time), not the moment the poller woke. Clocks without a
date sit on that send date in the process timezone.
`iphone-notes:` parks On My iPhone Shortcut dumps on the dedicated
store list. Grocery dumps pin a Telegram card. Token is not in this folder:
gitignored `.env.local` or Electron `safeStorage`. Bot:
[t.me/brain2_phone_bot](https://t.me/brain2_phone_bot).
Photos, PDFs, and receipt OCR are **shipped**: local Tesseract, deskew, JPEG PDF,
Docs folder **From phone**, grocery checkout + pantry bump. See
[`docs/MESSAGE_INGEST.md`](../../docs/MESSAGE_INGEST.md).

| File | Purpose |
|------|---------|
| `types.ts` | Intents, sources, apply results, ingest log events |
| `parse-message.ts` | Verb + payload parser. Prefix-less text → Inbox capture, except a multi-line `Name:` dump → bulk. Grocery verb is `groc` / `store` / `grocery` / `groceries` / `shop` (not bare `g`). `grocery` / `shop` / `shopping` need a colon before an item. Colon-only verbs: `text`, `sent`, `sms`, `imessage`, `call`, `called`, `phone-call`, `did`, `add`, `got`, `bought`, `checkoff`, `checkout`. Bare `now` / `status` / `where` are status; `now` with a payload and `/now` are Now capture. `/quicklists` is the numbered list pull. A header that only *starts* with `grocery` stays a list name. Colon headers (case-insensitive, before the alias loop): `log categories` / `log: categories` (a reply, not an event), `log:` / `log-` / `log` (colon optional), `log keywords` (a numbered list, not a row), `dh:`, `intake food:` / `intake drink:` / `intake drug:`, `intake:`, `switch:` (colon immediately after `switch`; the view is the next word), `st:` / `switch task:`, `so:` / `switch objective:` / `switch goal:`, `transit:`, `cycle:`, `tp:` / `thought process:` / `log: tp:` (colon required on the thought verb; bare `tp` stays capture). Bare `cycle`, `switch goal`, and `intake food coffee` (no colon) stay capture. `screen` / `screentime` / `iphone` / `ios` / `phone-screen` → iPhone Screen Time (`iphone-notes` still wins over `iphone`) |
| `parse-tracking-note.ts` | One parser each for `log:`, `intake:`, from/to notes (`st:` / `so:` / `switch goal:` / `transit:`), and the labeled `switch:` line (`parseSwitchCommand`). `at 3:30` is a point on the send date. `10m` on a log just finished. Intake never grows a duration. The first line is the event; lines under it are the note (`splitEventLine`). On log, intake, switch, and note lines, a trailing `est` / `estimated` / `~`, or `~` on a clock, is estimated; trailing `unknown` keeps the minute for placement only. A clock with no token stays exact. A log’s trailing `loc: home` is a Location pen (the place is last; `est` may sit before or after it). Log lines, switch lines, and tracking-note clocks use `parseExpectedWhen`. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37, `1:00` is 1:00am). `1pm`, `1:00 PM`, and `1:00 p.m.` are 13:00. `7/4/26` and `7/4/2026` are that date. A bare integer is not a clock. A date alone does not invent a clock. Ordinary inbox text is not scanned. Saved log keywords (`lib/log-keywords-store.ts`, added in Tracking settings, the gear; empty until added) take the longest phrase; the remainder is the optional date and time. On a log line, no am/pm means military time (`12:04` is noon, `1:00` is 1:00am, `1pm` / `1:00 PM` / `1:00 p.m.` are 1:00pm) and `7/4/26` is July 4, 2026. That military default applies to log lines, not to every text field in the app. |
| `message-time.ts` | `messageSentAt` prefers `receivedAt` (Telegram `message.date`). `compareSentOrder` sorts a backlog by send time, then message id. |
| `index-list.ts` | A line that is only comma-separated numbers (`1,8`, `1, 8`) is a list of indexes. Any other text stays one line. |
| `dedupe.ts` | Text is claimed by chat plus `message_id` (an edit does not run again) and by `update_id` for the first delivery. Live Location re-applies per `update_id`. Neither id → the executor logs a null dedupe key and does not apply |
| `confirm-updates.ts` | Poll offset moves only through update ids whose vault write finished |
| `deferred-album.ts` | Photo-album updates stay unconfirmed until the merged apply resolves |
| `chat-queue.ts` | Hub webhook runs one apply at a time per chat |
| `text-triggers.ts` | Whole-message habit keywords + discrete event patterns (Settings + habit form) |
| `expand.ts` | Custom shortcuts + one-letter rewrites (`w gym` → `at: gym`). Legacy expansions still pointing at bare `g` remap to `groc` |
| `shortcut-remap.ts` | Remap retired bare-`g` grocery shortcut values (`g` / `g milk` → `groc`) |
| `parse-bulk.ts` | Bulk Add buckets (`parsePathHeader` headers). `before 9/12:` stamps a due day; `before elijah gets home:` stays a list name. Shared with the Bulk Add dialog |
| `log-line-time.ts` | Peels a clock or US date off a log or switch line. The token meaning is `parseExpectedWhen` in `times.ts`. A bare clock is military. A bare integer is not a clock. Inbox text is not scanned. |
| `times.ts` | Clock, duration, sleep-range, and track-window parsing. `parseExpectedWhen` is the clock or US date when a log line, switch line, or tracking-note clock already expects one: a bare clock is military (`1:00` is 01:00), and a date alone does not invent a clock. |
| `name-resolve.ts` | Fuzzy match for habits / pens / operations / grocery lines. A shared **stopword** (`to`, `my`, `the`, `store`, `list`, …) is never evidence on its own. A unique fuzzy hit is refused when the query and the name each have a content word the other does not. A longer line that contains every content word of the name still matches |
| `pairing.ts` | 6-digit pairing codes (10 min TTL) **and** pair-by-sight: `unpairedSenders` reads `UNPAIRED_SUMMARY` refusals back out of the log so Settings can allowlist a real sender in one click. Pairing itself never expires. A pre-hydration seed cannot wipe `allowedChats` (`allowlistRev` + revoke tombstones in `vault-guard.js`). |
| `help.ts` | Short cheat-sheet (`help`). Pair OK aliases BIM. Live `info` is `command-glossary.ts` |
| `bim.ts` | BIM identity — Brain2 Ingestion Messenger intro / pair / ping lines |
| `command-catalog.ts` | **Complete command catalog** — every verb/alias/expansion/preset/GM reply/retired `g`; feeds `all commands` and `docs/BIM_COMMANDS.md` |
| `command-glossary.ts` | `info`, `{prefix} info`, `{prefix} commands`, `all commands` manuals (commands bodies from catalog) |
| `apply-glossary.ts` | Glossary matcher + apply helpers |
| `apply-morning-gm.ts` | `gm` morning flow: last night's wake reminder, what matters, and focus goals when saved; all-nighter; one-at-a-time affirmations (voice advances); to-do add; required (`1,8` / `1, 8`); 3–5 priorities; 1–3 habit priorities; go-through to-do (six slots; importance / resistance / excitement are 0–10 and may be decimals; a bad line stays on that item; `SKIP` one item; `SKIP ALL` the rest); plaintext day plan (`from text` stamp); circumstance branches; best day; gratitude. Each answer is stored immediately; skip leaves the question empty. Existing answers open a start-over / continue / jump menu. `STOP` quits and saves |
| `ritual-skip.ts` | Shared skip tokens for text rituals |
| `apply-capture.ts` | Quick Add pipeline (`parseSmartCapture` → `buildCapturedTask` → `addTask`). Reply says Monkey brain when the line had `-mb` / `-monkey`. `-p` / `-plain` stores the line as written. A date, time, duration, or priority stays in the title. A name may contain digits (`brain2: item` is the list brain2). `folder: all: item` files on that folder's All Items. A list created here is not sent to the Scheduler. The executor stamps `captureOrigin` (`telegram`) with the chat, message id, and raw line. |
| `apply-bulk.ts` | Bulk Add pipeline (Inbox off). Grocery headers with no other folder land on the store list. `Folder: all:` files following lines on that folder's All Items. Identical open titles are skipped; `see` / `again` / `dismiss`. A date, time, duration, or priority on an item line stays in the title. `-p` / `-plain` on a line stores that line as written; a header above it still files the item. A list created here is not sent to the Scheduler. |
| `apply-habit.ts` | `updateCompletion` / increment for today (optional `yesterday`) |
| `apply-habit-trigger.ts` | `dh:` habit keyword matches (`text-triggers.ts`). A BIM keyword source counts an exact whole message already stored (`lib/habit-keyword-source.ts`): true if received, true after N, or a logged phrase that writes the amount. A minutes or hours phrase also paints the prior tracking span (`lib/habit-logged-span.ts`). |
| `apply-needed.ts` | `needed:` / `get:` → list **needed**, item notes **sent from text** |
| `apply-discrete-event.ts` | `applyTransferredLogLine` / `applyTransferredLogLines` paint Text log instants at caller-supplied times and keep each line whole (inbox Transfer to log writes the batch in one store update; a `60m` or `15:00` in the title is not peeled, and the minute is not "now"). `log:` / `log` / `log-` (point, range, `10m` just finished, `START`/`END`, saved keywords, `log keywords` list), `intake:` (pen **Intake**), `switch:` / `log categories` / `st:` / `so:` / `switch goal:` / `transit:`, `tp:` / `thought process:` / `log: tp:` (`eventKind` `thought-process`, Thought process: a guiding strand of this moment — why you are doing something, what you expect next, and how it lands; not a general note, a one-word mood, or a short activity log such as brushed teeth; Text log pen), and Settings discrete triggers (`generatedBy.kind === "text"`). Points are instants. A log range is a block. A line under the event is stored on `notes`. `log:` sets `eventKind` to the slug of the phrase (`left room`). Trailing `loc:` reuses or creates a Location pen and paints a Location instant at that minute (`ensureLocationPen`). `intake food:` / `drink:` / `drug:` set `intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`; bare `intake:` sets `eventKind` `intake` and leaves the class unset. `ate` / `drank` / `took` set that class and the same `eventKind` and keep the **Text log** pen. Estimated clocks also set `precision: "estimated"`. `switch:` on Activity (and `st:` / `switch task:`) stores `started …` on the Switch pen plus `switchFrom` / `switchTo`. A named view paints that scope: `to` is the pen, `from` is stored, the tick color is the destination. `so:` / `switch goal:` still store `objective …` on the Objective pen. `log categories` lists the store’s views and writes no event. `logDiscreteNote` writes an `n` / `note:` tick, including its clock. `START` stays open in this process until `END` replaces it with the range. |
| `apply-cycle.ts` | `cycle: bleeding` / `spotting` / `ovulation`, and the same flag plus `off`, on the message's local day (`lib/cycle-marks.ts`). Spotting does not change `phaseForDate`. |
| `apply-activity-span.ts` | `currently` / `stopped` / `switched to` spans (Analytics **Text spans**) |
| `apply-tracking.ts` | Location / mood / activity / sleep / working now |
| `apply-phone-screen.ts` | `screen:` / `screentime:` / `iphone:` / `ios:` / `phone-screen:` → **iPhone Screen Time** only (estimated; no Mac AW stamp). Signed file: `docs/shortcuts/Screen Time to Brain2.shortcut`. |
| `apply-phone-life.ts` | `call:` / `called:` / `phone-call:` → **iPhone Calls** interval; `text:` / `sms:` / `imessage:` / `sent:` → **iPhone Texts** instant. Not a Phone/Messages watcher. Signed files: `docs/shortcuts/iPhone Call to Brain2.shortcut`, `iPhone Text to Brain2.shortcut`. |
| `apply-grocery.ts` | `groc` / `store` dump/add on the Settings live list (else the grocery-ish name), `got:` / `bought:` checkout, open-line match for colon-less `got`. The pin card is the dump; other shopping-list counts are on that card once, and a dump reply is the same string. A reply to that pin checks a line off |
| `apply-inventory.ts` | Pantry / fridge list dump + qty bump |
| `apply-receipt.ts` | OCR lines → grocery checkout + pantry; ask when new |
| `apply-scan-doc.ts` | Park a scan as a Docs `note` (folder From phone) + PDF attachment |
| `apply-media.ts` | Photo/PDF routing: receipt vs journal vs forwarded PDF |
| `ocr.ts` | Local `tesseract.js` worker |
| `scan-page.ts` | Contrast + small-angle deskew (canvas) |
| `jpeg-pdf.ts` | Embed JPEG pages in a PDF 1.4 file |
| `receipt-parse.ts` | Product lines from receipt OCR |
| `media-album.ts` | Collapse Telegram `media_group_id` bursts |
| `bytes.ts` | data-URL helpers |
| `apply-note.ts` | `n` / `note:` / `jot:` / `memo:` is a Text log instant at send time, or at a clock on the line (`est` / `estimated` / `~` estimated, `unknown` placement). Also appended to the block covering that minute. `day:` / `n day:` stay the day jot and do not read a clock. |
| `apply-iphone-notes.ts` | `iphone-notes:` Shortcut dump → park on iPhone Notes Store / Parked; `2/3` continuations; skip by `iphone:` id. `parkLooseText` parks free text that named nothing. Generate the signed shortcut with `npm run shortcut:iphone-notes` ([recipe](../../docs/shortcuts/dump-iphone-notes-to-brain2.md)); it is not in the repo. |
| `apply-pin.ts` | `pin` refreshes the grocery card. `pin todo` refreshes today's Home → To Do card. The two pins are separate |
| `apply-now.ts` | `now` with a payload and `/now`: doing now, just did, about to do. Bare `now` stays status |
| `apply-quicklists.ts` | `/quicklists` menu and bare-number dumps (today, week, month, next actions, live grocery, shopping stand-in, ISO, undone habits) |
| `apply-read.ts` | Plain-text dumps: named list/folder, catalogs, inbox (newest first), search, habits, status. A read that matches **nothing** parks the words on iPhone Notes Store instead of replying with a picker |
| `apply-plan-text.ts` | `plan for rn:` appends today's plan log (`stampSuffix: "from text"`). `read plan for today` / `read plans for today` |
| `apply-todos.ts` | `do:` → Next Actions **General**. `to do today:` → Home To Do for today (the to-do pin, not Next Actions). `read to do today` / `pin todo` pin that card once. A reply to it adds lines or checks numbered lines off (`completedDate`, `completionReview.completedAt`; `-est` / `-e` is a `logged` estimate on `completedDate`, shown as `~`) |
| `apply-ritual.ts` | Telegram rituals board (`rituals`/`reviews`), morning (`gm`), night (`gn`), start (`ritual start <period>`), end (`review`/`ritual end <period>`). Morning delegates to `apply-morning-gm`. Night follows the app: unfinished (Other can carry a note), assumed times, how the day was spent or period stats + arc, summary, gratitude, plan, went well / improve / learned, wake reminder, what matters, focus goals, tomorrow's plan. Start adds `required: 1, 8` / `priority: 2` after must-dos. Morning moves on `skip`/`next`; blank waits. Live Location is paused until the ritual ends. End/start treat blank as skip. Day/week/month push uses `pushTaskOnePeriod` (left period stays Undone). |
| `apply-gps.ts` | `gps:` / `gps-log:` and Telegram Live Location paint Location up to the sample, not through midnight. A named repeated place (80 m) wins; otherwise the same coordinates keep the pen. A venue pin is ignored. Signed file: `docs/shortcuts/Location to Brain2.shortcut` (Arrive / Leave, on-phone log). Tracking points are not written into the ingest log |
| `gps-places.ts` | Repeated GPS fixes (`brain2-gps-place-samples`) and the names for those clusters (`brain2-gps-place-names`). 80 m of the centroid. A second visit can be named on Analytics → Places; the next pin there is that Location pen. Unnamed pins stay coordinate labels |
| `gps-log.ts` | Memory-only ring for those points. The header log hides them unless **Show GPS**. A failed `gps:` and an unpaired refusal stay on the persisted log |
| `telegram-ui.mjs` | Private slash menu (`start`, `help`, `now`, `quicklists`, `info`) and inline buttons on clarify, duplicate, and receipt questions. Typed numbers and words still answer. No composer reply keyboard |
| `deliver-reply.ts` | Chunk replies and pin the grocery or to-do card (`pinKind`). When the reply is that card, it is sent once. The last chunk of a question can carry that inline keyboard. An open ritual edits one bot message per step |
| `phone-undo.ts` | `undo` reverts the last named text write for this chat. An open ritual is left in place. A sentence that only starts with undo stays inbox |
| `vault-push.ts` | Push this profile’s persist keys to a live always-on phone hub (skips friend-pic data URLs; large keys are not dual-aliased). Not used on a timer against localhost `/api/persist`. |
| `chunk-text.ts` | Split long replies for Telegram's 4096-character cap |
| `switch-scope.ts` | Paint a Tracking pen from *now* through end of day (`at:`, mood, `currently`). Phone GPS does not use this |
| `ingest-store.ts` | `brain2-ingest-store`: pairing, allowlist (`allowlistRev`, revoke tombstones), shortcuts (v4 remaps retired `g` expansions → `groc`; v5 drops GPS tracking rows from the log), live grocery list id (v6), hub URL, pins, log. Rehydrate unions chats so an empty seed cannot unpair |
| `executor.ts` | `ingestIncoming` / `ingestIncomingAsync` — dedupe, expand, pairing, allowlist, precedence (explicit → `dh:` / discrete triggers → dispatch), clarify, media, log. The `now` argument is send time. An open ritual owns the text. GPS tracking points go to `gps-log.ts`, not this log |
| `telegram-bridge.ts` | Renderer IPC + `/api/ingest` hub client |
| `index.ts` | Barrel |

Tests: `*.test.ts` next to the modules they cover.
