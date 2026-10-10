# Analytics vision — Tracking

This is a product design for an Analytics surface that reads **Tracking data only**. It is grounded in the records Tracking actually stores: minute intervals, pens, tags, day notes, cycle marks, sleep nights, counts, and the clocks those writers use. It does not describe any Analytics screen that already exists.

The question the surface should answer is not “how many charts can we draw.” It is: given a life recorded as parallel paintings of the same minutes, what structure is really there, which of it is observed, and which of it is a guess the logger left behind.

---

## 1. How time is stored

Tracking does not store slot arrays. One painted stretch is a `TimeEntry`: a local calendar day (`date`, `YYYY-MM-DD`), a view (`scopeId`), a primary pen (`penId`), and a half-open minute window. `startMin` is inclusive, `endMin` is exclusive, both minutes past **local** midnight. `09:00–10:00` is `{ startMin: 540, endMin: 600 }` and lasts 60 minutes. A day is `MINUTES_PER_DAY` = 1440. There is no timezone field. Cell sizes (1, 5, 10, 15, 30 minutes on the day grid; 15, 30, 60 on the week grid) are how the grid draws. They never regroup stored time.

An omitted `kind` is an **interval**. `kind: "instant"` is a discrete event at `startMin` with `endMin === startMin`, so duration is 0. Occupancy and untracked gaps ignore instants. Sunrise lines, “smoked weed,” a thought, a text, and a switch tick are instants. An interval may name instants as its edges (`startEventId`, `endEventId`).

A block that crosses midnight is **two rows** that share `spanId`. `23:00–02:00` is Thursday `1380–1440` plus Friday `0–120`. `00:00` as an end clock means the end of this day, not a wrap. An explicit later `endDate` can fill whole days in between (capped around 31 days in the slice helper). Analytics must treat `spanId` as one logical event and the rows as day-slices, or a night walk will be counted twice as two short days and never as one three-hour bout.

The vault is `brain2-timegrid-store` (persist v15): `scopes`, `tags`, `entries`, `removedEntryIds`, a mirror of `dayNotes`, `untrackedNotes`, `hiddenPenIds`, `confirmedEventIds`, `enableCycleTracking`, `cycleDetailsOpen`. Day notes’ source of truth is the separate append log `brain2-tracking-day-notes`. Cycle flags live in `brain2-cycle-marks`. Sleep statements live in the sleep store and are **copied** onto the grid as ordinary blocks. Screen Time, phone pings, text, GPS, and “working now” all end as the same `TimeEntry` shape, with different stamps.

### Counting rules any metric must obey

These are properties of the records, not chart preferences.

| Rule | What it means |
|---|---|
| Occupancy is a **union** | Two intervals on the same minute in the same scope (derived Sleep sitting on hand-painted Work is the usual case) count **once** toward “minutes tracked.” Summing `endMin − startMin` can report a 30-hour day. |
| Instants do not occupy | A tick at 18:37 does not fill 18:37. A day of only ticks is fully untracked. |
| Tags are a property of **time** | A pen’s `tags` mean “always.” `TimeEntry.tagIds` are extras on this block. `effectiveTagIds` unions tags of the primary pen **and** every `secondaryPenIds` entry, plus block tags. |
| Tag minutes are unioned **across scopes** | The same minute painted Work in Activity and Work-tagged in Location counts once for the Work tag. Summing per-scope tag totals triple-counts a minute. |
| Within one tag, minutes are a set | Overlapping blocks that share a tag do not add. |
| Secondary pens take the **full** block | They do not change grid color. They do feed every tag, habit, operation, or goal any assigned pen fulfils. |
| Display depth is a lens | `TrackScope.displayDepth` (`null` = Exact) never rewrites paint. At Exact the painted pen gets the whole block. At a collapsed depth, each **distinct** ancestor at that depth gets a **share**, and the shares sum to the block. An ancestor reached twice is paid once. **Show as** color follows the display parent only (`parentId` / `parentIds[0]`). |
| Variants have two honest totals | **Reach**: minutes of the parent that included Elijah. Overlaps, so Elijah + Rebecca can exceed the parent. **Split**: each distinct variant set (Elijah only / Rebecca only / both / unlabeled) partitions the parent and sums to it. |
| Estimated time is marked, not dropped by default | `precision: "estimated"` is assumed or reconstructed. Omitted precision is certain. A serious view offers “observed only” by dropping estimated rows, and always says how many minutes that hid. |
| Hidden pens still count | `hiddenPenIds` only removes a pen from the well. Paint stays. |
| Sleep and hand paint may disagree | Re-deriving sleep replaces only `generatedBy.kind === "sleep"` rows for that night. A hand-painted overlap is kept. Analytics should show the disagreement, not pick a winner silently. |
| Companion rules fill blanks | A `PenLink` (“Ian’s House always means Social”) paints a normal block in the other scope **only on minutes that scope left empty**, unless a person asked to overwrite. |

`entryMinutes` is `max(0, endMin − startMin)`. Logical span minutes are the sum of slices that share `spanId`.

---

## 2. Data inventory

### 2.1 `TimeEntry` — one block or one tick on one local day in one scope

Grain: one row. Identity: `id`. A logical overnight event is the group `spanId`.

| Field | Type | Grain role | Questions it can answer |
|---|---|---|---|
| `id` | string | row key | Drill to the block editor. Tombstones in `removedEntryIds` (cap 4000) stop a merge from painting a deleted id back. |
| `date` | `YYYY-MM-DD` | day axis | Which calendar day this slice belongs to. Weekday, month, season are derived, not stored. |
| `scopeId` | string | dimension | Which parallel painting: Activity, Location, Mood, Company, Screen Time, iPhone Screen Time, iPhone Calls, iPhone Texts, or a view the person added. |
| `penId` | string | category | What the grid colors. Always present. |
| `secondaryPenIds` | `string[]?` | extra categories | What else this block counts as, same view. Omitted = primary only. Never contains `penId`. |
| `kind` | `"interval" \| "instant"?` | occupancy | Omitted = interval. Instant = event at a clock, duration 0. |
| `startMin` | int 0–1439 | clock | When it starts, or the instant’s clock. For `clockCertainty: "unknown"` the minute is a **placement**, often `0`, and was not observed. |
| `endMin` | int 0–1440 | clock | Exclusive end. Instants set this equal to `startMin`. |
| `spanId` | string? | logical event | Glue for midnight slices. Pen-color “working now” uses `pen-color-<startedAt>`. |
| `startEventId` / `endEventId` | string? | edge events | “Being high” started at the “smoked weed” instant. |
| `splitAfter` | boolean? | seam | Scissors on the left half. Same-pen neighbors merge unless this is set. A seam is evidence the person refused a merge. |
| `variantIds` | `string[]?` | multi-label | Several details true at once (Elijah and Rebecca). |
| `tagIds` | `string[]?` | block-only tags | Extra tags on top of pen tags. Zoo today is Exercise; zoo forever is not. |
| `title` | string? | label | Display name (“walk to the beach”). **Does not change counting.** Blank falls back to the pen name (`entryDisplayName`). |
| `notes` | string? | free text | Block note. A line under a `log:` event lands here. GPS-written location blocks use the literal note `"gps"`. |
| `project` | string? | context | Also fills the `{project}` action-format variable. Two blocks that differ here do not merge. |
| `books` | string? | reading | Which book. Free text, not a catalog id. |
| `pages` | number? | reading amount | Pages read on this block. Integer from the editor (`parseInt`). |
| `precision` | `"estimated" \| "definite"?` | certainty | Omitted = certain. `"estimated"` is assumed, reconstructed, Screen Time, phone ingest, or an estimated log clock. Confirm clears it. |
| `clockCertainty` | `"estimated" \| "unknown"?` | clock firmness | Separate from mood, sleep, and completion certainty. Omitted = exact. `"estimated"` also sets `precision: "estimated"`. `"unknown"` still stores `startMin`. |
| `eventKind` | string? | count key | Stable slug. Free-form phrases: lowercase, punctuation stripped, spaces collapsed (`left room` stays `left room`). Intake: `intake`, `intake.food`, `intake.drink`, `intake.drug`. Thought process: `thought-process`. Switches often `switch` / `switch-task` / `switch-objective`. Omitted on older rows and on ordinary painted blocks. |
| `intakeClass` | `"food" \| "drink" \| "drug"?` | intake shelf | Set by classed intake and by `ate` / `drank` / `took`. Bare `intake:` leaves it unset. Food is a subset of intake. |
| `switchFrom` / `switchTo` | string? | transition ends | What a switch left and where it went. Activity still paints the Switch pen; another view uses the destination text as that scope’s pen. `so:` / `switch goal:` uses the Objective pen. There is no Goal scope. |
| `moodReading` | object? | mood report | Mood scope only. See §2.6. Different readings do not merge. A split copies the reading onto both halves. The derived sentence is **not** written into `notes`. |
| `generatedBy` | `{ kind, id }?` | provenance | `kind`: `"sleep"` \| `"screentime"` \| `"text"`. `id` is the local calendar day. Each generator replaces only its own kind+id. Hand paint is never eaten by a re-sync. iPhone Screen Time is **estimated and not stamped `screentime`**, so a Mac ActivityWatch replace cannot delete it. |
| `estimateOf` | `{ kind: "done" \| "import", id }?` | proposal source | **Place as assumed** stamps `kind: "done"` and the finished item’s id. Confirm clears `precision` and **keeps** the stamp so the same item is not proposed again. `kind: "import"` is in the type; nothing writes it yet. |

