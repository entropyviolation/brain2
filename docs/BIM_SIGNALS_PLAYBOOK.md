# BIM signals playbook: learn from the person's data, then build prompts from it

_Last mapped: 2026-10-30_

Brain2 holds years of the person's own record: tracked blocks, Company, Mood,
Location, sleep, texts, calls, Health. Much of what BIM needs to know is
already in there, as patterns. A model asked cold ("what was I doing?") guesses.
A model handed a fact the data proves ("no text from 02:10 to 09:55; your sleep
starts about 2 h after your last text") reads and words. This file is the
method for finding those facts and the record of what has been found.

## The method

1. **Pick a question BIM must answer** (where were they, who with, asleep,
   how they felt, what they were doing).
2. **Find ground truth the person made themselves.** Confirmed Activity blocks
   (not `generatedBy`, not `precision: "estimated"`), Company, Mood, Sleep,
   Location they painted. Count it first. Under about 20 cases, say the
   result is thin.
3. **Find a cheap signal in a second source** (texts, calls, Health, screen
   time, location). Write it as plain code over the vault's own shapes.
4. **Measure before building.** Count the signal inside truth versus outside it
   (rates, share of hours, median offset). A python or vitest one-off on the
   real files is enough. Keep a baseline (always guess the most common
   answer) and say how the result compares.
5. **Keep it only if it beats the baseline.** If a model has to decide, test
   it too (`texts.bench.test.ts`): same truth, several context styles, one
   score each. Negative results are findings; write them down.
6. **Ship it as a fact, not as a prompt rule.** Code puts a dated, counted
   line in `Evidence.facts` (`retrieve.ts`); the `answer` node reads it. Learn
   the constants from the person's own data at run time (`companyRates`,
   `sleepOffsets`), so they move as the person logs more, and return `null`
   when there are too few cases. Never hard-code one person's numbers.
