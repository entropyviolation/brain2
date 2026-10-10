# Charter — perfecting the Analytics tab

This folder holds **build briefs** for a later pass that perfects the Analytics tab. The source of what the vault can honestly show is the inventories already written under `docs/analytics-vision/`. This pass does not audit those inventories by rewriting them. A brief may point at them, quote a law they already state, and say where a shipped view must move. It does not replace them, and it does not invent a column they say is missing.

The inventories:

- `docs/analytics-vision/README.md` — what the folder is, and that a language reading is not a stored field
- `docs/analytics-vision/01-tracking.md`
- `docs/analytics-vision/02-habits.md`
- `docs/analytics-vision/03-plan.md`
- `docs/analytics-vision/04-now.md`
- `docs/analytics-vision/05-telegram.md`
- `docs/analytics-vision/06-language.md` — intention over prose already stored
- `docs/analytics-vision/ANALYTICS_VISION.md` — shared spine, joins, Day landing, blocked rooms, appendix of history that is not stored

Sibling briefs in this folder, by filename only, are `01-preserve.md` through `12-waves.md`. This charter does not describe what they contain. A later agent reads each file before treating it as scope.

## Who owns this brief

A **shell / charter agent** owns this file on the later build. That agent checks every other wave against the laws below before the wave is called done. It does not implement charts, plates, or pure math itself. If a wave moves a view, changes a group, or adds a room, this agent confirms the view ids still resolve, the helpers still own the numbers, empty frames stay empty, and the studio kit is the one already specified. Disagreement is resolved by this charter and by the inventories, in that order for shell law and in the inventories’ order for what a number means.

## Binding laws

These laws bind every later brief and every later edit of Analytics.

### Keep every existing view id

`components/Analytics/analytics-tabs.ts` is the list of ids. Tests, the persisted last-view, and screenshot capture click those ids. A rebuild may change labels, group membership, plate order, and which room paints first. It may not rename, drop, or alias away an id.

Groups that exist today: `behavior`, `time`, `accuracy`, `meta`, `library`.

View ids that must keep resolving:

- Behavior: `habits`, `streaks`, `points`, `velocity`, `reflection`, `todo-pulse`, `reviews`, `seasons`, `overcommit`
- Time: `tracking`, `sleep`, `screentime`, `circadian`, `places`, `mood-field`, `diversity`, `transitions`, `context-switch`, `text-events`, `text-spans`, `log`, `cycle-phase`, `operations`
- Accuracy: `plan`, `calibration`, `cycle`, `regret`, `goals`
- Meta: `observatory`, `cross-section`, `metrics`, `correlation`, `spectrum`
- Library: `item-types`, `lists-areas`, `attributes`, `tags`, `stages`, `weight`

`ANALYTICS_TAB_HELP` stays one honest, specific instruction per view. Help names the math the view actually uses (union, skipped missing scores, unknown as a count, estimated versus exact, n, and what a click does). A redesigned plate updates the sentence so it still matches the picture. It does not become a slogan.

A sixth group, Meaning, is specified and unbuilt. See “Homes the inventories do not cover.”

### Keep each view’s math

Each view’s numbers and its pure helpers stay. A redesign **moves and composes**. It does not replace a working chart with a thinner one, drop a series to simplify a plate, or reimplement a measure inside a component so the helper and the picture disagree.

Helpers already named on the studio — including the pure modules beside the views (`cross-section.ts`, `hour-day.ts`, `observatory-findings.ts`, `signal-stats.ts`, and the board stats that Tracking, Log, Cycle phase, and Operations already test) — remain the owners of those numbers. New composition calls them. It does not fork a second occupancy, a second habit grade, or a second Pearson.

Analytics reads the vault. It does not become the writer of tasks, habits, or tracking. Clicking a series still opens the underlying items in Lists where that jump already exists. Derived numbers stay marked `~` / **est.** Interpretive sentences name the subset, the dates, and the share left out. They describe events. The `regret` id stays; the prose does not call the person regretful.

### Honesty of the measures