Questions a single row can answer: what was painted, in which view, for how many minutes, under which name, with which tags and details, whether the clock was observed, whether a machine or a sentence produced it, and which other tick it claims as its start or end.

Questions it cannot answer alone: whether those minutes were the only thing true (other scopes), whether the person later edited it (no `updatedAt` on the row), or what the plan said (Day Log reads the plan beside these rows; the plan is not a field here).

### 2.2 `TrackScope` — one parallel view

Grain: one named dimension of the same day.

Seeded ids and names:

| `id` | Name | What a pen means | Default depth labels |
|---|---|---|---|
| `activity` | Activity | What you were doing | Category / Activity / Exact |
| `location` | Location | Where | Country / Area / Place / Exact |
| `mood` | Mood | The painted mood name | Mood |
| `company` | Company | Who you were with | Kind / Who / Exact |
| `screentime` | Screen Time | Mac ActivityWatch: category, then app, then optional domain | Category / App / Exact |
| `iphone-screentime` | iPhone Screen Time | Phone app pings, not Apple’s Screen Time export | Category / App / Exact |
| `iphone-calls` | iPhone Calls | A person, as an interval | Who / Exact |
| `iphone-texts` | iPhone Texts | A person, as an instant whose title is the message | Who / Exact |

People add scopes by name. `displayDepth` and `depthLabels` are how that view is drawn. Analytics should let the person pick a depth **without** writing `displayDepth`, and should label the lens (“Exact” vs “Country”) on every chart that uses it.

### 2.3 `TrackPen` — one color in one view

Grain: a vocabulary item, not a stretch of time. Time points at it.

| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `color` | string | Identity, label, swatch. A dropped pen is recovered from paint as “Recovered pen” with a stable hash color. |
| `parentId` | string? | Display parent. Always `parentIds[0]` when the list is set. |
| `parentIds` | `string[]?` | Full counts-as list, display parent first. Ocean Beach can count as both San Diego and Beaches. |
| `tags` | `string[]?` | `TrackTag` ids this pen **always** carries. Cross-scope. Distinct from parents, which are in-view rollup. |
| `variantLabel` / `variants` | string / `PenVariant[]` | What the details answer (“Who?”, “Which?”) and the options. |
| `links` | `PenLink[]?` | Standing implications: `{ scopeId, penId, variantIds? }`. Applied on paint; fill blanks only. |
| `actionFormats` | `{ id, template }[]?` | Templates that name a Done-today row. Most specific template whose variables all resolve wins; ties keep list order. Empty = this pen does not log a Done row. |
| `lastUsedAt` | epoch ms? | Last stroke. Drives Recent sort. |
| `editedAt` | epoch ms? | Last name, color, or settings edit. Newer stamp wins a persist merge. |
| `image` | URL? | Mosaic on the grid. Color remains the fallback. Not a measure. |

Seeded Activity pens and the tags they carry:

| Pen id | Name | Tag |
|---|---|---|
| `act-work` | Work | `tag-work` Work |
| `act-rest` | Rest | `tag-rest` Rest |
| `act-exercise` | Exercise | `tag-exercise` Exercise |
| `act-social` | Social | `tag-social` Social |
| `act-chores` | Chores | `tag-cleaning` Cleaning |
| `act-sleep` | Sleep | `tag-sleep` Sleep |

Seeded Location: Home, Work, Outside, Transit. Seeded Mood: Great, Good, Meh, Low (the pen is a name; the report is `moodReading`). Seeded Company: Alone; Together; In conversation (child of Together, variant label “Who?”).

Screen Time category roots (same six names on Mac and iPhone, **different ids**): Work, Communication, Browsing, Media, System, Other. Mac ids look like `st-cat-work`. iPhone ids look like `iphone-st-cat-work`. Apps are child pens. A browser may grow a domain child when the web watcher overlaps. iPhone Calls and Texts start with **no** pens; people are created on ingest (`iphone-call-<slug>`, `iphone-text-<slug>`).

Special Activity pens created by language, not by the seed:

| Pen name | What lands on it |
|---|---|
| Text log | `log:` events, `note:` / `n`, thought process |
| Intake | `intake:` points |
| Switch | `st:` / `switch:` / `switched to` ticks |
| Objective | `so:` / `switch objective:` / `switch goal:` |

`PenVariant`: `{ id, name, color?, penId? }`. The detail **is** a pen (`penId`) whose parent is the pen that owns the list. Adding a detail creates or adopts that child. A same-name pen that already counts as someone else is not stolen.

Action-format placeholders that always resolve: `{minutes}`, `{x}`, `{hours}`, `{duration}`, `{name}`, `{pen}`, `{start}`, `{end}`. Optional, and they decide which template wins: `{location}`, `{project}` (and the spaced forms). This is a naming rule for a Done row, not a second time series. Analytics of Tracking should treat the template as a label generator, and the minutes as the `TimeEntry`.

### 2.4 `TrackTag` — the cross-scope label

Grain: one id in a library shared by every scope. `{ id, name, color }`.

Seeded: Work, Rest, Exercise, Social, Cleaning, Sleep (`tag-sleep`). People add tags. A tag does not store time. Time reaches a tag through pen tags and block `tagIds`.

The useful grain for a tag is **a set of minutes on a date**, unioned across scopes and across overlapping blocks. Weekly or monthly “tagged minutes” are the sum of those daily set sizes, not a sum of block durations.

Default pen tags are the bridge people expect: Exercise minutes, Sleep minutes, Social minutes. Block-only tags are the exceptions (this zoo visit, not every zoo visit).

### 2.5 Instants, intakes, switches, thoughts

These are still `TimeEntry` rows. The Tracking log classifies **Activity instants**:

| Shelf | How a row qualifies | `eventKind` | Duration |
|---|---|---|---|
| Food / drink / drug | `intakeClass` or `eventKind` `intake.food` / `.drink` / `.drug` | that slug | 0 |
| Bare intake | Intake pen, or `eventKind: "intake"`, no class | `intake` | 0 |
| Event | Text log pen and/or a phrase `eventKind`, not intake | slug of the phrase, or the stored kind | 0 |
| Thought process | `eventKind === "thought-process"` | `thought-process` | 0 |
| Switch | Switch pen, Objective pen, or any instant with `switchTo` | `switch`, `switch-task`, `switch-objective`, or stored kind | 0 |
| Note | Text log via `note:` / `n` | slug of the title if grouped as an event | 0 |

A `log:` line may also be a **range** (a real interval on Text log) or a start/end pair that becomes one span. A trailing `loc: home` does not change `eventKind`; it paints a **second** instant on Location at the same minute, reusing or creating that Location pen.

Clock words on `log:`, `intake:`, `switch:`, `st:`, `so:`, `note:`, and thought lines: `est` / `estimated` / `~` and `unknown`. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37). `1pm` is 13:00. Unknown clocks sort **after** timed rows and display as a badge; the stored minute is not an observation. The composer’s unknown placeholder is minute `0`.

Whole-message triggers that paint Activity instants (Text log, `generatedBy.kind === "text"`): `smoked weed`, `drank water`, `ate {item}`, `took {item}`. `ate` and `drank` and `took` also set an intake class. Settings can add more discrete triggers.

Saved log keywords (`brain2-log-keywords`) are phrases. A row is a string, or `{ phrase, countId? }`. Matching `log:` of that phrase increments a bound count. The keyword list itself is not a time series.

### 2.6 `MoodReading` — the report on a mood stretch

Stored on the entry, Mood scope only. The pen can be any name (“Great,” or a word the person typed). The reading is separate.

Text fields, stored only when non-blank: `word` (spelling on this stretch), `sensation` (body), `vibe`, `narrative` (the shorthand the mind is offering), `reframe` (a lighter map, stored only when accepted), `about` (what the mind is doing with the state).

`tone`: `"pleasant"` \| `"unpleasant"` \| `"neutral"` (shown as “neither”).

Integer marks **1–10**. A blank or out-of-range value is omitted, never stored as zero. Absence is not a zero.

| Key | Plate | Plain meaning |
|---|---|---|
| `energy` | marks | Energy |
| `tension` | marks | Tension |
| `loop` | marks | Loop |
| `enjoyment` | marks | Enjoyment |
| `grasping` | marks | Grasping |
| `knowing` | marks | Knowing |
| `cast` | water | Cast |
| `sociability` | water | Sociability |
| `initiative` | water | Initiative |

Grouping key for a word is trim, lowercase, collapsed spaces. The stored spelling stays. Stretches that share a word are the same **word**, not the same stretch.

Already-defined summaries, which analytics should reuse rather than reinvent:

- Mean of a mark is the average of **set** values only, rounded to one decimal, with `n`.
- Water plate: distinct vibe phrases with their dates, plus means of cast, sociability, initiative.
- Marks plate: means of the six marks, tone counts that actually occurred, and grasping split by whether `about` was filled.

### 2.7 Day notes and gap notes

**Day notes** (`brain2-tracking-day-notes`, mirrored on the timegrid blob). Grain: one local date → one append log.

Each `AppendLogEntry`: `{ id, createdAt: ISO string | null, text, stampSuffix? }`. Submit stamps the **writing** time. Entries are immutable. Legacy plaintext becomes one entry with `id: "legacy"` and `createdAt: null`. A draft can sit beside entries and is not a submitted note. List / Bulk / Latest is a view, not data.

The day’s key is the Tracking day the person was looking at. `createdAt` is when they pressed submit, which may be another day. Analytics must not treat the stamp as the time the day happened.

