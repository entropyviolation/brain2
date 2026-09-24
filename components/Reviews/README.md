# `components/Reviews/` — End-of-Period Reviews

Global **BRAIN2** header **Review** dropdown (not a top-level tab). Guides the user through closing out a day, week, month, quarter, or year. Dialog shells use the shared pin-bar milled fascia (`.hpp95` / `components/header-popup-chrome.css`): CRT caption, brushed bay, engraved nameplates, raised metal keys — looks only.

## Files

| File | Purpose |
|------|---------|
| `reviews.tsx` | `Reviews` header button + `ReviewDialog` (`data-ui-name="Period review"`) for each period type; mounts the `MorningReview` entry; `.hpp95` shell |
| `MorningReview.tsx` | `MorningReview` button + `MorningReviewDialog` (`data-ui-name="Morning review"`) — start-of-day ritual (HM2): all-nighter (lists the habit blocks it lifts: evening before / that morning), sleep, affirmations, to-do add/priorities, daily habit priorities (1–3, skipping habits the all-nighter lifts), go-through to-do (six-slot fields), plaintext day plan, circumstances, best day, gratitude; writes sleep through `lib/sleep-store.ts`; `.hpp95` shell |
| `AffirmationsDialog.tsx` | Spoken-affirmations ritual launched from the morning dialog (stacks above it). Picks 5 random lines from the Lists → "Affirmations" list and gates "Next" on confident vocal delivery; CRT mic well (no purple soft circles); `.hpp95` shell |
| `DayReviewTomorrowSection.tsx` | End of day review: tomorrow's plan append log (`PlanTextLog`) + search-to-schedule / create tomorrow to-dos |
| `PostMortemDialog.tsx` | Per-task post-mortem launched from a "Reflect" affordance on a completed task (in the review carry-over or Analytics). Captures the four scales (satisfaction / resistance / focus / distraction, 1-10), an optional actual-duration correction, and notes, then persists via `saveCompletionReview` (`lib/services/completion-service.ts`); `.hpp95` shell |

## Entry point

Rendered in the `AppHeader` pin bar (`app/page.tsx`) in the **Review** group, beside Tracking, Inbox, Bulk Add, From Notes, and Quick Add.

- The **Morning** button opens the morning ritual for today. First paint matches SSR (`Morning` only); ✓ appears after mount if today’s review is saved. A small error boundary keeps a throw inside the widget from unmounting Home / To Do; same-day session draft resumes an unfinished panel after close or refresh without discarding a finished review.
- The **Review** dropdown lists all five (evening/end-of-period) period types. A life **Season** is specified as its own record, not a sixth period, in [`docs/JungBrain2.md`](../../docs/JungBrain2.md) (not built).
- CRT **due** count with a tooltip naming how many just-ended periods still need a review.
- Saved reviews browsable from Analytics → Reviews tab; regret accrual surfaces in Analytics → `RegretView`.

## Morning review ritual (HM2)

`MorningReview` (header/Home banner entry) → `MorningReviewDialog` captures:

1. **All nighter** checkbox (skip sleep clocks) or fell-asleep / wake / dream
2. **Five affirmations** randomly picked from Lists → `affirmations` (Speak them opens `AffirmationsDialog`)
3. **To do for today** — show today's list, add new lines (notes: `logged from text`), pick 3–5 priorities (shown on Home → To Do)
4. **Daily habit priorities** — optionally pick 1–3 daily habits (shown on Home → Habits as Morning habit priorities)
5. **Go through to do list** — per item: tier, expected duration, points, day importance (0–10), resistance (0–10, append-only series), day excitement (0–10). Blank / `-` leaves a field unchanged; Skip leaves the item untouched. Shared grammar with BIM (`lib/morning-todo-walk.ts`)
6. **Plaintext day plan** — appends today's Plan log (desktop stamp, not falsely labeled "from text")
7. **Circumstances** — must-do / must-not / new events / excitement (checkbox + answers)
8. **Why is today going to be the best day ever?**
9. **10 things you are grateful for today**

The `morning` slice merges onto today's **day** `PeriodReview` via
`reviews-store.saveMorningReview` so it coexists with the evening review for the
same day. Text pipeline (`gm` via BIM) writes the same shape with
`source: "telegram"`. Analytics → Reviews reads the answers; Analytics → To-do pulse
charts the walkthrough fields; Analytics → Sleep tracks all-nighter days.