These rules come from the shared spine in `ANALYTICS_VISION.md` and from the product law in `components/Analytics/README.md`. They override a prettier chart.

- **Occupancy is a union of minutes.** Two intervals on the same minute in the same scope count once. Summing durations can invent a day longer than a day. Instants do not occupy a minute. Tag minutes are unioned across scopes. Display depth is a lens; it does not rewrite paint.
- **Habit raw, curved, and the 50% priority blend stay apart.** Three numbers, three readings. Raw stays visible under curved and under blended. A blend that is off is still named. Zero is never lifted by the curve or the blend. A vacant day leaves the week mean; it is not drawn as zero. A logged zero is data. A cell that was never written is not evidence of a stored zero, even when a named grade puts it in a denominator — and the chart says which formula.
- **Phone versus desk only where a real stamp exists.** “From the phone” is allowed only on the provenance list in the Telegram inventory and the combined vision. Inbox, grocery, night review, `habit:` without a keyword stamp, cycle flags, day notes, and `at:` / `mood:` / `track:` paints have no channel flag. Unstamped writes do not flip a telegram-day flag and do not get a phone-versus-desk bar. A join that exists only while a turn is still in the last 200 is labeled as that join. It does not become a historical share.
- **A blocked metric is an empty frame and a sentence, never a zero.** The blocked-rooms table in `ANALYTICS_VISION.md` is the list: assertion log, write timestamps on `TimeEntry`, attendance, free-block outcomes, frequency-rule instances, channel stamps, ingest `processedAt`, habit-goal snapshots, move history, retained previous intervals, and a joint learned forecast. Frequency rules show the rule as a sentence and an empty frame. Unknown window is “window unknown,” not a stand-in 16-hour day. Plan slip with no clock is “no clock,” not 0.
- **Missing stays missing.** A blank mood, a blank wellbeing key, a missing night, a rejected sleep span, an unknown clock, and a day with no paint are absent. Means use the count of set values and show n. Empty days stay inside every range. The only zeros are the ones a named formula already uses, and the chart names that formula (for example a silent log day counted as 0 logs, or a habit grade’s denominator). Do not impute. Do not draw a missing hour as work.

### What may be rebuilt, and what stays put

Shell, groups, plate order, and new rooms may be rebuilt. The Day landing below is the new first paint. Existing views remain reachable by the ids above. Default remembered view may change only if persistence and tests are updated in the same wave; the ids themselves do not.

Do not restyle Lists, Habits, Plan, or Tracking outside Analytics. Do not restyle the Operations module to match this studio. Analytics still sits in Brain2 beside Lists: keep the `.fm98` title bar and status bar. Range and the left index use the house milled fascia. The canvases are the light instrument studio, not a theme pushed onto the rest of the app.

### Studio kit

Beauty is composition and the existing kit, not a new theme.

- Win95 face (`#c0c0c0` / `--an-paper`), ink `#000000`, Karla only
- Nested milled wells; **white plot wells** (`--an-hi`) inside milled rims
- Phosphor `#3dff8a` **only on traces**, never as a dark CRT theme and never as cream paper
- `.an-plate` with **16px** between plates
- Help and tooltips: `ANALYTICS_TAB_HELP` under the nav, `?` on titled canvases, native `title` on controls, as many as the control actually needs
- Shared primitives already in the studio (pies, treemap, density, mosaic, hour×day, ribbon, horizon, violin, alluvial, beeswarm, slopegraph, UpSet, phosphor scope) are the vocabulary. A new picture uses them. Pen fills stay opaque. Empty charts keep the frame and put one sentence inside it.

### Language readings are guesses

Sentiment, machine learning, language models, embeddings, and word clouds are specified as an **intention** in `docs/analytics-vision/06-language.md`. They read sentences the person already stored (task why, why an action was not taken, gratitude, day / week / month / season plan text, and the other prose that file names). A reading is labeled a guess. It never becomes a pen, a mood, a grade, a phase, a completion, or a plan entry. It does not write a model sentence back as if the person had typed it. Classical counts of that same prose stay the record. No new store.

