# BIM command catalog

Complete list of phrases **BIM** (Brain2 Ingestion Messenger) accepts.
Generated from the live surface in `lib/ingest/command-catalog.ts`
(parser verbs, expansions, habit/discrete presets, bulk dumps, morning GM, retired `g`).

In chat: `info` · `{prefix} info` · `{prefix} commands` · `all commands`.

## Help & manuals

### `help`

- **Format:** `help`
- **Forms / aliases:** `help`, `/help`, `commands`, `?help`
- **Does:** Short cheat-sheet of common phrases (grocery, habits, log, monitor, plan, gm).

### `info`

- **Format:** `info`
- **Forms / aliases:** `info`, `/info`, `instructions`, `manual`, `cmds`
- **Does:** BIM basics: who he is, families of input, and exactly how to ask for `{prefix} info`, `{prefix} commands`, and `all commands`.

### `{prefix} info`

- **Format:** `groc info` · `log info` · `review info` · `to do info` · `read info` · …
- **Forms / aliases:** `{prefix} info`
- **Does:** Deep dive for one family: what it is, how to use it, how to format it.

### `{prefix} commands`

- **Format:** `grocery commands` · `habit commands` · `monitor commands`
- **Forms / aliases:** `{prefix} commands`, `{prefix} command`, `{prefix} cmds`
- **Does:** Full glossary of every command and keyword for that family.

### `all commands`

- **Format:** `all commands`
- **Forms / aliases:** `all commands`, `all cmds`, `all command`
- **Does:** One glossary of every command and keyword across every type BIM supports.

### `ping`

- **Format:** `ping`
- **Forms / aliases:** `ping`, `pong`
- **Does:** Liveness check. BIM replies that he is listening and points to info / all commands.

## Pairing

### `pair:`

- **Format:** `pair: 123456` · `/start 123456` · `/start123456`
- **Forms / aliases:** `pair`, `/start`
- **Does:** Pair this Telegram account using the 6-digit code from Settings → Message ingest. Send to @brain2_phone_bot, never BotFather. Unknown senders get no reply.

## Grocery

### `groc`

- **Format:** `groc` · `grocery` · `shop`
- **Forms / aliases:** `groc`, `grocery`, `groceries`, `shop`, `shopping`
- **Does:** Dump the grocery-ish list (Grocery / Groceries / Shopping) as plain text and pin it in the chat.

### `groc {item}`

- **Format:** `groc milk` · `grocery: eggs` · multi-line under `groc`
- **Forms / aliases:** `groc …`, `grocery: …`, `groceries: …`, `shop: …`, `shopping: …`
- **Does:** Add item(s) onto the grocery store list (Inbox off). Several lines = bulk. Identical open titles ask see / again / dismiss.

### `got`

- **Format:** `got milk` · `x bread, eggs` · `bought: oats` · `check off milk`
- **Forms / aliases:** `got`, `bought`, `x`, `check off`, `checkoff`, `checkout`
- **Does:** Complete matching open grocery lines and refresh the pin.

### `g` *(retired)*

- **Format:** `g` (retired)
- **Forms / aliases:** `g`
- **Does:** Bare `g` no longer means grocery. It falls through as Inbox capture unless a custom shortcut remaps it.
- **Note:** Use `groc`. Old Settings shortcuts that expanded to `g` are remapped to `groc` automatically.

## Needed

### `needed:`

- **Format:** `needed: batteries` · `needed batteries` · `get:` then lines · `get: batteries`
- **Forms / aliases:** `needed`, `get:`
- **Does:** Add onto the list named "needed" (created if missing). Inbox off. Each item's detail notes include: sent from text. `get:` is the colon-only shortcut (same writer); bare `get` without a colon is not this command.

## Capture / add / Inbox

### `add`

- **Format:** `add: pick up milk` · `qa: idea` · `inbox: …` · `idea: …` · `capture: …` · `quick add: …`
- **Forms / aliases:** `add`, `qa`, `quick add`, `quickadd`, `capture`, `inbox`, `idea`
- **Does:** Smart-capture into Inbox (same path as desktop Quick Add). End with -mb or -monkey to dump it in Monkey brain instead of the Inbox you mean to revisit.

### `(plain text)`