**Untracked notes** (`untrackedNotes`). Grain: one gap. Key `date|scopeId|startMin|endMin`, value a string. Empty text drops the key. The gap is not a `TimeEntry`. If the person later paints that range, the key no longer matches a live gap; the note can dangle.

### 2.8 Counts

`brain2-count-statuses`. Not cycle marks. Not the timegrid blob.

| Field | Type | Grain |
|---|---|---|
| `CountStatus.id` | string | one named tally (“joints,” “days happy”) |
| `name` | string | label |
| `intakeClass?` | `food` \| `drink` \| `drug` | if set, a tick also paints an Intake instant |
| `keyword?` | string | saved into log keywords so `log:` of that phrase increments the count |
| `ticks[]` | `CountTick` | one press |

`CountTick`: `{ id, date, startMin 0–1439, clockCertainty? }` where certainty is only `"estimated"` or `"unknown"` when not exact.

Deleting a count drops its ticks and **leaves** intake instants already painted. So the grid and the tally can diverge. A tick is a count event; the instant, when painted, is a separate `TimeEntry`.

### 2.9 Cycle day marks and derived phase

`brain2-cycle-marks`. One local date → flags. A day with every flag clear is dropped. **No `TimeEntry` is written.** This is a calendar record, not medical advice, not a diagnosis, not a fertility method.

| Field | Stored when | Effect |
|---|---|---|
| `bleeding` | `true` only | Starts or continues a bleed run (contiguous bleeding days). |
| `spotting` | `true` only | Recorded. Does **not** start, extend, or change phase. |
| `ovulation` | `true` only | That day is ovulatory unless it is also bleeding. |

`phaseForDate` derives a label and does not store it:

| Phase | When |
|---|---|
| `menstrual` | Inside a bleed run. Wins over ovulation on the same day. |
| `ovulatory` | Ovulation marked, and not menstrual. |
| `luteal` | From the day **after** an ovulation mark until the next bleed starts. If no later bleed, later days stay luteal. An ovulation during a bleed opens luteal once that bleed has ended. |
| `follicular` | After a bleed ends, when no ovulation during or after that bleed is still in effect — including the whole gap when nobody marked ovulation. |
| `unknown` | No marks, or a day before the first bleed and before any ovulation. |

`enableCycleTracking` (timegrid store) only shows the Tracking log cycle section. It does not delete marks. New stores start false; an upgrade of an older blob that omitted the key sets it true. `cycleDetailsOpen` hides or shows the phase line. Analytics should respect concealment: if the latch is closed, do not draw phase charts.

**Estimates** (`assessCycleDay`) never write marks and never replace `phaseForDate` as the marked truth. A day is `basis: "estimated"` only when no ovulation was marked for that cycle and a guess can be said aloud. `basis: "marked"` has confidence 1. Estimated days have lower confidence plus a reason sentence.

Cycle length is bleed-start to next bleed-start. Lengths under 18 or over 60 days are **not used for the median** and are not deleted. Luteal length is the distance from an ovulation day to the next bleed start. With no such pair the length is a **14-day prior**, not a measurement from this body. Learned medians are clamped to 8–18 days. Open-cycle stand-in when there is no median length: 28 days. The summary also carries median bleed length, how many completed cycles the estimate rests on, and `lutealSource: "marks" | "prior"`.

The encyclopedia in Cycle detail (clinical, Chinese medicine, esoteric) is reference prose. It is not personal data and should not be charted.

### 2.10 Sleep nights — a statement that paints blocks

Grain: one **morning** date. `SleepNight.date` is the morning the night belongs to, not the bedtime’s calendar day.

| Field | Unit | Meaning |
|---|---|---|
| `sleptMin` | signed minutes from midnight of `date` | Negative is the evening before. Noon is the pivot when parsing a clock: 11:30pm → −30, 12:45am → 45. Earlier than −720 is treated as the previous afternoon, not a bedtime. |
| `wokeMin` | 0–1439 on `date` | Wake clock. |
| `sleptPrecision` / `wokePrecision` | `"estimated"` \| `"definite"` | Confidence of that end. Clearing an end clears its precision. |
| `note` | string? | Night note. |
| `updatedAt` | ISO | Last edit. This is the honesty stamp for “recorded three days later.” |
| `allNighter` | boolean? | This morning was no sleep. Clears both clocks. |
| `allNighterAt` | ISO? | When the all-nighter was marked. |
| `allNighterSource` | `"telegram"` \| `"desktop"` \| `"text"` | Where it was marked. |
| `source` | `"logged"` \| `"tracked"` \| `"mixed"` | Unset in storage means logged. `"tracked"` / `"mixed"` are set on read when the grid fills a gap. |

Duration is `wokeMin − sleptMin`. Null when either end is missing, when the span is ≤ 0, or when it exceeds `MAX_SLEEP_MINUTES` (20 hours). A bad pair is a data-quality event, not a quiet zero. Target default is 8 hours (`DEFAULT_SLEEP_TARGET_MINUTES` = 480), clamped 60–960 when changed.

Derived grid blocks: Sleep pen (prefer a pen carrying `tag-sleep`, else `act-sleep`, else a pen named Sleep), split at midnight, `generatedBy: { kind: "sleep", id: <morning date> }`, and `tagIds: ["tag-sleep"]` pinned on the block. All-nighter mornings paint nothing.

Because bedtimes are signed offsets from their own morning, mean and standard deviation are ordinary arithmetic. Median bedtime and wake are the right “typical night” (one all-nighter must not move the assumption). A trend that splits a range in half is comparable only when each half has at least two nights.

### 2.11 Screen Time and phone life

**Mac Screen Time** (`scopeId` `screentime`). Source events are ActivityWatch window events intersected with not-afk. AFK stays untracked. Pieces shorter than `minDurationSec` (default 15) are dropped. Split at local midnight, then merged when the pen matches. Each derived row is `precision: "estimated"`, `generatedBy: { kind: "screentime", id: <that date> }`, optional `title` only when `storeWindowTitles` is on (default off). Prefs live in `brain2-screentime-prefs`: loopback URL, `lookbackDays` (1–365, default 14), `minDurationSec` (0–3600), `includeWebWatcher`, `lastSuccessAt`, `lastError`, `lastSyncNote`. ActivityWatch only records from when its watchers run. A reachable sync with zero blocks is success, not a bug. There is no Apple Screen Time import and no pre-install history.

**iPhone Screen Time.** Same category tree, distinct pen ids, `precision: "estimated"`, **no** `generatedBy.kind === "screentime"`. A phrase names an app and a window.

**iPhone Calls.** Intervals on person pens. A phrase with a duration or clock window paints that window; with no window, **one estimated minute** at now. A window that wraps the previous day paints both dates. Precision estimated.

**iPhone Texts.** Instants. Title and notes are the message body. Person pen. Precision estimated. No body, no row.

### 2.12 GPS location

A fix says where the phone was **at that minute**. It does not paint the rest of the day. Same coordinates (within 150 m) keep the current pen, so a reverse-geocoded restaurant name does not replace home. A fuzzier-than-150 m jump does not move you. A dropout under 45 minutes still belongs to the last confirmed place. Isolated samples are stretched to at least 15 minutes so they can show on a coarse grid. The block’s `notes` is the literal `"gps"`. The last fix (`lat`, `lon`, `penId`, `name`) lives in a side key, not on the entry. **Coordinates are not on `TimeEntry`.** A Telegram venue pin is a shared place, not presence.

### 2.13 Open-until-midnight paint

`at:`, `mood:`, `start:` of an activity pen, and `currently` paint from the current minute **through the end of that local day**. The next switch overwrites only the remainder. Until that next switch, future hours of today look tracked. `track: name 30m` and similar windows paint a closed interval instead. `stopped` truncates the open activity to now.

### 2.14 Live sessions that write entries

Two pointers, at most one of each:

| Store | Fields | What it paints |
|---|---|---|
| Work session | `operationId`, `startedAt` ISO, `title` (operation name), `scopeId`, `penId`, `trackingEntryIds`, `pausedAt?`, `pausedAccumMs?` | Ordinary blocks titled with the operation name. Pause freezes paint; the gap is accumulated milliseconds, not a tracked block. |
| Pen-color session | `penId`, `scopeId`, `title` (pen name), `startedAt`, `trackingEntryIds`, pause fields | Same slice math, in that pen’s own view. `spanId` `pen-color-<startedAt>`. Does not write a Done row. |

`trackingEntryIds` is the foreign key from the session to the blocks. When the session ends, the blocks remain. Analytics of a finished day should read the blocks. Analytics of “right now” may read the live pointer, including pause.

Header **Update state** stamps the present only: extend the open stretch up to now, or paint this minute with a seam if the pen already touches it. It erases future minutes. It never paints through midnight.

### 2.15 Confirmed plan events, and what is not on the row

`confirmedEventIds: string[]` lists calendar events Day Log has confirmed into tracked blocks. The block itself is a normal `TimeEntry` (optional notes). The id list is how analytics knows a block was **confirmed from a plan event** rather than brushed, but only if the writer stored that id — the entry does not carry `eventId`. Task `timeLogs` (amber on Day Log) are a different store: `{ date: YYYY-MM-DD, ... }` on the task, not a `TimeEntry`. This vision does not fold them into Tracking occupancy.

**Place as assumed** writes a hatched block into an open gap: `precision: "estimated"`, `estimateOf: { kind: "done", id }`.

### 2.16 Sun, as an axis not a record of life

