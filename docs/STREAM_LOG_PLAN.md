# Stream-log plans — eleven ideas from the October logs

_Last mapped: 2026-11-02_

**Planned.** Nothing in this file is built yet. Each section is one idea from the stream-of-consciousness logs (sorted in [`IDEA_STATUS.md`](IDEA_STATUS.md)). Each one says what you asked for, what already exists to build on, the smallest true shape, the steps, and when it is done.

Work order is [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 16. Suggested order: 1 and 7 first (7 is the one marked **!!!**), then 2, 5, 8, 6, 3 with 4, 9, 10, 11. Sections 3–4, 7, 9, and 11 have their own full plans, linked in each section. Sections 1 and 2 touch the same parsers, so give them to one person or do them one after the other.

---

## 1. Text misreads: `now`, `with`, `alone`, and friends

**You asked.** Stop `now` firing when you did not mean it. A `with` keyword for company, and a way back, so "alone" and "with" inside a normal sentence are not read as commands. Also from the logs: do not eat "probs"; stop mixing 8 am and 8 pm (no clock guess unless `@` is used); drop the bare `text` shortcut and most prefix-less verbs; Quick Add and text shorthand should be one language.

**Exists.**
- `lib/ingest/parse-message.ts`: bare `now` / `status` / `where` is the status readout; `/now` is Now capture. Most verbs already need a colon (`cycle:`, `get:`).
- `lib/ingest/name-resolve.ts`: `with` is a glue word that never carries a fuzzy hit alone.
- Company today is `switch: company Elijah`.
- `lib/smart-parse.ts` is the Quick Add parser. Each chip has a hover × that skips that span.
- The Telegram feed keeps every text you sent (`lib/ingest/telegram-feed-store.ts`). That is the test corpus.

**Shape.** One rule for both doors: a word acts as a command only at the start of a line with a colon or a slash, or when it is the whole message (`now`, `status`, a habit phrase). Inside a sentence it is plain text. Two tail words are allowed:
- `with Elijah` / `with Becca and Matt` at the end of an activity line attaches Company for that block.
- `alone` as the last word sets Company to nobody for that block.

Everything the parser read is echoed back as chips, the same as Quick Add. `back` (or `undo`) as the next message reverses the last parse.

**Steps.**
1. Mine the Telegram feed for lines whose parsed kind was not what you meant. Save them as fixtures in `lib/ingest/parse-message.test.ts`, each with the kind you wanted.
2. Tighten `parse-message.ts` until the fixtures pass. Keep a list of the whole-message keywords in `lib/ingest/command-catalog.ts`.
3. Add the `with` / `alone` tail to activity lines. Reuse `name-resolve.ts` for the names.
4. Add `back` / `undo` for the last BIM write (the store writes already go through `action-history`).
5. Clock words: a bare `8` or `8:30` is not a time unless `@8`, `8am`, `8pm`, or `20:00` is written. Same in `smart-parse.ts`.
6. Remove the prefix-less `text` shortcut. Words like "probs" stay in the text.
7. One shorthand table for Quick Add and BIM, generated into `docs/BIM_COMMANDS.md` and the Quick Add Shorthand help.

**Done when.** Every fixture from the feed parses as you meant. `with` and `alone` only act at the tail of an activity line. `back` reverses one write.

---

## 2. Several dates in one capture

**You asked.** One capture can carry many dates, each tied to a different part. Your example: "my birthday is May 5 and I have a paper due in a week and I think it'll take me between 10m and 20m but I need to warm up today." That should give five tags: a plain date, a due date, a duration range, and a scheduled day, each on the right part.

**Exists.** `SmartSuggestion` in `lib/smart-parse.ts` holds one of each: `attachedDate`, `scheduledDate`, `deadline`, `scheduledTime`, `estimatedDuration`. The first match wins. Tasks already have PERT fields (optimistic / likely / pessimistic) with no capture UI.

**Shape.** The parser returns a list of spans instead of first-wins fields: `{ kind, value, text range, clause }`. `kind` is attached date, scheduled day, deadline, time, duration, or duration range. The clause is the words around the span ("paper due in a week", "warm up today"). The old single fields stay, filled from the first span of each kind, so nothing else breaks.

Each span is a chip. Each chip has a target: the item, or a new step made from its clause. Defaults: the first deadline and duration go to the item; a date inside "my birthday" is a plain attached date; "warm up today" becomes a step scheduled today.

**Steps.**
1. `parseSmartCapture` collects all spans, not the first of each kind. Fixtures with your example.
2. Read "between 10m and 20m" as a range: optimistic 10, pessimistic 20.
3. Quick Add shows one chip per span with a target picker (item / new step).
4. The write puts each span on its target.
5. BIM uses the same parser for captures.

**Done when.** Your example gives five chips and writes them to four places: item date, item deadline, item estimate range, and a "warm up" step today.

---

## 3. Three pages (no flag)

**Full plan: [`WRITING_PLAN.md`](WRITING_PLAN.md) Part 1.** Changed 2026-11-02: there is no `-3p` flag. Three pages is a folder in Docs with a doc per day, tied to the daily "Write at least 3 pages" habit by page count. Journal scans can be filed as a day's pages. Google Docs import brings the old ones in.
---

## 4. Who wrote it, and 100% human

**Full plan: [`WRITING_PLAN.md`](WRITING_PLAN.md) Parts 2 and 3.** Any passage is marked `me`, `model`, `person:<id>`, or `copied` (with a source). Long hand-typed text is auto-tagged `me` and offered for a separate **100% human** document, opt-in only, kept apart from Three pages.
---

## 5. Objectives: auto-tag and a timeline of each sitting

**You asked.** When an objective is completed, tag it, store the time on the step, and compare that to the estimate, the way Tidy keeps completion data. For one sitting, see the whole timeline: each objective, when it was created, and when it was marked complete. Also from the logs: marking an objective done sometimes lags badly while the pen clock is running.

**Exists.** `lib/now-objective.ts`: each objective has `addedAt`, `completedAt`, `stintStartedAt`, a lane (Now / Next), and an optional `stepId`. Steps store `actualDuration` and `completedAt`. The end-of-sitting sheet lists objectives with minutes. The Time tab shows each block's objectives.

**Shape.**
- **Auto-tag.** On complete, an objective with a `stepId` adds its stint minutes to that step's actual. One without a `stepId` suggests the closest step by title on the clock's task. One tap accepts it; nothing is attached silently.
- **Timeline.** One horizontal track for the sitting, in the end-of-sitting sheet and on the Time tab block. Each objective is a bar from `stintStartedAt` (or `addedAt`) to `completedAt`. Next-lane waiting is hatched and does not count. Each step shows estimate against actual.

**Steps.**
1. Profile the lag first: completing an objective with the pen clock running, in a narrow window too (the logs saw twitching at one window size).
2. The step write on complete, with a test on `now-objective`.
3. The title-match suggestion.
4. The timeline component, shared by the sheet and the Time tab.
5. Data: estimate against actual per step over a range (the calibration view in `docs/analytics-plan/08-cross.md`).

**Done when.** A sitting shows every objective on one timeline, and each completed objective has added its minutes to a step.

---

## 6. Bare minimums you can clear in more than one way

**You asked.** A tier can be cleared several ways. Hemisync counts at 10 seconds of a tape. Cleaning counts at 1 minute. Reading counts as opening a random page and reading passages five times, or reading one page. Drinking water counts as any water. Then a regular goal, then an exceptional level with extra points. Show this only in an optional advanced view so the screen stays calm for others.

**Exists.** `lib/completion-tiers.ts` has bare minimum / goal / exceptional as quantity thresholds and point amounts. Steps have B / G / E tiers (`lib/step-tiers.ts`). Habit cells open a detail view on double-click.

**Shape.** A tier holds a list of ways. Any one way clears it. A way is a duration (≥ 10 s), a count (5 passages), a quantity (any water), or a plain check with words ("open a random page"). One number stays one way, so every current habit is unchanged.

**Steps.**
1. `ways` on the tier type, read by the existing threshold math. Old tiers read as one way.
2. Habit form: an **Advanced** switch (off by default) that shows ways per tier.
3. Cell detail: pick which way you did; the tier lights.
4. Exceptional keeps its extra points from the existing point amounts.
5. BIM: `habit: reading 1 page` matches the way by its words.

**Done when.** Reading can be cleared by either of its two bare-minimum ways, and a habit without the advanced switch looks exactly as it does now.

---

## 7. Named events as moving due dates **!!!**

**Full plan: [`NAMED_EVENTS_PLAN.md`](NAMED_EVENTS_PLAN.md).** The summary below is kept for the wave; the full plan wins where they differ.

**You asked.** Discrete events with names, past or future: Elijah comes home, Elijah went to bed, Claude resets, the portal opens, the store opens. Use them as due dates that move when the event moves. Make lists of what must be done before a named event. Analyze repeating named events ("how much later do I go to bed than Elijah?"). Stats on planned events, like doctor's appointments or concerts, including how far in advance they were planned. Your example: add "frog concert with Becca" to Plan and have it tracked when it happens.

**Exists.**
- Plan events (`lib/event-store.ts`) are the prospective side. Countdown widgets read a Plan event (`lib/home-days-until-event.ts`), and BIM can create the event and countdown from text.
- Discrete events on Tracking are ticks at a minute (`lib/ingest/apply-discrete-event.ts`, `log:`).
- [`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md): a plan is drawn beside what happened and never merged into it.

**Shape.** A **named event** is a name with instances. A planned instance is a Plan event; a lived instance is a Tracking tick. They pair by name, and the pair is a bridge (compare), never a merge.
- A task's due can point at an instance (`due: { eventId }`). When the event moves, the due moves.
- A **Before …** list is bound to the next instance of a name and shows its countdown.
- A text like `log: Elijah home` lands as the lived instance and pairs with today's planned one, if there is one.
- A repeating name gets stats: average time, spread, and the gap to another name ("you go to bed 48 min after Elijah, median").
- A planned instance keeps when it was created, so lead time ("planned 23 days ahead") is a fact.
- An instance can carry Company. "Frog concert with Becca" is a Plan event with Becca. When its time comes, BIM asks "at the concert?", and yes paints the block with that company.

**Steps.**
1. The named-event type: name, aliases, repeat, and the pairing rule. Store it beside `event-store`.
2. `due: { eventId }` on tasks, read wherever due dates are read (To do, Scheduler, rituals look-ahead).
3. **Before …** lists (a list setting bound to a name).
4. Lived instances from `log:` / discrete events, paired by name.
5. Data: a Named events view with averages, gaps between two names, and planned lead time.
6. Planned-event prompts: when a planned event starts, BIM asks; a yes paints the block.

**Done when.** A task due "before Elijah comes home" moves when that event moves. Texting `log: Elijah home` records the lived time beside the planned one. Data answers how much later you go to bed than Elijah.

---

## 8. Rename or merge a person, and every record follows

**You asked.** Renaming a person anywhere renames them everywhere (to fix "unknown girl"). Merging two entries, for example one person with several numbers, counts every message as one person under one name. Text analytics should show when a new person was created and add them, so you do not keep clicking. Later, connect a topic to a person.

**Exists.** People are items (`lib/person-types.ts`, `lib/people-sync.ts`). Numbers and handles link through `lib/phone-person-links.ts` and `lib/instagram-person-links.ts`. The texts report already merges inside its own data (`docs/TEXTS_ANALYTICS_PLAN.md`). Known issue: the call pen is keyed by name (`iphone-call-<slug>`), so a rename starts a new pen (`docs/PHONE_SYNC_PLAN.md`).

**Shape.** Every record points at a person id, never a name. Each person has an alias table: names, numbers, emails, Instagram usernames. A rename changes the display name only. A merge moves the aliases to one person and leaves a redirect from the old id, so old rows still resolve.

**Steps.**
1. The alias table on the person item, filled from the existing phone and Instagram links.
2. Key the call pen and the text pens on the person id. A one-time pass rewrites old pens through the alias table.
3. Merge in People: pick two, choose the name, confirm. Company blocks, Instagram lists, and Tracking pens follow.
4. The texts report reads the alias table, so its merges and Brain2's are the same.
5. Text analytics marks a person created this session and adds them to People I know.
6. Later: link a topic to a person.

**Done when.** Renaming "unknown girl" to a real name changes Tracking, People, calls, and the texts report. Two numbers merged into one person show one set of totals.

---

## 9. Period summary, with songs and photos

**Full plan: [`PERIOD_SUMMARY_PLAN.md`](PERIOD_SUMMARY_PLAN.md).** The summary below is kept for the wave; the full plan wins where they differ.

**You asked.** A summary of any period: most-played songs with your comments on them (what you like, how they make you feel), photos from that time, events, location and activity facts, outfits, company, a color palette if you give one, symbols you noticed, and the day, week, and month summaries. If the month has no written summary yet, this is where you write it. View it in **Data**. Add and edit it in **Rituals**.

**Exists.**
- Data → Meta → **Research report** gives a plain rundown of the shared range (`components/Analytics/meta/research-report.ts`).
- Rituals already walk the week, month, season, and year (`docs/RITUALS_REDESIGN.md` Phase 6). `day:` appends to that day's summary. Plan keeps written logs per period.
- Places, Company, Inventory outfits, and media photos are all stored.
- Spotify login is built, but no listening history is read yet (`docs/SPOTIFY_LISTENING.md`, Planned).

**Shape.** One summary record per period key (day / week / month / season / year), with two doors.
- **Data → Summary** (view). On the shared range, it reads plates from the stores: top songs, photos, events, places, activity, outfits, company, and your written summaries. A plate appears only when it has rows, like the Research report.
- **Rituals → Summary step** (edit). In end-of-week, month, and season walks, it shows the same plates. It asks for what is missing: the written summary, a note on each top song, a palette, and symbols.

**Steps.**
1. The summary record and its store, keyed like the ritual periods.
2. The Data view, reusing the Research report's plate-on-floor rule.
3. The ritual step, writing to the same record.
4. Songs: build the Spotify readers first (recently played on a schedule, plus the extended-history import). Song notes are stored per track per period.
5. Photos: from media ingest and Inventory outfits, by date.
6. Palette and symbols as plain fields; a palette can be picked from the period's photos.

**Done when.** October has one summary page in Data with songs, photos, places, company, and your written month summary, and the month-end ritual can edit it.

---

## 10. Email watch and an email cleaner

**You asked.** Connect email. **Watch** for one email you are waiting on (for example the Instagram "your information is ready" mail to your address) and get notified in the app and by Telegram when it arrives, Zapier-style. An **email cleaner** module. Emails that need a reply should sit with texts and DMs in correspondence reminders. A second Gmail account may help.

**Exists.** [`phone-sync/05-screen-dms-email.md`](phone-sync/05-screen-dms-email.md) plans an IMAP reader on the hub, with a Gmail app password kept on the Mac, and only from, to, subject, and time stored by default. [`INSTAGRAM_DATA_SOURCES.md`](INSTAGRAM_DATA_SOURCES.md) lists ways to watch for Meta's email. BIM already sends Telegram messages.

**Shape.** One mail reader (IMAP, any account, so a second Gmail works) with three uses:
- **Watch.** A rule is a sender and/or subject words, made by text (`watch: email from instagram`) or in Settings. When a match arrives, BIM texts you and the app raises a notification. The rule closes after one match unless it repeats.
- **Cleaner** (a module). Senders grouped by count and last date, with the `List-Unsubscribe` link and bulk archive. Each batch is confirmed; nothing is deleted.
- **Needs a reply.** Mail from a person in People can join the texts-to-send list.

**Steps.**
1. The IMAP reader in the hub (`lib/phone-sync/email.ts`, `scripts/email-reader.mjs`), metadata only, password in the keychain.
2. Watch rules and the Telegram notice.
3. The cleaner module on the module platform, with confirm-per-batch writes.
4. Needs-a-reply rows beside texts.

**Done when.** A watch for the Instagram export email texts you within minutes of the email arriving, and the cleaner can group and archive one sender's mail after you confirm.

---

## 11. Printable booklets and reMarkable sync

**Full plan: [`PAPER_LOOP_PLAN.md`](PAPER_LOOP_PLAN.md).** The summary below is kept for the wave; the full plan wins where they differ.

**You asked.** Printable, scannable to-do lists, checklists, and habit sheets, even a small folded booklet, with tracking dots so scanning is fast. Write and tick by hand, scan, and it lands in Brain2. Later, the same pages on a reMarkable (a "common book"): check things off on the tablet and sync over Wi-Fi. Make sure it works before replacing anything.

**Exists.** Photos and PDFs sent to BIM are routed by caption (`lib/ingest/apply-media.ts`); scans park as Docs notes (`lib/ingest/apply-scan-doc.ts`) with local OCR (`lib/ingest/ocr.ts`). Docs can export (`lib/doc-export.ts`).

**Shape.** A page generator and a page reader that share one page code.
- **Print.** A PDF of today's or this week's to-dos, habits, a checklist, or blank three pages. Each page has corner marks and a small code naming the page and its rows. A booklet option lays pages out to fold.
- **Scan back.** The scan door finds the code, reads each box as ticked or not (box detection, not OCR), and reads free writing with OCR. A confirm sheet shows every change before it is written.
- **reMarkable.** The same PDF goes to the tablet, and the annotated PDF comes back through the same reader. Start with the tablet's USB web interface, by hand. Automate it only once a week of paper has round-tripped cleanly. No jailbreak in the first slice.

**Steps.**
1. Page code and layout for one daily to-do sheet.
2. The reader for that sheet: ticks to rows, with a confirm sheet.
3. Habits sheet, checklist sheet, and three-pages sheet.
4. Booklet layout.
5. Handwriting OCR on free text, routed like journal scan.
6. reMarkable round trip, by hand first.

**Done when.** A printed daily sheet, ticked by pen and photographed, marks the right tasks done after one confirm.
