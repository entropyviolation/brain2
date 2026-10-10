# Telegram analytics vision

BIM (Brain2 Ingestion Messenger) is the phone door into the vault. The bot is [@brain2_phone_bot](https://t.me/brain2_phone_bot). A person texts a short phrase, forwards a photo or PDF, shares a location, or walks a ritual. The same executor that Settings can simulate writes Lists, Habits, Tracking, Plan, sleep, cycle marks, reviews, Docs, and pantry counts.

This note is a product design for an Analytics tab that would be built only from that door. It is grounded in the live command surface (`lib/ingest/command-catalog.ts`, `lib/ingest/parse-message.ts`, `lib/ingest/executor.ts`) and in the records those writers actually leave. It does not describe any Analytics screen that already exists.

The interesting fact about this data is a split. The conversation is a thin, rolling audit. The life record is thick, and only some of it remembers that a phone wrote it. Analytics that treats the ingest log as the dataset will see the last 200 turns and miss the year. Analytics that treats domain stores as the dataset will see the year and lose the conversation: which prompt was asked, which reply failed, which album never parsed, which command was a read. A Telegram tab has to hold both grains and say, on every chart, which one it is using.

---

## 1. Data inventory

### 1.1 How a turn becomes a record

```
Phone
  → Telegram Bot API
      update types the poller asks for: message, edited_message
      (no callback_query, no inline keyboard, no channel_post)
  → one of three consumers, never two at once
      Electron long-poll     electron/telegram-ingest.js
      always-on hub          scripts/phone-hub.ts   (npm run phone:hub)
      queue-only poller      scripts/telegram-ingest.mjs → data/message-ingest.json
  → extract + optional file download   electron/telegram-file.js
  → IncomingTelegramPayload
  → album buffer (1.1s) when media_group_id is set
  → ingestIncomingAsync
      dedupe → pairing → open ritual or clarify → verb ladder → store write
  → IngestEvent appended (with the exceptions in §1.3)
  → deliverIngestReply: sendMessage chunks, optional pinChatMessage
```

Webhook mode (`COGS_TELEGRAM_WEBHOOK` on the hub) posts the same update shape to `POST /telegram/webhook`. A wrong `X-Telegram-Bot-Api-Secret-Token` is HTTP 403 and never becomes an ingest event.

Telegram holds unclaimed updates for about 24 hours. A laptop that slept longer than that has a hole that no store can fill. There is no outbound morning cron. `gm` runs when a live consumer receives it.

### 1.2 Grains

| Grain | What it is | Durable? | Clock |
| --- | --- | --- | --- |
| Update | Telegram `update_id`. One delivery of a message, an edit, or a live-location revision. | Only as a dedupe key `upd:{update_id}` inside a ring of 500 (`seenIngestKeys` on `brain2-ingest-store`). | Not stored after the claim. |
| Message | Telegram `message_id` inside a chat. Edits keep this id and mint a new `update_id`. | Dedupe falls through to `msg:{channel}:{chatId}:{message_id}` only when `update_id` is missing. The ingest event does not store either id. | `message.date` (unix seconds). `edit_date` is ignored on purpose. |
| Ingest turn | One `IngestEvent` after the executor accepts the payload. | Last 200 events, newest first, GPS successes stripped. Key `brain2-ingest-store`. | `at` is `receivedAt`, which is `message.date`, not the moment the poller applied it. |
| Clarify / ritual state | One `PendingClarify` per `telegram:{chatId}` in `pendingByChat`. | Yes, until the next resolving turn clears it. | `createdAt` is the send time of the turn that opened the question. |
| Capture session | Not a stored object. A run of turns for one chat. | Must be derived. | See §4. |
| Poller session | Not a stored history. `data/phone-hub-status.json` is overwritten every 10s (and on error). Electron `lastPollAt` / `lastPollError` / `lastPollSource` are memory only. | The latest heartbeat only. | `at` on the status file is wall-clock of the hub process. |
| Domain record | The list item, habit cell, time entry, plan line, review, sleep night, cycle flag, doc, regret, or count tick the writer touched. | Yes, in that domain’s store, subject to later in-app edits. | Usually the send time, stamped as the record’s “when.” Processing time is the exception, not the rule. |

A session worth analyzing is defined here, because the product does not store one:

- **Capture session.** For one `chatId`, sort ingest events by `at`, then by arrival order. Cut a new session when the gap exceeds 20 minutes, or when a ritual pending opens or closes. Twenty minutes matches a store trip or a morning walk better than a calendar day.
- **Ritual session.** From the turn whose kind is `morning`, `night`, `review`, or `reviews` and whose status becomes `clarify` with `pending.kind === "ritual"`, through the turn that clears that pending (`STOP`, `cancel`, or the finishing save). The step names live on the pending ritual, and a partial morning is also copied onto the review (`morning.resumeStep`).
- **Backlog session.** A batch whose `message.date` values sit far earlier than the hub heartbeat `at` that first overlaps them. This is the “laptop woke up” shape. It cannot be measured until a processing timestamp exists (§2.2).

### 1.3 Bot-native telemetry (the conversation itself)

Persisted on `brain2-ingest-store` (Zustand persist v5, GPS tracking rows removed):

| Field | Meaning for analytics |
| --- | --- |
| `events[]` (max 200) | The audit log. Each row: `id` (`ing-…`), `at`, `channel` (`telegram` \| `simulate` \| `hub`), `chatId`, `userId`, `username`, `raw`, `kind` (`IngestIntentKind`), `status` (`applied` \| `clarify` \| `ignored` \| `error`), `summary`, optional `itemIds`. |
| `seenIngestKeys` (max 500) | Dedupe ring. Keys `upd:{update_id}` or `msg:{channel}:{chatId}:{message_id}`. |
| `pendingByChat` | Open question. Key `telegram:{chatId}`. |
| `allowedChats[]` | `chatId`, `userId`, `username`, `pairedAt`. Pairing does not expire. |
| `revokedChatIds`, `allowlistRev` | Tombstones. A later vault union must not re-pair a revoked chat. |
| `pairing` | Current 6-digit code and `expiresAt` (10 minutes). |
| `shortcuts` | First-token aliases, e.g. `store` → `groc`. |
| `discreteEventTriggers` | Editable whole-message patterns. Defaults: `smoked weed`, `drank water`, `ate {item}`, `took {item}`. |
| `livePins.grocery` | Last grocery pin: `chatId`, `messageId`, `kind`, `at`. `at` is wall-clock of the pin call, the rare processing timestamp. |
| `enabled`, `allowGroups`, `phoneHubUrl` | Gates, not events. |

`IngestEvent.status` is the executor’s word, mapped in `logAndReturn`:

| Apply result | Log status | Summary |
| --- | --- | --- |
| `ok` | `applied` | Writer’s `summary` |
| `needs_clarify` | `clarify` | Always the literal `Needs clarification` (the question text is the reply, not the summary) |
| `ignored` | `ignored` | Writer’s `summary` |
| `error` | `error` | The reply string (the human-facing failure) |

Statuses that show up in real traffic:

| Summary (or kind) | What happened |
| --- | --- |
| `Unpaired sender` | Chat is not allowlisted. No reply is sent. Settings → Texted but not paired reads these rows. |
| `Ignored group` | `chat.type` is group or supergroup and `allowGroups` is false. |
| `Bad or expired pairing code` | `/start` or `pair:` with a wrong or stale code. |
| `Duplicate Telegram update` | Returned **before** `logAndReturn`. A retried update is silent. It is not an event. |
| `Ingest is disabled in Settings.` | Also returned before the log. |
| `Live location paused during review` | Morning hold. Returned before the log, and the Electron/hub drain drops the payload even earlier. Usually invisible. |
| `Waiting for a morning-review reply` | Blank morning text. Same: not logged. |
| `Shared place, not where you are` | A venue card (restaurant pin), not a live location. |
| `Fuzzy GPS, kept {place}` / `Still at {place}` | Sample rejected or identical. Successful GPS paints are **removed** from `events` and kept in a memory ring of 40 (`useGpsIngestLog`). That ring is not in the persist hub. |
| `Voice note (no ritual)` | Voice or audio with no walkthrough open. The bytes are not downloaded (`dataUrl` is empty). Nothing is transcribed. |
| `Needs clarification` | Name collision, duplicate grocery line, receipt line, or an open ritual step. |
| `Cancelled` / `Morning review saved` / domain summaries | The happy paths. |

Reply text, chunk counts, Telegram’s `message_id` for the bot’s own `sendMessage`, pin failures, and OCR confidence are not columns. Pin failure is swallowed. Send failure returns `{ ok: false, error }` to the caller and is not written onto the ingest event.

### 1.4 What the conversation log cannot see

These updates die in `extractTelegramMessage` and never reach the executor. Analytics of “messages received” from the ingest log undercounts them by the whole class:

- stickers, video, video notes, animations, contacts, polls, dice, venues that are not locations
- documents that are neither PDF nor image
- photos or PDFs over 12 MB (`MAX_BYTES`), which fall back to caption-only and vanish if the caption is empty
- `getFile` failures, same fallback
- empty text with no photo, document, location, or voice

The poller asks only for `message` and `edited_message`. There is no callback data, no chosen button id, no reaction. Clarify is a free-text reply (`1`, a name, `new`, `see`, `again`, `dismiss`, `inv`, `skip`, `STOP`).

### 1.5 Domain records the bot writes

The executor’s ladder, before any write (`lib/ingest/executor.ts`):

1. Dedupe on `update_id`, else `(channel, chatId, message_id)`. Simulate has no key.
2. Help / info / glossary / pair.
3. Explicit verbs in `PRIORITY_EXPLICIT` (grocery, needed, plan-for-now, currently / stopped / switched, log, thought process, log categories, `dh:`, intake, cycle, switch, `st:`, `so:`, transit).
4. Whole-message discrete triggers (Settings patterns).
5. Everything else: remaining verbs, multi-line list dumps, or Inbox capture.

An open ritual is earlier than that ladder. `gm` during night, start, or end still opens morning. `cancel` quits night, start, and end. Morning ignores `gm` until the message is exactly `STOP`. Blank morning text waits. Live Location is dropped until the ritual ends; the Telegram share stays on, and the next edit can land.

Custom shortcuts (`brain2-ingest-store.shortcuts`) and the built-in one-letter expansions rewrite the first token before parse:

| Token | Empty message | With a payload |
| --- | --- | --- |
| `w`, `@` | `where` (status) | `at:` (location) |
| `h` | `help` | `habit:` |
| `m` | bare `mood` (error: which mood?) | `mood:` |
| `tt`, `trk` | bare `track` | `track:` |
| `pause` | `stop` | `stop` |
| `day` | `today` (snapshot) | `n day:` (day jot) |

Bare `g` is retired. It captures to Inbox. Old shortcuts that still expand to `g` are remapped to `groc`.

#### Command → store

`itemIds` on the ingest event is set only for `status: ok` and only when that writer returns them. Many important writes do not. The join key is then a stamp inside the domain row, or nothing.

| Intent `kind` | Primary phrases | Mutates? | Store and fields | Provenance that survives | `itemIds` on the log? |
| --- | --- | --- | --- | --- | --- |
| `capture` | prefix-less text, `qa:`, `add:`, `inbox:`, `idea:` | Yes | Task on Inbox (or Monkey brain if `-mb` / `-monkey`). `createdAt` = send time. Colon paths create the list. A date, time, duration, or priority is stored and left in the title. `-p` / `-plain` stores the line as written and sets none of that. | None beyond `createdAt` matching send time. A later in-app edit keeps the item and drops the phone story. | Yes, one task id |
| `bulk` | `bulk:`, `Name:` then lines, `before 9/12:` | Yes | Tasks on the named list. Inbox off. New lists are not sent to the Scheduler. `deadline` and `mustBeDoneBefore` when the header is a date. Item-line dates, times, duration, and priority stay in the title. `-p` / `-plain` on a line stores that line as written; a header above it still files the item. | None. Identical open titles become a `duplicate` clarify instead of a second row. | Yes when lines land |
| `grocery` | `groc`, `grocery`, `shop` | Add: yes. Bare dump: no | Grocery-ish list (name score: Grocery list / Groceries / Shopping). Add goes through bulk. Dump and add both refresh `pinText`. | Pin in `livePins.grocery`. Items themselves are ordinary tasks. | On add, the new ids |
| `bought` | `got`, `x`, `bought`, `check off` | Yes | `completeTask` on matching open grocery lines. Ambiguous name → clarify. | Completed task. No “bought via text” flag. | The completed ids |
| `needed` | `needed:`, `get:` (colon required) | Yes | List named `needed`, created if missing (`scheduleable: false`, description “Things needed — from phone text”). Each item `notes` includes `sent from text`. `createdAt` = send time. | The notes phrase. | Yes |
| `habit` | `habit:`, `did:`, `h {name}` | Yes | `weeklyData[YYYY-MM-DD][habitId]` via `updateCompletion`. BOOLEAN `completed`; TEXT `text`; INCREMENTAL number or +1; GOAL number or fill-to-goal. `yesterday` shifts the date. `updatedAt` = `Date.now()` at write. | **No** `keywordLogged`. **No** notes stamp. Cell `updatedAt` is processing time. | **No** |
| `habit-trigger` | `dh:` then a habit’s text keyword | Yes | Same cell, plus `keywordLogged: true`. Quantity adds (`keywordValue` accumulates). Score replaces. Done-today task notes get `from text message at {h:mmam/pm}`. | `keywordLogged`, `keywordValue`, and that notes phrase. | **No** |
| `event-log` | `log:` / `log ` / `log-` | Yes | Activity scope, pen **Text log**, usually `kind: "instant"`. `generatedBy: { kind: "text", id: date }`. `eventKind` = slug of the phrase. `title`, optional `notes` (lines under the first). `clockCertainty` `estimated` or `unknown`; estimated also sets `precision: "estimated"`. Trailing `loc:` paints a Location instant on that pen. `START`/`END` and clock ranges become blocks. | `generatedBy.kind === "text"` plus notes. A saved keyword also increments `brain2-count-statuses` when a count is bound to that phrase. | Event id, and location id when paired |
| `thought-process` | `tp:`, `thought process:`, `log: tp:` | Yes | Same Text log instant, `eventKind: "thought-process"`. | Same text stamp. | Yes |
| discrete trigger | whole message `ate {item}`, `drank water`, `took {item}`, `smoked weed`, or a custom pattern | Yes | Text log instant. `ate` / `drank` / `took` set `intakeClass` and `eventKind` `intake.food` / `.drink` / `.drug`. Other patterns have no class. | `generatedBy.kind === "text"`. | Yes |
| `intake` | `intake:`, `intake food:`, `intake drink:`, `intake drug:` | Yes | Pen **Intake**, always a point. `eventKind` `intake` or `intake.{class}`. | Text stamp. | Yes |
| `switch`, `switch-task`, `switch-objective`, `transit` | `switch:`, `st:`, `so:` / `switch goal:`, `transit:` | Yes | Activity `st:` / default `switch:`: pen **Switch**, title `started …` or `stopped … · started …`, `switchFrom` / `switchTo`, `eventKind: "switch"`. `so:`: pen **Objective**. `transit:`: pen **Transit**. Other tracking views: an instant on that scope’s pen. | Text stamp. Clock words as on log lines. | Yes |
| `log-categories` | `log categories` | No | Reply only: scope display name, id, depth. | — | No |
| `currently`, `stopped-activity`, `switched-to` | `currently`, `stopped`, `switched to` | Yes | Activity interval from now through end of day (`endMin` at the last minute). Stop truncates. Switch closes the open span, opens the next, and paints a Switch instant `switch → {name}`. Notes include `from text pipeline` and `from text message at …`. | `generatedBy.kind === "text"`. | **No** |
| `location`, `mood`, `start` (pen) | `at:`, `mood:`, `start:` when it is not an operation | Yes | Paints that scope from the send minute through end of day. Next paint cuts the previous open tail. Unknown name → clarify (`1`, name, or `new`, which creates a pen). | **No** `generatedBy`. These strokes look hand-painted. | **No** |
| `track` | `tt`, `track:`, `doing:` | Yes | Activity block: duration ending now, or an explicit window. `syncTrackedHabits` may fill a linked habit. | No text stamp on the block. The habit cell may show `trackedValue` rather than `keywordLogged`. | **No** |
| `gps` | `gps:`, `gps-log:`, Live Location, AirDrop location shortcut | Yes | Location minutes up to the sample, not through midnight. Notes `GPS_NOTE`. A named repeated place (80 m) wins; otherwise the same coordinates keep the pen. A jump beyond the fuzzy threshold is dropped. Venue pins are ignored. | Notes text, the in-memory GPS ring, and `gps-places` samples/names. **Not** the 200-line log. | **No** |
| `iphone-screen` | `screen:`, `screentime:`, `iphone:`, `ios:` | Yes | Scope **iPhone Screen Time** only. Pen id `iphone-st-app-{slug}` under a category root. `precision: "estimated"`. No `generatedBy`, so a Mac ActivityWatch replace cannot delete these minutes. | Scope id + estimated precision. Indistinguishable from a hand estimate on that scope. | **No** |
| `iphone-call` | `call:`, `called:` | Yes | Scope **iPhone Calls**. Interval, `precision: "estimated"`. No `generatedBy`. | Scope id. | **No** |
| `iphone-text` | `text:`, `sms:`, `imessage:` | Yes | Scope **iPhone Texts**. Instant at send minute. `title` and `notes` are the body. `precision: "estimated"`. | Scope id. | **No** |
| `sleep` | `sleep: 11:30-7:00` | Yes | `brain2` sleep log for the morning key. `setBedtime` / `setWakeTime` with precision `estimated`. | Precision `estimated`. `source` on a night is not `"telegram"`; the sleep store’s `source` field means logged vs inferred-from-tracking. | **No** |
| `cycle` | `cycle: bleeding` / `spotting` / `ovulation`, optional `off` | Yes | `brain2-cycle-marks` flag on the send date. Spotting is stored and does not change derived phase. | **No** channel stamp. A desktop toggle writes the same flag. | **No** |
| `note` | `n`, `note:`, `jot:`, `memo:` | Yes | Text-log instant on Activity (or Location / Mood when the line says `n loc:` / `n mood:`). If a block covers that minute, the same text is appended to that block’s `notes`. | Text-log `generatedBy` when an instant is created. Appended block notes have no channel flag. | Instant and/or covering block |
| `note` (day) | `day:`, `daynote:`, `n day:`, expansion of `day {text}` | Yes | `brain2-tracking-day-notes` append, also mirrored with `setDayNotes`. | **No** channel stamp. | **No** |
| `plan-now` | `plan for rn:` | Yes | Day plan append log. `stampSuffix: "from text"`. `createdAt` is send time. | The suffix on the stamp line. | **No** |
| `do` | `do:`, `next action:` | Yes | Next Actions → General. Not scheduled. | None. | Yes |
| `todo-today` | `to do today:`, `tdt` | Yes | Home → To Do for the send date. | None. | Yes |
| morning ritual | `gm`, `good morning` | Yes, across many turns | See §1.6. | `PeriodReview.morning.source = "telegram"`. Sleep all-nighter `allNighterSource: "telegram"`. To-do `notes` include `logged from text`. Day plan `stampSuffix: "from text"`. | Not on each step |
| night / end ritual | `gn`, `good night`, `review today` | Yes | `PeriodReview` for that period: summary, gratitude, reflections (`wentWell`, `improve`, `learned`), plan, wake reminder, tomorrow matters, focus goals, arc, resolved and pushed task ids, blocked reasons. Blocked unfinished tasks also call `addRegret` on the regret store. | **`source` is not set.** A night finished in Telegram looks like a night finished in the app. | No |
| start ritual | `ritual start week` (and month, quarter, year) | Yes | `PeriodReview.start` with `source: "telegram"`. | That field. | No |
| `receipt` | photo that OCRs as a receipt, or caption `receipt` | Yes | Checks off grocery via `completeTask`, bumps Inventory/Pantry/Fridge `attributes.qty`. Ambiguous or new lines wait (`inv` / `skip` / a number). | Grocery completion and qty. No receipt document is kept unless the caption forced a journal. | Often empty on the finishing summary |
| `journal`, `pdf` | photo album, caption `journal:` / `scan:`, forwarded PDF | Yes | Docs note, folder **From phone**, tags `docs` and `scan`, PDF attachment, searchable HTML. `createdAt` = send time. | Folder + tags. A hand-made note in that folder looks the same. | Doc id |
| `inventory` | `inv`, `pantry` | Dump: no. Name: yes | Bumps `qty` on Inventory / Pantry / Fridge, creating the list `list-inventory` if needed. | None beyond qty. | Bumped ids |
| `iphone-notes` | `iphone-notes:`, `inotes:`, parts `2/3` | Yes | Parked item on **iPhone Notes Store** (Phone Notes). Multi-part bodies join in a process-local map; a restart mid-dump drops the unfinished parts. A `read:` that matches nothing calls `parkLooseText` with `account: "Telegram"`. | Parked-item source, and `account: "Telegram"` on loose parks. | Yes |
| `start` / `stop` | `start: {operation}`, `stop`, `pause` | Yes | Work session on an operation, or an Activity pen through end of day. `stop` ends the live session. | Session title. No channel. | Operation id on start |
| `pin` | `pin`, `live`, `snapshot` | Pin only | Rewrites `livePins.grocery` and a one-line now. Items unchanged. | The pin row. | No |
| `pair` | `/start 123456`, `pair: 123456` | Allowlist | `allowedChats` row, `pairedAt` = send time. Also pins grocery. | The allowlist row. | No |
| reads | `read:`, `lists`, `folders`, `read inbox`, `search:`, `today`, `habits`, `where` / `now`, `ops`, `count`, `tags`, `agenda`, `read plan`, `read plans`, `read to do today`, `info`, `help`, `{prefix} info`, `{prefix} commands`, `all commands`, `ping`, `rituals` | No | Reply only. Grocery-ish `read:` also pins. | A `clarify` row if a read used to ask; a read that matches nothing is parked (that park **is** a write). | Read-todo returns open ids; others usually no |

Habit `habit:` writes and tracking paints go through the same stores as the UI, so Home undo (`action-history`) can reverse the last one. The ingest log is not itself an undo stack.

### 1.6 Morning, night, and the other walks

Morning (`gm`) is the densest conversation in the product. Each step persists a partial `PeriodReview.morning` with `source: "telegram"` and `completed: false` until the end. Steps:

| Step id | What a reply writes |
| --- | --- |
| `again` / `jump` | Resume or jump menu. No new life data. |
| `bed`, `wake`, `dream` | Sleep log bedtime/wake, plus `morning.bedTime` / `wakeTime` / `dream`. `all nighter` sets `allNighter` and `allNighterSource: "telegram"` and skips bed, wake, and dream. |
| `affirmation` | Five lines, one at a time. A voice note advances. `morning.affirmations`, `shownAffirmations`, `affirmationIndex`. |
| `todo-show` / `todo-add` | New Home to-dos. `notes` gain `logged from text`. Ids in `morning.todosAddedIds`. |
| `todo-required` | `required` commitment on today’s to-dos. `morning.requiredTaskIds` (empty array means the question was answered). |
| `todo-priorities` | 3–5 to-do ids. `morning.priorityTaskIds`. |
| `habit-priorities` | 1–3 daily habits, written onto the habit tasks. `morning.priorityHabitIds`. |
| `todo-walk` | Six slots per to-do: tier, duration, points, importance, resistance, excitement (last three 0–10, decimals allowed). `SKIP` one, `SKIP ALL` the rest. A bad line sets `walkClarify` and stays. `morning.walkIndex`. |
| `day-plan` | Appends the day plan log with `stampSuffix: "from text"`. `morning.dayPlanLogged`, `dayPlanText`. |
| `circumstances` and branches `must-do`, `must-not-do`, `new-events`, `excited` | Free text on the morning slice. |
| `best-day`, `gratitude` | `morning.bestDayWhy`, `morning.gratitude` (often 10). |
| `STOP` | Quits and saves. Other rituals use `cancel` / `nevermind` / `quit`. |

Night (`gn`) and longer end rituals walk `periodSteps`: unfinished → assumed → (`time-spent` on a day, else `stats` and `arc`) → summary → gratitude → plan (day/week/month) → went well / improve / learned → (day only) wake reminder, what matters, focus goals → next plans. Skip and blank move on. The saved `PeriodReview` has `endCompleted: true` and **no** `source` field. Start rituals (week and longer) do set `start.source = "telegram"`.

Other multi-turn machines, all stored as `pendingByChat` until the next message:

| Pending `kind` | Opens when | Resolving replies |
| --- | --- | --- |
| `habit`, `location`, `track`, `start`, `mood` | Fuzzy name is ambiguous or unknown | `1`, the name, or `new` / `create` |
| `bought` | Grocery checkout is ambiguous | index or exact name |
| `read` | (Historical / rare; a total miss now parks on iPhone Notes instead of asking) | index or name |
| `duplicate` | An open line with the same title already exists | `see`, `again`, `dismiss` |
| `receipt` | OCR line is new or ambiguous | number, `inv`, `skip` |
| `ritual` | Morning, night, start, end | The step’s grammar, or `STOP` / `cancel` |

`createdAt` on the pending row is the only timestamp of “question opened.” The ingest log’s clarify row says `Needs clarification` and does not copy the step name. Reconstructing a funnel from the log alone means parsing `raw` and knowing the ritual machine. Reconstructing it from `morning.resumeStep` is better for mornings that were abandoned, because the review slice survives after the pending row is cleared.

### 1.7 Provenance cheat sheet

Use this when a chart says “from Telegram.” If the stamp is missing, the chart is an outside join and must say so.

| Stamp | Where | Confidence |
| --- | --- | --- |
| `IngestEvent.channel === "telegram"` | Last 200 turns only | Certain for those turns. Blind to older history and to GPS successes, silent dupes, and drops. |
| `generatedBy.kind === "text"` | Log, intake, thought process, discrete triggers, activity spans | Certain those minutes were text-pipeline. The pipeline is also used by Simulate. Filter `channel` on a joined ingest row when the 200-log still has the turn. |
| `keywordLogged` / `keywordValue` | Habit cell after `dh:` | Certain a keyword line wrote the cell. Later in-app edits can change `value` and leave the flag. |
| `from text message at {clock}` | Habit done-log notes, activity-span notes | Certain at write. Editable. The clock is process-timezone, 12-hour, minutes omitted when zero (`3pm`). |
| `sent from text` | Needed-list item notes | Certain at create. |
| `logged from text` | Morning-ritual to-dos | Certain at create. |
| `stampSuffix: "from text"` | Plan append log | Certain. |
| `morning.source === "telegram"` | Day review morning slice | Certain the morning walk was the bot. Desktop morning sets `"desktop"`. |
| `start.source === "telegram"` | Week+ start ritual | Certain. |
| `allNighterSource === "telegram"` | Sleep night | Certain for the all-nighter flag only. Bed and wake from `gm` or `sleep:` do not set this. |
| `livePins.grocery.at` | Last pin | Certain a pin happened. One row, overwritten. |
| `account: "Telegram"` | Loose-parked read misses | Certain. Shortcut dumps of Apple Notes use the note’s own account. |
| Folder **From phone**, tags `docs`+`scan` | Journal / PDF | Weak. The app can file a note there by hand. |
| Scope id iPhone Screen Time / Calls / Texts, `precision: "estimated"` | Phone-life paints | Medium. Typed `screen:` and the Shortcuts are the only writers, but a hand paint on that scope is the same shape. |
| `precision: "estimated"` on sleep | `sleep:` phrase | Weak. The morning UI and memory can also store estimated ends. |
| Cycle flag, day jot, `habit:` cell, location/mood/track paint, grocery completion, Inbox capture, night review | Domain stores | **No stamp.** Telegram vs in-app is an outside join through `itemIds` while the ingest row still exists, or it is unknowable. |

---

## 2. Metric catalog

Every metric below names its grain, its formula, and whether it is computable from today’s vault. “Needs a clock” means the formula is the right one and the field does not exist yet. Do not fake it by subtracting `IngestEvent.at` from itself.

### 2.1 Command mix

**Grain:** ingest turn, channel `telegram`, inside the 200-row window (or a future unbounded log).

Collapse aliases before counting. The log stores `kind`, not the surface form. `groc` and `grocery` are both `grocery`. `h stretch` is `habit` because the expansion runs before parse. `dh: read 12 pages` is `habit-trigger`. Prefix-less Inbox lines are `capture`.

| Metric | Formula |
| --- | --- |
| Kind share | \(n(kind) / N\) |
| Family share | Map `kind` through the catalog categories (help, grocery, needed, capture, bulk, habits, log, monitor, plan, todo, review, track, note, sleep, gps, screen, call, text, iphone-notes, pin, inventory, receipt, journal, read). |
| Mutating share | \(n(\text{applied and writer mutates}) / N\). Reads, help, ping, pin, and the rituals board are applied and non-mutating. |
| Alias waste | Not stored. A future column `surface` (the first token before expansion) would give \(n(\text{shortcut or one-letter expansion}) / N\). Today, infer only when `raw` still starts with `w`, `h`, `tt`, `day`, or a key in `shortcuts`. |
| Help gravity | \(n(kind \in \{help, info\}) / N\), plus a follow-on rate: share of help turns whose next turn in the same session is a mutating apply. |

**Outside join:** none, if the chart is labeled “last 200 turns.”

### 2.2 Latency from message to record

**Grain:** one applied mutating turn.

\[
\text{ingestLag} = t_{\text{processed}} - t_{\text{sent}}
\]

\(t_{\text{sent}}\) is `message.date` (`IngestEvent.at`, task `createdAt` when the writer passed `now`, plan entry time, tracking `startMin` on the send date). \(t_{\text{processed}}\) is **not stored** on the event.

Accidental clocks, each with a bias:

| Clock | Formula | Bias |
| --- | --- | --- |
| Habit cell `updatedAt` | `updatedAt - Date.parse(event.at)` for a `habit` or `habit-trigger` turn whose summary names that habit | Last write to that cell wins. A second `dh:` the same day erases the first lag. `updatedAt` is also refreshed by any later in-app edit, which then measures the edit, not the text. |
| Grocery pin `livePins.grocery.at` | `pin.at - event.at` for the latest grocery/pin turn in that chat | One pin. A backlog of five `groc` lines yields one lag, for the last pin call. |
| Hub heartbeat | `status.at - max(message.date in the batch)` | Coarse. The file is overwritten every 10s. Historical batches are gone. |

Album turns add a built-in wait of 1100 ms before apply (`MediaAlbumBuffer`). File download (`getFile` + bytes, cap 12 MB) sits inside the poll loop before the renderer sees the payload. OCR (local Tesseract) sits inside `applyMedia` before the Docs or grocery write. None of those sub-spans are timed.

**Needs a clock:** `processedAt` on the ingest event, plus optional `downloadMs`, `ocrMs`, `applyMs`. Until then, publish lag only for the two accidental clocks and label them as such.

Queue lag while the laptop is asleep is a different number: the gap from `message.date` to the first successful poll after it. Telegram drops the update after ~24 h, so the observable support of that lag is \((0, 24\text{h})\). The right tail is censored, not zero.

### 2.3 Capture completeness

**Grain:** attempted phone acts, which is larger than the ingest log.

| Metric | Formula | Data today |
| --- | --- | --- |
| Apply rate | \(n(status=applied) / n(events)\) | Yes, last 200, GPS successes excluded so the denominator is already biased toward non-location life. |
| Clarify rate | \(n(status=clarify) / n(events)\) | Yes. |
| Error rate | \(n(status=error) / n(events)\) | Yes. The summary is the reply, so errors are classifiable by first sentence. |
| Refusal rate | \(n(summary=Unpaired sender) / n(events)\) | Yes, until those rows age out of 200. |
| Silent-drop rate | \(1 - n(extracted) / n(updates)\) | **Not stored.** Requires the poller to count updates that `extractTelegramMessage` returned null. |
| Dedupe rate | \(n(duplicate claims) / n(updates)\) | **Not stored.** Duplicates return before the log. The ring of 500 can also forget a key and apply twice; that double is invisible as a duplicate and visible as two domain rows. |
| GPS hide rate | \(n(gps paints in the memory ring) / n(gps events including failures)\) | Only while the process lives. Failures stay on the main log; successes do not. A historical GPS rate from `events` is mostly failures and unpaired refusals. |
| Backlog loss | Updates older than ~24 h that Telegram never delivered | Unobservable. Report it as a coverage caveat, not a number. |
| Parse-but-no-persist | `status=applied` whose writer is non-mutating, or `status=ok` with no domain change (`pin`, `today`, `help`, empty grocery dump, `Stop with no live session`) | Yes, by kind. |
| Media failure | `kind=receipt` or `journal` with `status=error` (“Couldn't read that receipt”, “Nothing to scan”, “Typed pdf: needs the file”) | Yes, while the row survives. |

**Capture completeness ratio** for a life domain on a day:

\[
C_d(\text{domain}) = \frac{n(\text{telegram-stamped writes on day } d)}{n(\text{telegram-stamped writes}) + n(\text{unstamped writes that analytics is willing to call in-app})}
\]

Only compute \(C_d\) for domains in the high-confidence half of §1.7. For Inbox, grocery, night review, and `habit:` without `dh:`, say the ratio is not identified.

### 2.4 Failure and retry

| Metric | Formula | Notes |
| --- | --- | --- |
| Poll failure incidence | Count of `phone-hub-status.json` writes with `error`, or Electron `lastPollError` | Only the latest error string survives (`poll failed`, Telegram’s `description`, or `No bot token stored`). A 1s backoff follows each failure. There is no failure log. |
| Double-consumer collisions | Telegram 409 while Electron and the hub both call `getUpdates` | The desktop yields when the hub file is fresh (`polling: true` and `at` younger than 45s). A 409 would show up as `lastPollError` and then vanish. |
| Webhook reject | HTTP 403 | Not in the vault. |
| Send failure | `sendMessage` throws | Not attached to the ingest event. The domain write may already have committed. **Split brain:** the vault has the item and the phone never got the confirmation. |
| Pin failure | `pinChatMessage` throws, caught empty | Same split: grocery rows exist, `livePins` may still point at the previous message. |
| Clarify abandonment | Pending `createdAt` with no later resolving event before session end | Computable inside the 200-window. Abandoned mornings are also `morning.completed === false` with a `resumeStep`, and that survives the log rotation. |
| Retry of the same command | Same `chatId`, same `kind`, normalized `raw`, gap < 2 minutes, previous status `error` | Computable. This is the human retry, not Telegram’s update retry. |
| Seen-key overflow | `seenIngestKeys.length === 500` and a key that hashed to an evicted slot is applied again | Not directly countable. A symptom is two domain rows with the same title and the same send timestamp. |

### 2.5 Time of day of capture

**Grain:** `IngestEvent.at` interpreted in the **process timezone**. The product has no user timezone. Clocks in the message (`3:30`, `18:37`, `7/4/26`) are read with `parseExpectedWhen` in that same zone. The machine that runs the bot is the zone.

| Metric | Formula |
| --- | --- |
| Hour histogram | Count turns by `getHours()` of `at`, per kind family. |
| Weekday × hour | Same, 7×24. |
| Ritual hour | Hour of the first `morning` or `night` turn of a ritual session. |
| Store-trip hour | Hour of `bought` and `receipt` turns. |
| Live-location coverage | Minutes of Location entries whose notes are the GPS note, by hour. This uses the time grid, not the ingest log, so it survives log rotation. It still cannot separate Telegram Live Location from `gps:` text or the Shortcut. |

Do not convert `message.date` into another zone. Telegram’s unix time is absolute; the calendar day Analytics shows must be the same local day `formatLocalDateKey` used when it filed the habit and the plan.

### 2.6 Remote versus in-app, by life domain

This is the chart that answers “what do I only bother to log from the phone?”

| Domain | Remote signal (high confidence) | In-app-only residue | Honest comparison |
| --- | --- | --- | --- |
| Discrete events (log, intake, tp, ate/drank/took) | `generatedBy.kind === "text"` | Entries with no `generatedBy`, or `generatedBy.kind === "sleep"` / `"screentime"` | Share of instants. |
| Activity spans | Text-pipeline notes + `generatedBy.text` on open-until-midnight Activity blocks and `switch →` instants | Hand-painted Activity blocks | Share of Activity minutes vs share of span starts. |
| Keyword habits | `keywordLogged` | Cells with `handCompleted` / `manualValue` and no keyword flag; cells with `trackedValue` from a tracking link | Share of met habit-days. A cell can be both keyword and later hand-edited: count `keywordLogged` as “phone touched” and `updatedAt` much later than the ingest turn as “edited after.” |
| Name-matched habits (`habit:`) | Only while the ingest row’s summary still exists | The cell itself | Outside join. Label it. |
| Morning review | `morning.source` | `source === "desktop"` or a morning slice with no source (legacy) | Completion rate and step depth by source. |
| Start ritual (week+) | `start.source` | Desktop start | Same. |
| Night / end review | None | The review | Do not split. Offer “reviews saved on days that also have a `night` ingest turn” only inside the 200-window, as an outside join. |
| Plan log | `stampSuffix === "from text"` | Other append-log lines | Share of day-plan entries, not share of characters, unless you also store length. |
| Needed list | notes contain `sent from text` | Other items on that list | Share of open and completed lines. |
| Morning to-dos | notes contain `logged from text` | Other to-dos that day | Share of today’s list. |
| Inbox / quick add | `itemIds` join | Everything else in Inbox | Outside join, 200-window. |
| Grocery add / bought | `itemIds` join; pin time | The grocery list | Outside join. Completions have no phone flag, so “bought at the store” cannot be reconstructed after the log rotates. |
| Location / mood from `at:` / `mood:` | None | The whole scope | Unidentified. GPS notes are the exception inside Location. |
| Sleep | `allNighterSource`; estimated bed/wake only as a weak hint | Desktop morning, inference (`source` tracked/mixed) | Report all-nighters by source. Report bed/wake as “estimated vs exact,” not as “Telegram vs desk.” |
| Cycle | None | `brain2-cycle-marks` | Unidentified. |
| iPhone Screen Time, Calls, Texts | The scopes exist only for this door and the Shortcuts | Mac Screen Time is a different scope and uses `generatedBy.screentime` | Treat the three phone scopes as remote-by-construction, and say a hand edit cannot be separated. |
| Docs from the camera | Folder From phone + scan tag | Other docs | Weak label. |
| Pantry qty | Receipt and `inv` turns via `itemIds` | Hand qty edits | Outside join. Qty is a counter, not an event log, so later bumps erase the path. |
| Work session | `start` / `stop` ingest rows | The session store | Outside join. |
| Regrets | Created when a Telegram night records a blocked reason | Desktop night does the same call | Unidentified after the fact. |
| Counts | `recordCountForKeyword` when a log keyword is bound | Other increments | The count tick does not store the channel. Join through the text-log instant at the same date and `startMin`. |

### 2.7 Conversation funnels

**Grain:** a session, or a single pending question.

**Generic command funnel**

\[
\text{sent} \rightarrow \text{extracted} \rightarrow \text{claimed (not deduped)} \rightarrow \text{paired} \rightarrow \text{parsed kind} \rightarrow \text{applied | clarify | error} \rightarrow \text{domain row still present}
\]

Today, “sent” and “extracted” and “claimed” are not counted. Start the published funnel at paired turns in the log, and draw the missing stages as a dashed unknown.

**Clarify funnel** (habit, pen, bought, receipt, duplicate)

| Stage | How to see it |
| --- | --- |
| Question opened | `status=clarify` |
| Resolved next turn | The following event in the same chat has `status=applied` and a compatible kind (`habit` after `habit`, `bought` after `bought`, `bulk` after a duplicate) |
| Re-asked | Next event is `clarify` again (bad index, another ambiguous receipt line) |
| Abandoned | Session ends, or a verb-looking message steals the turn (`looksLikeVerb` clears the pending by handling the new command instead) |
| Escape hatch | `raw` is `new`, `see`, `again`, `dismiss`, `inv`, `skip` |

Duplicate grocery is the cleanest small funnel: open → `see` (read) → `again` (second item, summary `Added duplicate`) or `dismiss` (summary `Left duplicate items`).

**Receipt funnel:** one clarify per unresolved OCR line. Length of the chain is the number of lines that were not a unique grocery match. Completion is a final `applied` receipt summary. Abandonment leaves `pending.kind === "receipt"` or simply stops.

**Morning funnel:** prefer `morning.resumeStep` and the filled fields over the chat log.

| Depth score | Fields present |
| --- | --- |
| 0 | No morning slice |
| 1 | `bedTime` or `allNighter` |
| 2 | `wakeTime` or all-nighter |
| 3 | `dream` or skipped via all-nighter |
| 4 | `affirmations.length` |
| 5 | `todosAddedIds` or `requiredTaskIds` defined (including empty) |
| 6 | `priorityTaskIds` defined |
| 7 | `priorityHabitIds` defined |
| 8 | `walkIndex` or walk finished into day plan |
| 9 | `dayPlanLogged` |
| 10 | `bestDayWhy` |
| 11 | `gratitude.length > 0` and `completed` |

Drop-off at step \(k\) is the share of telegram mornings whose depth is \(k\) and `completed` is false. Voice-advance rate is not stored; a voice note becomes the same skip-like reply as text. A future flag `advancedBy: "voice" | "text"` on the affirmation step is the whole metric.

**Night funnel:** `endCompleted` is the only durable finish bit, and it is not channel-specific. Inside the log window, count turns whose `raw` matches the night step grammar only if you are willing to re-simulate `periodSteps`. That simulation is deterministic. It is still an outside join to the review.

**Pairing funnel:** code generated (not logged) → `/start {code}` applied, or `Bad or expired pairing code`, or `Unpaired sender` then a later `allowedChats` row whose `pairedAt` is after that refusal (the one-click Settings path). Time-to-pair = `pairedAt - first Unpaired sender at` for that `chatId`.

---

## 3. Visualizations

Each view names the grain in the corner. Remote-capture charts that depend on an outside join wear a small “joined” mark. Charts that are unidentified for a domain do not pretend.

### 3.1 Command calendar

A month grid. Cell = one local day. Color = count of telegram ingest turns, or, on a second layer that survives rotation, count of high-confidence stamped writes (text-pipeline instants + `keywordLogged` habits + `from text` plan lines + telegram mornings).

Toggle:

- All turns (200-window, so the month will look empty before the window)
- Stamped writes (full history)
- Ritual days only (`morning.source === "telegram"` or a night turn)

A thin mark under the cell when the day has stamped writes but zero ingest rows: history exists, the conversation log has rotated. That mark is the product teaching itself.

### 3.2 Command mix

Horizontal stacked bar of family share, last 200 and (separately) last 30 stamped-write days. A small multiples row for weekday. Helps and reads in a quiet color; mutations in a strong one. Hover lists the `kind` values inside the family, not a guessed verb, unless `raw` is still in the window.

### 3.3 Funnels

Three funnels, not one:

1. **Turn funnel** for the log window: paired → parsed → applied / clarify / error / ignored. Unpaired is its own exit, not a failure of parsing.
2. **Morning depth** as a survival curve: share of telegram mornings that reached each step in §2.7. One curve for completed, one for `resumeStep` abandoned.
3. **Clarify survival:** opened → resolved within the same session → domain row still present (join on `itemIds` where the writer provided them).

### 3.4 Ingest lag

A dot per accidental clock: habit `updatedAt` lag and pin lag. Log scale. A vertical band at 1.1 s for albums and at the long-poll timeout (25 s) so a healthy live consumer sits near zero and a woken laptop sits in minutes or hours.

Until `processedAt` exists, the chart’s empty state is the sentence: “Lag is not recorded. These dots are the two clocks that happen to differ.” A backlog censoring note at 24 h.

### 3.5 Source-of-capture share

Small multiples, one per domain in §2.6 that has a real stamp. Stacked bar: phone-stamped vs not, by week. Domains without a stamp appear in a second section titled “Not separable,” listing Inbox, grocery checkout, night review, cycle, day notes, `habit:` without `dh:`, and location/mood paints. Showing them as 100% unknown is more honest than a joined guess presented as a share.

### 3.6 Hour ribbon

24-hour ribbon of stamped text-pipeline instants (full history) beside a ribbon of ingest-log hours (windowed). If they disagree, the window is the reason, or the person logs `log:` at the time of the event and `gm` at a different hour. That disagreement is the finding.

### 3.7 Session strip

One horizontal strip per capture session in the window: blocks colored by kind, width by count, gap drawn when the session rule cuts. Ritual sessions get the step name on each block when `raw` plus the state machine can recover it. This is the picture of “phone as a conversation” rather than “phone as a bag of events.”

---

## 4. Statistical and learning analyses

These are questions the vault can actually answer, with the estimator named.

### 4.1 Which prompts get used

The catalog is large (help, grocery, habits, log, monitor, plan, rituals, tracking, phone-life, media, reads). Usage is not uniform, and the log’s `kind` is the observation.

- **Support.** Kinds with \(n \ge 1\) in the window, over kinds the parser can emit. A kind at zero for ninety days of stamped history (where history exists) is an unused door.
- **Manual follow-through.** After `info`, `{prefix} info`, `{prefix} commands`, or `all commands`, the probability the next mutating kind belongs to that prefix’s family. Example: `grocery commands` followed within the session by `grocery` or `bought`. Estimate with a simple conditional frequency and a Wilson interval; the window is small.
- **Shortcut yield.** Share of turns whose `raw` first token is in `shortcuts` or in the one-letter table. If `store` is defined and never appears, the alias is dead. The expansion map is in the store, so the denominator of “defined aliases” is known even when usage is not.
- **Keyword yield.** For each habit text trigger and each discrete pattern, count matches (`habit-trigger` summaries, `eventKind` slugs, `intakeClass`). A preset (`hemisync`, `read N pages`, `exercise N min`, `chess score N`) with zero `keywordLogged` days is a preset that never fired. Compare with Inbox `capture` rows whose `raw` is the same phrase without `dh:`: those are the misses the precedence rules created on purpose. The ratio

\[
\text{prefixDiscipline} = \frac{n(dh\text{ matches})}{n(dh\text{ matches}) + n(\text{capture whose text would have matched a trigger})}
\]

measures whether the colon habit stuck. The second term needs the trigger table and the raw capture text, so it lives in the 200-window.

- **Discrete pattern edit.** `discreteEventTriggers` is the current list. Historical patterns that were removed leave `eventKind` slugs behind and no row in Settings. Count slugs that match no current pattern: retired prompts that still have a past.

### 4.2 Drop-off

- Morning survival curve (§2.7). The interesting test is not “do people finish” but “which step is the cliff.” Affirmations (five turns), the six-slot walk (one turn per to-do), and ten gratitudes are the long stairs. Report median turns-to-complete and the modal `resumeStep` among `completed === false`.
- Receipt line drop-off: empirical distribution of clarify-chain length. A long chain means OCR lines are not on the grocery list, which is a data fact about the list, not only about patience.
- Clarify re-ask rate by pending kind. High re-ask on habits means names in the vault and names in the person’s head diverge (fuzzy match is doing real work).
- `STOP` versus finish for morning; `cancel` versus `endCompleted` for night. `STOP` still saves. It is a partial commit, not a rollback. Count it as depth-at-exit, not as a failure.

### 4.3 Burstiness of remote capture

Use stamped text-pipeline instants and ingest turns separately.

- **Inter-event times.** For one chat, \(\Delta_i = t_i - t_{i-1}\). Report the median, the 90th percentile, and the fraction of gaps under 2 minutes (a burst) versus over 6 hours (a return).
- **Fano factor** on hourly counts of stamped instants, by day: \(\mathrm{Var}(n_h) / \mathrm{Mean}(n_h)\). Near 1 is Poisson-like; far above 1 is bursty (a journaling sitting, a grocery trip, a live-location stream). Live location will dominate this if GPS minutes are included. Compute it twice: once on discrete instants, once on GPS samples, and do not mix them.
- **Session size.** Distribution of turns per capture session. A mass at 1 is “drive-by capture.” A mass at 15 with kind `morning` is the ritual. Mixing them into one mean is how the average becomes useless; show the two modes.
- **Backlog bursts.** When `processedAt` exists: many send-times spread over hours applied within one minute. The signature of a sleeping laptop. Today, a weak proxy is many ingest `at` values that differ, written into stores whose habit `updatedAt` values collapse to the same second. That proxy only works for `dh:` and `habit:`.

### 4.4 Do Telegram days look different?

Define a **telegram day** only with high-confidence stamps, so the label is not an artifact of the 200-row window:

A local date is a telegram day if any of these is true:

- a text-pipeline time entry on that date (`generatedBy.kind === "text"`)
- a habit cell that day with `keywordLogged`
- a plan entry that day with `stampSuffix === "from text"`
- `morning.source === "telegram"` on that day’s review
- `allNighterSource === "telegram"` on that morning’s sleep night
- a needed item or morning to-do whose `createdAt` falls on that date and whose notes carry the phrase

Compare telegram days to other days on outcomes the bot does not fully determine, so the contrast can be interesting:

| Outcome | Why it might move | Caveat |
| --- | --- | --- |
| Count of text-pipeline instants | By definition higher on telegram days | Do not use this as the finding. It is the definition. |
| Habit-days met, among habits that have a `dh:` trigger | Phone prompts may add completions that the desk skips | Split `keywordLogged` meets from hand meets. |
| Morning `completed` | The bot is a script; the desk is a form | Compare telegram mornings to desktop mornings, not to days with no morning at all, or you will credit the bot for the existence of the ritual. |
| Day-plan present | `plan for rn` and the morning day-plan step | Same: compare sources of the plan line. |
| Sleep estimated vs exact | `sleep:` always writes estimated | A telegram day can inherit an estimated night from one phrase. |
| Grocery lines completed | Store trips are phone-shaped | Outside join. Only inside the log window, and say so. |
| Inbox created that day | Prefix-less capture | Outside join. |
| Tracking minutes on Activity | `currently` paints through midnight, which inflates the day | Separate span minutes from instant counts before claiming “more tracked.” |

A simple estimator: for each outcome, the difference in means between telegram days and other days, with a weekday fixed effect (telegram use piles on certain days). This is descriptive. The person chooses to text. The contrast is “days I reached for the phone look like this,” not “the bot caused the day.”

### 4.5 Learning the language

Over calendar time, the share of turns that are `error` or `clarify` should fall if the phrases stick, and the share that are one-letter expansions or custom shortcuts should rise if the short forms stick. Plot both as a 14-day rolling rate inside whatever history exists. A rising error rate on `switch:` or `log:` is a parser change or a timezone surprise (military clocks), not a user failure. Annotate the chart with nothing automatic; leave room for a human note.

Unused help prefixes are a product signal: if `screen info` never appears and `screen:` never appears, the phone-life door is undiscovered. If `screen info` appears and `screen:` does not, the manual did not convert.

---

## 5. Within-Telegram combinations

The cube that is actually stored, inside the log window:

**kind × status × hour × mutating?**

and, where the stamp exists, a second cube on full history:

**record type × hour × stamp × clock certainty**

Useful slices:

| Slice | What it shows |
| --- | --- |
| `kind × status` | Which commands fail (`habit` clarify vs `log` error vs `capture` almost always applied). |
| `kind × hour` | Grocery and `bought` in the afternoon, `gm` in the morning, `log:` all day, `gn` at night. If `gm` is not in the morning, the process timezone is wrong or the ritual is a catch-up. |
| `log × clockCertainty` | Share of `est` / `unknown` / exact on text instants. Exact is the omitted default. A high `est` share means the phone is a memory, not a live tap. |
| `intakeClass × hour` | Food, drink, drug, and unclassed intake across the day. `ate` / `drank` / `took` versus `intake food:` are two doors to the same `eventKind`. Count them together and show the door as a facet. |
| `switchFrom × switchTo` | Only on rows that stored the strings. Older rows omit them. The matrix is the day’s path through Activity, Company, and the other scopes. |
| `eventKind × date` | Repeatable life events (`left room`, `thought-process`). The slug is the grouping key the writer already computed. |
| `ritual step × outcome` | Morning depth × whether that day’s priority habits were met. Outside join on the habit cell, labeled. The hypothesis: a finished walk (`priorityHabitIds` non-empty, `completed`) co-occurs with those habits’ cells, not with a vague “good day.” |
| `receipt × grocery list size` | Clarify-chain length versus open grocery count that day. Long chains against a long list mean fuzzy match is failing; long chains against a short list mean the receipt is not the list. |
| `gps × ritual` | Live-location updates dropped while a ritual is open are invisible. The visible combination is a GPS gap whose clock sits inside a morning `resumeStep` interval. That is a hypothesis about missing samples, not a count of dropped updates. |
| `media × caption kind` | Photo with no caption that OCR called a receipt, versus caption `journal:`, versus PDF. Success is a doc id or a grocery completion. |
| `unpaired × raw kind` | What people try to say before they are paired. The raw text is on the refusal row. It is the best sample of first-contact language, and it ages out in 200 turns. |

Combinations to refuse until a stamp exists: “Telegram location × later mood,” “Telegram cycle × sleep,” “night-review gratitude × next-day habits.” Those joins cross unidentified channels. They can live in a Habits or Tracking tab. They do not belong on a chart that claims to be about the bot.

---

## 6. Analytics information architecture (the bot only)

One tab, **Phone**, with BIM named in the header so it is obvious this is the conversation and the records it leaves. Five sections. The first number on the page is always the coverage line: “Conversation log: last 200 turns. Stamped history: as far back as the vault. GPS successes: this sitting only.”

### 6.1 Today’s door

A single column for the local date.

- Turns today, by family, from the log if they are still in it.
- Stamped writes today: text instants, keyword habits, from-text plan lines, morning source.
- Open pending, if `pendingByChat` is non-empty: the step name (`morning.resumeStep` or the ritual step), how long since `createdAt`, and the last `raw`.
- Last pin time and whether it matches the latest grocery turn.
- Hub heartbeat age from `phone-hub-status.json` when the desktop can read it. Stale means the phone is talking to a queue or to nobody.

### 6.2 Conversation

The 200-row log as a session strip (§3.7), then the three funnels (§3.3). Filters: kind, status, chat (there should be one paired chat; if `allowedChats` has several, the filter matters). Unpaired refusals in a side list, because they are the pairing funnel, not noise.

This section expires. Say so at the top.

### 6.3 What the phone writes

Full-history charts that use only §1.7’s high-confidence stamps.

- Source-of-capture small multiples (§3.5).
- Command calendar on stamped writes (§3.1).
- Hour ribbon (§3.6).
- Event-kind ranking for `generatedBy.text`.
- Keyword habits: which triggers fired, quantity added, score set.
- Morning depth survival, split by `source`.

A fixed footnote lists the domains that cannot be split. The footnote is part of the design, not an apology.

### 6.4 Language

- Kind support versus the catalog.
- Error and clarify rolling rates.
- Shortcut and `dh:` discipline (§4.1).
- Top raw first-tokens that became `capture` (the phrases that missed every verb). This is the backlog of language the person expects and the parser does not have. It is the most useful product list in the tab, and it only exists while `raw` is in the 200.

### 6.5 Reliability

- Accidental lag dots (§3.4).
- Latest poll error, with the explicit absence of a history.
- Silent-loss checklist, qualitative until the poller counts null extracts: stickers and other update shapes, files over 12 MB, dedupe ring of 500, 24-hour Telegram retention, album wait, voice without a ritual, live location during a ritual, edits re-applied (§7).
- Split-brain note: a domain row can exist when `sendMessage` failed, and a pin can fail after the grocery write.

No sixth section that re-charts habit grades, sleep architecture, or plan quality. Those are other tabs. Phone may link to a habit cell or a time entry. It does not recompute the grade.

---

## 7. Edge cases

### 7.1 Duplicate messages

Dedupe key is `upd:{update_id}` when present, else `msg:{channel}:{chatId}:{message_id}`. The first claim wins. The second claim returns `ignored` with summary `Duplicate Telegram update` and **does not log**. Webhook retries and a double poller are the reason.

The ring keeps 500 keys in memory and on the store. After eviction, the same update can apply again and create a second Inbox item, plan line, habit write, or text instant. Analytics should treat two domain rows with equal send timestamps and equal titles as a possible re-apply, not as two intentions.

Simulate has no dedupe key. A chart that forgets to filter `channel === "telegram"` will mix practice messages into the life record. `generatedBy.text` is set for Simulate too.

### 7.2 Edits

`edited_message` is accepted. The extractor uses `message.date`, not `edit_date`, so the ingest clock stays the original send time. The edit is a **new** `update_id` with the **same** `message_id`. Because the dedupe key prefers `update_id`, a text edit is processed as a second command. It can create a second capture, a second log instant, or a second plan line. It does not update the first record in place.

Live Location is the edit path that is intentional. Each edit is a GPS sample (`locationUpdate: true`). Same coordinates keep the current pen; a real move cuts and paints. During any ritual, those edits are dropped and not logged. When the ritual ends, a later edit can record again. The gap in the Location grid during a morning walk is partly this rule.

A venue pin (a place card with a title and no `live_period`) becomes `gps:` lines marked shared-place and is ignored with summary `Shared place, not where you are`. It must not count as a location sample.

### 7.3 Failed sends

`sendMessage` errors are returned to the hub or Electron and not written on the event. The store write has already happened inside `ingestIncomingAsync`, and the hub flushes the vault after `deliverIngestReply`. Order:

1. Domain write and ingest log (in memory / zustand).
2. Reply chunks (3900 characters, split on newlines; Telegram’s cap is 4096).
3. Optional extra message for the pin, then `pinChatMessage` (best effort).
4. Hub persist flush.

So a failed send is a confirmation failure, not a capture failure. Analytics must not infer “not captured” from the absence of a story the phone remembers. The inverse also matters: the person may retry, and the retry is a new message that dedupe will not collapse. Two grocery lines and one memory of failure is the expected scar.

Pin failure leaves the previous `livePins.grocery` in place. The dump the store trip sees can be older than the list.

### 7.4 Parses but does not persist

| Case | What the person sees | What is stored |
| --- | --- | --- |
| `help`, `info`, `ping`, catalogs, `today`, `where`, `lists`, `agenda`, `log categories` | A reply | An `applied` ingest row. No domain row. |
| `pin` | A refreshed card | `livePins` only. |
| Bare `groc` on an empty list | “No grocery list yet…” | No list, until an add. |
| `stop` with nothing running | “Nothing was running.” | No session change. |
| `got` when the list is already empty | “already empty.” | No completion. |
| Typed `pdf:` with no file | Error reply | An error event. No doc. |
| Voice note outside a ritual | “Got your voice note…” | No audio, no transcript. |
| Voice note inside morning | Advances the step | The step’s text fields, as if they had typed a skip or a reply. The audio is discarded. |
| Blank text during morning | Silence | Pending stays. Usually no ingest row. |
| Live location during a ritual | Silence | Pending stays. No GPS sample. |
| Photo that is not a receipt and not captioned `journal` | A Docs note anyway (the non-receipt photo path) | A scan doc. This **does** persist. Do not treat “no caption” as a drop. |
| Receipt OCR empty | Error | No grocery change. |
| `status=applied` for `shared place` | Ignored, not applied | No location paint. |
| iPhone note part `2/3` before part 1 | Waiting in a process-local map | Nothing durable until every part arrives. A restart loses the map. |
| Read that matches no list | Parked on iPhone Notes Store | A loose item with `account: "Telegram"`. This looks like a failed read and is a successful park. |
| Disabled ingest, or a duplicate update | Nothing, or no second reply | No new event for the duplicate; disabled returns before the log. |

### 7.5 Timezone of the chat versus the app

Telegram delivers `message.date` as unix seconds. That instant is absolute. The calendar day, the minute on the tracking grid, and the words `3:30` and `7/4/26` are interpreted in the timezone of the process that runs the executor (the desktop machine or the hub host). There is no per-chat timezone and no per-user timezone.

Consequences for analytics:

- A hub on a VPS in UTC and a life lived in US Pacific will file `gm` and `log: at 8:15` on the wrong local day. The ingest `at` ISO string is still the true instant; `formatLocalDateKey` of that instant in the wrong zone is the bug. Any “telegram day” chart must document which zone it bins in, and it must be the zone the executor used, or the join to habit dates will lie.
- Military clocks (`18:37`, bare `1:00` as 1:00 am) and `1pm` forms are properties of the parser, not of Telegram. A histogram of `clockCertainty` does not catch a systematically shifted zone.
- `from text message at 3pm` is formatted in that process zone at write time. If the zone later changes, old notes keep the old words and new ones use the new zone. Do not re-parse those notes as a time series.
- Backlog apply uses send order (`message.date`, then `message_id`), and stamps domain rows with the send instant. The tracking minute is when they sent it, not when the laptop woke. That is correct for the life record and is why lag must be a separate field.
- Sleep’s morning key and cycle’s calendar day use the same local key. A message sent at 00:30 local files “today,” not “the night I meant,” unless the phrase says `yesterday` (habits) or carries an explicit date (`7/4/26` on log and switch lines).

### 7.6 Groups, pairing, and who the row belongs to

Groups are ignored unless Settings turns them on. A group turn that is ignored is logged (`Ignored group`) and not applied. If groups are enabled, the `chatId` is the group and `userId` is the sender. The allowlist matches chat id **or** user id. Analytics should group by `chatId` for “which conversation,” and by `userId` for “which person,” and expect them to be equal in the normal one-human DM.

Unpaired senders get no reply. Their `raw` is stored. That text can be intimate. A Phone tab that shows raw refusals is showing untrusted input on purpose so the owner can recognize themselves. It should not leave that list sitting in a shared or exported view without the same care as the ingest log already has.

### 7.7 Rotation and memory

| Buffer | Limit | What falls out |
| --- | --- | --- |
| `events` | 200 | The conversation. Domain rows remain. |
| `seenIngestKeys` | 500 | Dedupe protection. |
| GPS ring | 40, memory only | Successful location samples as audit rows. The Location grid remains. |
| `pendingByChat` | One per chat | The previous question, when a new one opens. Morning progress is copied onto the review before that. |
| `livePins` | One grocery pin | Older pins. Telegram may still show the message if it was not unpinned. |
| Hub status | One file | All but the latest heartbeat and the latest error. |
| iPhone note parts | Process memory | An unfinished multi-part dump. |

Any long-run statistic that reads only `events` is a statistic about the last 200 turns. The Phone tab says that in the section header every time.

---

## 8. What a later instrumentation pass would add

The vision above is honest about today’s vault. A small set of fields would turn the dashed parts of the funnels into measurements, without changing the command language:

| Field | Where | Unlocks |
| --- | --- | --- |
| `processedAt` | `IngestEvent` | Ingest lag, backlog sessions, censoring at 24 h. |
| `telegramUpdateId`, `telegramMessageId` | `IngestEvent` | Edit vs new message, true dedupe rate, join to a retry. |
| `surface` | First token before expansion | Alias and shortcut yield. |
| `extractDropReason` | Poller counter, not necessarily per row | Stickers, oversize files, empty updates. |
| `sendOk`, `pinOk` | After `deliverIngestReply` | Split brain. |
| `advancedBy` | Morning affirmation step | Voice versus text. |
| `source: "telegram"` | Night / end `PeriodReview`, cycle flags, day notes, `habit:` cells, location/mood paints | The domains that are unidentified today. |

Until those exist, the stamped history in §1.7 is the dataset, the 200-row log is the conversation, and every chart says which one it is.