`DaySunTimes` for a local date and a lat/lng pin: `sunriseMinutes`, `sunsetMinutes`, plus clock labels. Cached per `YYYY-MM-DD|lat|lng`; first write wins so last week is not restamped with today’s clock. Polar days with no rise or set are null. Default pin in the astronomy helper is San Diego. This is a clock the grid already draws. Analytics can shift “hours after sunrise” without pretending the sun is a pen.

### 2.17 Adjacent clock series that is not a Tracking row

Current moment can log five wellbeing scores in the metrics store. They are **not** `TimeEntry` fields and Tracking does not store their ids.

`MetricDatapoint`: `id`, `at` (`YYYY-MM-DDTHH:mm`, the minute the reading applies to, editable for back-log), `values` (subset of `joy`, `suffering`, `alignment`, `selfSatisfaction`, `situationalSatisfaction`, each 0–100), optional `context`, optional `details`, `createdAt` (when the row was actually created).

A Tracking analytics view may **align** a datapoint to the minute it names, beside Activity / Location / Mood / Company. It must not treat a missing score as zero, and it must show `createdAt` when it differs from `at`, the same way sleep shows `updatedAt`.

### 2.18 View state that is not a measure

Do not chart these as life: `gridStep`, `gridSpan`, `weekStep`, `activeScopeId`, `selectedPenId`, `penSort` (Recent / A–Z / Tree), `infiniteScroll`, `hiddenPenIds`, fill clocks (`fillFrom` / `fillTo` / week equivalents — hours, not dates), `superimposeByScope`, pen-well and notes-well expand flags, `cycleDetailsOpen` except as a privacy latch.

---

## 3. Metric catalog

Every metric below names its grain, its unit, and the plain-language formula. “Period” means the dates on screen (a day, a week, a month, a custom range). “Waking” means minutes outside sleep-tagged or sleep-generated intervals, unless the chart says otherwise.

### 3.1 Counts

| Metric | Formula |
|---|---|
| Blocks | Number of interval rows in the scope and period. Say so when `spanId` groups are collapsed to logical events. |
| Instants | Number of `kind === "instant"` rows. |
| Days with paint | Distinct `date` values that have at least one interval. |
| Days in period | Calendar length of the range, including empty days. |
| Tick count | `CountTick` rows for one `CountStatus`, optionally dropping `clockCertainty: "unknown"`. |
| Intake events | Instants with an `intakeClass`, counted by class and by `eventKind` slug of the title. |
| Switch events | Instants on the Switch or Objective pen, or any instant with `switchTo`. |
| Thought count | Instants with `eventKind === "thought-process"`. |
| Day-note entries | Append-log entries whose **day key** is in the period. Separately, entries whose `createdAt` falls in the period (writing burst). |
| Bleed runs | Maximal contiguous `bleeding` days. Spotting does not join them. |
| Completed cycles | Bleed-start to next bleed-start. Report the count used for the median (length 18–60) beside the count excluded. |
| Nights | Sleep mornings with a usable duration. |
| All-nighters | Mornings with `allNighter` and no duration. |
| Confirmed events | Length of `confirmedEventIds` is a lifetime list, not a period count. Period counts need the painted block’s date; the id list alone cannot date them. |

### 3.2 Durations

| Metric | Formula |
|---|---|
| Block duration | `endMin − startMin` minutes. Instants contribute 0. |
| Logical duration | Sum of slice durations that share `spanId`. |
| Scope occupancy | Size of the set of `date#minute` covered by intervals in that scope. Overlaps count once. |
| Untracked | `days × 1440 − occupancy`, per scope. Instants do not fill. |
| Coverage | Occupancy ÷ (days × 1440), as a percent. A fully empty scope is 0, not “undefined.” |
| Average per day | Occupancy ÷ days in the period, not ÷ days with data. Offer both; the second hides gaps. |
| Tag minutes | Size of the minute set whose `effectiveTagIds` contain the tag, **across scopes**. |
| Pen minutes at a depth | At Exact, the painted pen’s occupancy (union). At a collapsed depth, each ancestor’s **share**. Shares of one block sum to the block. |
| Variant reach | Minutes of the parent block that include that variant id. Can sum past the parent. |
| Variant split | Minutes of each distinct variant-id set. Sums to the parent. Unlabeled is its own slice. |
| Secondary-pen minutes | Full block duration (or occupancy) credited to each secondary, reported as overlap, not as a partition. |
| Sleep duration | `wokeMin − sleptMin` when 1…1200. Otherwise missing. |
| Sleep debt | Sum over counted nights of `max(0, target − duration)`. Default target 480. |
| Time in bed vs tagged sleep | Compare the night’s duration to the union of `tag-sleep` or `generatedBy.sleep` minutes on the two calendar dates the night touches. The gap is disagreement or unpainted sleep, not a third kind of sleep. |
| Pages | Sum of `pages` on blocks that have it. |
| Reading rate | Sum of `pages` ÷ sum of minutes on blocks that have **both** `pages` and a positive duration. Blocks with pages and no duration (a tick) do not enter the denominator. |
| Bout length | A bout is a maximal run of the same pen (at the chosen depth) on one scope, merging across `spanId` and across midnight, and **not** merging across `splitAfter`. |

### 3.3 Rates

| Metric | Formula |
|---|---|
| Switches per waking hour | Switch instants plus pen-changes (see §3.6) divided by waking hours that have any Activity occupancy. A day with no Activity paint has no rate; do not divide by 24. |
| Intakes per day | Classed instants ÷ days, with a companion “per day that had any intake.” |
| Notes per painted hour | Day-note entry count on that date ÷ (occupancy ÷ 60) for Activity. |
| GPS fixes | Count of location intervals whose `notes === "gps"`, per day. This is a lower bound: adjacent same-pen fixes merge. |
| Screen fragmentation | Screen Time blocks ÷ Screen Time occupancy hours. High means many short focuses. Remember the 15-second floor: shorter than `minDurationSec` never existed. |
| Call minutes | Sum of iPhone Calls durations. The one-minute default when a phrase had no window must be labeled estimated. |
| Texts per person | Instant counts on `iphone-texts`, by pen. |
| Estimated share | Minutes (or nights, or instants) with `precision === "estimated"` or `clockCertainty !== exact`, ÷ the corresponding total. |
| Unknown-clock share | Instants with `clockCertainty === "unknown"` ÷ instants. Their `startMin` must not enter hour-of-day charts. |

### 3.4 Distributions

| Metric | What to compute |
|---|---|
| Bout-length distribution | Histogram of bout minutes. Expect a spike at 1 minute from one-minute phone calls and from “until midnight” that got stopped immediately. |
| Start-hour distribution | Histogram of `startMin` floored to the hour, **excluding** unknown clocks and excluding GPS blocks that were stretched only to satisfy the 15-minute floor if you can still see `notes === "gps"` and duration ≤ 15. |
| Coverage distribution | One number per day. Show the empty days. |
| Mood-mark distribution | For each rank key, the multiset of stored 1–10 values. Never impute 0. Report `n` beside every mean. |
| Tone mix | Counts of `pleasant` / `unpleasant` / `neutral` among readings that set `tone`. Readings with no tone are a separate “unspecified” bin, not neutral. |
| Cycle-length distribution | All bleed-to-bleed gaps, with 18–60 highlighted as the median’s sample and the rest shown as excluded. |
| Sleep duration / bedtime / wake | Use the signed bedtime so 10pm sorts before 1am. Median and mean side by side. Standard deviation of bedtime and of wake is the regularity number already defined for the sleep log. |
| Pages per sitting | Distribution of `pages` on blocks that have it. |
| Title length | Not a vanity metric. Very long `title` values are thought-process or notes that were stored as titles (first line). Short repeated titles are event kinds. |

### 3.5 Streaks and runs

| Metric | Definition |
|---|---|
| Paint streak | Consecutive local dates with Activity occupancy &gt; 0. Break on a missing date. Do not let a single instant keep the streak alive. |
| Tag streak | Consecutive dates whose tag-minute set is non-empty. |
| Coverage streak | Consecutive dates with coverage ≥ a stated threshold (offer 50% and 80% of 1440, and of waking minutes). |
| Sleep-target streak | Consecutive mornings with duration ≥ target. An all-nighter breaks it. A missing night breaks it; do not skip. |
| Bleed run length | Days in one contiguous bleeding run. |
| Follicular / luteal run | Consecutive derived phase days. Estimated days must be marked so a guessed luteal does not look like a marked one. |
| Same-pen return | After leaving a pen, minutes until it appears again the same day. The median return time is a rhythm; the tail is “abandoned until tomorrow.” |
| Count streak | Consecutive dates with ≥ 1 tick of that count. A “days happy” count is a day-grain habit hiding inside a minute stamp; offer a day-collapsed view. |

### 3.6 Rhythms

The clock axis is `startMin` and the occupied minutes, local.

| Rhythm | Construction |
|---|---|
| Hour-of-day profile | For each clock hour 0–23, the mean across days of occupied minutes in that hour (0–60). Separate profiles per pen, per tag, per scope. |
| Weekday profile | Seven profiles, or a weekday×hour matrix of mean occupancy. |
| Weekend vs weekday | Compare the two groups only when each has at least four days; otherwise show the days and withhold the adjective. |
| Sun-relative hour | Subtract that date’s `sunriseMinutes` (or sunset). “Two hours after sunrise” lines up summer and winter. Days with null sun (polar, or no pin) stay on clock time and are flagged. |
| Sleep midpoint | `(sleptMin + wokeMin) / 2` as a signed offset. Drift of the midpoint is the circadian story; duration alone hides a schedule that slid later while staying 8 hours. |
| First painted minute / last painted minute | Per scope, per day, ignoring instants and ignoring unknown clocks. The gap from wake (`wokeMin`) to first Activity paint is “time to first log.” |
| Intake clock | Histogram of food vs drink vs drug instants by hour, unknown clocks omitted. |
| Thought clock | Same for `thought-process`. |
| Switch clock | When transitions cluster (morning startup, post-lunch, late night). |