## Day landing

From `ANALYTICS_VISION.md` (information architecture and “The day as a joint cube”). This is the first paint of the tab. It does not delete the existing views.

One analytics tab. The subject is the vault. The default landing is **one local day**: today, or the last day that has any of the five blocks if today is still empty and the person is looking backward. The 28-day shape is one step away, as five thin calendars, not one blended heat. Empty days stay in every range. When a habit grade is on screen, the as-of date is visible and uses the same rule as the habit grid.

The first paint is the day card. **Five blocks. No single score.** Do not average them into a day score. Do not show a forecast caption until that forecast’s error has been computed.

| Block | What the card holds | When it is empty |
| --- | --- | --- |
| Plan | Commitment minutes, plan occupancy, stacked minutes, banner count, unplaced rail count, day-plan entry count, draft present, from-text entry count, header-plan step count, window-known flag; overcommit only if the window is known | Unknown window is a state, not a fine day. Inbox stays out. Show the empty block. |
| Tracking | Activity occupancy and coverage, entropy and top-pen share at Category depth, estimated share, open-until-midnight tail minutes, sleep duration and midpoint, phase only if the latch is open | Missing or rejected night stays missing. Instants do not fill coverage. Unknown clocks stay out of hour bins. Phase is omitted when concealed. |
| Habits | Raw day %, curved day %, blended day % only if the toggle is on, vacant flag, good-day flag, stone count, named-miss count, echo-stone count | Raw, curved, and blended stay three numbers. A vacant day is omitted from week means and is not drawn as zero. |
| Wellbeing | Count of datapoints whose `at` falls on the date, count whose `createdAt` falls on the date, mean of each key among points that set it, median lag | No points is empty, not a zero vector. Keys absent on a point are skipped. |
| Phone | Telegram-day flag from the high-confidence definition, plus which stamp fired | Unstamped writes do not flip the flag. |

The card’s pictures: tracking ribbon, plan lanes, habit strip (ratios and exempt marks, not fake minutes), wellbeing ticks at `at`, a provenance hairline only on rows that carry a stamp, quality strip with the worst overlapping minutes and the estimated share. Plan commitment may double-count overlaps; tracking occupancy does not. Both labels stay on the card. Offer a second raw percent with echo parents removed, labeled.

**Drill is Day → minute → record.**

- **Day.** The landing card. A calendar cell in the 28-day shape opens this card.
- **Minute.** The cube at that `startMin`: each scope’s covering pen, or missing; instants in a side list (unknown clocks not forced onto minute 0); plan blocks whose windows cover the minute; wellbeing points whose `at` is that minute, with lag. Habit cells do not pretend to occupy the minute. They stay on the day strip unless a tag-minute set, a sleep clock, or a planned-action window actually covers the minute — then the habit is “linked through this minute,” with the link named.
- **Record.** The row itself (`TimeEntry`, event, planned action, task, habit cell, sleep night, metric point, append-log entry, ingest turn if it is still in the last 200). A rotated conversation says the row has rotated and shows the domain stamp instead. Click a gap to the untracked note. Do not paint from this tab.

Quality (the cross-section data-quality room in the vision) stays one click from the day card. It is the legend for trust: overlaps, goal edits that rewrite habit history, vanished plan drags, and the other signals that section already lists.

## History that is not stored

The appendix in `ANALYTICS_VISION.md` is a wish list. None of those fields exist. The tab is designed to be true without them. Until a field exists, its metric is an **empty frame and a sentence**. Do not approximate it with a proxy and then drop the sentence.

Keep these frames empty until the history exists:

