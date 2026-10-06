# Time context — analyze only certain kinds of time

**Not built.** Analytics can search blocks and redraw Tracking on the words that matched. It cannot yet show “only time at home” or “alone vs with Elijah”. This file is the design for that, so a later change does not invent a second clock.

A **slice** is a predicate over blocks that already exist (`TimeEntry` in `lib/time-entries.ts`). Every measure that already runs on a list of entries — `totalsFor` / `penTotalsAtDepth` / `tagTotals` / `tagWeekTrend` in `lib/tracking-summary.ts`, the period filmstrip (`components/Analytics/period-filmstrip.ts`), day and week color strips (`components/Analytics/grain-strips.ts`), hour × day (`components/Analytics/hour-day.ts`), circadian, diversity, places, up/down (`components/Analytics/period-delta.ts`) — runs again on `entries.filter(predicate)`. The stores stay as they are.

Find blocks (`components/Analytics/block-search.ts`, matcher `lib/tracking-search.ts`) is the first predicate in the product, and it is a word match, not a life-context slice. “Show matches in this view” is the pattern to copy: pass the filtered entries into the existing board, omit the rest, and do not call the rest untracked.

## What the record already is

One block is one `TimeEntry`:

| Field | What it holds |
|---|---|
| `scopeId`, `penId` | Which view, and the primary pen (the color). |
| `secondaryPenIds` | Extra pens on the same minutes. They do not change the color. |
| `variantIds` | Details on the primary pen (`PenVariant`). Several may be true at once. |
| `tagIds` | Tags on this block only, on top of tags the pens always carry (`effectiveTagIds` in `lib/tracked-time.ts`). |
| `title`, `notes`, `project`, `books`, `pages` | Words and a page count. Counting still uses pens and tags. |
| `moodReading` | Mood scope only. The word on that stretch, the body, the water, the heaps, tone, and optional 1–10 marks. Omitted when empty. Not copied into `notes`. |
| `startMin`, `endMin`, `date` | Local clock and civil day. Instants (`kind: "instant"`) have no duration. |
| `precision` | Omitted = certain. `"estimated"` = hatched / assumed. |
| `estimateOf` | `{ kind: "done" \| "import", id }` when an assumed block was proposed from a Done item or an import. Confirming clears `precision` and leaves the stamp. |
| `generatedBy` | `{ kind: "sleep" \| "screentime" \| "text", id }` when a sync wrote the block. |
| `spanId` | The two civil-day halves of one block that crossed midnight. |
| `startEventId`, `endEventId` | Instants named as the start or end of an interval. |

Pens live on a `TrackScope` (`lib/time-tracking-store.ts`). A pen may nest (`parentId` / `parentIds` — counts-as, `lib/pen-tree.ts`), carry tags, variants, standing cross-scope `links` (`lib/entry-links.ts`), and `actionFormats` (`lib/pen-action-sync.ts`).

Seeded scopes in `defaultScopes()`:

| Scope id | Name | Seed pens / depth labels |
|---|---|---|
| `activity` | Activity | Work, Rest, Exercise, Social, Chores, Sleep. Depth: Category / Activity / Exact. |
| `location` | Location | Home, Work, Outside, Transit. Depth: Country / Area / Place / Exact. |
| `mood` | Mood | Any pen name. Great, Good, Meh, and Low are starter pens, equal to any other. A stretch may also carry `moodReading`. |
| `company` | Company | Alone, Together, In conversation (`variantLabel: "Who?"`). Depth: Kind / Who / Exact. |
| `screentime` | Screen Time | Work, Communication, Browsing, Media, System, Other — then apps under those. |
| `iphone-screentime` | iPhone Screen Time | Same category shape, distinct pen ids. |
| `iphone-calls` | iPhone Calls | Empty until people are added. Depth: Who / Exact. |
| `iphone-texts` | iPhone Texts | Empty until people are added. |

Scopes are independent. Four hours can be Work in Activity, Home in Location, and Alone in Company. None of those rows owns the others. `attachCompanion` paints an ordinary block in the other scope over the same minutes, and only into minutes that scope left blank (`lib/entry-links.ts`). The block editor already offers that as Attach / Annotate / Always (`components/Home/Tracking/companion-section.tsx`).

## Rules for every slice

