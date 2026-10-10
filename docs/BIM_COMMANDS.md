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
- **Does:** Smart-capture into Inbox (same path as desktop Quick Add). `list: item` and `folder: list: item` create the list if needed. Dates, times, duration, and priority are read and left in the title. End with -mb or -monkey to dump it in Monkey brain. -p or -plain stores the line as written and detects none of that.

### `(plain text)`

- **Format:** `pick up milk`
- **Forms / aliases:** `(any message with no verb)`
- **Does:** Prefix-less text that is not a list dump becomes an Inbox capture. Colon paths create the list. Dates, times, duration, and priority stay in the title. -mb or -monkey on the line sends it to Monkey brain. -p or -plain stores the line as written.

## Bulk add & list dumps

### `bulk`

- **Format:** `bulk:` then headers and one item per line
- **Forms / aliases:** `bulk`, `bulk add`, `bulkadd`
- **Does:** Bulk Add pipeline (Inbox off). Headers `list:` / `folder: list:` / `Home: Groceries:` work. Grocery names with no other folder use the store list. Dates, times, duration, and priority on an item line stay in the title. -p or -plain on a line stores that line as written.

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

### `dh:`

- **Format:** `dh: hemisync` · `dh: read 30 pages` · `dh: chess score 355`
- **Forms / aliases:** `dh:`
- **Does:** Habit keyword. The phrase after dh: is the existing whole-message keyword. Bare keywords are not logged.

## Discrete event log

### `log:`

- **Format:** `log: left room` · `log: left room at 3:30` · `log: left room at 3:30 loc: home` · `log: shower 7:30 - 7:45` · `log: shower 10m` · `log: START walk` · `log: END walk 5:00` · `log: went outside 12:04` · `log went outside 7/4/26 1:00`
- **Forms / aliases:** `log:`, `log-`, `log`
- **Does:** Tracking note on Activity, the Event row of the Tracking log. The word log works with or without the colon. No time → point at send time. `at 3:30` is a point on the send date. `7:30 - 7:45` is a range. `10m` / `10 min` just finished (end = send time). START/END pair an activity. A line under the event is the note; the clock stays on the first line. A later block over that minute leaves the point. Times use the machine timezone. A clock with no certainty word is exact (`clockCertainty` omitted). `est` / `estimated` / `~` marks the time estimated and also sets `precision: estimated`. `unknown` keeps the named minute for placement and does not treat it as observed. Put the word after the clock, or after the place. Trailing `loc: home` reuses or creates that Location pen and paints a Location instant at the same minute (`log: left room loc: home`, `log: left room at 3:30 loc: home`). The place is the last suffix. The event phrase is stored as the title and as `eventKind`, a lowercase slug with spaces collapsed and punctuation removed, so the same phrase groups (`left room`). Saved keywords, added in Tracking settings (the gear), match the longest phrase (`log: went outside`, `log went outside 12:04`, `log: went outside 7/4/26 1:00`). The remainder is the optional date and time, not part of the title. The title is the saved phrase and `eventKind` is its slug. A bare phrase with no log prefix is not a log. On a log line, a clock with no am/pm is military time: `12:04` is noon, `18:37` is 6:37pm, and `1:00` is 1:00am, not 1pm. `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 1:00pm. `7/4/26` and `7/4/2026` are July 4, 2026 (month/day/year). Log lines, switch lines, and tracking-note clocks share that reader (`parseExpectedWhen`). Ordinary inbox text is not parsed this way. Labeled from text pipeline. Bare `o` is NOT a log.

### `tp:`

- **Format:** `tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix` · `TP: …` · `thought process: …` · `log: tp: …`
- **Forms / aliases:** `tp:`, `TP:`, `thought process:`, `log: tp:`
- **Does:** Thought process: a guiding strand of this moment, from what you are doing, to what it leads to, to how it feels. Why you are doing something, what you expect to do next, and how it lands. Not a general note, a one-word mood, or a short activity log such as brushed teeth. Colon required on the verb, so bare `tp` and bare `thought process` stay capture. Activity instant on the Text log pen, `eventKind` `thought-process`. The first line is the title; lines under it are the note. No time uses the send time. Clocks are `parseExpectedWhen`, the same reader as a log line. A bare clock is military (`1:00` is 1:00am, `12:04` is noon). `1pm`, `1:00 PM`, and `1:00 p.m.` are 13:00. `7/4/26` is July 4, 2026. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` keeps the minute for placement. A general note stays `note:` / `n`.