### 3.7 Entropy, concentration, fragmentation

Let a day in one scope be a distribution over pens at a chosen depth: share_i = pen minutes_i / occupancy. Empty days have no distribution.

| Metric | Formula in words |
|---|---|
| Shannon entropy | −Σ share_i log share_i, using the natural log or log2; label the unit. Only pens with minutes &gt; 0. |
| Normalized entropy | Entropy ÷ log(number of pens used). 0 = one pen all day. 1 = equal split across the pens that appeared. |
| Herfindahl | Σ share_i². Near 1 = one pen dominates. Near 0 = spread out. |
| Gini / Lorenz | Sort pens by minutes ascending. Lorenz plots cumulative pens vs cumulative minutes. Gini is the area between that curve and equality. A day of one 10-hour pen and forty 1-minute pens is unequal even if entropy looks moderate. |
| Top-pen share | Largest pen’s minutes ÷ occupancy. |
| Effective number of pens | exp(entropy). “This day behaved like 3.2 equal activities.” |
| Fragmentation | Number of bouts ÷ occupancy hours. |
| Scope divergence | How different Activity’s hour profile is from Location’s (Jensen–Shannon on the two 24-bin occupancy vectors). High means the day was logged in one view and not the other. |

Compute entropy on **shares that partition** (Exact paint, or split shares at a depth). Do not compute it on variant reach, which does not partition.

### 3.8 Switching cost

Two different events:

1. **Paint changes** — the Activity pen (at the chosen depth) at minute m differs from minute m−1, inside occupied time. Midnight uses the previous day’s last occupied pen when `spanId` matches or the slices abut; otherwise it is a new bout, not a switch.
2. **Declared switches** — instants with `switchFrom` / `switchTo`, or Switch / Objective pens. `switched to` from text also writes a Switch instant titled `switch → {name}` with `generatedBy.text`.

| Metric | Formula |
|---|---|
| Paint-change count | Count of (1). |
| Declared-switch count | Count of (2), unknown clocks included in the count but not in the hour histogram. |
| Agreement | A declared switch whose `switchTo` names the pen that actually occupies the next occupied minute. Disagreement is a quality signal. |
| Mean bout | Occupancy minutes ÷ bouts. |
| Switch tax | Minutes in bouts shorter than 5 (or 15). Short bouts are context-switch residue, phone-call defaults, or scissors. Offer the threshold as a control, default 5. |
| Self-loop | `switchFrom` and `switchTo` normalize to the same string, or a paint change returns to the same pen within 2 minutes. |
| Objective changes | Switches whose pen is Objective, or whose copy starts with `objective`. These are goal changes, not activity changes. |

### 3.9 Tag co-occurrence

For a period, build a minute set per tag (the same unioned set as tag totals).

| Metric | Formula |
|---|---|
| Co-minutes | \|A ∩ B\|. The number of minutes that carried both tags, from any scopes. |
| Jaccard | \|A ∩ B\| / \|A ∪ B\|. |
| Conditional | \|A ∩ B\| / \|A\|. “When Work is on, how often is Social also on?” |
| Lift | co-minutes / (expected if the two sets were independent given the period’s painted minutes). Lift &gt; 1 means they travel together more than chance. Use painted minutes as the universe, not 1440, or sleep-heavy days fake a negative association between daytime tags. |
| Triple | The same for three tags, only when the pair already has lift above 1 and support above a floor (for example 30 minutes). |
| Block-only vs always | Split co-occurrence into minutes where the tag came from a pen’s `tags` versus minutes where it came only from `TimeEntry.tagIds`. The second is intentional exception; the first is vocabulary. |

Secondary pens create within-scope co-occurrence even when the two pens share no tag: “this hour was both YouTube and Spanish.” Report that as **pen co-assignment**, separate from tag co-occurrence.

### 3.10 Cycle phase effects

Join key: local `date`. Phase is `phaseForDate` unless the chart is explicitly the estimate layer.

For each phase, among days with that phase:

- Mean Activity mix (pen shares), with `n` days.
- Mean mood-mark values, `n` = readings that set the mark, not days.
- Sleep duration, bedtime, wake (morning date’s phase, and also the bedtime’s calendar date — show both if they differ).
- Intake counts.
- Coverage and entropy.
- Spotting days as a flag **inside** whatever phase they already have, not as a fifth phase.

A phase effect is a difference large enough to see against the within-phase spread (for example, luteal mean tension minus follicular mean tension, beside each group’s `n` and the unpooled spread). With fewer than three days in a phase, show the days and do not state an effect. Estimated phase days stay in a hatched series. Marked ovulation days are a single-day bin; do not average them into luteal.

Cycle length, bleed length, and luteal length (marks vs 14-day prior) are the body’s own baselines. A “short luteal” claim uses the learned median only when `lutealSource === "marks"`.

### 3.11 Within-day structure

| Structure | What it is |
|---|---|
| Gap list | Unoccupied intervals per scope, chronological. Wrapping midnight is one gap when both ends of the day are empty. Sleep and other paint are not gaps. Instants are not fill. |
| Longest gap | The Fill control’s default. Earlier start wins a tie. |
| Open-until-midnight tail | An interval that ends at 1440 and was produced by `currently` / `at:` / `mood:` / `start:` with no later switch. Detectable when the block ends at 1440 and nothing in that scope starts at 0 the next day with the same pen and `spanId`. These minutes are **asserted through the end of the day**, not observed minute by minute. |
| First / last | See rhythms. |
| Morning / afternoon / evening / night | Fixed local bins are a starting cut (for example 5–12, 12–17, 17–22, 22–5) but sun-relative bins are the better default once a pin exists. |
| Deep work candidate | A bout of a Work-tagged pen lasting ≥ 50 minutes with no switch instant inside. A proposal, labeled as such. |
| Interleave | Number of times A and B alternate. High interleave with short bouts is fragmentation; high interleave with long bouts is a real two-project day. |
| Company × activity | For each Activity minute, the Company pen that covers it, or “company untracked.” |

### 3.12 Across-day structure

| Structure | What it is |
|---|---|
| Day vector | 24 × (pens or tags) of minute counts, plus scalar coverage, entropy, sleep duration, phase. |
| Template day | Median hour-profile of the pen that most often wins each hour, among weekdays with coverage above a floor. |
| Lag-1 | Today’s Work minutes vs yesterday’s. |
| Weekend rebound | Monday morning first-paint and sleep debt after two weekend days. |
| Catch-up bursts | A day whose `precision: "estimated"` share is high **and** whose blocks were not `generatedBy`. That pattern is reconstruction, not a new lifestyle. |
| Writing delay | For sleep, `updatedAt` date minus morning `date`. For day notes, `createdAt` date minus the note’s day key. For metrics, `createdAt` vs `at`. |

---

## 4. Visualizations

The right chart is the one whose geometry matches the grain. A pie of variant **reach** is a lie because the slices do not sum to the whole. A pie of variant **split** is honest.

### 4.1 The day as a ribbon

**Question:** What was true, in parallel, from midnight to midnight?

**Chart:** One horizontal ribbon per scope (Activity, Location, Mood, Company, and any scope that has paint that day). Color is the pen at the selected depth. Instants are ticks on top of the ribbon, not slabs. Estimated minutes are hatched. Unknown-clock instants sit in a side list, not at 00:00. Sleep-generated and GPS (`notes === "gps"`) and Screen Time get a thin provenance stripe, not a new color.

**Why:** The scopes are independent paintings of the same minutes. A stacked bar of totals throws away order. The ribbon keeps order and makes an untracked gap visible as white.

### 4.2 Occupancy calendar

**Question:** Which days were actually logged?

**Chart:** A month (or year) of cells. Ink is coverage of the selected scope, or of the union of the four presence scopes. A hatch overlay is the estimated share. A dot is “instants only.”

**Why:** A bar of total minutes treats an empty Tuesday like a short Tuesday. The calendar makes absence a cell.

### 4.3 Hour × weekday heatmap

**Question:** When in the week does this pen, tag, or gap happen?

**Chart:** Seven rows, 24 columns, color = mean minutes in that hour (0–60) or probability the pen is the dominant one. A companion heatmap of **sample size** (how many dates contributed) sits beside it or gates the color (a cell with one day stays pale).

**Why:** A single “you work at 10” average hides that it is only Tuesdays. Small multiples of the same heatmap by cycle phase answer “does the week change shape.”

### 4.4 Sun-shifted small multiples

**Question:** Is the rhythm clock time or daylight?

**Chart:** The same hour profile twice: clock hours, and hours relative to sunrise. If the peak locks to sunrise and smears on the clock, the habit is daylight. If it locks to 9:00 and smears on the sun axis, it is a schedule.

**Why:** Local midnight is the storage axis. It is not always the biological axis. The grid already knows sunrise and sunset per date.

### 4.5 Bout survival

**Question:** How long does a stretch last once it starts?

**Chart:** A survival curve per pen (or per tag): vertical axis is the share of bouts still running after t minutes; horizontal axis is minutes. Mark the 5- and 15-minute switch-tax lines.

**Why:** A mean bout of 40 minutes can be one long sitting or a pile of fragments plus one marathon. Survival shows the shape. Compare curves by phase, by company (Alone vs Together), and by whether the bout was estimated.