1. **Filter entries, then call the measure.** Do not fork `uniqueMinutes`, the filmstrip, or the hour grid.
2. **The complement is hidden, not untracked.** Untracked means no paint in that scope. A slice that drops Work must not draw those minutes as a gap you failed to log. The search filter already pauses Show untracked for this reason.
3. **Empty means empty.** Zero matching blocks: keep the frame and one sentence (“No blocks at home in this window”). Do not plot a flat zero as a finding. Same bar as `SAMPLE_FLOORS` on interpretive views.
4. **Overlap inside one scope counts once.** `minuteMap` / `uniqueMinutes`. Two blocks on the same minute — derived Sleep on top of Work — are one minute.
5. **Scopes do not add.** Activity + Location + Company on the same hour is one hour of life, three statements. A total that crosses scopes unions `date#minute` keys, the way `tagTotals` already does. Summing the three scopes reports three hours.
6. **A match includes the whole block.** If the predicate is true, the block’s minutes enter the slice once. Do not emit one copy per secondary pen or per ancestor. Display-depth rollup (`penTotalsAtDepth`) is a separate question and already splits a multi-parent block so the shares sum to the block.
7. **Instants stay off occupancy.** They may appear in a list. They do not color a strip or fill an hour.
8. **Say which record you read.** “With Elijah” might be a Company variant, an Activity “Who with?” variant, or both. The slice names its source. It does not add the two.
9. **The shared Analytics window stays the window.** A slice narrows blocks inside it. It does not invent a new range. Prev / Next (`previousAnalyticsWindow`) applies the same predicate to the previous window when the comparison is “did this kind of time go up”.

Suggested shape, next to the search helper, not inside the tracker:

```ts
type Slice = (entry: TimeEntry, ctx: SliceContext) => boolean
// ctx: scopes, tags, the other entries (for cross-scope minute overlap)
```

`SliceContext` is read-only store data. The predicate must not paint, sync, or allocate ids.

Showing two slices side by side (home vs away, alone vs with Elijah) is two filtered runs of the same component, not two datasets. The week strip drawn twice is the picture. A small multiple. A trend whose series was filtered before `tagWeekTrend` / the filmstrip / the hour grid.

## Location

**Question.** Where did the week happen? What does Activity look like on days that were mostly home, versus days that were not?

**Collect.** A Location block on those minutes: primary pen (`loc-home`, or a nested place such as a park that counts as a city). Depth labels are already Country / Area / Place / Exact. No coordinates exist. `PlacesView` (`components/Analytics/PlacesView.tsx`) is time-at-pen for the Location scope. It is not a map, and it is not “activity while at home”.

**Invite.** The companion row on the block already open: one click fills Location for the minutes Activity left blank in that scope. A standing pen link (“this place always means Social”) is the Always gesture, offered after a pairing exists, not before. A hatched estimate — last place, drawn `precision: "estimated"` — can sit on the gap until the person confirms it. Do not prompt on every stroke.

**Show.** The same week strip twice: home and not-home, same pen colors, same axis. Or the day-color strip (`GrainStrips`) computed only on minutes that overlap a Home block. Places stays the “how much time in each place” view; the slice is “everything else, given the place”.

**Honesty.** “At home” is Location entries whose pen or counts-as ancestor is Home. Minutes with no Location paint are neither home nor away — an unknown band, named, not folded into away. Overlapping Location pens on one minute count once.

**Today.** Location scope, pens, nesting, Places mosaic, companion attach. **Not today:** a control that filters Activity (or any other scope) down to minutes that overlap Home.

## Company

**Question.** What happened alone, and what happened with a named person? Who shows up together?

**Collect.** Company is its own scope (`defaultCompanyScope`): Alone, Together, In conversation, and a “Who?” variant whose `penId` is that person’s pen (detail chips and counts-as are the same fact — `lib/pen-detail-sync.ts`). A person can also be an Activity variant on Social (“Who with?”). Those are different statements.

**Invite.** Same companion row: Annotate is where the name lands while the block is open. Alone can be the default only as a hatched estimate, never as a silent fact — an unmarked afternoon is unknown company, not alone. One tap for the last person you actually logged, not a picker of everyone you have ever named.

**Show.** A small multiple: the Activity filmstrip (or the day strip) for blocks whose minutes overlap Alone, beside the same strip for blocks that overlap Elijah. Combinations (Elijah and Rebecca on one hour) use the split that already exists: `combinationTotals` partitions, `variantTotals` is reach and may exceed 100%. Label which one the multiple is.