Planned, not built ([`docs/JungBrain2.md`](../../docs/JungBrain2.md)): if yesterday is in the top or bottom 5% on habits, points, mood, or reflection, the next morning asks one optional question and stores the answer on this morning slice. A non-empty dream also upserts a Dream item. The year review later gains three afternoon prompts. None of that is in the dialog yet.

Its two time fields — **fell asleep** and **wake time** — are a view onto
`lib/sleep-store.ts`, not a second copy of the data (unless all-nighter is on).
Saving writes the night there, which is what paints it on the Sleep pen, logs it
in To-Do Done, and feeds any habit linked to the Sleep tag; `morning.wakeTime` is
still written so older reviews and exports keep reading correctly.

A field with nothing stated yet opens **pre-filled from the Tracking grid**
(`lib/sleep-inference.ts`), so someone who painted their night is confirming a
time rather than retyping it. See `components/Home/Tracking/README.md` for the
model.

## Spoken affirmations ritual

The morning dialog's **Speak them** button opens `AffirmationsDialog`, a popup
that stacks above the morning review. It reads its lines from a normal Lists
list named **"affirmations"** (visible under Lists → All; older **"Affirmations"**
lists still match), seeding sensible defaults the first time so it works out of
the box. Five lines are chosen at random; tapping the mic streams audio through
`useVocalConfidence`
(`hooks/useVocalConfidence.ts`), and each affirmation is shown one at a time with
a live confidence meter (volume · steadiness · conviction · full delivery).
**"Next" only unlocks once the line is delivered with full confidence** — loud,
steady, convicted (no uptalk, no trailing off, no hesitation), and spoken all the
way through.

Over BIM text (`gm`), affirmations are also one-at-a-time; almost any reply
advances — including a voice note.

Voice scoring is a transparent, client-side analyzer in `lib/vocal-confidence.ts`
(no API keys, audio never leaves the device, degrades gracefully without a mic).
The scoring boundary (`scoreConfidence`) is deliberately swappable for a real
model later. The four meters shown — **Volume**, **Steadiness**, **Conviction**,
**Full delivery** — map to acoustic correlates of perceived speaker confidence
established in the speech-prosody literature:

| Meter | Signals | Grounded in |
|-------|---------|-------------|
| **Volume** | mean intensity (RMS loudness) | Jiang & Pell (2014, 2017); Sabu & Rao (2020) |
| **Steadiness** | low cycle-to-cycle *jitter* (f0) + *shimmer* (amplitude) tremor, plus HNR voice quality. Uses *local* perturbation, not macro pitch range, so expressive intonation isn't penalized | Jiang & Pell; Sabu & Rao (2020); Boersma (1993) HNR |
| **Conviction** | a **weighted average** (intonation 0.40, fluency 0.35, projection 0.25) of: terminal pitch contour (falling/level = confident; rising **uptalk** = doubt), fluency (prompt onset, few/short pauses), and loudness **projection** (ending doesn't fade/mumble out). It's a smooth, interpretable meter; the hard "any one weak cue blocks Next" logic lives in the per-cue **gates** (fluency, intonation, projection, conviction floor). Projection uses the end-vs-**median** loudness with a tolerant band, so a *natural* phrase-final taper is **not** mistaken for trailing off | Ponsot et al. (2018); Pon-Barry (2008); Duchi et al. (2015) |
| **Full delivery** | voiced duration vs. the line's word count (proxy for completing the utterance at a natural rate) | Sabu & Rao (2020) speech-rate / duration |

**Accuracy & robustness (why it now catches a deliberately-unsure delivery):**

- **`confident` is hard-gated, not just thresholded.** A line only unlocks when it
  is loud, steady, *and* convicted, with the conviction sub-cues additionally
  gated: no rising **uptalk**, no **trailing off**, fully voiced. Sounding unsure
  on any one of these blocks "Next".
- **Pitch uses the McLeod Pitch Method** (NSDF + 0.9 peak-pick + parabolic
  interpolation), which tracks higher (female) f0 as reliably as lower (male) f0
  and resists octave errors — so uptalk/jitter are measured correctly for any
  voice. Absolute pitch *height* is intentionally **not** scored (it would bias
  across speakers); only speaker-independent cues are used.
- **Frames are decimated to ~`ANALYSIS_INTERVAL_MS` (45 ms)** so successive
  windows are decorrelated. Earlier versions measured jitter/shimmer on
  heavily-overlapping ~16 ms frames, which made "steadiness" read high even for a
  wavering voice; decimation makes tremor actually measurable.
- A tracked-but-shaky pitch is **penalized** (not ignored): the amplitude-only
  steadiness fallback applies only when *no* pitch could be tracked at all.

The pure helpers (`detectPitch` (MPM), `relativePerturbation`,
`terminalContourRise`, `terminalLoudnessRatio`, `clarityToHnr`,
`scoreConfidence`, `ConfidenceTracker`) are unit-tested in
`lib/vocal-confidence.test.ts` (incl. female-range pitch and each gate).

| File / helper | Role |
|---------------|------|
| `lib/affirmations.ts` | Find/seed the "Affirmations" list, read its items, random subset (`pickRandom`) |
| `lib/vocal-confidence.ts` | Pure DSP + confidence scoring (`computeFrameMetrics`, `ConfidenceTracker`, `scoreConfidence`) |
| `hooks/useVocalConfidence.ts` | Mic (getUserMedia) → AnalyserNode → tracker → live `ConfidenceScore` |

## Why-blocked reasons (HM3)

In the carry-over step each unfinished item exposes a **Why blocked?** picker
(`no-energy` · `missing-input` · `procrastination` · `no-time` ·
`blocked-by-other` · `other`). Selected reasons are saved on the review's
`blockedReasons` map and tag the item's accrued **regret** entry
(`lib/regret-store.ts`) so Analytics can break regret down by cause.

## Review flow (`ReviewDialog`)

1. **Unfinished items** — tasks scheduled in the period but not completed; mark Done or Push to next period.
2. **Summary** — free-text recap.
3. **Gratitude** — multiple gratitude lines.
4. **Your plan** (day/week/month only) — read-only stamped plan log from `lib/plan-text.ts` + reflection textarea. Day review also hosts `DayReviewTomorrowSection` (same submit-stamped composer for tomorrow).
5. **Reflection** — What went well? / What could improve? / What did you learn?
6. **Next plans** — intentions for the upcoming period.

## Data

| Store / helper | Role |
|----------------|------|
| `lib/reviews-store.ts` | Persists `PeriodReview[]` + `OperationReview[]` (`cogs-reviews-store`); `saveReview`/`getReview`, `saveMorningReview`, operation-review actions, and period helpers |
| `lib/pending-reviews.ts` | `getPendingReviews` / `countPendingReviews` — which just-ended period of each type still needs a review (drives the "due" badges) |
| `lib/regret-store.ts` | Regret ledger (`regret-store`); blocked-reason-tagged accrual |
| `lib/task-store.ts` | Incomplete tasks, push/done actions |
| `lib/plan-text.ts` | Loads the day/week/month plan-entry log (`getStoredPlanText` formatted; `appendPlanEntry` to add) |
| `lib/services/completion-service.ts` | `saveCompletionReview` — persists a `TaskCompletionReview` from `PostMortemDialog` without touching the hot `completeTask` path |
| `lib/services/review-service.ts` | `carryOverIncomplete` + period-review repository helpers |

## Operation post-mortem (Feature 2, #277 — for Worker B)

`reviews-store.addOperationReview(input)` upserts an `OperationReview`
(`operation:${operationId}` id) and is the integration point Worker B calls when
closing an Operation. Read one back with `getOperationReview(operationId)`.

## Period keys

| Period | Key format |
|--------|------------|
| Day | `YYYY-MM-DD` |
| Week | `getWeekString` range |
| Month | `YYYY-MM` |
| Quarter | `YYYY-Qn` |
| Year | `YYYY` |

Helpers: `getPeriodKey`, `dateFromPeriodKey`, `previousPeriodDate`, `nextPeriodDate`, `periodLabel`, `localDayKey` in `reviews-store.ts`.

## Push behavior

Pushing a task increments the period's push counter (`daysPushed`, `weeksPushed`, or `monthsPushed`) and reschedules to the next period's field.

## Planned — map and territory (Wave 13)

Not built. Evening and weekly reviews gain describe-then-infer (GS-5): facts
first, then a `formulation` with role `inference` linked to those facts.
Morning review keeps its current order. Each period ends with a handoff the
next period opens on (GS-6). An optional extensional check may offer a dated
rewrite and never blocks save (GS-4). Sequence:
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md) Part 3.

## Planned — meaning beside the average (Wave 14)

Not built. Sequence: [`docs/JungBrain2.md`](../../docs/JungBrain2.md).

- Morning: one optional exception question when yesterday is an extreme day; a non-empty dream upserts a Dream item.
- Year: three prompts (keep / revise / retire standing rules, one neglected objective, what was finished on purpose). Week, month, and quarter stay as they are.
- Season is a separate record, not a sixth `ReviewPeriod`.