- **Format:** `pick up milk`
- **Forms / aliases:** `(any message with no verb)`
- **Does:** Prefix-less text that is not a list dump becomes an Inbox capture. -mb or -monkey on the line sends it to Monkey brain.

## Bulk add & list dumps

### `bulk`

- **Format:** `bulk:` then headers and one item per line
- **Forms / aliases:** `bulk`, `bulk add`, `bulkadd`
- **Does:** Bulk Add pipeline (Inbox off). Headers `list:` / `folder: list:` / `Home: Groceries:` work. Grocery names with no other folder use the store list.

### `{List name}:`

- **Format:** `Chores:` then lines · `Grocery list:` then lines · `before elijah gets home:` then lines
- **Forms / aliases:** `{Name}: then lines`
- **Does:** Multi-line `Name:` dump files onto that list (found or created). Grocery headers land on the store list. Identical open titles ask see / again / dismiss.

### `before M/D:`

- **Format:** `before 9/12:` · `before Friday:` · `before Sept 12:` then item lines
- **Forms / aliases:** `before …:`
- **Does:** Following lines are due that day (`deadline` / mustBeDoneBefore). A past M/D rolls forward a year. Non-date words after `before` stay a list name.

## Habits

### `habit:`

- **Format:** `habit: exercise 30` · `did: stretch` · optional `yesterday`
- **Forms / aliases:** `habit`, `did`
- **Does:** Write a habit by name. GOAL → number; BOOLEAN → done/yes/no/undo; TEXT → rest of line. Fuzzy-matches habit name.

### `h`

- **Format:** `h` alone → help · `h stretch` → `habit: stretch`
- **Forms / aliases:** `h`
- **Does:** Built-in expansion: bare `h` is help; with a payload it becomes habit:.

### `habits`

- **Format:** `habits` · `hi` · `habit board`
- **Forms / aliases:** `habits`, `hi`, `habit board`
- **Does:** Dump today's habit board as plain text.

### `hemisync`

- **Format:** `hemisync`
- **Forms / aliases:** `hemisync`
- **Does:** Whole-message habit keyword preset (done mode) when a habit named like Hemisync has that trigger. Editable on the habit.
- **Note:** Stamp: from text message at {time}.

### `read {n} pages`

- **Format:** `read 30 pages`
- **Forms / aliases:** `read … pages`, `read … page`
- **Does:** Whole-message quantity keyword for reading habits (preset). Not the same as `read:` list dump.

### `exercise {n} min …`

- **Format:** `exercise 15 min walked to the cliffs`
- **Forms / aliases:** `exercise …`
- **Does:** Whole-message quantity keyword for exercise habits; trailing detail goes into notes.

### `chess score {n}`

- **Format:** `chess score 355`
- **Forms / aliases:** `chess score …`
- **Does:** Whole-message score keyword for chess-like habits (preset).

## Discrete event log

### `log:`

- **Format:** `log: drink water` · `log-something happening`
- **Forms / aliases:** `log:`, `log-`
- **Does:** Explicit discrete event on Activity. Whatever follows is the event title. Labeled from text pipeline. Bare `o` is NOT a log.

### `smoked weed`

- **Format:** `smoked weed` (whole message)
- **Forms / aliases:** `smoked weed`
- **Does:** Default discrete-event trigger (editable in Settings → Message ingest).

### `drank water`

- **Format:** `drank water` (whole message)
- **Forms / aliases:** `drank water`
- **Does:** Default discrete-event trigger.

### `ate {item}`

- **Format:** `ate egg salad`
- **Forms / aliases:** `ate …`
- **Does:** Default discrete-event trigger with `{item}` slot.

### `took {item}`

- **Format:** `took 2 adderall`
- **Forms / aliases:** `took …`
- **Does:** Default discrete-event trigger with `{item}` slot.

## Activity monitor (currently / stopped / switched)

### `currently`

- **Format:** `currently deep work` · `current cooking`
- **Forms / aliases:** `currently`, `current`
- **Does:** Start an Activity-scope interval from now through end of day. Labeled from text pipeline.

### `stopped`

- **Format:** `stopped deep work` · `stopped`
- **Forms / aliases:** `stopped`
- **Does:** Close the open activity interval at now.