### 4.6 Lorenz and the concentration bar

**Question:** Did a few pens eat the week?

**Chart:** Lorenz curve of pen minutes, one curve per week, overplotted. A one-number companion is the top-pen share and the effective number of pens. A sorted bar (longest pen at the top) is the drill.

**Why:** Entropy is one number and is easy to misread. The curve shows whether the inequality is “one job plus crumbs” or “five real activities.”

### 4.7 Transition matrix

**Question:** What follows what?

**Chart:** A matrix. Rows are the pen (or declared `switchFrom`) you left; columns are what came next. Color is count, or share of the row. The diagonal is “continued,” which for paint-changes is empty by definition and for declared switches is a self-loop. Order rows and columns by total minutes, not alphabetically, with an “untracked” column for leaving into a gap.

**Why:** A list of switch titles has no base rate. The matrix shows that Rest almost always follows Work, or that Objective changes scatter.

Drill: click a cell to list the instants (`switchFrom` → `switchTo`, clock, `clockCertainty`, title).

### 4.8 Alluvial of the day-type

**Question:** How do days flow from morning shape to afternoon shape?

**Chart:** Cluster days first (§5). Then an alluvial from “morning cluster” to “afternoon cluster” to “evening cluster,” width = number of days.

**Why:** A heatmap averages days that should not be averaged. The alluvial keeps “gym morning, scattered afternoon” as a path.

### 4.9 Tag co-occurrence matrix

**Question:** Which labels travel together?

**Chart:** A matrix of lift, cells with support under 30 minutes blanked. Diagonal is total minutes, not lift. A second matrix, smaller, is block-only tags.

**Why:** A chord diagram looks richer and hides the counts. The matrix can be sorted, thresholded, and read. Chord is optional once the matrix has a story.

### 4.10 Mood marks as small multiples, not a spider on one hour

**Question:** What was the body of this kind of hour?

**Chart:** For a chosen word (`normalizeWord`), a row of strips: each mark that was ever set, each occurrence a dot at 1–10 on its date. Means as a tick with `n`. Tone as a simple count. Vibe phrases as a list with dates, which the water summary already groups.

**Why:** A radar chart pretends every mark was filled and that 0 is the origin. Marks are optional and start at 1. Dots show the actual readings; “these share a word; they are not the same stretch.”

Grasping with `about` vs without is two means, each with `n`, not one blended number.

### 4.11 Sleep as a two-ended timeline

**Question:** When did nights happen, and were they believed?

**Chart:** Each morning is a bar from `sleptMin` to `wokeMin` on a signed axis (evening before on the left). Estimated ends are dashed. All-nighters are a mark, not a zero-length bar. `updatedAt` delay is a small tick if the night was written more than a day later. Overlay the median typical window (only after ≥ 3 nights).

**Why:** Duration bars hide a schedule that slid. The signed axis is how the sleep log already avoids circular statistics.

### 4.12 Cycle calendar with two layers

**Question:** What was marked, and what is only a guess?

**Chart:** A month grid. Solid wash = `phaseForDate`. Hatch = `assessCycleDay` basis `estimated`, with the reason and confidence on hover. Spotting is a dot, not a recolor. Bleed runs and ovulation days are the only solids that claim observation.

**Why:** The derived phase is not stored, and the estimate must not overwrite the marks. People need to see both.

### 4.13 Phase small multiples of the ribbon

**Question:** Does the day look different in luteal vs follicular?

**Chart:** Four (plus unknown) average ribbons, or four hour×pen heatmaps, each labeled with `n` days and “marked only” vs “including estimates.”

**Why:** One overlay spaghetti-plots every day. Small multiples keep the phase as the unit of comparison.

### 4.14 Screen Time as a nested icicle

**Question:** Where did focus go, at category, app, and domain?

**Chart:** An icicle or sunburst that follows `parentIds`: category → app → domain. Exact minutes at the leaves; shares at collapsed depth must sum to the parent. AFK is the untracked remainder, labeled “not at keyboard,” not “Other.”

**Why:** The scope’s depth labels are Category / App / Exact. The chart should be that tree. A flat top-ten apps list hides that five apps are one category.

Window titles, when `storeWindowTitles` is on, are a drill list under the app, not a default — they are sensitive and off by default.

### 4.15 Count ticks on the ribbon

**Question:** When did this tally happen relative to the day?

**Chart:** The Activity ribbon with that count’s ticks as marks. If the count has an `intakeClass`, show the painted instant beside the tick and flag ticks with no matching instant (deleted paint, or a count that does not paint).

**Why:** The tally and the grid are different stores and can diverge.

### 4.16 Quality strip

**Question:** How much of this picture was observed?

**Chart:** A thin stacked bar for the period: certain intervals, estimated intervals, unknown-clock instants (count, not minutes), open-until-midnight tails, overlapping minutes, dangling untracked notes.

**Why:** Every beautiful chart above can be made of reconstructed time. The strip is the legend for trust.

---

## 5. Statistical and learning analyses

These are analyses the Tracking records can support. Each one says what would be **learned about this vault**, and the minimum evidence before a sentence is allowed on screen.

### 5.1 Seasonality that is actually in the clock

Decompose daily occupancy, Work-tag minutes, and sleep duration into weekday, time-of-year, and leftover.

What would be learned: whether “I don’t log weekends” is the dominant season; whether sleep duration has a weekly shape distinct from bedtime; whether a pen is a season (gardening, travel) rather than a daily habit. Year-of-day needs many months. With fewer than eight weeks, show the weekday profile only and say the year is not identified.

Sun-relative profiles (§4.4) are the seasonality check that does not require a long series: if the peak tracks sunrise across the weeks you do have, say that.

### 5.2 Changepoints

On the daily series of coverage, entropy, sleep midpoint, and top-pen share, look for a small number of breaks (a simple binary segmentation or a penalized cost on the mean).

What would be learned: the week the log started being real; the week Work stopped meaning the job; a travel block; the day cycle tracking was turned on (a metadata break, not a life break — exclude it or mark it). Show the dates and the before/after means. Do not name a cause. With fewer than 21 days, do not search.

A changepoint that lands on a jump in `precision: "estimated"` share is a **logging** change. Say so.

### 5.3 Clustering of days

Represent each date as a vector: 24 bins of Activity pen (at Category depth, so the vector stays small), coverage, sleep duration (missing as its own flag, not as 0), and phase (one-hot, unknown separate). Cluster with a small k (2–5) chosen by stability: the same days group together if you drop a random week. Name a cluster by its median ribbon, not by a slogan.

What would be learned: the two or three shapes this life actually repeats (“tracked workday,” “untracked weekend,” “travel / outside,” “low-coverage reconstruction”). Outlier days are the ones far from every center.

Do not cluster on raw pen ids if the person renamed or reparented pens; cluster at a depth, or on tags, so a recolor is not a new lifestyle.

### 5.4 Sequence mining

Treat a day as a sequence of bouts: `(pen, duration bucket, company if covered, location if covered)`. Mine subsequences that recur on many days (Work→Rest→Work, Transit→Outside→Home) with a minimum support (for example 5 days) and a maximum length of 4.

What would be learned: the actual motifs, including ones nobody named. A motif that appears only in one phase, or only after a short night (sleep duration below that person’s median), is the interesting hit. Print support and an example date. Do not print a rule with support 2.

Declared `switchFrom → switchTo` strings are a second sequence, coarser and closer to language. Mine them separately from paint changes. Where they disagree, that disagreement is the finding.

### 5.5 Association rules inside Tracking

Items are tags present that day (tag minutes &gt; a floor, for example 15), plus phase, plus “sleep debt &gt; 60,” plus “any drug intake,” plus “company Together for ≥ 30 minutes.” Rules are `A → B` with support, confidence, and lift, computed on days, not on minutes (minute-level lift is §3.9 and will rediscover “Home and Alone”).

What would be learned: day-scale companions. “Drug intake days also have late sleep midpoint” is a day rule. It is not a claim about the minute of the intake unless the minute join (§6) also shows it.

Minimum: at least 8 days containing A. State the counts. Association is not a cause.

### 5.6 Anomalies

Score each day against its own cluster center and against a trailing 28-day median of coverage and sleep midpoint.

Flag, separately:

- Coverage far below the person’s recent median, while the previous week was dense (a hole, not a new normal).
- A pen that never appears in the trailing 28 days and then occupies ≥ 60 minutes.
- Overlap minutes above a small threshold (sleep sitting on work, two locations at once).
- A cycle length outside 18–60, shown as excluded from the median, not as an alarm tone.
- A sleep span that `sleepMinutes` rejected (≤ 0 or &gt; 20 h).
- Instants piled at minute 0 with `clockCertainty: "unknown"`.
- Open-until-midnight tails covering hours after the last **declared** switch or last instant.

What would be learned: which days are bad data, and which days are unusual life. The UI should split those two lists. An anomaly detector that cannot tell GPS bridge-fill from a real trip will train the person to ignore it.

### 5.7 Forecasting tomorrow’s shape

Predict tomorrow’s **hour profile** of Activity occupancy and the top pen per hour, from the weekday template, recent 14 days, and yesterday’s last pen (people continue). A simple baseline: the median profile of the same weekday among days with coverage ≥ 25%. Add sleep: if last night’s midpoint is known, shift the template by the difference from the median midpoint, capped at 90 minutes, and label the shift as a hypothesis.

