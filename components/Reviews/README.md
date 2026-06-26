# `components/Reviews/` — End-of-Period Reviews

Global header **Review** dropdown (not a top-level tab). Guides the user through closing out a day, week, month, quarter, or year.

## Files

| File | Purpose |
|------|---------|
| `reviews.tsx` | `Reviews` header button + `ReviewDialog` for each period type; mounts the `MorningReview` entry |
| `MorningReview.tsx` | `MorningReview` button + `MorningReviewDialog` — start-of-day ritual (HM2); hosts the **Affirmations** launcher |
| `AffirmationsDialog.tsx` | Spoken-affirmations ritual launched from the morning dialog (stacks above it). Picks 5 random lines from the Lists → "Affirmations" list and gates "Next" on confident vocal delivery |
| `PostMortemDialog.tsx` | Per-task post-mortem launched from a "Reflect" affordance on a completed task (in the review carry-over or Analytics). Captures the four scales (satisfaction / resistance / focus / distraction, 1-10), an optional actual-duration correction, and notes, then persists via `saveCompletionReview` (`lib/services/completion-service.ts`) |

## Entry point

Rendered in `app/page.tsx` header alongside Tracking, Inbox, Bulk Add, and Quick Add.

- The **Morning** button opens the morning ritual for today.
- The **Review** dropdown lists all five (evening/end-of-period) period types.
- **Due** badge when the just-ended period has no saved review.
- Saved reviews browsable from Analytics → Reviews tab; regret accrual surfaces in Analytics → `RegretView`.

## Morning review ritual (HM2)

`MorningReview` (header/Home banner entry) → `MorningReviewDialog` captures wake
time, a dream-journal note, the day's intentions + affirmations, and which
scheduled tasks are being consciously postponed. The `morning` slice is merged
onto today's **day** `PeriodReview` via `reviews-store.saveMorningReview` so it
coexists with the evening review for the same day.

## Spoken affirmations ritual

The morning dialog's **Affirmations** button opens `AffirmationsDialog`, a popup
that stacks above the morning review. It reads its lines from a normal Lists
list named **"Affirmations"** (visible under Lists → All), seeding sensible
defaults the first time so it works out of the box. Five lines are chosen at
random; tapping the mic streams audio through `useVocalConfidence`
(`hooks/useVocalConfidence.ts`), and each affirmation is shown one at a time with
a live confidence meter (volume · steadiness · conviction · full delivery).
**"Next" only unlocks once the line is delivered with full confidence** — loud,
steady, convicted (no uptalk, no trailing off, no hesitation), and spoken all the
way through.

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
4. **Your plan** (day/week/month only) — read-only plan text from `lib/plan-text.ts` + reflection textarea.
5. **Reflection** — What went well? / What could improve? / What did you learn?
6. **Next plans** — intentions for the upcoming period.

## Data

| Store / helper | Role |
|----------------|------|
| `lib/reviews-store.ts` | Persists `PeriodReview[]` + `OperationReview[]` (`cogs-reviews-store`); `saveReview`/`getReview`, `saveMorningReview`, operation-review actions, and period helpers |
| `lib/pending-reviews.ts` | `getPendingReviews` / `countPendingReviews` — which just-ended period of each type still needs a review (drives the "due" badges) |
| `lib/regret-store.ts` | Regret ledger (`regret-store`); blocked-reason-tagged accrual |
| `lib/task-store.ts` | Incomplete tasks, push/done actions |
| `lib/plan-text.ts` | Loads saved day/week/month plan from localStorage (`getStoredPlanText`) |
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