### `switched to`

- **Format:** `switched to cooking` · `switch to email` · `switched email`
- **Forms / aliases:** `switched to`, `switch to`, `switched`
- **Does:** Stop previous activity, start new, log a switch instant. Labeled from text pipeline.

## Plan log

### `plan for rn:`

- **Format:** `plan for rn:` then lines · `plan for now: …`
- **Forms / aliases:** `plan for rn`, `plan for now`, `plan now`, `plan rn`
- **Does:** Append today's Plan log (Home → Plan day tab). Entries from Telegram show "from text" after the stamp.

### `read plan for today`

- **Format:** `read plan for today`
- **Forms / aliases:** `read plan for today`, `read plan today`, `latest plan`
- **Does:** Reply with the latest plan-log entry for today.

### `read plans for today`

- **Format:** `read plans for today`
- **Forms / aliases:** `read plans for today`, `read plans today`, `read plans`
- **Does:** Reply with every plan-log entry for today.

### `agenda`

- **Format:** `agenda` · `calendar` · `plan`
- **Forms / aliases:** `agenda`, `calendar`, `plan`
- **Does:** Today's calendar / agenda events (read-only dump). Distinct from `plan for rn:`.

## To-do & Next Actions

### `to do today:`

- **Format:** `to do today: call dentist` · multi-line
- **Forms / aliases:** `to do today`, `todo today`, `do today`, `tdt`
- **Does:** Create Home → To Do items scheduled for today.

### `do:`

- **Format:** `do: call dentist` · `next action: …`
- **Forms / aliases:** `do`, `next action`
- **Does:** Create Next Actions → General items (not day-scheduled).

### `read to do today`

- **Format:** `read to do today`
- **Forms / aliases:** `read to do today`, `read todo today`, `read todays list`
- **Does:** Numbered dump of open to-do items for today.

## Reviews & morning (GM)

### `gm`

- **Format:** `gm` · `good morning`
- **Forms / aliases:** `gm`, `good morning`, `goodmorning`
- **Does:** Start morning review over text: sleep (or all nighter) → 5 affirmations one-at-a-time → to-do add → 3–5 priorities → 1–3 habit priorities → go through each to-do (six slots: tier duration points importance resistance excitement) → plaintext day plan → circumstance branches → best day → 10 gratitude.

### `all nighter`

- **Format:** Reply `all nighter` at the first sleep question
- **Forms / aliases:** `all nighter`, `all-nighter`, `all nighters`
- **Does:** Marks the night as an all-nighter and lifts habits that carry an all-nighter block (bedtime the evening before, wake and dream that morning, unless those blocks were edited). The morning routine continues.

### `skip`

- **Format:** `skip` or a blank message
- **Forms / aliases:** `skip`, `pass`, `next`, `blank`, `empty`, `n/a`, `na`, `-`, `.`, `—`, `(empty message)`
- **Does:** Advance a ritual step without an answer (morning or period review).

### `reviews`

- **Format:** `reviews`
- **Forms / aliases:** `reviews`
- **Does:** Reviews board: morning done/not yet + which period reviews are due.

### `review`

- **Format:** `review` · `review today` · `review day|week|month|quarter|year`
- **Forms / aliases:** `review`
- **Does:** Start the first due period review, or a named period. Walk unfinished tasks, summary, gratitude, plan reflection, etc.

### `cancel`

- **Format:** `cancel` · `quit` · `nevermind`
- **Forms / aliases:** `cancel`, `quit`, `nevermind`, `never mind`
- **Does:** Stop a ritual (morning or period) in progress.

## Tracking (location / activity / mood / working now)

### `at:`

- **Format:** `at: gym` · `location: home` · `here: cafe` · `loc: …`
- **Forms / aliases:** `at`, `location`, `here`, `loc`
- **Does:** Paint Location from now through tonight.

### `w`

- **Format:** `w` alone → where · `w gym` → `at: gym` · `@ home` → `at: home`
- **Forms / aliases:** `w`, `@`
- **Does:** Built-in expansion for location / where.

### `track:`

- **Format:** `track: exercise 30m` · `doing: work 9-11` · `tracking: …`
- **Forms / aliases:** `track`, `tracking`, `doing`
- **Does:** Paint an Activity block (duration ending now, or an explicit clock window).