### `log keywords`

- **Format:** `log keywords` · `log: keywords`
- **Forms / aliases:** `log keywords`, `log: keywords`
- **Does:** Numbered list of saved log keywords. Does not create a log row. Phrases are added in Tracking settings (the gear) and start empty. A saved phrase is logged with `log: went outside` or `log went outside` (colon optional). A clock or US date after the phrase is the time, not part of the title. Longest saved phrase wins. A bare phrase with no log prefix is not this log. On a log line, a clock with no am/pm is military time (`12:04` noon, `1:00` is 1:00am, `1pm` is 1:00pm). Log lines, switch lines, and tracking-note clocks share that reader (`parseExpectedWhen`). Ordinary inbox text is not parsed this way.

### `intake:`

- **Format:** `intake: coffee` · `intake food: egg salad` · `intake drink: coffee at 8:15` · `intake drug: tablet est` · `intake: coffee at 8:15 unknown`
- **Forms / aliases:** `intake:`, `intake food:`, `intake drink:`, `intake drug:`
- **Does:** Food, drink, medicine, or any intake — the Intake row of the Tracking log. Food is a subset of intake. Always a point — no duration. Pen: Intake. No time uses the send time. A following clock uses that time on the send date. `intake food:` / `intake drink:` / `intake drug:` set `intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`. Bare `intake:` leaves `intakeClass` unset and sets `eventKind` to `intake`. A clock with no certainty word is exact. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` stores the minute for placement only. A line under the event is the note. `ate` / `drank` / `took` keep the Text log pen and set the same class. Vertical line on the Tracking grid. A later block leaves the point.

### `switch:`

- **Format:** `switch: location from: home to: ralphs` · `switch: activity from: working on brain2 to: working on foxtide 6:37pm` · `switch: company Elijah` · `switch: to cleaning` · `switch: from email to cleaning`
- **Forms / aliases:** `switch:`
- **Does:** Switch. The colon sits right after `switch`. The next word is the Tracking view when it names one you have (Activity, Location, Mood, Company, …). Omit it and the view is Activity (`switch: to cleaning`, `switch: from email to cleaning`). `from:` is what you left and `to:` is the destination; a bare name after the view is the destination (`switch: company Elijah`). Optional clock, else the send time. The clock and date are `parseExpectedWhen`, the same reader as a log line and a tracking-note clock. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37, `1:00` is 1:00am). `6:37pm`, `6:37 PM`, `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 13:00. A bare integer is not a clock. Optional `7/4/26` or `7/4/2026` is month/day/year on the local calendar; a date with no clock keeps the send clock. `at` marks the clock and is not part of the destination. Ordinary inbox text is not parsed this way. `est` / `estimated` / `~` is estimated. `unknown` keeps the minute for placement. Activity stores the same instant as `st:`: pen Switch, title `started …` or `stopped … · started …`, plus `switchFrom` / `switchTo`. Any other view paints an instant on that scope. `to` is that scope’s pen (existing name, or created the way that view adds a pen). `from` is found or created the same way and stored; the tick’s color is the destination. There is no Goal view.

### `log categories`

- **Format:** `log categories` · `log: categories`
- **Forms / aliases:** `log categories`, `log: categories`
- **Does:** Reply only. A numbered list of the tracking views in the store: display name, the id you type after `switch:`, and `depth N` when that view’s display depth is set. Not a logged event.

### `st:`