**Honesty.** Reach bars overlap on purpose. A pie of company must be the split (each minute in one combination) or it will not add to the hour. Do not add an Activity “Elijah” variant to a Company “Elijah” block. Unknown company stays out of both Alone and Elijah.

**Today.** The Company scope, variants, and split/reach in the Tracking drill. **Not today:** an alone-vs-Elijah comparison, or any company filter.

## Activity, place, person, tool, body, media, obligation, sleep, travel, indoors

These are not extra columns. They are scopes and pens, or they are absent.

| Dimension | Question | Where it lives now | Collection | Picture | Empty / double-count | Ready? |
|---|---|---|---|---|---|---|
| Activity | What was the person doing? | `activity` scope. | Paint, or a companion from another scope. | The Tracking board that already exists. A slice is that board after a predicate. | One owner per minute inside the scope. | Ready as a scope. Not ready as a filter on other scopes. |
| Place | Which place, finer than home/away? | Location pens and counts-as (park under city under country). | Paint the leaf. Nesting is retroactive (`docs/COUNTS_AS.md`). | Places mosaic at a depth, or the day strip at that depth. | `penTotalsAtDepth` splits one block across distinct ancestors so shares sum to the block. An ancestor reached twice is paid once. | Ready to total. Not ready to slice other scopes by place. |
| Person | Who was there? | Company variants, Activity “Who with?”, iPhone Calls / Texts pens (those two scopes start empty). | Name the variant once; the pen is created with it. | Small multiple per person, plus a split pie when two people share an hour. | A person in two scopes is two records. Pick one source per slice. | Names can be stored. The comparison is future. Calls/texts are empty until import. |
| Tool | Which app or instrument? | Screen Time category pens and apps (`screentime`, `iphone-screentime`). Not a field on an Activity block. | ActivityWatch sync (`generatedBy.kind === "screentime"`) or a pen the person adds. | Screen Time view already. A slice would be “Activity during minutes a given app owned”, joined on the clock. | Screen Time and Activity both describe the same hour. Union before any cross total. AFK stays untracked in that scope. | Apps can be painted by sync. Joining them to Activity is future. |
| Body state | Sick, pain, hungry, substance? | A mood stretch can hold a sensation for that hour. It is not a body-state scope. | A scope the person adds, or a tag, for a body that outlasts one stretch. | Same strip language, once paint exists. | Unknown body is blank, not “fine”. | Sensation on a mood stretch is ready. A body scope is **future collection.** |
| Media | What was on? | `books` / `pages` on the block. Screen Time “Media” category. No show/album id. | Type the book on the block, or let Screen Time name the app. | A list of blocks with `books` set, and the Media pen’s minutes. | A book title does not duplicate the block’s duration. | Pages and the Media pen are ready to list. A media library is future. |
| Obligation | What was required? | Not on `TimeEntry`. Tasks, `timeLogs`, and Plan vs Reality (`components/Analytics/PlanVsReality.tsx`). | The plan and the to-do, which already exist. | Planned minutes beside painted minutes — that view is already there. | Do not add task estimates on top of painted minutes and call it the day. | The comparison view is ready. A slice of “blocks that were obligations” needs a link the block does not have yet. |
| Sleep | When was the night? | Sleep pen, `tag-sleep`, and `generatedBy.kind === "sleep"`. Nights also live in `lib/sleep-log.ts`. Sleep Analytics reads both. | Sleep log sync. Hand paint remains. | The 6pm→noon strip in `SleepAnalytics.tsx`. A slice is “days whose night was short”, which needs the sleep record, then a filter on other entries that share `date`. | Sleep-derived paint sitting on hand paint counts once in occupancy. Sleep sync skips action-format Done rows because the night already has one (`lib/pen-action-sync.ts`). | Nights are ready. “Everything else on short-sleep days” is future. |
| Travel | In transit, or a trip? | Seed pen `loc-transit` (“Transit”). No trip id, no from/to. | Paint Transit, or a nested place. | Transit’s minutes on the Location board, or a slice of Activity that overlaps Transit. | Transit is a place pen, not a third timeline. | The pen is ready. Trip structure is **future collection**. |
| Indoors / outdoors | Inside or out? | No boolean. Seed pen `loc-out` (“Outside”). A person can nest places under it. | Use that pen, or add Indoor / Outdoor as parents and nest. | Two strips, outside vs not, with an unknown band for minutes that have neither. | “Not outside” is not “indoors” unless an indoors pen was painted. | **Future** as a pair. Outside-as-a-pen is ready to total. |