### `tt`

- **Format:** `tt` alone → track · `tt work` → `track: work`
- **Forms / aliases:** `tt`, `trk`
- **Does:** Built-in expansion for track.

### `mood:`

- **Format:** `mood: good` · `feeling: tired` · `state: …`
- **Forms / aliases:** `mood`, `feeling`, `feel`, `state`
- **Does:** Paint Mood scope until further notice.

### `m`

- **Format:** `m` alone → mood · `m good` → `mood: good`
- **Forms / aliases:** `m`
- **Does:** Built-in expansion for mood.

### `start:`

- **Format:** `start: write paper`
- **Forms / aliases:** `start`
- **Does:** Start working-now (operation match) or start an Activity pen.

### `stop`

- **Format:** `stop` · `/stop`
- **Forms / aliases:** `stop`, `/stop`
- **Does:** Stop working-now / pause the live activity.

### `pause`

- **Format:** `pause`
- **Forms / aliases:** `pause`
- **Does:** Built-in expansion → `stop`.

## Notes

### `n`

- **Format:** `n stuck in aisle 4` · `note: …` · `jot: …` · `memo: …`
- **Forms / aliases:** `n`, `note`, `jot`, `memo`, `day note`, `daynote`, `dnote`
- **Does:** Append a note onto the activity block covering *now* (or scoped with `n loc:` / `n mood:` / `n activity:`).

### `day:`

- **Format:** `day: tired` · `daynote: …` · `n day: …`
- **Forms / aliases:** `day:`, `daynote`, `dnote`, `day note`
- **Does:** Tracking day jot (append log). Bare `day` expands to `today`.

## Sleep

### `sleep:`

- **Format:** `sleep: 11:30-7:00` · `slept: …`
- **Forms / aliases:** `sleep`, `slept`
- **Does:** Log bed/wake on the current morning key in the sleep store.

## GPS / Live Location

### `gps:`

- **Format:** `gps: Home` · `geo: …` · Telegram location / Live Location
- **Forms / aliases:** `gps`, `geo`
- **Does:** Paint Location from a place name and/or lat,lon. Same place stays quiet. Arrive/Leave Shortcut sends gps: lines.

## iPhone Screen Time

### `screen:`

- **Format:** `screen: Instagram 30m` · `screentime: …` · `iphone: …` · `ios: …`
- **Forms / aliases:** `screen`, `screentime`, `phone-screen`, `iphone`, `ios`
- **Does:** iPhone Screen Time interval (estimated). Not Mac ActivityWatch. Shortcut available.
- **Note:** `iphone-notes:` still wins over bare `iphone` when that longer alias matches.

## iPhone Calls

### `call:`

- **Format:** `call: Jane 12m` · `called: Mom 3:02-3:17` · `phone-call: …`
- **Forms / aliases:** `call`, `called`, `phone-call`
- **Does:** iPhone Calls interval (who + duration or clock window). Estimated.

## iPhone Texts

### `text:`

- **Format:** `text: Jane on my way` · `sms: …` · `imessage: …` · `sent: …`
- **Forms / aliases:** `text`, `sms`, `imessage`, `sent`
- **Does:** iPhone Texts instant. First word is who; the rest is the body.

## iPhone Notes park

### `iphone-notes:`

- **Format:** `iphone-notes:` body · `iphone-notes 2/3:` continuations · `inotes:` · `phone notes:`
- **Forms / aliases:** `iphone-notes`, `iphone notes`, `phone notes`, `inotes`
- **Does:** Park an On My iPhone note dump onto Lists → iPhone Notes Store → Parked (header Phone Notes). Not the tracker `n` jot.

## Pinned grocery card

### `pin`

- **Format:** `pin` · `live` · `snapshot`
- **Forms / aliases:** `pin`, `live`, `snapshot`
- **Does:** Refresh the pinned grocery card (and a one-line now) without changing items.

## Pantry / inventory

### `inv`

- **Format:** `inv` · `inventory` · `pantry` · `inv oats`
- **Forms / aliases:** `inv`, `inventory`, `pantry`
- **Does:** Dump the pantry list, or bump a line's quantity.

## Receipt OCR