- **Format:** `st: cleaning` · `switch task: cleaning at 3:30` · `st: from: email to: cleaning`
- **Forms / aliases:** `st:`, `switch task:`
- **Does:** Alias of Switch on Activity. `st:` or `switch task:` (colon required). Same stored instant as before: pen Switch, title `started …` (or `stopped … · started …` when from: is present). `switchFrom` / `switchTo` are filled on new rows; older rows omit them. Optional clock, else send time. `est` / `estimated` / `~` is estimated. `unknown` keeps that minute for placement.

### `so:`

- **Format:** `so: read` · `switch objective: read at 8:00 est` · `switch goal: read`
- **Forms / aliases:** `so:`, `switch objective:`, `switch goal:`
- **Does:** Alias. There is no Goal view. `so:`, `switch objective:`, or `switch goal:` (colon required) still writes the Objective pen on Activity, title `objective …` (or `left … · objective …`). `switchFrom` / `switchTo` are filled on new rows. Same clock words as `st:`.

### `transit:`

- **Format:** `transit: from: home to: the store` · `transit: the store`
- **Forms / aliases:** `transit:`
- **Does:** Location change as a tracking note. Unlabeled text is to. Optional time, else send time. The same clock words as `st:`: exact unless `est` / `estimated` / `~` or `unknown`.

### `smoked weed`

- **Format:** `smoked weed` (whole message)
- **Forms / aliases:** `smoked weed`
- **Does:** Default discrete-event trigger (editable in Settings → Message ingest).

### `drank water`

- **Format:** `drank water` (whole message)
- **Forms / aliases:** `drank water`
- **Does:** Default discrete-event trigger. Sets `intakeClass` drink and `eventKind` `intake.drink`. Pen stays Text log.

### `ate {item}`

- **Format:** `ate egg salad`
- **Forms / aliases:** `ate …`
- **Does:** Default discrete-event trigger with `{item}` slot. Sets `intakeClass` food and `eventKind` `intake.food`. Pen stays Text log.

### `took {item}`

- **Format:** `took 2 adderall`
- **Forms / aliases:** `took …`
- **Does:** Default discrete-event trigger with `{item}` slot. Sets `intakeClass` drug and `eventKind` `intake.drug`. Pen stays Text log.

### `cycle:`

- **Format:** `cycle: bleeding` · `cycle: spotting` · `cycle: ovulation` · `cycle: bleeding off`
- **Forms / aliases:** `cycle:`
- **Does:** Set bleeding, spotting, or ovulation on the message's local calendar day. The same flag plus `off` clears it. Spotting is stored and does not change the derived phase. Colon required — bare cycle is not this command. A calendar mark, not medical advice.

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

## Rituals (GM / night / start / end)

### `gm`

- **Format:** `gm` · `good morning`
- **Forms / aliases:** `gm`, `good morning`, `goodmorning`
- **Does:** Start the day morning ritual (sun) over text. Opens with last night's wake-up reminder, what matters most, and focus goals when those were saved. Then sleep (or all nighter) → 5 affirmations one-at-a-time → to-do add (lines and/or rm 1 3) → required tasks (a line of only comma-separated numbers, like 1,8 or 1, 8, selects those indexes; any other line is a new to-do) → 3–5 priorities → 1–3 habit priorities → go through each to-do (six slots: tier duration points importance resistance excitement; the last three are 0–10 and may be decimals; a bad line stays on that same item; SKIP skips one; SKIP ALL skips the rest) → plaintext day plan → circumstance branches (must-not, events, excitement) → best day → 10 gratitude. Answers save as you go. If today already has some, gm asks 1 start over, 2 continue, 3 jump (that menu only). Shortcuts stay off until STOP. Live Location is paused until the ritual ends, then the same Telegram share resumes.

### `gn`