What would be learned: whether this life is regular enough to have a tomorrow. Report the baseline’s past error (mean absolute minutes per hour on the last four same-weekdays). If that error is large, say the forecast is not earned and show the template without a “prediction” caption.

Do not forecast cycle phase over a marked ovulation. Do not forecast bleeding. The estimate layer already has a prior; analytics should show that prior’s basis note, not a second medical model.

### 5.8 Mood and context, as a paired comparison

For each mark, compare the distribution of values when a tag or pen is present in the same minutes versus when it is absent, restricted to minutes that have a reading at all.

What would be learned: “tension is higher on Work minutes than on Rest minutes, n = 12 readings vs 9,” or that it is not. Readings are sparse. A regression with nine covariates on twelve readings should not ship. Paired comparisons with `n` should.

`about` filled vs empty is the comparison the mood model already isolates for grasping. Extend that pattern only when both sides have `n ≥ 3`.

### 5.9 Screen vs stated activity

On minutes where both `screentime` (or `iphone-screentime`) and Activity are occupied, tabulate category vs Activity pen.

What would be learned: the places the two instruments disagree (Activity says Rest, screen says Work; Activity untracked while the keyboard was not AFK). Agreement is not validation — both can be wrong — but systematic disagreement is the most useful screen chart. AFK-untracked minutes where Activity is painted are “life away from the keyboard,” which is a finding, not a hole to impute.

### 5.10 Language, lightly

`eventKind` slugs, `title`, day-note text, `moodReading.word` / `narrative` / `vibe`, and `switchTo` are a vocabulary.

What would be learned: which phrases repeat (`eventKind` counts), which words are hapaxes, whether thought-process titles cluster at the same hours as switch spikes (a planning burst). A bag of `eventKind` over the week, sorted by count, is the right first instrument. Topic models on a few dozen notes are not.

Search already matches name, notes, project, mood word, sensation, vibe, narrative, reframe, about, pen, secondary pen, counts-as names, and action templates. Analytics can offer that same find as a drill, then chart the hit set (when those blocks happen). The hit set is a cohort of blocks, not a new entity.

---

## 6. Within-Tracking joins

The join key for almost everything is **local date + minute**, or **local date** when the other record is a day.

### 6.1 Scope × scope (the minute cube)

For each date and minute, each scope contributes at most the entries that cover that minute. Intervals may overlap inside a scope; when they do, keep the list and mark the minute overlapped. Instants attach to the minute but do not occupy it.

A coherent “moment” is the tuple (activity pen, location pen, mood pen, company pen, screen pen, call, text, instants). Missing scopes stay missing. Do not fill them from another scope except when displaying a `PenLink` that **already painted** a companion — the companion is a real row, so the join does not need the rule. Historical pairing suggestions (what this pen usually overlaps) are a prompt for logging, not a fact about the minute.

`startEventId` / `endEventId` join an interval to instants by id, possibly the same day. If the id is missing, say the edge is dangling.

`spanId` joins slices across dates into one bout before any cross-midnight rhythm is computed.

### 6.2 Tags × minutes

`effectiveTagIds(entry, scopes)` then union the minutes. A chart of “Exercise by location” is: minutes in the Exercise tag set, grouped by the Location pen that covers each of those minutes, with an “location untracked” bin that will often be the largest. That bin is the result, not a bug.

Block-only tags vs pen tags: a minute can carry both. Attribute the tag to “always” if any assigned pen lists it, else “this block.”

### 6.3 Notes × the day and the minute

| Note | Joins to |
|---|---|
| `TimeEntry.notes` | That block’s minutes (intervals) or that instant’s clock. |
| `moodReading` text | That mood block’s minutes. Not copied into `notes`. |
| Day-note append log | The **day key**. Place `createdAt` on a second axis (“written at”). Do not smear the paragraph across all 1440 minutes. |
| `untrackedNotes` | The gap `date\|scopeId\|startMin\|endMin`. If no current gap matches, show it under quality, not on the ribbon. |
| `SleepNight.note` | The night’s `[sleptMin, wokeMin)` on the morning date and the evening before. |
| Count has no note | Only date and minute. |
| Thought `title` + `notes` | The instant. First line is the strand; later lines are notes. |
| iPhone text `title` / `notes` | The instant; both hold the body. |
| GPS `notes === "gps"` | Provenance flag, not a diary sentence. |

### 6.4 Cycles × days

`phaseForDate(date, marks)` and optionally `assessCycleDay`. Join to every day-grain metric and to every minute of that date. A sleep night joins to the **morning** date’s phase by default, with a toggle for the bedtime date when `sleptMin < 0`.

Spotting joins as a boolean on that date. It must not recompute phase.

`enableCycleTracking === false` or `cycleDetailsOpen === false`: do not join phase into other charts. The marks still exist; concealment is a product latch.

### 6.5 Sleep × the grid

Join the night’s derived blocks by `generatedBy.kind === "sleep"` and `generatedBy.id === night.date`. Also join any hand-painted block tagged `tag-sleep` on `nightDateKeys`. Show three layers: the statement (clocks, precision, `updatedAt`, all-nighter), the derived paint, and other paint on those minutes. Disagreement is a first-class view.

### 6.6 Counts × instants

Match a tick to an Intake instant on the same date and `startMin` with the same `intakeClass` when the count has one. Unmatched ticks and unmatched instants both list. Keyword linkage is `CountStatus.keyword` ↔ log-keyword phrase ↔ `eventKind` slug of a `log:` title.

### 6.7 Switches × the following bout

Order declared switches by `startMin` (unknowns last). The following bout is the next Activity interval that starts at or after that minute, compared to `switchTo`. `switchFrom` compared to the previous bout’s pen name. This is a string join (names), not an id join, because `switchFrom` / `switchTo` are strings. Case-fold and collapse spaces the way `eventKindSlug` does, but keep the original on screen.

### 6.8 Screen × activity × sun

Screen rows carry `generatedBy.screentime` or, for the phone, estimated rows on `iphone-screentime` without that stamp. Join on date+minute to Activity. Sun joins on date only, as two minute marks (`sunriseMinutes`, `sunsetMinutes`) that slice the day into dark / day / dark.

### 6.9 Sessions × entries

While a work session or pen-color session is live, `trackingEntryIds` are the open blocks. After stop, those ids may still resolve. A pause (`pausedAt`, `pausedAccumMs`) is time that was **not** painted. Subtracting it from wall-clock elapsed is how “how long I was working” can exceed painted minutes. Report both.

### 6.10 Metrics × the minute cube (optional, external)

Align `MetricDatapoint.at` to date + minute. Attach the presence tuple at that minute. Keep `createdAt` visible when the back-log is real. Missing metric keys stay missing. This join is the only reason the five 0–100 scores appear in a Tracking analytics story, and they should be labeled as the metrics log, not as mood marks. Mood marks are 1–10 on a stretch. These are 0–100 at a minute. They are different instruments.

### 6.11 What not to join

- Plan events and task `timeLogs`, except to interpret `confirmedEventIds` and `estimateOf.kind === "done"`. Those ids point out of Tracking. A plan-vs-lived chart is a different document.
- Habit completions. Tags are the bridge, but the habit’s link, target, and grade live in the habits store. Tracking analytics may show tag minutes; it should not recompute a habit grade.
- Encyclopedia chapters, herbs, and citations. Reference text.
- `hiddenPenIds`, cell size, and sort mode.

---

## 7. Information architecture

One Analytics area called **Tracking**. Default period: the last 28 local days, including today, with empty days kept. Default scope lens: Activity at Exact, with a depth control that does not write the grid’s `displayDepth`. Default certainty: include estimated, and show the quality strip so that choice is visible. A switch, **Observed only**, drops `precision: "estimated"`.

If cycle details are concealed, the Body section omits phase charts and shows the same concealed latch the log uses.

### 7.1 Today

The landing view when the period is one day, and the drill target from every other chart.

- Ribbon of every scope that has rows, plus ticks.
- Quality strip.
- Gap list with `untrackedNotes`.
- Instants in clock order (unknowns in their own group).
- Day notes in append order, with `createdAt`.
- Sleep statement if this date is a morning or the evening before one.

Drill: click a slab → the block (pen, secondaries, tags, variants, title, notes, project, books, pages, mood reading, provenance, span siblings). Click a gap → the note and Fill’s range, without painting from Analytics.

### 7.2 Shape

The default for a multi-day period.

- Calendar of coverage.
- Hour × weekday heatmap of occupancy, then of the top tags.
- Lorenz of pens, and entropy / effective number of pens as sparklines.
- Cluster strip: each day colored by its cluster, named by the median ribbon.

Drill: a day → Today. A heatmap cell → the days that made it. A cluster → the member dates and the motif list.

### 7.3 Library

Vocabulary, not time.

- Pens by scope, tree = `parentIds`, with minutes in the period at the current depth and at Exact.
- Tags with minutes, always-vs-block-only split, and co-occurrence matrix.
- Variant split (pie-legal) and reach (bars) for the selected pen.
- Event-kind table: slug, count, last date, example title.
- Counts: ticks per name, joined or unmatched to instants.

Drill: a pen → its bouts, its transition row, its links, its action templates (as labels, not as a second total). A tag → the minute set as a ribbon across days.

### 7.4 Rhythms

- Clock profile vs sun-relative profile.
- Sleep timeline and midpoint.
- First and last paint, time-to-first-log after wake.
- Intake and thought and switch clocks.

Drill: an hour → the blocks in that hour across the period.

### 7.5 Attention