## Primary pen vs secondary pens

**Question.** What else was true on this color? A youtube block that also counts as studying.

**Collect.** `secondaryPenIds` on the block. Older vaults omit it. The primary stays `penId`.

**Invite.** The block editor already edits secondaries. Do not ask again in Analytics.

**Show.** Search already matches secondary names (`match: "also"`). A slice “counts as studying” includes blocks where studying is primary or secondary, and still counts the minutes once. The filmstrip keeps the primary color; a second caption or a hatch can name the secondary so the strip does not become two clocks.

**Honesty.** Tags and habit links already use `assignedPenIds` (primary plus secondaries) via `effectiveTagIds`. A slice must use the same list or the habit total and the chart will disagree. Do not sum primary duration and secondary duration.

**Today.** The field, the search match, and tag/habit rollup. **Not today:** a secondary-pen slice control.

## Counts-as ancestors

**Question.** How much time was “San Diego” when the paint says Ocean Beach? How much was Exercise when the paint says Walk?

**Collect.** `parentId` / `parentIds` on the pen. Painting still writes the leaf. The rollup is computed when you look (`docs/COUNTS_AS.md`, `ancestorChains` in `lib/pen-tree.ts`).

**Invite.** Pen settings, not a prompt at paint time. Nesting is retroactive, so the invitation is “this place has no parent” in the pen dialog, once, not on every block.

**Show.** Display depth already does this on Tracking, the filmstrip, and the day/week strips. A slice “counts as Exercise” is `ancestorChains` containing that pen — for any assigned pen, primary or secondary. Search already does the word version (`match: "counts as"`).

**Honesty.** Two different questions, both already implemented as math: “blocks whose chain includes Exercise” (the whole block) and “minutes rolled up to Exercise” (`penTotalsAtDepth`, shares sum to the block). A pie uses the rollup. A block list uses the predicate. A pen with two parents splits; it is not paid twice to the same ancestor.

**Today.** Depth control, rollup, search. **Not today:** a saved slice “only what counts as X” separate from the depth control.

## Confirmed blocks vs hatched estimates

**Question.** What did the person assert, and what did the app assume?

**Collect.** `precision: "estimated"` on the assumed block. Certain blocks omit `precision`. `entryFill` hatches estimated color on the grid. Analytics already has Include assumed (`withPrecision` drops estimated blocks when the box is off).

**Invite.** Write the guess as estimated — last place, last company, a Done item’s clock — and let a review confirm it. Confirming deletes `precision` and keeps `estimateOf` so the same source is not proposed again. Do not nag each hatch; the review ritual is the moment.

**Show.** Two readouts, or the same strip with hatched cells for estimated minutes and solid cells for confirmed. The existing Include assumed toggle is the coarse version (in or out). A slice can be `precision === "estimated"` or its absence.

**Honesty.** An estimate and the confirmed block that replaced it must not both be in the total. Confirmation clears the flag on that block; it does not leave a second row. Coverage with assumed blocks included must say so.

**Today.** The flag, the hatch, Include assumed. **Not today:** a side-by-side confirmed vs assumed strip.

## Planned vs actual

**Question.** What was supposed to happen, and what was painted?

**Collect.** Plans are tasks and calendar events, not fields on `TimeEntry`. `confirmedEventIds` on the tracking store records which calendar events the Day Log has already turned into blocks. `PlanVsReality.tsx` compares planned minutes to painted minutes. Capacity vs the waking window is labeled `~` when sleep is inferred.

**Invite.** The Day Log confirm gesture, which already exists. Analytics should not grow a second planner.

**Show.** The plan view is the comparison. A later slice can be “painted blocks that came from a confirmed event” only if the block stores the event id. It does not, today — the id list is separate — so that slice waits on a stamp, or on a join through `confirmedEventIds` that a person can audit.

**Honesty.** Planned minutes and painted minutes are different lists. Adding them double-counts the afternoon. Unpainted plan time is not untracked grid time.

