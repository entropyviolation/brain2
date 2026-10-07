# `lib/ingest/` — Phone-message ingest

Channel-agnostic command core that turns short phrases into the same capture,
habit, and tracking writes the desktop UI uses. Telegram is the first adapter.
See [`docs/MESSAGE_INGEST.md`](../../docs/MESSAGE_INGEST.md).

The Electron poller never writes Zustand. `npm run phone:hub` *does* run this
folder headlessly against `data/shared-persist.json` so grocery reads work when
the laptop is closed. Write commands reuse capture / habit / tracking paths.
Inbox captures and `plan for rn` appends land through the same stores as the UI
(`-mb` / `-monkey` files a capture in Monkey brain, the dump partition of Inbox).
Hub merge unions those rows by id so a later desktop Sync cannot erase them.
Read commands dump lists, folders, inbox, habits, and status as plain text
(`groc`, `read: grocery list`, `lists`, `info`; `ping` replies that **BIM** is
listening). The bot introduces himself as **BIM** (Brain2 Ingestion Messenger) —
you can call him BIM for short. `info` covers basics plus how to ask for
`{prefix} info`, `{prefix} commands`, and `all commands`. Full catalog:
[`docs/BIM_COMMANDS.md`](../../docs/BIM_COMMANDS.md). Bare `g` is retired
(Inbox capture). Matching order: dedupe → help/start/info → explicit verbs →
whole-message discrete triggers → else. Habit keywords need `dh:` first
(`dh: hemisync`); a bare keyword captures to Inbox. A quantity keyword adds
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
| `parse-message.ts` | Verb + payload parser. Prefix-less text → Inbox capture, except a multi-line `Name:` dump → bulk. Grocery verb is `groc` / `grocery` / `groceries` / `shop` (not bare `g`). A header that only *starts* with `grocery` stays a list name. Colon headers (case-insensitive, before the alias loop): `log:` / `log-`, `dh:`, `intake food:` / `intake drink:` / `intake drug:`, `intake:`, `st:` / `switch task:`, `so:` / `switch objective:` / `switch goal:`, `transit:`, `cycle:`. Bare `cycle`, `switch goal`, and `intake food coffee` (no colon) stay capture. `screen` / `screentime` / `iphone` / `ios` / `phone-screen` → iPhone Screen Time (`iphone-notes` still wins over `iphone`) |
| `parse-tracking-note.ts` | One parser each for `log:`, `intake:`, and from/to notes (`st:` / `so:` / `switch goal:` / `transit:`). `at 3:30` is a point on the send date. `10m` on a log just finished. Intake never grows a duration. The first line is the event; lines under it are the note (`splitEventLine`). On log, intake, switch, and note lines, a trailing `est` / `estimated` / `~`, or `~` on a clock, is estimated; trailing `unknown` keeps the minute for placement only. A clock with no token stays exact. A log’s trailing `loc: home` is a Location pen (the place is last; `est` may sit before or after it). |
| `message-time.ts` | `messageSentAt` prefers `receivedAt` (Telegram `message.date`). `compareSentOrder` sorts a backlog by send time, then message id. |
| `index-list.ts` | A line that is only comma-separated numbers (`1,8`, `1, 8`) is a list of indexes. Any other text stays one line. |
| `dedupe.ts` | Ignore retried Telegram `update_id` / `message_id` before any write |
| `text-triggers.ts` | Whole-message habit keywords + discrete event patterns (Settings + habit form) |
| `expand.ts` | Custom shortcuts + one-letter rewrites (`w gym` → `at: gym`). Legacy expansions still pointing at bare `g` remap to `groc` |
| `shortcut-remap.ts` | Remap retired bare-`g` grocery shortcut values (`g` / `g milk` → `groc`) |
| `parse-bulk.ts` | Bulk Add buckets (`parsePathHeader` headers). `before 9/12:` stamps a due day; `before elijah gets home:` stays a list name. Shared with the Bulk Add dialog |
| `times.ts` | Clock, duration, sleep-range, track-window parsing |
| `name-resolve.ts` | Fuzzy match for habits / pens / operations / grocery lines. A shared **stopword** (`to`, `my`, `the`, …) is never evidence on its own, so prose cannot tie five unrelated names at the 0.55 floor |
| `pairing.ts` | 6-digit pairing codes (10 min TTL) **and** pair-by-sight: `unpairedSenders` reads `UNPAIRED_SUMMARY` refusals back out of the log so Settings can allowlist a real sender in one click. Pairing itself never expires. A pre-hydration seed cannot wipe `allowedChats` (`allowlistRev` + revoke tombstones in `vault-guard.js`). |
| `help.ts` | Short cheat-sheet (`help`). Pair OK aliases BIM. Live `info` is `command-glossary.ts` |
| `bim.ts` | BIM identity — Brain2 Ingestion Messenger intro / pair / ping lines |
| `command-catalog.ts` | **Complete command catalog** — every verb/alias/expansion/preset/GM reply/retired `g`; feeds `all commands` and `docs/BIM_COMMANDS.md` |
| `command-glossary.ts` | `info`, `{prefix} info`, `{prefix} commands`, `all commands` manuals (commands bodies from catalog) |
| `apply-glossary.ts` | Glossary matcher + apply helpers |
| `apply-morning-gm.ts` | `gm` morning flow: last night's wake reminder, what matters, and focus goals when saved; all-nighter; one-at-a-time affirmations (voice advances); to-do add; required (`1,8` / `1, 8`); 3–5 priorities; 1–3 habit priorities; go-through to-do (six slots; importance / resistance / excitement are 0–10 and may be decimals; a bad line stays on that item; `SKIP` one item; `SKIP ALL` the rest); plaintext day plan (`from text` stamp); circumstance branches; best day; gratitude. Each answer is stored immediately; skip leaves the question empty. Existing answers open a start-over / continue / jump menu. `STOP` quits and saves |
| `ritual-skip.ts` | Shared skip tokens for text rituals |
| `apply-capture.ts` | Quick Add pipeline (`parseSmartCapture` → `buildCapturedTask` → `addTask`). Reply says Monkey brain when the line had `-mb` / `-monkey`. A list created here is not sent to the Scheduler. |
| `apply-bulk.ts` | Bulk Add pipeline (Inbox off). Grocery headers with no other folder land on the store list. Identical open titles are skipped; `see` / `again` / `dismiss`. A list created here is not sent to the Scheduler. |
| `apply-habit.ts` | `updateCompletion` / increment for today (optional `yesterday`) |
| `apply-habit-trigger.ts` | `dh:` habit keyword matches (`text-triggers.ts`). Bare keywords do not log. |
| `apply-needed.ts` | `needed:` / `get:` → list **needed**, item notes **sent from text** |
| `apply-discrete-event.ts` | `log:` / `log-` (point, range, `10m` just finished, `START`/`END`), `intake:` (pen **Intake**), `st:` / `so:` / `switch goal:` / `transit:`, and Settings discrete triggers → Activity (`generatedBy.kind === "text"`). Points are instants. A log range is a block. A line under the event is stored on `notes`. `log:` sets `eventKind` to the slug of the phrase (`left room`). Trailing `loc:` reuses or creates a Location pen and paints a Location instant at that minute (`ensureLocationPen`). `intake food:` / `drink:` / `drug:` set `intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`; bare `intake:` sets `eventKind` `intake` and leaves the class unset. `ate` / `drank` / `took` set that class and the same `eventKind` and keep the **Text log** pen. Estimated clocks also set `precision: "estimated"`. Switch task stores `started …`; switch goal stores `objective …`. `logDiscreteNote` writes an `n` / `note:` tick, including its clock. `START` stays open in this process until `END` replaces it with the range. |
| `apply-cycle.ts` | `cycle: bleeding` / `spotting` / `ovulation`, and the same flag plus `off`, on the message's local day (`lib/cycle-marks.ts`). Spotting does not change `phaseForDate`. |
| `apply-activity-span.ts` | `currently` / `stopped` / `switched to` spans (Analytics **Text spans**) |
| `apply-tracking.ts` | Location / mood / activity / sleep / working now |
| `apply-phone-screen.ts` | `screen:` / `screentime:` / `iphone:` / `ios:` / `phone-screen:` → **iPhone Screen Time** only (estimated; no Mac AW stamp). Signed file: `docs/shortcuts/Screen Time to Brain2.shortcut`. |
| `apply-phone-life.ts` | `call:` / `called:` / `phone-call:` → **iPhone Calls** interval; `text:` / `sms:` / `imessage:` / `sent:` → **iPhone Texts** instant. Not a Phone/Messages watcher. Signed files: `docs/shortcuts/iPhone Call to Brain2.shortcut`, `iPhone Text to Brain2.shortcut`. |
| `apply-grocery.ts` | `groc` dump/add, `got` checkout, grocery-ish list match, pin text. Adds go through bulk so duplicates ask |
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
| `apply-iphone-notes.ts` | `iphone-notes:` Shortcut dump → park on iPhone Notes Store / Parked; `2/3` continuations; skip by `iphone:` id. `parkLooseText` parks free text that named nothing. Signed file: `docs/shortcuts/Dump iPhone Notes to Brain2.shortcut`. |
| `apply-pin.ts` | Refresh the pinned grocery card |
| `apply-read.ts` | Plain-text dumps: named list/folder, catalogs, inbox (newest first), search, habits, status. A read that matches **nothing** parks the words on iPhone Notes Store instead of replying with a picker |
| `apply-plan-text.ts` | `plan for rn:` appends today's plan log (`stampSuffix: "from text"`). `read plan for today` / `read plans for today` |
| `apply-todos.ts` | `do:` → Next Actions **General**. `to do today:` → Home To Do. `read to do today` |
| `apply-ritual.ts` | Telegram rituals board (`rituals`/`reviews`), morning (`gm`), night (`gn`), start (`ritual start <period>`), end (`review`/`ritual end <period>`). Morning delegates to `apply-morning-gm`. Night follows the app: unfinished (Other can carry a note), assumed times, how the day was spent or period stats + arc, summary, gratitude, plan, went well / improve / learned, wake reminder, what matters, focus goals, tomorrow's plan. Start adds `required: 1, 8` / `priority: 2` after must-dos. Morning moves on `skip`/`next`; blank waits. Live Location is paused until the ritual ends. End/start treat blank as skip. Day/week/month push uses `pushTaskOnePeriod` (left period stays Undone). |
| `apply-gps.ts` | `gps:` / `gps-log:` and Telegram Live Location paint Location up to the sample, not through midnight. Same coordinates keep the pen. A venue pin is ignored. Signed file: `docs/shortcuts/Location to Brain2.shortcut` (Arrive / Leave, on-phone log). Tracking points are not written into the ingest log |
| `gps-log.ts` | Memory-only ring for those points. The header log hides them unless **Show GPS**. A failed `gps:` and an unpaired refusal stay on the persisted log |
| `deliver-reply.ts` | Chunk replies and pin the grocery card |
| `vault-push.ts` | Push this profile’s persist keys to a live always-on phone hub (skips friend-pic data URLs; large keys are not dual-aliased). Not used on a timer against localhost `/api/persist`. |
| `chunk-text.ts` | Split long replies for Telegram's 4096-character cap |
| `switch-scope.ts` | Paint a Tracking pen from *now* through end of day (`at:`, mood, `currently`). Phone GPS does not use this |
| `ingest-store.ts` | `brain2-ingest-store`: pairing, allowlist (`allowlistRev`, revoke tombstones), shortcuts (v4 remaps retired `g` expansions → `groc`; v5 drops GPS tracking rows from the log), hub URL, pins, log. Rehydrate unions chats so an empty seed cannot unpair |
| `executor.ts` | `ingestIncoming` / `ingestIncomingAsync` — dedupe, expand, pairing, allowlist, precedence (explicit → `dh:` / discrete triggers → dispatch), clarify, media, log. The `now` argument is send time. An open ritual owns the text. GPS tracking points go to `gps-log.ts`, not this log |
| `telegram-bridge.ts` | Renderer IPC + `/api/ingest` hub client |
| `index.ts` | Barrel |

Tests: `*.test.ts` next to the modules they cover.
