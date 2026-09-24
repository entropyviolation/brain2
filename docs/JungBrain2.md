# Jung × Brain2 — implementation plan

Sep 23, 2026 · @allie

The source essay is [`jungideas.md`](jungideas.md). How this sits with the map and the loop: [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). This file is the meaning instrument. Do not re-sequence the work from that brief.

This file is the work order: ten slices, the files they land in, and what done means. Execute this part. Do not re-sequence the work from the essay. The product chrome never names Jung, synchronicity, archetypes, oracles, or the I Ching.

Nothing in this wave is built yet. Existing groups, review periods, and persist keys stay as they are until the slice that owns them says otherwise.

## How to read this

A coincidence is shown and never claimed as a cause. A run lists its members, its date, the count observed, and the count expected by chance. The person may mark a run **meaningful** or **chance**. The system never writes that mark itself. Thin windows stay watermarked under the same `SAMPLE_FLOORS` habit as Observatory (n below 7 is not a finding).

Derived numbers stay labeled. A sentence describes events ("3 days fell outside this pattern") and names the dates. It does not say what the person is.

Labels in the product:

| Idea in the essay | Label on screen |
| --- | --- |
| Synchronicity / fish series | Coincidence |
| User judgment of a run | Meaningful / Chance |
| Outlier day question | Exception |
| Dream symbols | Symbol |
| Impasse prompt | Ask sideways |
| Whole-life arc | Season |
| Sixth Analytics group | Meaning |

## Decisions that keep the current app intact

**Meaning group toggle.** One setting, `showMeaningViews`, on `lib/user-settings-store.ts`, default **on**. Settings copy: "Show Meaning views in Analytics." When off, the studio index omits the Meaning group and a remembered Meaning tab falls back to Habits. Capture, marks, dream items, seasons, affect, and Ask sideways keep writing. Turning the setting back on shows the same records. Causal groups are unchanged either way.

**Season is not a `ReviewPeriod`.** `ReviewPeriod` stays `"day" | "week" | "month" | "quarter" | "year"` (`lib/types.ts`). A season is its own record with a start date, an optional end date, a name, and an aim. Direction and the ribbon compute over that date span. Period math, the review dropdown, and the period cursor do not grow a sixth key.

**Affect tokens do not reuse bare `~`.** Estimates already use `~` and the est. chip. BIM suffixes for this wave are `!!` (charged), `!?` (stuck), and `--` (low). Calm is the absence of a mark. A bare trailing `~` stays an estimate hint if one already exists; this slice does not claim it.

**Dream text stays on the morning review.** `PeriodReview.morning.dream` remains the ritual field. A non-empty save also upserts one Dream item for that date so symbols and recurrence have an Item. Clearing the dream field does not delete a Dream item the person has edited; it stops the upsert from overwriting a hand-edited body.

**Handoff.** Yearly answers store on the year `PeriodReview` first. When GS-6's handoff exists, the same three lines copy into it. This wave does not wait on Wave 13 and does not invent a second handoff type.

**No runtime model.** Scanners, draws, and glyphs are deterministic. A module deck is a List the module already owns. An LLM is not called to judge a coincidence or write a card.

## Data added (all optional, all dated)

Additive fields and one small persist slice. No migration that rewrites existing items.

```ts
type CaptureAffect = "calm" | "charged" | "low" | "stuck"

// On Task / Item, optional. Absent means unmarked.
affect?: CaptureAffect
affectAt?: string // ISO, set when the mark is chosen

// On PeriodReview.morning, optional. Asked only when yesterday is an exception day.
exceptionNote?: string
exceptionDateKey?: string // YYYY-MM-DD of the unusual day
exceptionMetrics?: Array<"habits" | "points" | "mood" | "reflection">

// On a year PeriodReview, optional.
afternoon?: {
  rules: Array<{ id: string; kind: "habit" | "affirmation" | "list-rule"; verdict: "keep" | "revise" | "retire" }>
  neglectedObjectiveId?: string
  finishedOnPurpose?: string
}

type CoincidenceVerdict = "meaningful" | "chance"

interface CoincidenceMark {
  id: string // sha of dateKey + kind + key + sorted member ids
  dateKey: string
  kind: "tag" | "word" | "type"
  key: string
  verdict: CoincidenceVerdict
  markedAt: string
}

interface LifeSeason {
  id: string
  name: string
  aim: string
  startedOn: string // YYYY-MM-DD, inclusive
  endedOn?: string // inclusive; open season has none
}
```