### `receipt`

- **Format:** Photo of a receipt · caption `receipt:` / `slip:`
- **Forms / aliases:** `receipt`, `reciept`, `slip`
- **Does:** Local OCR → grocery check-off + pantry bump. Asks when a name is new.

## Journal / PDF scan

### `journal`

- **Format:** Journal photo(s) · caption `journal:` / `notebook:` / `pages:` / `scan:`
- **Forms / aliases:** `journal`, `notebook`, `pages`, `scan`
- **Does:** Deskew + searchable text → Docs note in folder From phone (optional PDF).

### `pdf`

- **Format:** Forward a PDF · optional caption `pdf: title`
- **Forms / aliases:** `pdf`
- **Does:** Park a PDF as a Docs item (typed `pdf:` alone needs the file).

## Read-back & status

### `where`

- **Format:** `where` · `status` · `now` · `working now`
- **Forms / aliases:** `where`, `status`, `now`, `working now`
- **Does:** Snapshot: location, activity, mood, working now, last night's sleep, inbox count.

### `read:`

- **Format:** `read: grocery list` · `show: Groceries` · `dump: chores` · `peek: …`
- **Forms / aliases:** `read`, `show`, `dump`, `peek`
- **Does:** Dump a named list or folder as plain text. Grocery-ish dumps also pin. `read list: Name` / `read folder: Home` when the name is shared. Matches nothing → parks on iPhone Notes Store (not a picker).
- **Note:** Whole-message `read 30 pages` is a habit keyword when configured, not this verb.

### `lists`

- **Format:** `lists` · `ls`
- **Forms / aliases:** `lists`, `ls`, `list of lists`, `list lists`
- **Does:** Catalog of lists grouped by folder, with open counts. Bare `list:` is still a capture path.

### `folders`

- **Format:** `folders` · `dirs`
- **Forms / aliases:** `folders`, `dirs`, `list of folders`, `list folders`
- **Does:** Catalog of folders. Bare `folder:` is still a capture path.

### `read inbox`

- **Format:** `read inbox` · `show inbox` · `dump inbox`
- **Forms / aliases:** `read inbox`, `show inbox`, `dump inbox`, `open inbox`
- **Does:** Dump Inbox, newest first, then Monkey brain if any. Bare `inbox:` still captures. -mb / -monkey on a capture dumps it in Monkey brain.

### `search:`

- **Format:** `search: milk` · `find: oats` · `? oat`
- **Forms / aliases:** `search`, `find`, `?`
- **Does:** Ranked item search across the vault.

### `today`

- **Format:** `today` · `tdy`
- **Forms / aliases:** `today`, `tdy`
- **Does:** Snapshot: inbox count, habit %, location/activity, working now, today's plan.

### `ops`

- **Format:** `ops` · `operations`
- **Forms / aliases:** `ops`, `operations`
- **Does:** List operation names.

### `count`

- **Format:** `count` · `count: grocery`
- **Forms / aliases:** `count`, `counts`
- **Does:** Open-item sizes overall, or for a named list.

### `tags`

- **Format:** `tags`
- **Forms / aliases:** `tags`
- **Does:** Item tags in use.

## Built-in one-letter expansions & custom shortcuts

### `day`

- **Format:** `day` alone → today · `day tired` → `n day: tired`
- **Forms / aliases:** `day`
- **Does:** Built-in expansion.

### `(custom first-word shortcuts)`

- **Format:** e.g. `store` → `groc` (first token only; letters/digits/_/-)
- **Forms / aliases:** `Settings → Message ingest shortcuts`
- **Does:** User-defined first-word expansions run before the verb parser. Expansions that still point at bare `g` are remapped to `groc`.

## Media (photos / voice)

### `(voice note)`

- **Format:** Send a voice note during `gm` affirmations
- **Forms / aliases:** `Telegram voice`, `Telegram audio`
- **Does:** During an open morning ritual, a voice/audio message advances the step (counts as an answer). Outside a ritual, BIM acknowledges and suggests `gm`.

### `(photo)`

- **Format:** Snap a receipt or journal page (optional caption)
- **Forms / aliases:** `Telegram photo`
- **Does:** Routes to receipt OCR or journal scan based on caption / heuristics.