| Missing history | The frame stays empty for |
| --- | --- |
| Assertion log (`assertedAt`, gesture, previous pen, origin) | Check-in counts, click time versus occupancy, the overwritten pen, origin of a stamp, calibration of an estimated interval against the exact one that replaced it |
| `updatedAt` or an edit log on `TimeEntry` | “Edited on” for a block; any claim that the ribbon was brushed the day it names |
| Channel stamps on night reviews, cycle flags, day notes, `habit:` cells, and location / mood / `track:` paints | Phone-versus-desk share for those domains |
| Move history on events and planned actions (`createdAt`, `updatedAt`, `movedFrom`, tombstone) | How many times a chip was dragged, and what time it used to occupy |
| Snapshots of habit `goal`, `increment`, `threshold`, `grace`, `floorPercent`, `completionSources` | A dated retarget; the climb staircase for any period before the current increment |

The same rule covers the rest of that appendix (coordinates on a location entry, `eventId` on a confirmed block, a row per frequency-rule occurrence, ingest `processedAt` and the send/pin flags, `advancedBy` on a morning step, a retained previous interval). Each stays an empty frame until the column exists. The minute stays the join, the union stays the occupancy, the hatch stays the doubt, and the empty day stays a day.

## Homes the five inventories do not cover

`01-tracking.md` through `05-telegram.md` do not inventory every view that already ships. Those views still have a home. The shell agent does not drop them because a section report never named them. Their math stays; composition may move their plates.

| Home | View ids | What must survive the move |
| --- | --- | --- |
| Points | `points` | Daily points stacked by source (habit / bonus / task). Top earners open those items in Lists. |
| Velocity | `velocity` | Completions and points per day, plus median time from start (or create) to done. Display only. |
| Reflection | `reflection` | Completion reviews. Legacy satisfaction / resistance / focus / distraction stay on the trajectory; a missing score is skipped, not a 5. Review points, exact vs estimated vs unknown time, the same three marks for starts, expected vs actual difficulty, optional feelings, and which goals or objectives held the hard or joyful work. |
| To-do pulse | `todo-pulse` | Morning walkthrough fields: tier, expected duration, points, day importance, resistance readings, day excitement. Each number is labeled. Text-pipeline mornings stay tagged as from BIM. |
| Seasons | `seasons` | Calendar quarters as seasons (Q1 Spring through Q4 Winter). This year and last year: completions, points, season rituals. Season goals are Goals whose period is Season. Not clipped to the shared date window. |
| Goals | `goals` | Objective contribution and neglected goals in the window, plus which linked goals held the harder or more enjoyable work. Open those items in Lists. |
| Operations | `operations` | Operation items: stage/category mosaic and work vs neglect from time logs, plus the after-action debrief the view already computes. Does not restyle the Operations module. |
| Regret | `regret` | Accrued cost of important items sitting undone past due. Not a to-do list. |
| Library | `item-types`, `lists-areas`, `attributes`, `tags`, `stages`, `weight` | Item Types stays a first-class Library view; Settings still edits types. Lists sized by count, attribute histograms from schemas that exist, tag area and exact combinations, lifecycle stage (not a list name), importance / cognitive load / entropy with missing values left missing. |

**Meaning** is specified in `docs/JungBrain2.md` and is not in `analytics-tabs.ts` yet. It is a sixth studio group, default on, hideable from Settings. Tabs named there: Coincidence, Symbols, Exceptions. A series shows an observed count and an expected-by-chance count. The person marks a run. The app never marks a run meaningful on its own. Causal groups stay as they are. Hiding Meaning removes that group from the index and leaves Behavior, Time, Accuracy, Meta, and Library working. Symbols and Exceptions render an empty studio frame until their records exist. This charter does not build Meaning; it reserves the home so a later wave cannot treat the group as out of scope or fold it into a causal chart.

## How a later wave uses this file

1. Read this charter, then the inventory files the wave touches, then the sibling brief for that wave.
2. Preserve every view id and the pure helper that already owns each number.
3. Compose plates in the studio kit. New rooms are allowed. A thinner replacement of a working chart is not.
4. Paint Day as five blocks with drill to the minute and the record. Leave empty days in range.
5. Where the appendix says the history is not stored, ship the empty frame and the sentence.
6. Leave language readings labeled as guesses, cited to `docs/analytics-vision/06-language.md`.
7. The shell / charter agent signs the wave against this file. It does not implement the charts.