Dream items use a catalog type `dream` (seeded once, user-editable, same pattern as `lib/catalog-types.ts`). Attribute `symbols` is `multistring`, user-defined values. Glyph threshold is three distinct dates, computed at read time, never stored as a flag that can drift.

Coincidence marks live in a new persist slice `lib/coincidence-marks.ts` (key via `persistKey`, cap a few thousand, append-only verdicts). Seasons live in `lib/life-seasons.ts`. Neither slice is a second item graph.

## What a coincidence is

Pure function `scanCoincidences` in `lib/coincidence.ts`. Input is a vault snapshot plus an inclusive date window. Output is dated series. No store writes.

A **member** is one dated record in one room:

| Room | Record | Date used |
| --- | --- | --- |
| Inbox | item with `stage === "inbox"` | `createdAt` local date |
| Lists / Docs | any other item body or title | `createdAt`, or `updatedAt` when the body changed that day (`lib/item-activity.ts`) |
| Tracking | painted block | the block's local date |
| Morning | `morning.dream` text | the review's `periodKey` |
| Completion | post-mortem note or completed item | completion local date |
| Phone | parked phone-note item | `createdAt` |

A **series** is one tag, one item type, or one word (length ≥ 4, stop-words dropped; splitter local to this file, not `lib/search.ts`'s private `tokenize`) that appears in **two or more rooms** on the same local date, on members that are **causally unrelated**.

Causal relation, any one of these excludes the pair:

- same item id
- parent / child task
- dependency or critical-path edge (`lib/critical-path.ts`)
- typed link either direction (`lib/links.ts`)
- counts-as chain between the pens of two blocks

Same room twice is a repeat, not a series. Cross-section alignment without a shared tag, type, or word is simultaneity and stays on Cross-section.

**Expected count.** For a key, let `p` be its share of member-days in the chosen window (key-days / window-days, floor 1 day). Expected series-days ≈ `p` times days that had two or more occupied rooms. Show observed and expected beside the run, each with `n` = days in the window. If `n` is below 7, watermark the row and withhold the "above chance" clause. The clause, when `n` is enough and observed exceeds expected, is "more than the rate of this word in this window." It is not a cause.

One click sets the mark. Unmarked is the default and is not stored.

## Slices

### JG-1 — Coincidence scanner

Essay feature 1, the library half. Lane: `lib/`. No UI.

`lib/coincidence.ts` plus `lib/coincidence.test.ts`. Fixture vault: a tag on an inbox item and a tracking block the same day counts; the same tag on a parent and its child does not; a word that appears twice in one doc does not; `n = 4` watermarks; expected count is a number next to observed.

Done when those four cases pass and the function does not import a store.

Do not add an Analytics tab in this slice. Do not export search's tokenizer. Do not persist series.

### JG-2 — Meaning group and Coincidence Log

Essay change 1 and feature 1, the view. Depends on JG-1. Lane: Analytics, plus the settings field.

- `components/Analytics/analytics-tabs.ts`: sixth group `id: "meaning"`, label `Meaning`, tabs `coincidence`, `symbols`, `exceptions`. Help strings say what the view lists and that a mark is the person's. `symbols` and `exceptions` render an empty studio frame until JG-4 and JG-6 ("Nothing recorded in this window yet.").
- `analytics-tabs.test.ts`: the six ids, and `groupForTab("coincidence")` is `meaning`. Existing five groups keep their ids and order.
- `enhanced-analytics.tsx`: render `CoincidenceView` for `coincidence`.
- `CoincidenceView.tsx`: series list for the shared range, members open through `open-in-lists.ts`, Meaningful / Chance buttons write `lib/coincidence-marks.ts`.
- `lib/user-settings-store.ts`: `showMeaningViews` default true, persist version bump with migrate that sets true for old blobs. Settings panel one checkbox. `enhanced-analytics` filters the group out when false.

Done when the studio index shows Meaning beside the existing groups, a fixture series is markable, reload keeps the mark, and hiding the group leaves Behavior / Time / Accuracy / Meta / Library as they are.

Do not move Observatory. Do not change a causal chart. Do not auto-mark.

### JG-3 — Named outliers

Essay change 5, before the interview exists. Lane: Analytics. May proceed beside JG-2 after JG-1 is not required; this slice does not import coincidence.

`lib/named-outliers.ts` returns the two or three most extreme days in a numeric daily series (highest and lowest), each with `dateKey`, value, and optional `itemId`. Needs at least 20 days in the series before a tail is named; below that, return none and do not add a sentence.

Wire into `CalibrationView.tsx`, `HabitsView.tsx`, and `CrossSection.tsx`. Each extreme is a row: date, the habit or item or series name, click opens Lists. The finding sentence gains one clause when any extreme exists: "3 days fell outside this pattern." Means, bands, and Pearson cells stay.

Done when a fixture series of 30 days names its max and min, a series of 10 names nothing, and the three views still render their current charts when the list is empty.

Do not change grade math. Do not color a new scale. Do not require an interview answer.

### JG-4 — Exception interview

Essay feature 2. Depends on JG-3's day picker. Lane: Reviews, then Analytics.

`lib/exception-days.ts` flags a local date in the top or bottom 5% of a trailing 90-day series for habits %, points, mood, or reflection. Same 20-day floor. A day that is extreme on two metrics lists both.

`MorningReview.tsx`: if yesterday is flagged and `exceptionNote` is empty, one optional question — "Yesterday was unusual. What was different?" Saving writes `exceptionNote`, `exceptionDateKey`, and `exceptionMetrics` on today's morning slice. Skip leaves the fields empty. All-nighter does not suppress the question.

`DensityCalendar` in `studio-kit.tsx` and `HabitsView`: a flagged day with a note shows the note in the existing tooltip; the cell is still the same percent color. `ExceptionsView.tsx` (the Meaning tab) lists dated notes, newest first, and opens the day in Lists when an item id exists. JG-3's outlier rows append the note when `exceptionDateKey` matches.

Done when a fixture extreme yesterday shows the question once, the answer round-trips on the review, and a second morning does not ask again.

Do not block finishing the morning ritual. Do not invent the note. Do not add the question to evening review.

### JG-5 — Affect on capture

Essay change 2. Lane: capture. Independent of JG-2; can run beside JG-3 and JG-4. Does not touch Analytics charts until a follow-up inside this same slice wires read-only filters.

Optional one-tap on Quick Add, the Inbox row, and BIM parse: Calm, Charged, Low, Stuck. BIM suffixes `!!`, `!?`, `--` as decided above. Stored as `affect` + `affectAt` on the item. Unmarked items stay unmarked.

`MoodFieldView` and `CoincidenceView` gain a filter chip "Charged only" that restricts rows to items with `affect === "charged"`. The chip is off by default. Coincidence expected-counts recompute on the filtered set and say so ("charged captures only").

Done when a Quick Add mark survives reload, BIM `buy milk !!` stores charged and the title without the suffix, a bare `~` is not read as low, and unmarked items are unchanged.

Do not require a mark to save. Do not copy the mark onto completions. Do not reuse the est. chip for affect.

### JG-6 — Dream items and symbols

Essay feature 3. Lane: catalog type, then Reviews, then Lists and Docs.

`lib/catalog-types.ts`: `DREAM_TYPE_ID = "dream"`, attribute `symbols` (`multistring`). Seed once via `withCatalogTypes()`. User renames and extra symbols persist.

On morning save, non-empty `dream` upserts item id `dream:${periodKey}` with that type, title from the first line, body the dream text, `createdAt` the morning. Symbols edited later on the item are kept across later morning saves of the same date (body updates only when the item body still equals the previous dream string).

`SymbolsView.tsx` on the Meaning tab: one row per symbol, members in date order (dreams, items, captures whose `symbols` or tags equal that name). Count is the number of distinct dates.

After three dates, Lists title and Docs body show a small existing glyph (reuse a Lists mark already in the icon set; no new illustration pass) beside the word. Tooltip: "fish · 4 days". Click opens the Symbol view filtered to that name. The glyph is computed. Docs and Lists do not store it.

Done when three fixture dreams with the same symbol produce one glyph, two do not, and editing symbols on the item does not rewrite `morning.dream`.

Do not parse symbols out of prose with a model. Do not glyph a symbol the person has not typed.

### JG-7 — Ask sideways

Essay feature 4. Lane: Focus, then a List. Depends on no earlier JG slice. Regret and Overcommit predicates already exist.

Predicate, either one: `daysPushed >= 3` (`lib/overcommitment.ts`) or the item is in the Regret set (important and overdue, `lib/regret-store.ts`). When the predicate is false, Just Start is unchanged.

When it is true, `JustStartMode.tsx` shows a second button, **Ask sideways**, beside the existing step button. The deck is the List titled `Sideways` if present; otherwise the button explains "Add a Sideways list to draw a prompt" and does not draw. Draw is one uniform random item body, same shape as `AffirmationsDialog.tsx`'s pick, one card, no voice gate. Optional module deck: if the focused item's module manifest names a list role `sideways`, that list wins over the global one.

The person writes one sentence. It appends to item activity (`lib/item-activity.ts`) as a note, dated, with the card text stored as the prompt that was shown. The card is labeled "Prompt", the sentence "Reply". Nothing in the card is stored as advice or as a completion.

Done when a pushed-three item shows the button, a fresh item does not, the reply is on the history tab, and declining to write still returns to the two-minute step.

Do not schedule, complete, or reprioritize from a card. Do not ship a built-in deck of prompts.

### JG-8 — Friend interest and a symbol mission

Essay change 3. Depends on JG-6 for the symbol mission only. The retirement rule can ship first inside this slice.

Read `FriendMission.status === "declined"` in `lib/friend-mission.ts`. Group by `kind`. Three declines of the same kind in a row, with no `done` between them, set `retiredUntil` for that kind to seven days later on a small map in the baby-animals store (beside the mission log, not a new product). The offer picker skips retired kinds and must still return some other kind; if every actionable kind is retired, offer `affection` / `empty` as today. Gallery Details shows "paused until {date}" on that kind. History rows stay.

One new offer, only when some symbol has ≥ 3 distinct dates in the last 7 days (JG-6 count): title "A fish has come up 4 times this week", line "Want to write about it?", `kind: "mission"`, `source` a new union member `symbol` on `FriendSuggestionSource`. Accept opens Docs or the dream item. Decline counts toward retirement of `symbol` the same way. If no symbol qualifies, this offer is absent.

Done when three declines pause a kind for seven days, the fourth offer is a different kind, and a symbol at count 2 never produces the line.

Do not delete declined rows. Do not shame. Do not call a model to phrase the mission.

### JG-9 — Life seasons

Essay feature 5. Lane: Goals, then Analytics. Independent of JG-1–8. Does not edit `ReviewPeriod`.

`lib/life-seasons.ts`: list of `LifeSeason`, persist, seasons must not overlap. Starting one ends the open season the day before `startedOn`. Name and aim are required strings. No default seasons are seeded.

`DirectionReport.tsx` already knows served and neglected objectives. Add a range argument for an arbitrary inclusive span (the season's dates) without removing the current period-key path. Home → Goals gains a Season strip: name, aim, start, end. One open season.

`SeasonsRibbon` in Analytics → Goals (Accuracy group, existing Goals view, not the Meaning group): horizontal bands, one per season, using the alluvial layout in `studio-plots.tsx` only if it already accepts categorical bands; otherwise a simple labeled bar row. Each band lists objectives served, neglected, and newly risen (neglected in the previous season, served in this one). Empty vault: one sentence, no fake seasons.

Done when two non-overlapping seasons round-trip, an overlap is rejected, Direction for a season uses only that span, and day/week/month/quarter/year reviews still open.

Do not add `"season"` to `ReviewPeriod`. Do not auto-name a season. Do not close a season from a yearly review (JG-10 may link to the open one; it does not end it).

### JG-10 — Afternoon questions

Essay change 4. Depends on JG-9 for the neglected-objective prompt's season span; the other two prompts can be built against the year either way. Lane: Reviews.

`components/Reviews/reviews.tsx` year flow gains three prompts. They are required to finish the year review. Week, month, and quarter flows stay as they are.

1. "Which standing rules, habits or affirmations were right for an earlier you?" Lists habits, affirmation items, and list rules that existed before this year. Each row: keep / revise / retire. Retire marks the record archived or paused through the existing archive path; it does not delete.
2. "Which neglected objective is asking to come back?" One pick from Direction's neglected set over the open season if one exists, otherwise over the year.
3. "What did you finish on purpose this year?" A short text, with chips of post-mortems and archived items from the year the person can insert. The sentence is theirs.

Answers write `PeriodReview.afternoon`. If a GS-6 handoff object is already on the review type, also set its three lines from these answers. The next year opens with last year's three lines visible above the new prompts.

A season review is the same three prompts on the Season strip's End action (explicit, not the yearly dialog). Ending a season is optional and separate from closing the year.

Done when a year review cannot complete with the three blank, the answers reload, retire uses the existing archive, and a week review has no new step.

Do not add the prompts to morning review. Do not summarize the year with a model.

## Lanes

Claim one slice. JG-5, JG-7, and JG-9 share no files with JG-1 and can run beside it. JG-2 waits on JG-1. JG-4 waits on JG-3. JG-8's symbol line waits on JG-6. JG-10's neglected prompt waits on JG-9.

| Slice | Owns | Does not touch |
| --- | --- | --- |
| JG-1 | `lib/coincidence.ts` | Analytics tabs, stores |
| JG-2 | `analytics-tabs.ts`, `CoincidenceView.tsx`, `coincidence-marks.ts`, `showMeaningViews` | Observatory, causal charts |
| JG-3 | `lib/named-outliers.ts`, Calibration, Habits, Cross-section | Grade formulas |
| JG-4 | `lib/exception-days.ts`, `MorningReview.tsx`, density tooltip, `ExceptionsView.tsx` | Evening review |
| JG-5 | Quick Add, Inbox, BIM suffix, `affect` on the item | est. chip, completion scales |
| JG-6 | `catalog-types.ts` dream, morning upsert, `SymbolsView.tsx`, glyph | Auto-extract from prose |
| JG-7 | `JustStartMode.tsx`, Sideways list draw, activity note | Scheduling, built-in deck |
| JG-8 | Friend decline map, symbol mission offer | Mission-log deletion |
| JG-9 | `lib/life-seasons.ts`, Direction range, Goals strip, ribbon | `ReviewPeriod` union |
| JG-10 | Year prompts, `PeriodReview.afternoon`, season End | Morning ritual, model summary |

## Done for the wave

A person can open Meaning and see dated series with observed and expected counts, mark one meaningful, read the two extreme days by name, answer one morning question about an unusual yesterday, mark a capture charged, watch a symbol glyph appear on the third day, draw one sideways prompt on a stuck item, see a stale friend mission pause, name a season and read which objectives rose inside it, and close a year by keeping or retiring standing rules. Hiding Meaning removes the group from the index and leaves every other room working. No screen says the coincidence caused anything.

## Docs each slice updates

After the slice, in the same change: the colocated README, [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) (check the bullet), and the Analytics screenshot pair only when a view's copy changed (`npm run capture-screenshots` while the app is running). [`SPEC_MAPPING.md`](SPEC_MAPPING.md) stays put; this wave is not a spec-docx item.

## Source notes

Essay: [`jungideas.md`](jungideas.md). Book pages cited there are from the Synchronicity PDF. Stages points are paraphrased because the local Stages PDF is corrupted.

Brain2, read 2026-09-23, and not changed by this plan: `analytics-tabs.ts` (five groups: behavior, time, accuracy, meta, library), `analytics-tabs.test.ts`, `enhanced-analytics.tsx`, `observatory-findings.ts`, `open-in-lists.ts`, `studio-kit.tsx` `DensityCalendar`, `MorningReview.tsx` (`morning.dream`), `lib/types.ts` `ReviewPeriod`, `lib/catalog-types.ts`, `lib/overcommitment.ts`, `lib/regret-store.ts`, `lib/friend-mission.ts`, `lib/item-activity.ts`, `lib/user-settings-store.ts`, `components/Focus/JustStartMode.tsx`, `components/Reviews/reviews.tsx`, `components/Reviews/AffirmationsDialog.tsx`, `components/Home/Goals/DirectionReport.tsx`.