- Transition matrix (paint changes and declared switches, toggled).
- Survival curves of bouts.
- Switch tax.
- Screen icicle (Mac and iPhone as two trees, never summed into one pen id).
- Screen category vs Activity pen table.
- Call minutes and text counts by person.

Drill: a matrix cell → the switches. An app → its intervals and, if titles were stored, the titles.

### 7.6 Body

Shown in full only when cycle details are open; sleep and mood and intake still show when cycle tracking is off.

- Cycle calendar, marked vs estimated, basis note, median cycle and luteal source.
- Phase small multiples of the day shape, marked days only by default.
- Mood: by word, then marks with `n`, grasping with and without `about`.
- Intake shelves.
- All-nighters and rejected sleep spans.

Drill: a phase → the dates. A word → the stretches that share it, each still its own row.

### 7.7 Language

- Day notes: volume by writing day vs by day key (the delay).
- Thought-process list in time order, not a word cloud.
- Repeated `eventKind` phrases.
- Find, using the same fields Tracking search already indexes, then a tiny calendar of hits.

Drill: a note or a thought → that minute’s presence tuple.

### 7.8 Quality

Always one click away, and summarized by the strip on Shape.

- Overlaps inside a scope.
- Open-until-midnight tails.
- Estimated share by `generatedBy` kind and by “no stamp” (hand-hatched, phone, GPS).
- Unknown clocks.
- Dangling `startEventId` / `endEventId`.
- Dangling untracked-note keys.
- Count ticks vs instants.
- Sleep statement vs derived blocks vs other paint.
- `removedEntryIds` count (tombstones exist; they are not a history of edits).
- Retroactive sleep edits (`updatedAt` far from `date`).
- Screen Time `lastSyncNote` / `lastError` so a hole caused by a dead watcher is not called a life change.
- Recovered pens (name “Recovered pen”) so a deleted vocabulary is visible.

### 7.9 Defaults that keep the first session honest

- 28 days, empty days included.
- Activity, Exact, all four presence scopes available as ribbon toggles.
- Estimated included, quality strip visible.
- No forecast caption until the weekday baseline has a computed error.
- No phase effect sentence below three marked days.
- No association rule below eight supporting days.
- Unknown clocks never placed at midnight on a clock chart.
- Pies only for partitions (variant split, tag split **within** a parent’s shares, screen tree shares).

---

## 8. Edge cases and data-quality signals

The surface should show these, not smooth them.

| Signal | Why it happens | What to show |
|---|---|---|
| Sum of durations ≫ occupancy | Overlapping intervals, usually derived sleep on hand-painted work. Both are kept on purpose. | Occupancy as the headline. Overlap minutes as a quality count. A toggle to see both layers. |
| Day coverage over 100% if someone sums scopes | Scopes are parallel, not a partition of the day. | Never add Activity + Location + Mood into one “hours lived.” |
| Tag total over 100% of the day | A minute can carry several tags. | Percents of the day may exceed 100. Percents of tagged minutes need a defined denominator. |
| Variant reach over 100% of the pen | Two details at once. | Bars, not a pie. |
| Untracked day that still has ticks | Instants do not occupy. | “No occupied minutes; 6 events.” |
| Unknown clocks at 00:00 | Placeholder minute `0`. | Badge “Unknown.” Exclude from hour histograms. |
| Open until midnight | `currently`, `at:`, `mood:`, `start:` paint through 1440. | Mark the tail “asserted to end of day.” Do not let it dominate entropy or “you were in transit for 9 hours.” |
| GPS stretch to 15 minutes and bridge to 45 | So a sample is visible, and a short dropout stays put. | Label `notes === "gps"`. Do not treat a 15-minute block as a visited duration without saying it may be one sample. |
| Coordinates absent | Last fix is a side blob. Entries have a pen name and `"gps"`. | No map unless a later design stores lat/lon. This vision does not pretend they are on the row. |
| iPhone call of 1 minute | No duration in the phrase. | Count it as estimated and as a default, not as a measured call. |
| iPhone Screen Time vs Mac Screen Time | Different pen ids, different stamps. | Two trees. Summing “Work” across them double-counts nothing in time only if you union minutes; summing the **categories by name** without unioning minutes will double-count a minute that somehow existed in both. Union if you combine. |
| Screen Time holes before the watcher existed | No backfill. | Say “no watcher,” especially when `lastSyncNote` or `lastError` is present. `lookbackDays` limits repair. |
| Pieces under `minDurationSec` | Dropped before they become entries. | The fragmentation metric is a lower bound on switches. |
| Window titles off | Default. | Do not show an empty “top windows” chart. |
| Estimated Screen Time | Every Mac screen row is `precision: "estimated"`. | Observed-only mode will **blank** Screen Time. Say that, or the person will think the watcher died. |
| Sleep rejected | Span ≤ 0 or &gt; 20 h. | “These two clocks contradict,” not a duration of 0. |
| All-nighter | Clocks cleared. | A mark. It breaks sleep streaks. It is not 0 hours of sleep in an average unless the chart is “nights including all-nighters,” which should be a separate average. |
| Sleep recorded later | `updatedAt`. | “Written 3 days after the morning.” |
| Hand paint vs derived sleep | Re-derive does not delete hand paint. | Both layers. |
| `estimateOf.import` | Type only. No writer. | Do not build an import cohort. |
| Place-as-assumed | Hatched, `estimateOf.done`. Confirm clears precision, keeps the stamp. | “Assumed from a finished item” vs “confirmed.” |
| Scissors | `splitAfter` blocks a merge. | Two bouts, even if the pen matches. The seam is intentional. |
| `spanId` forgotten | Two rows that abut at midnight with the same pen may be one night or two decisions. | Merge for display only when `spanId` matches. Abutting without `spanId` stays two, with a hint. |
| Parallel parents | Shares at a collapsed depth sum to the block. Secondary pens still take the full block. | Label the depth. Do not add share-minutes to secondary-minutes. |
| Recovered pen | Pen id on an entry, missing from the scope. | Name “Recovered pen,” stable color. Quality list. |
| Hidden pen | Still in the totals. | Do not omit it from analytics just because the well hid it. |
| Dangling pen link | `PenLink` to a deleted scope or pen paints nothing. | “This rule points nowhere.” |
| Dangling event edge | `startEventId` not in `entries`. | “Start event missing.” |
| Dangling gap note | Key no longer matches a gap. | Quality list, not a ribbon label. |
| Count deleted, instant kept | By design. | Unmatched instants. |
| Instant painted, count not incremented | A tick happens only through the count or a bound keyword. | Unmatched the other way. |
| Tombstones | `removedEntryIds` prevent resurrection. They are not an edit log. | “N deletions remembered.” You cannot see what the row used to say. |
| No `updatedAt` on `TimeEntry` | Retroactive drags, splits, and repaints are invisible except by undo, which is not persisted as analytics. | Do not claim “edited on.” Sleep, pens (`editedAt`), and day notes (`createdAt` vs day key) are the honesty stamps you do have. |
| Day-note union | Entries are immutable and union by id across storage aliases. | Duplicates should not appear if ids match. Legacy `createdAt: null` is “earlier,” not midnight. |
| Cycle spotting | Stored, ignored by phase. | A dot. |
| Cycle gap &lt; 18 or &gt; 60 | Not used for the median. | Show the gap as excluded. |
| Luteal prior | 14 days when no marked pair. | `lutealSource: "prior"`. Do not call it this body’s luteal length. |
| Estimated phase | Guess beside the marks, lower confidence. | Hatch. Never replace the solid. |
| Cycle latch off | Feature or privacy. | No phase charts. |
| Company “In conversation” | A child of Together, with variants. | At Kind depth it shares into Together. At Exact it is its own pen. |
| Mood pen vs mood word | The pen is the paint; `word` is the spelling on the stretch. They can differ. | Charts of color follow the pen. Charts of language follow `word`. |
| Blank mood mark | Omitted, not zero. | Means use `n` of set marks only. |
| `pages` without a duration | A tick or a zero-length mistake. | Exclude from rate. |
| Books as free text | “Dune” and “dune ” will split. | Normalize for grouping the way mood words are normalized; show the newest spelling. |
| Military vs 12-hour mistakes | Bare `6:37` is 06:37. | A burst of event kinds at 1:00–9:00 that the person describes as evening is a clock-parse suspicion, not a finding about dawn. Offer it only as a quality hint when titles say night and `startMin` is morning. |
| Text pipeline stamp | `generatedBy.text` and a note suffix “from text pipeline.” | Filter: phone/bot vs grid brush. |
| Live pause | `pausedAccumMs` is not painted. | Session elapsed ≠ block duration while the session exists. |
| Confirmed events | Ids on the store, not on the row. | You can count the list. You cannot, from the list alone, draw those blocks on a calendar. |
| Superimpose | A view pref. | Not a fact about the day. |
| Fill clocks | Fallback when the day is fully untracked. | Not bedtimes. |

---

## 9. What this vision refuses to flatten

Tracking is several instruments written into one interval type.

The brush (certain, hand-painted). The sleep statement (a morning, two clocks, a precision, an edit time). The watcher (estimated, replaceable, AFK-aware, title-shy). The phone phrase (estimated, sometimes one default minute, sometimes a GPS sample grown to fifteen). The sentence (`log:`, `switch:`, thought, note) with a clock that might be unknown. The tally (ticks that may or may not have painted). The cycle (three flags and a derived phase, plus a labeled guess). The day jot (immutable, stamped when it was written).

An analytics tab that adds those into one “hours” number will be precise and wrong. The tab this data deserves keeps the minute as the join, the union as the occupancy, the hatch as the doubt, and the empty day as a day.