7. **Say how sure.** The fact names its basis ("by the person's own logs, 16
   nights"). Weak signals go on their own lane and are not fed to the answer.
8. **Record it** in the table below, with the numbers, the date, and the re-run
   command. A tool that ran once and was not written down is lost.

## Rules that kept this honest

- Machines write files too. Learn which folders are reliable from the person's own away blocks before trusting one; one folder here (`websites`) was 73% away.
- Recent only. Texts older than a few weeks do not say what the person is
  doing now (the hub caps the window at 60 days, 14 by default). Learn
  constants on up to 60 days; read evidence from the last 14. Old history is
  a separate, planned tool.
- Code counts, the model reads. A 14B model cannot count and is bad at
  "unknown"; it was right 1 time in 60 naming an activity from one text.
- Absence is weak, presence is strong. Texting someone now means probably
  apart (85%); silence means little (43% together against a 32% base).
- A signal can be a constraint rather than a label: no text was ever sent
  inside a logged sleep block, so a sent text inside one is a reason to doubt
  the block.
- Read-only. Nothing here writes the vault.

## What has been found (2026-10-30, Sept 1 – Oct 30 2026)

| Question | Signal | Truth used | Result | Status | Code |
|---|---|---|---|---|---|
| What activity, from one text | model reads the text (4 context styles) | 60 sent texts in confirmed Activity blocks | 0–1 right of 60; baseline ~25%; model says unknown 80% | **Failed.** Do not label activity from a text. | `texts.bench.test.ts` |
| Who with | texts with a person this hour | 194 hours of Company (Elijah vs Alone) | together 0.10 sent/h, apart 1.54; 85% of hours with a text were apart | **Works** as "not in the same room" | `text-company.ts` |
| Asleep | quiet gap between last and first sent text | 26 Sleep blocks of 3 h+ | 0 texts inside any block; last text median ~2 h before logged start, first ~1 h after wake | **Works** as a window | `text-sleep.ts` |
| Mood | model reads a day of sent texts | 10 days of logged mood | no clear match; model rated 8 of 9 "none" | **Weak**, hint lane only | `texts.mood.bench.test.ts` |
| At a screen (Mac) | Mac Screen Time (ActivityWatch) covers the block | 109 confirmed Activity blocks (20 min+) on the 16 days ActivityWatch ran | cover ≥ 50% of block ⇒ at a screen: 86% right vs 62% baseline; Computer Work 80% covered, Brain2 100%, Sleep/driving/walking/hanging out 0%. Mac minutes at a Sleep block's edges (lying in bed on it) are normal: 0 of 9 Sleep blocks had 10+ Mac min once 30 min is trimmed off each end | **Works** as a yes/no, but only 16 days of data. Which activity: top app ⇒ activity, leave-one-day-out, 29% vs 18% baseline: **weak**. | `screen-presence.ts`; re-run `scripts/bim-screentime-signal.py` |
| Scrolling | iPhone Screen Time (Instagram only) covers the block | 189 blocks on the 31 days with Instagram pings, 44 of them scrolling (23%) | cover ≥ 30%: 84% precision, 70% recall; ≥ 50%: 93% precision, 59% recall. Misses are phone calls and the odd walk | **Works** as a presence signal for scrolling. It is Instagram, so it says nothing of YouTube or other apps | same |
| At a screen (Chrome history) | `screentime:phone-sync` blocks (Chrome visits) | 280 blocks, 83 days | cover ≥ 50%: 72% vs 71% baseline | **No gain.** Browser visits are too sparse to mean "at the screen". Do not use | same |
| Home vs out (Chrome) | any Chrome session overlapping a Location block of 30 min+ | 78 blocks (44 Home) on 56 Chrome days | session ⇒ Home: 76% vs 56% baseline; 35 of 45 session blocks were Home, 24 of 33 no-session blocks were not | **Works**, modest. Not shipped yet | `scripts/bim-screentime-browser.py` |
| Alone (Chrome) | any Chrome session in a Company block of 30 min+ | 38 blocks (16 Alone) | session ⇒ alone: 68% vs 58%; but no session ⇒ with someone is 12 of 14 (86%); Alone median 11 pages/h, with someone 0 | **Weak** as alone; the useful half is "no browsing, so probably with someone". Thin | same |
| Intensity (Chrome) | pages per hour inside the block | 280 Activity blocks | Foxtide work 95/h, Computer Work 12/h, Brain2 10/h, watching tv 12/h, youtube 3/h, scrolling 0/h | **Separates work kinds a little** (Foxtide is page-heavy); not tested as a classifier | same |
| Which activity (Chrome) | top site by minutes, leave-one-day-out | 135 blocks with a session | 35% vs 27%; YouTube top ⇒ youtube 11, scrolling 6, Computer Work 3 | **Weak as a learned rule.** YouTube is shipped as the person's own rule: YouTube ⇒ youtube (`DECLARED_APPS`; the data agrees in 11 of 17 blocks where it was the top site, 6 were scrolling) | same |
| Asleep (Chrome) | a Chrome session well inside a Sleep block | 27 Sleep blocks | 1 of 27 (a Hydraflix session at 06:00 inside a 02:00–10:00 block) | **Holds** as a constraint, same as texts and the Mac | same |
| Working at the computer (files) | 3+ files created or modified in the block, by folder and name | 288 confirmed blocks, 47 days; 115k files under `~` touched Sept 1 – Oct 30 (bulk bursts of 100+ in a minute collapsed, `websites` dropped as noisy) | 89% vs 76% baseline. Events ⇒ a work pen (Computer Work, Brain2, Foxtide work; learned as pens with 60%+ blocks touched): 59 of 82. **No events ⇒ not work: 196 of 206 (95%)** | **Works**, mostly as "file-quiet means not working". **Shipped** 2026-10-30: `file-activity.ts`, fed by the hub's `/api/file-activity` (re-learned on the real files: 59 of 82 and 159 of 168 not-work once the 8-day, 40-block floor applies) | `scripts/bim-screentime-files.py` |
| Which pen (files) | top folder, leave-one-day-out | 104 blocks with events | 38% vs 38%: `brain2` ⇒ Computer Work 30 or Brain2 8, because the person logs Brain2 work as Computer Work | **No gain.** By extension: `.psd` ⇒ Foxtide work 6 of 10, `Desktop` touched in 10 of 10 Foxtide blocks (but 26 of 46 Computer Work too); `.ts/.tsx` ⇒ Computer Work and Brain2 | same |
| Declared folder (files) | files saved or changed under `elijah/foxtide` (a `:` in a Finder name reads as `/`) | the person's own rule, not measured | `DECLARED_FOLDERS` in `file-activity.ts`; on Oct 12 it found 229 files 21:23–22:41 | **Shipped** as the person's rule for Foxtide work | `file-activity.ts` |
| Folder reliability (files) | share of a folder's blocks that were clearly away (Sleep, driving, walking, hanging out, scrolling, tv, youtube) | 7 top folders | `brain2` 6%, `Desktop` 7%, `Downloads` 5% are real; **`websites` 73% away** (a background process writes there) | **Learnable at run time**: drop any folder whose events land mostly in away blocks | same |
| Asleep (files) | file event 30+ min inside a Sleep block | 25 Sleep blocks of 3 h+ | 0 of 25 | **Holds** as a constraint, as texts, Chrome and the Mac | same |
| Home / alone (files) | any file event in a Location / Company block | 71 Location, 36 Company | Home 70% vs 56%; alone 61% vs 58% | Home modest (like Chrome), alone **no gain** | same |
| Which screen activity (Mac) | top foreground app, leave-one-day-out | 40 screen blocks on AW days | 50% vs 40% baseline (Cursor ⇒ Computer Work 8 of 10; Spotify ⇒ playlists 2 of 2; Chrome splits four ways) | **Thin, not shipped as a learned rate.** One app is shipped as the person's own rule: Cursor ⇒ Computer Work (`DECLARED_APPS` in `screen-presence.ts`; the data agrees, 8 of 10). Retry the rest with 40+ more days of ActivityWatch | `scripts/bim-screentime-signal.py` (`scripts/bim-screentime-mac.py`) |
| Alone (Mac) | any Mac use in a Company block of 30 min+ | 23 blocks (12 Alone, 11 with someone) on 17 AW days | Mac use ⇒ alone: 78% vs 52% baseline; no Alone block had zero Mac use, but 6 of 11 with-someone blocks did | **Thin (23 cases), not shipped.** Zero Mac use looks like "not alone"; re-test at 40+ blocks | same |
| Home vs out (Mac) | Mac cover of a Location block | 38 blocks, 19 Home | Home 84% any use, 26% half-covered; the 4 away blocks had none | **Too thin** (4 away blocks) | same |

Numbers are one person's, one season. The code re-learns them; it does not
embed them.

## Next signals to try (each is a question for the data, not a promise)

- **Location from texts.** Hours at Home vs Transit vs out against texting
  pace, reply speed, and words ("omw", "here"). Truth: Location blocks.
- **Calls** (`iphone-calls`): a call hour is almost certainly not asleep,
  not driving without hands-free, and says who. Truth: Activity and Company.
- **Reply latency by person** as a closeness or busyness signal; compare with
  Company hours and with Activity (driving, working).
- **Health × texts:** steps and heart rate against the quiet gaps (asleep vs
  awake and still).
- **Screen time × texts:** the screen-time half is done (rows above); still to try: does Instagram cover in a text hour predict texting?
- **Screen time as a constraint:** Mac minutes well inside a Sleep block (not at its edges) would flag a block to doubt. None found in 9 blocks.
- **Mood from non-text signals first:** sleep length, Health, plans pushed,
  then test text tone as an add-on, with more than 11 logged days.
- **BIM Telegram messages the same way:** which words precede a logged block
  (the BIM feed is the person's own words, so it is richer than texts).
- **Per-person routine:** who the person texts at which hour on which weekday;
  an expected text that does not come is a signal.
- **Old texts (planned, separate):** one relationship, or anything from before
  Brain2 had history (texts go back to 2018). Its own screen and windowing.

## Where things plug in

- A new signal is a pure file in `lib/bim-flow/` with a `*.test.ts`, plus
  at most one line in `retrieve.ts` that adds its facts to a `retrieve` kind.
- Real-data checks are opt-in vitest files named `*.bench.test.ts`, gated on
  `BIM_TEXTS_BENCH=1`, that write to `data/bim-flow-runs/` (git-ignored).
- Constants come from `learn(rows, truth)` functions that return `null` when
  the person has too few cases.
- Add the result to the table above in the same change.