**Today.** Plan vs Reality, and the confirmed-event id list. **Not today:** a Tracking slice of only planned blocks.

## Imports

**Question.** What arrived from a sync, and what was brushed by hand?

**Collect.** `generatedBy` (`sleep`, `screentime`, `text`) and `estimateOf.kind === "import"`. Hand paint has neither. Text pipeline views (`TextPipelineView`) already isolate `generatedBy.kind === "text"`.

**Invite.** Imports should land hatched when they are guesses, solid when the source is a log (sleep, ActivityWatch). The person confirms or clears. No extra form.

**Show.** A caption on the strip (“from Screen Time”) and a slice that keeps or drops `generatedBy`. The text views are the narrow version already shipped.

**Honesty.** A sync must replace only its own `kind`+`id`, which the store already does, so a re-import cannot delete hand paint or stack a second copy. A slice of imports plus a slice of hand paint should partition the scope, with an explicit overlap row if both claim one minute.

**Today.** The stamps, sleep/screen/text views. **Not today:** one toggle for all imports across Tracking.

## Completion and Done linkage

**Question.** Which painted time became a thing that was done, and which Done rows have no block?

**Collect.** `actionFormats` on the pen. `lib/pen-action-sync.ts` writes a `loggedAction` task keyed by `trackingEntryId` when a primary or secondary pen has a template (`docs/PEN_ACTION_FORMATS.md`). `estimateOf.kind === "done"` is the other direction: a Done item proposed a hatched block. Habit links are tags, not this (`lib/habit-tracking.ts`).

**Invite.** The template lives on the pen. Painting is enough. A title the person edited in To-Do is left alone. Do not ask Analytics to create the Done row.

**Show.** On a block list, a mark when a `pen-action-` row exists. A slice “blocks that logged a Done row” joins on `trackingEntryId`. The reverse list — Done rows with no block — belongs next to it so the gap is visible.

**Honesty.** The Done row is not more time. Duration stays on the block. Sleep-derived blocks skip action formats because the night already has a Done row. Deleting the block deletes the generated row unless the title was hand-edited.

**Today.** Formats, sync, search over the template text (`match: "action"`). **Not today:** a Tracking slice of only blocks that produced Done rows.

## Time of day, weekday, season, grain

**Question.** When in the day, which weekday, which season, and at which grain is the pattern visible?

**Collect.** Nothing extra. `startMin` / `endMin` and `date` are the clock. Seasons in this app are calendar quarters (Q1 Spring … Q4 Winter) as used by `SeasonsView` and the range chips — not a field on the block.

**Invite.** None. The paint is the collection.

**Show.** Already shipping, on the full set: hour × day and the Cleveland weekday cycle (`CircadianView`, `hour-day.ts`), weekday vs weekend (`signal-stats.ts`), the minute filmstrip, the day and week color strips, up/down against `previousAnalyticsWindow`. A slice reuses them unchanged. “Evenings at home” is the location predicate, then the hour grid. Season is the Analytics window set to that quarter, then the same board — or a small multiple of four quarters. Do not add a season property to `TimeEntry`.

**Honesty.** Missing hours are 0 only inside a grid that means “no paint”, and the caption must say so (Circadian already treats empty as missing, not as work). A weekday average includes blank weekdays in the denominator, matching `weekdayWeekendCut`. Instants do not fill hours.

**Today.** All four grains as views of everything in the window. **Not today:** those views locked to a context predicate.

## Duration shape

**Question.** Short ticks or long blocks? Did the day fragment?

**Collect.** `endMin - startMin`. Instants are the zero case (`kind: "instant"`). `splitAfter` keeps a scissors cut from merging back.

**Invite.** None.

**Show.** The block-length violin on Tracking is this, for the whole scope. A slice is the same violin after the predicate (“length of blocks at home”). The day strip answers a different question (which pen dominated), not how long the blocks were.

**Honesty.** Overlapping blocks are two lengths and one occupancy. Say which number you are showing. Fragments from `switchCount` are pen changes, not durations.

**Today.** The violin and the switch readout. **Not today:** duration of a context slice.

## Overlap and parallel activities

**Question.** What else was true during this hour — another scope, a secondary pen, a variant?

**Collect.** Another scope’s block on the same minutes (companion or hand paint), `secondaryPenIds`, `variantIds`. `spanId` only groups midnight halves; it is not parallelism.