- **Format:** `gn` · `good night` · `night`
- **Forms / aliases:** `gn`, `good night`, `goodnight`, `night`
- **Does:** Start today's night ritual (moon) over text. Unfinished (done / push / why blocked, including other plus a note) → assumed times → how the day was spent → summary → gratitude → plan reflection → went well / improve / learned → wake-up reminder → what matters most tomorrow → goals to focus → tomorrow's plan. Week and longer reviews add the period stats and the longer reflection questions before the summary. cancel quits. A walkthrough answer is not a log.

### `all nighter`

- **Format:** Reply `all nighter` at the first sleep question
- **Forms / aliases:** `all nighter`, `all-nighter`, `all nighters`
- **Does:** Marks the night as an all-nighter and lifts habits that carry an all-nighter block (bedtime the evening before, wake and dream that morning, unless those blocks were edited). The morning routine continues.

### `skip`

- **Format:** `skip` or `next` · a blank message on period review
- **Forms / aliases:** `skip`, `pass`, `next`, `blank`, `empty`, `n/a`, `na`, `-`, `.`, `—`, `(empty message)`
- **Does:** Advance a ritual step without an answer (morning, night, start, or end). Morning review moves on skip or next and leaves that question empty; a blank message waits. Live Location is paused while a text ritual is open and resumes on the next edit after it ends. Period review still treats a blank message as skip.

### `rituals`

- **Format:** `rituals` · `reviews`
- **Forms / aliases:** `rituals`, `reviews`
- **Does:** Rituals board: every available/undone slot (morning, night, start, review) with status, the Telegram command to open it, and the in-app path (Header → Rituals).

### `review`

- **Format:** `review` · `ritual` · `review today` · `review day|week|month|quarter|year` · `ritual start week|month|quarter|year` · `ritual end week|…` · `ritual morning` · `ritual night`
- **Forms / aliases:** `review`, `ritual`
- **Does:** Open a ritual. Bare review/ritual starts the first available/undone slot. review <period> / ritual end <period> = end/review for the just-ended period. ritual start <period> = plan the current period, including required: 1, 8 and priority: 2 on assigned tasks. review today / ritual night = today's night (moon). ritual morning = same as gm.

### `cancel`

- **Format:** `cancel` · `quit` · `nevermind`
- **Forms / aliases:** `cancel`, `quit`, `nevermind`, `never mind`
- **Does:** Stop a night / start / end ritual in progress. Morning ritual ignores cancel — send STOP in all caps to quit and save.

### `STOP`

- **Format:** `STOP` (all caps, the whole message)
- **Forms / aliases:** `STOP`
- **Does:** Quit the morning ritual and keep every answer so far. Shortcuts turn back on. Lowercase stop is a normal reply. Text gm afterward to start over, continue, or jump.

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
- **Does:** Paint Mood scope until further notice, any word. The Tracking card holds the full report; a message does not fill it.

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

- **Format:** `n stuck in aisle 4` · `note: left room at 8:15` · `note: left room at 8:15 est` · `jot: …` · `memo: …`
- **Forms / aliases:** `n`, `note`, `jot`, `memo`, `day note`, `daynote`, `dnote`
- **Does:** The Note row of the Tracking log: a Text log instant. No clock uses send time. `at 8:15` is that minute on the send date. A clock with no certainty word is exact. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` keeps that minute for placement. The first line is the title; lines under it are the note. Also appended onto the block covering that minute, including `n loc:` / `n mood:` / `n activity:` (those `loc:` words pick a scope, not a place on an event). `day:` stays the day jot and does not read a clock.

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

- **Format:** `gps: Home` · `gps-log:` · `at: 2026-10-05T19:04:00` · Telegram Live Location
- **Forms / aliases:** `gps`, `geo`, `gps-log`
- **Does:** Paint Location up to the sample time, never through the rest of the day. Same coordinates keep the current pen. A Telegram venue pin is a shared place, not where you are. A fuzzy fix does not move you. gps-log: replays lines the phone saved while offline. Message ingest hides these points unless you show GPS. A text ritual pauses Live Location and the same share resumes when that ritual ends.

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