**Invite.** Companion Attach is the one-tap version. Variants are the “Who?” chips. Do not infer a parallel activity the person did not record, except as a hatch they can reject.

**Show.** For one block, the companion section already lists the other scopes. For a week, a slice is the intersection of two predicates on the clock: minutes that are both Work and Home. Draw that intersection as its own strip. The union and the two originals can sit beside it so the overlap is obvious.

**Honesty.** Intersection can be empty while both scopes are full — they did not cover the same minutes. Report the empty intersection; do not fall back to either side. Within one scope, `minuteMap` already picks one owner, so two Activity pens are not “parallel” on the grid; the second record is hidden under the last writer. Parallel means another scope, a secondary, or a variant, not two primaries stacked in secret.

**Today.** Companions, secondaries, variants, and single-owner occupancy. **Not today:** an intersection strip.

## Energy and mood

**Question.** How did the day feel, next to what was painted?

**Collect.** Mood is a scope painted with any pen name. Great, Good, Meh, and Low are starter pens, equal to names the person adds. A mood block may carry `moodReading` (`lib/mood-reading.ts`): the body, optional 1–10 marks (energy, tension, loop, and the rest of the card), the water, and the heaps. A blank mark is omitted, never stored as zero. The five wellbeing metrics stay in `lib/metrics-store.ts`, 0–100, and are not these marks. Completion reviews can carry feelings (`CompletionReviewPlates.tsx`). The derived sentence is not written into notes.

**Invite.** Paint a color, or open the block and fill **This stretch**. BIM `mood:` / `feeling:` paints a word and does not fill the card. Do not impute a missing mood as Meh.

**Show.** Mood field keeps the pen mosaic for whatever names exist, then Same word, The water, and Marks. A painted name with no card stays out of the averages. Logged wellbeing metrics still sit beside that. A metric is per day (or per log), so it colors a day, not a minute, unless a log has a time — do not smear one daily number across 24 hours and call it measured. A slice “Activity on low-mood minutes” is still not built.

**Honesty.** A missing mood is missing. A missing mark is missing. Do not impute Meh. Do not add a wellbeing metric to a pen total. Do not write stretch marks into the wellbeing store.

**Today.** Mood scope, any-name pens, the three-part reading, Mood field plates. **Not today:** Activity filtered by mood.

## Goals and habits

**Question.** Which painted minutes already count toward a habit or a goal?

**Collect.** A habit’s `trackingLink` names tag ids (`lib/habit-tracking.ts`). Tags sit on pens and, per block, on `tagIds`. `lib/habit-tracking-sync.ts` writes `trackedValue` apart from `manualValue`. Goals analytics reads linked completions, not a goal id on the block.

**Invite.** Tag the pen once. The habit link is a setting, not a question at paint time. A block can take an extra tag (the zoo counting as exercise for one afternoon) without retagging the pen.

**Show.** Tag rows and the week/month bars (`TagTrendBoard`, `tagWeekTrend`, `tagMonthTrend`) are the current picture, across scopes, minute-unioned. A slice “only minutes that feed this habit” is `effectiveTagIds` intersecting the habit’s tags, then the filmstrip. The habit grade stays in Habits; Analytics shows the minutes, with `trackedValue` vs `manualValue` named so a typed bonus is not drawn as paint.

**Honesty.** Two scopes sharing a tag on the same minute count once toward the tag (`tagTotals`). The habit sync uses that. A slice must too. A habit with no tracking link has no painted slice — say so, do not show zero paint as a failed day.

**Today.** Tags, links, tag totals, week and month bars. **Not today:** “show the week as only this habit’s minutes” on the filmstrip. That is a slice. The bars are not that slice.

## What to build later, in order

1. A `Slice` predicate and a `SliceContext` beside `block-search.ts`. No tracker rewrite.
2. One comparison that the data can already answer: Location Home vs not-home, unknown separated, the week strip drawn twice. Company alone vs one named person, only if that name exists on Company entries.
3. The same predicate fed to hour × day, the day strip, and up/down.
4. Intersection of two scopes (Work while at home) as a third strip, empty when the clocks do not overlap.
5. Hatched estimates and import stamps as a visible confirmed-vs-assumed pair.

Do not add indoors, body, energy, or trip until something in the vault stores them. Do not add a slice control that only has an empty answer.
