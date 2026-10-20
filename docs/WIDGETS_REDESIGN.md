# Widgets redesign plan: the Visual dashboard

Home → the widget row above the sub-tabs. _Last mapped: 2026-10-20._

**Status.**
- **Built 2026-10-20:** phases 1–8 below. Kinds and installed copies, the dashboard store, migration, and backup; edit mode and the **Edit** key; the gear with per-copy settings; Countdown; Language study with CEFR levels and the placement quizzes; the Dash style and the style switch; and the Widget gallery with setup, guides, and **Reset to my old layout**.
- **Planned:** retiring the mirror (phase 9), more Language study modes, and user-made kinds.

What is built is described in [`components/Home/README.md`](../components/Home/README.md#visual-dashboard) and [`lib/README.md`](../lib/README.md#widgets-libwidgets). This file is the plan and the reasons.

**Rule for every phase: break nothing.** Every widget, setting, and saved layout keeps working. Today's look stays available as the **Milled** style.

**Dash is permanent.** Athena chose Dash as a lasting option (2026-10-20). Every future version keeps both the Dash and Milled styles and the switch between them.

### How the build differs from the plan

_Last mapped: 2026-10-20_

- **Kind ids did not change.** Countdown is still `daysuntil` and Language study is still `vocab`, so saved layouts, backups, and `data-kind` selectors keep working. Only the names changed.
- **Layouts are an order plus sizes,** not x / y boxes. Each style keeps `order` (copy ids) and `sizes` (copy id → `1x1` … `3x2`, or `auto` on Milled). The grid packs them densely.
- **Copy fields.** `WidgetCopy` (`lib/widgets/types.ts`) also has `hidden`, `lamp` (`phosphor`, `blue`, `violet`, or `white`; no amber), `daySource` (`dashboard`, `clock`, or `viewed`), `showFoot`, and `guideSeen`. `title` is `""` for the kind's own caption.
- **Settings are a schema.** Each kind lists choice, toggle, and text fields in `lib/widgets/kinds.ts`. The gear draws them. Countdown and Language study add their own panels.
- **Countdown copies point at marks.** A Countdown copy holds `settings.markId`. The mark's fields stay in `brain2-home-days-until`, and `reconcileCountdowns` keeps marks and copies one to one.
- **Language study copies are keyed by language.** `key` and `settings.lang` are the code. `settings.role` is `studied` or `native`, and `settings.cefr` is the level. English is native by default; the rest are studied.
- **Install rules as built:** Points and Countdown are `many`. Weather, Solar remainder, and Language study are `perKey`. The rest are `once`.
- **First style.** A vault with a saved strip lands on Milled; a fresh one lands on Dash.

The open questions at the end are answered by those defaults until the owner says otherwise.

---

## Summary

Today's Home strip has 19 widget kinds, each allowed exactly one copy, saved as one `order` + `hidden` list in `brain2-home-widgets` (persist v10). Footprints are fixed in CSS, settings live in seven separate stores, and only Days Until already behaves like "many copies". The plan keeps every one of those stores readable, adds one new store of **installed copies**, and moves the strip to it with a migration that turns each visible or hidden id into a copy. Today's look survives as a style called **Milled** next to the new **Dash** style.

- **Kinds vs copies.** A kind is the app in the Widget gallery. A copy is one installed instance with its own id, size, place, and settings. Kinds declare `once`, `perKey`, or `many`.
- **Face, detail, gear.** Faces become dash-gauge glances. Today's handheld dialogs become the detail views, unchanged at first. Each copy gets a gear that opens its own settings.
- **Edit mode.** Drag and resize only while edit mode is on. Out of edit mode the dash is locked.
- **Two replacements.** Countdown replaces Days Until (each mark becomes its own copy). Language study replaces Vocab (one copy per language, vocab is one mode, levels and placement quizzes).
- **Room to grow.** The kind registry is a plain manifest, so a user-made kind can join later through the Module platform's rung 2 manifest.

Written as a plan against `3e31da6`, before any code changed. See **Status** above for what is built.

## Inventory of today's widgets

Nineteen kinds are registered in `HOME_WIDGET_IDS` (`lib/home-widgets.ts`). Eight show on a fresh install; eleven start hidden. Only seven kinds own saved settings, and Points keeps its one setting outside the backup. Footprints are columns × rows on the `home-widget-face.css` grid (columns `minmax(144px, 1fr)`, rows 74px).

| Widget (id) | Fresh install | Footprint | Saved settings and where | Code | Research doc |
|---|---|---|---|---|---|
| Today's Progress (`progress`) | showing | 3 × 2 | None. Fold state is in memory only. | `home-overview.tsx` (`ProgressTile`) | `home-widget-progress.md` |
| Rituals (`review`) | showing | 1 × 2 | **Not now** writes `brain2-rituals-snooze-until`. **Dismiss** is session-only. | `home-review-banner.tsx` | `home-widget-review.md` |
| Points (`points`) | showing | 2 × 2 | Ticker period D / W / M / ALL in plain localStorage `brain2-home-points-period`. Per device, **not in the backup**. | `points-stats.tsx` | `home-widget-points.md` |
| Latest award (`award`) | showing | 1 × 2 | None. | `home-award-tile.tsx` | `home-widget-award.md` |
| Screen pet (`pet`) | showing | 1 × 2 | None. | `home-screen-pet.tsx` | `home-widget-pet.md` |
| Moon (`moon`) | showing | 1 × 3 | View width and time rate in `brain2-sky-motion` (v1). Zoom, True sizes, Stars near, pause, reverse are session-only. | `home-moon-tile.tsx`, `home-moon-orrery.tsx`, `home-sky-*.tsx` | `home-widget-moon.md`, `components/Home/MOON_SKY_MOTION.md` |
| Days Until (`daysuntil`) | showing | 1 × 2 per mark | `brain2-home-days-until` v3 `items[]`: label, date, time, format, mode (countdown / countup / auto), `eventId`, `scheduleAllDay`. Can write a Plan all-day event. | `home-days-until.tsx`, `lib/home-days-until-event.ts` | `home-widget-countdown.md` (was `home-widget-daysuntil.md`) |
| Vocab (`vocab`) | showing | 2 × 2 | `brain2-home-vocab` v2: languages, active, level per language, today's shuffle, favorites. Also Lists items `vocab-1000-<lang>`, `vocab-mine-<lang>`, attribute `vocab-known`. | `home-vocab-tile.tsx`, `-thousand`, `-flashcards`, `-dictionary` | None (README rows only) |
| Affirmation (`affirmation`) | hidden | 2 × 2 | Lens and recitation log in `brain2-affirmation-log`. Lines come from Lists → affirmations or the morning ritual. | `home-affirmation-tile.tsx` | `home-widget-affirmation.md` |
| Weather (`weather`) | hidden | 2 × 2 | City and beach in `brain2-home-weather`. Falls back to Settings `homeCity`. | `weather-instrument.tsx` | `home-widget-weather.md` |
| Next (`next`) | hidden | 1 × 2 | None. | `home-next-tile.tsx` | `home-widget-next.md` |
| Day lamp (`daylamp`) | hidden | 1 × 2 | None. | `home-day-lamp.tsx` | `home-widget-daylamp.md` |
| Harvest leftover (`harvest`) | hidden | 1 × 2 | None. | `home-glance-tiles.tsx` | `home-widget-harvest.md` |
| Inbox mill (`inbox`) | hidden | 1 × 2 | None. | `home-glance-tiles.tsx` | `home-widget-inbox.md` |
| Already flowing (`flow`) | hidden | 2 × 2 | None. | `home-reading-tiles.tsx` | `home-widget-flow.md` |
| Plan and lived (`paint`) | hidden | 2 × 2 | None. | `home-reading-tiles.tsx` | `home-widget-paint.md` |
| Tracking now (`tracking`) | hidden | 1 × 2 | None. **Update** writes Tracking, not a setting. | `home-tracking-tile.tsx` | `home-widget-tracking.md` |
| Night well (`night`) | hidden | 1 × 2 | None. | `home-glance-tiles.tsx` | `home-widget-night.md` |
| Solar remainder (`solar`) | hidden | 1 × 2 | None of its own. Reads the Weather pin, else Settings `homeCity`, else San Diego. | `home-solar-tile.tsx` | `home-widget-solar.md` |

Shared by every widget: **Follow the clock** (`widgetsFollowClock` in `brain2-home-widgets`) and the three Habits hues (`percentLedTint`, `gradeTubeColor`, `outputGradeTubeColor`) that tint meters. The shell is `home-overview.tsx` (one `if` per id), `home-widget-dialog.tsx` (the silver handheld detail), `home-widgets-menu.tsx` (the **Widgets** key), and `home-widget-catalog.tsx` (**Widget catalog**).

**Where the docs live.** Every kind has a row in `components/Home/README.md` (Overview widgets, ~92) and a blurb in `HOME_WIDGET_CATALOG`. Research reports are in `docs/widget-improvement/` (research docs above) and the fix plan in `docs/widget-improvement/plan/` (`day-score.md`, `clock-sky.md`, `capture-rites.md`, `shared-chrome.md`). Ideas are in `docs/FUTURE_WIDGET_IDEAS.md`. Days Until is also named in `lib/README.md`, `docs/UI_NEXT.md`, `docs/PLAN_OF_ACTION.md`, `docs/SPEC_MAPPING.md`, `docs/tree.md`, `docs/cyberneticsbrain2.md`. Vocab is also named in `lib/README.md`, `docs/KNOWLEDGE_GRAPH_PLAN.md`, `docs/LINKS_REDESIGN.md`, and `docs/analytics-vision/`.

A second, separate widget system exists: Modules **Widgets** (List Explorer, Writing Generator, Random Task, Analytics Stat, List Summary, Rules) in `lib/modules-store.ts`. Those are already many-copy instances with per-copy `config`. They are out of scope here but they are the precedent for the copy model below.

## How layouts and settings are saved today

A saved layout is only two lists and a switch: `order` (every id, in strip order), `hidden` (ids not showing), and `widgetsFollowClock`. Size and position on the grid are not saved; CSS decides them per kind, and `grid-auto-flow: dense` lets a small tile jump ahead of its menu position.

- **Store.** `lib/home-widgets-store.ts`, zustand `persist`, key `brain2-home-widgets`, version 10. The `cogs-home-widgets` alias is still read (`lib/storage-keys.ts`). Demo profile writes `brain2-demo-home-widgets`.
- **Sanitize on load.** `sanitizeHomeWidgetOrder` drops unknown ids and duplicates, then appends any missing id at the end. `sanitizeHomeWidgetHidden` keeps only known ids. So an unknown id in a saved blob is silently lost today. The new store must not do that.
- **Migration ladder.** `migrateHomeWidgetPersist` (~662) walks v1 to v10: v3 folds `alltime` / `today` / `week` / `month` into `points`; v2, v4, v5, v9 tuck new kinds hidden; v6 and v7 place `award` and `moon`; v8 adds Follow the clock; v10 appends `vocab` showing.
- **Backup.** `lib/data/backup.ts` (~181, ~246, ~510) backs up and live-restores `home-widgets`, `home-weather`, `home-days-until`, `sky-motion`, `home-vocab`, and `affirmation-log`. `brain2-home-points-period` and `brain2-rituals-snooze-until` are not in that list.
- **Who writes it.** Only the **Widgets** menu (show, hide, move up / down, Follow the clock), the tile × (with **Are you sure?**), and the **Widget catalog** (Add, Hide, Add another). There is no drag today.

README drift found while mapping: `components/Home/README.md` says the weather pin persists under `cogs-home-weather`; the code writes `brain2-home-weather` and only reads the `cogs-` alias. The Layout diagram (~75) still shows an equal-height single row, which the dense grid replaced. Both are worth fixing when the README is next touched.

## Model: widget kinds and installed copies

A **kind** is the app as the Widget gallery lists it. An **installed copy** is one instance of a kind on the dashboard, with its own id, settings, size, and place. Every face, detail, and gear reads one copy, never the kind's global state.

_Diagram in the source doc: kind to copy to face, detail, and gear._

Installing a kind makes a copy. The copy draws its face; a click opens the detail, and its gear saves back to that copy alone.

**Kind manifest** (new `lib/widgets/kinds.ts`, one plain object per kind):

- `id`, `name`, `version` — stable id, gallery name, settings schema version.
- `installs` — `once` (at most one copy), `perKey` (one copy per key, for example per language), or `many` (any number).
- `keyOf(settings)` — for `perKey` only: the key that must stay unique (`"fr"`).
- `sizes` and `defaultSize` — allowed footprints in dash cells, for example `["1x1", "2x1", "2x2"]`.
- `defaultSettings`, `sanitizeSettings(raw)`, `migrateSettings(raw, fromVersion)` — the same sanitize-then-merge habit every store here already uses.
- `Face`, `Detail`, `Settings` — lazy components. `Setup` and `Guide` are optional.
- `gallery` — what it does, how it works, and a static sample (today's `HOME_WIDGET_CATALOG` blurb moves here).

**Installed copy** (new store, key `brain2-home-dashboard`):

```ts
type WidgetCopy = {
  id: string            // "cpy_…", stable across devices
  kind: string          // "countdown", "language", "points", …
  key?: string          // perKey kinds only
  title?: string        // optional rename on the face
  settings: unknown     // validated by the kind's sanitizeSettings
  settingsVersion: number
  installedAt: string
}
type DashLayout = { copyId: string; x: number; y: number; w: number; h: number; hidden?: boolean }[]
type DashboardState = {
  copies: WidgetCopy[]
  layouts: { milled: DashLayout; dash: DashLayout }
  style: "milled" | "dash"
  followClock: boolean
  legacy?: { order: string[]; hidden: string[] }   // the v10 blob, kept read-only
  unknown?: WidgetCopy[]                           // copies of kinds this build does not know
}
```

Settings are layout and preference, never records. That follows law 2 of `docs/MODULE_PLATFORM.md`. Vocab favorites, `vocab-known`, affirmation recitations, and Plan events stay where they are. A copy points at them by key.

**Proposed install rule per kind.** A kind can loosen later (once → many) without a migration; tightening needs one.

| Kind | Installs | Why |
|---|---|---|
| Countdown (was Days Until) | many | One copy per mark. Each mark is already its own tile. |
| Language study (was Vocab) | perKey: language | One copy per language, as the brief asks. |
| Points | many | Each copy can pin its own period (D / W / M / ALL) and show it at once. |
| Weather | perKey: place | Two cities side by side. |
| Solar remainder | perKey: place | Same pin as Weather, or its own. |
| Today's Progress, Rituals, Latest award, Screen pet, Moon, Affirmation, Next, Day lamp, Harvest leftover, Inbox mill, Already flowing, Plan and lived, Tracking now, Night well | once | One reading of one vault. Next and Tracking now could become many later (per list or per lane). |

## Faces, details, gear settings, styles, edit mode

The face is a gauge, the detail is the instrument, and the gear is the copy's settings. Edit mode is the only way to move or resize.

### Faces

- **Dash cell.** The new grid is a cell of about 96 × 64 px. A kind declares the sizes it can draw: `1x1`, `2x1`, `1x2`, `2x2`, up to `3x2`. Screen pet and Solar remainder must support `1x1`. Moon keeps `1x3` as an option.
- **Face rule.** One reading (a number or a word), one short label, an optional lamp. At most one secondary line, and only at `2x1` or larger. No keys on the face; today's hover keys (↻ on Vocab, ⇄ and ✓ on Affirmation) move into the detail, or stay as a per-copy "quick key" setting.
- **Face contract.** `Face({ copy, size, date, style })`. Every kind must render every size it lists. A test renders each kind at each size against a fixture vault.

### Detail

Clicking a face opens its detail. Today's silver handheld (`home-widget-dialog.tsx`) becomes the detail frame, so every existing detail works on day one. A kind may ask for a wide or full sheet (Moon, Language study) and can use any UI inside. Esc, ×, and outside click close it as now.

### Gear

The detail header gets a gear key. It opens that copy's `Settings` panel in place of the detail body, with **Done** to return. Settings save to `copy.settings` only, so two Points copies can differ. Every setting must visibly change the face or the detail; a setting with no visible effect does not ship. A test per setting renders before and after and asserts the output changed.

First settings proposed per kind:

| Kind | Gear settings |
|---|---|
| Points | Period (D / W / M / ALL), show change vs previous, show chart |
| Today's Progress | Lines (habits, to-dos, both), period (today, week, month) |
| Rituals | Which slots count (morning, night), show Star Lord |
| Screen pet | Show clock, pet name |
| Moon | Face shows phase name or next major phase; chart view width and time rate (from `brain2-sky-motion`) |
| Weather, Solar remainder | Place (the key), units, what the foot shows |
| Affirmation | Lens, source (ritual's five or the list), quick keys on or off |
| Next | Sources (events, planned actions), look-ahead |
| Countdown, Language study | See their section below |
| All kinds | Title, day source (dashboard day or wall clock), lamp color |

The global **Follow the clock** stays as the dashboard default. A copy can override it with "day source".

### Styles

- **Milled** is today's look: `home-widget-face.css`, the nameplate, the CRT, today's footprints. It stays the default for anyone who already has a saved layout.
- **Dash** is the new look: flat dark bezel, vacuum-fluorescent segment digits and bar meters (1980s Oldsmobile), with a soft blue LCD field and simple pictograms (2011 Prius). Tokens go in `docs/DESIGN_STYLE.md` under a new Dash section.
- Style is a dashboard setting. Each style keeps its own layout, because Milled footprints and Dash cells differ.

### Edit mode

- An **Edit** key on the date plate (beside the Widgets key, which becomes **Gallery**) turns edit mode on. A banner names it and offers **Done**.
- In edit mode faces show a drag grip, a resize corner, and ×. Clicking a face does not open its detail. Resize snaps to the kind's allowed sizes.
- Out of edit mode nothing can be dragged or resized. Edit mode is not saved; reload always starts locked.
- No drag library is in `package.json`. Use pointer events on the grid, plus keyboard: arrow keys move the focused copy, Shift+arrows resize. The current move up / down keys in the menu keep working as the accessible fallback.

## Widget gallery, setup, and first-run guides

The **Widget catalog** (`home-widget-catalog.tsx`) becomes the **Widget gallery**: one page per kind, not per copy. It already steps through kinds with a sample face, "what it shows" and "when it is useful", so it grows rather than restarts.

Each kind's page has:

- **What it does.** One paragraph, from the kind's `gallery` field.
- **How it works.** Where its numbers come from, in plain words (for example "habit points paid over the habit ceiling"). Today this text lives in the README rows and the research docs; it moves into the manifest.
- **Samples at each size**, in the current style.
- **Installed copies.** A list of this kind's copies with **Open**, **Settings**, and **Remove**. For `perKey` kinds the list shows which keys are taken.
- **Install.** `once`: Install, or Installed. `perKey`: Install for… with the free keys. `many`: Add another.

**Setup.** A kind may declare a `Setup` step that runs before the copy lands. Countdown asks for the label and date. Language study asks for the language, and whether it is native or studied. Weather asks for the place. A kind without `Setup` installs with defaults.

**First-run guide.** A kind may declare an optional `Guide`: a few short cards shown the first time a copy's detail opens, with **Skip** always visible. A flag on the copy (`guideSeen`) keeps it from returning. Good candidates: Language study (modes and levels), Moon (zoom, scale tour), Points (what the split means). The gallery page has **Show the guide again**.

## Countdown and Language study

Both replacements reuse today's stores as their data source, so no mark, favorite, or known word moves.

### Countdown replaces Days Until / Days Since

Today one `daysuntil` id draws one tile per item in `brain2-home-days-until` v3, and × hides the whole family. Countdown makes each mark its own copy (`installs: many`).

Kept from today: label, date, optional time, unit or decimal format, mode (count down to, count up from, auto), the Plan event link, and the all-day Plan day (`lib/home-days-until-event.ts`).

Improved:

- **One × per mark.** Removing a copy removes only that mark (today's **Remove this** in the detail becomes the normal path).
- **Units.** Days, weeks, "sleeps", or working days, plus the existing decimal.
- **Repeats.** Yearly or monthly, for birthdays and anniversaries; the face rolls to the next one.
- **Progress from a start.** An optional start date draws a bar of how far along the span is (useful for "days since" streaks too).
- **Milestones.** Optional lamp at round numbers (100 days, 1 year) for count-up marks.
- **When it passes.** Choose: switch to count-up (today's auto), show "Done", or hide the copy.
- **Setup** on install asks label and date; the date can be picked from a Plan event.

### Language study replaces Vocab

One copy per language (`installs: perKey`, key = language code). A copy has a **role**: studied or native.

- **Modes.** Vocab is one mode and holds everything Vocab does today: Word of the day, 1000 words, Flashcards, Look up, the dictionary fold, Say it. Later modes (reading, listening, grammar drills) are **Planned** and slot in as more modes, not more widgets.
- **Levels for studied languages.** CEFR A1–C2 as the shared ladder. The level picks the word pool: today's `common` and `everyday` banks and the 1000-word frequency ranks map onto A1–B1, `advanced` onto B2 and up.
- **Placement quiz (optional).** Offered at setup and from the gear. Its format follows the real exam for that language, scored to CEFR: DELF / DALF (French), DELE (Spanish), CELI / CILS (Italian), Goethe-Zertifikat (German), JLPT N5–N1 (Japanese), HSK (Mandarin). The questions are original, written in that exam's format; no exam content is copied. The result sets the level, and the user can override it.
- **Native languages.** Vocab building and flashcards only: Word of the day at Everyday, SAT / Word Power, Advanced, or Extremely advanced, plus favorites and flashcards. No CEFR level, no placement quiz, no 1000 words. This is today's English view.
- **Face.** Today's word and its reading at `2x1`; the level and a known-word meter at `1x1`.
- **Data stays put.** Favorites and shuffles stay in `brain2-home-vocab`, keyed by language. Known words stay as the `vocab-known` attribute on `vocab-1000-<lang>` items, and My words stay in `vocab-mine-<lang>`, so Lists still sees them.

Gaps found: German has a daily word but no 1000-word list (`THOUSAND_LANGS` excludes `de`). English has only native-style levels. Both are fine for a first cut and are named in the gallery page.

## Room for user-made widgets

Nothing user-made ships in this redesign, but the shapes above are chosen so it can join later without another migration.

- **Kinds are data first.** The manifest is a plain object plus lazy components. A built-in kind and a future user kind register the same way, through one `registerWidgetKind` call.
- **Ids are namespaced.** Built-ins use bare ids (`points`). User kinds will use `user:<slug>`, so they can never collide.
- **Unknown kinds are kept.** A copy whose kind this build does not know goes to `unknown[]` instead of being dropped, and the dash shows a quiet "widget not available" face. That fixes today's silent drop in `sanitizeHomeWidgetOrder`, and it also protects a layout synced from a newer build.
- **Where they come from.** The path is rung 2 of `docs/MODULE_PLATFORM.md`: a hand-written manifest. A user widget would be a face and detail built from existing Module view kinds (stat, list summary, random pick, notes) bound to the user's lists. Arbitrary code (rung 3) stays out.
- **The five laws apply.** A user widget keeps records as Items and only layout and preference in `copy.settings`.
- **Modules Widgets converge.** List Explorer, Random Task, Analytics Stat, and the rest are already many-copy instances. They are good first "user-style" kinds to port onto the dash later, which proves the path end to end.

## Migration plan

The migration only adds. It builds `brain2-home-dashboard` from the stores that exist, never deletes or rewrites an old key, and mirrors back to the old blob for one release so an older build still opens the same strip.

**When it runs.** On first load with no `brain2-home-dashboard`, after `brain2-home-widgets` has run its own v10 migration. It also runs when a backup without the new key is restored, and per data profile (Live and Demo).

**What each old thing becomes.**

| Today | Becomes | Rule |
|---|---|---|
| Each id in `order` | One copy of that kind | Same position in the Milled layout. Footprint = today's CSS footprint. `hidden` ids keep `hidden: true`. |
| `daysuntil` with N items | N Countdown copies | Each item's fields copy into `settings`; the item id is kept as `settings.legacyId`. If the family was hidden, every copy is hidden. The copies sit where the family sat, in item order. |
| `vocab` with its `languages` | One Language study copy per language | The `active` language takes Vocab's place and shows. The others install hidden, so the strip does not grow overnight. English gets role native; the rest get role studied, with today's level mapped to CEFR. |
| `brain2-home-points-period` | The Points copy's `period` | Read once. The key stays for rollback. |
| `brain2-home-weather` pin | The Weather copy's key and place | The store stays as the default pin Solar remainder already reads. |
| `brain2-sky-motion`, `brain2-affirmation-log`, `brain2-home-vocab`, `brain2-home-days-until` | Unchanged | Still the data source. The gear writes to them for `once` kinds; `perKey` and `many` kinds keep their per-copy part in the copy. |
| `widgetsFollowClock` | `followClock` | Same meaning, dashboard default. |
| `review` session Dismiss, `rituals-snooze-until` | Unchanged | Still session and day state, not layout. |
| Any id the build does not know | A copy in `unknown[]` | Never dropped. |

**Style on first run.** A vault that already had `brain2-home-widgets` lands on **Milled**, so nothing looks different until the user picks Dash. A fresh install starts on **Dash**. Switching style never deletes the other style's layout.

**Safety.**

- `legacy` keeps the v10 `order` and `hidden` exactly as read, for at least two releases.
- For one release, every layout change also writes `order` and `hidden` back to `brain2-home-widgets` (dual-write, the same pattern as the Trip Itinerary wave in `lib/modules-store.ts`).
- `lib/data/backup.ts` adds `home-dashboard` to the backup, the label map, and live restore.
- Fixture tests: one saved blob per persist version v1–v10, Days Until v2 and v3, Vocab v1 and v2. Each asserts every old id has a copy, hidden stays hidden, every mark and language is a copy, and `unknown[]` is empty. A round-trip test restores an old backup and checks the same.
- A **Reset to my old layout** key in the gallery rebuilds the dashboard from `legacy`.

## Build order, doc updates, open questions

Each phase ships on its own and leaves the app working. Phases 1–2 change nothing the user can see.

1. **Registry.** Add `lib/widgets/kinds.ts` with all 19 kinds wrapping today's tiles and dialogs as `Face` and `Detail`. `HomeOverview` renders from the registry instead of the `if` chain. Check: Home looks identical; existing tests pass.
1. **Copies store and migration.** Add `brain2-home-dashboard`, the migration, the dual-write, backup wiring, and the fixture tests. The strip renders from copies in the Milled style. Check: every fixture vault keeps its exact strip.
1. **Edit mode.** Add the Edit key, drag, resize, keyboard moves, and save to the Milled layout. Check: nothing moves while edit mode is off.
1. **Gear.** Add the gear and per-copy `Settings` for each kind, with a visible-change test per setting.
1. **Countdown.** Replace Days Until with copies, then add the improvements.
1. **Language study.** Replace Vocab with per-language copies, roles, CEFR levels, then the placement quizzes.
1. **Dash style.** Add the Dash faces at every declared size, plus the style switch and the Dash section of `docs/DESIGN_STYLE.md`.
1. **Widget gallery.** Rename the catalog, add per-kind pages, setup steps, guides, and **Reset to my old layout**.
1. **Retire the mirror.** After two releases, stop dual-writing `brain2-home-widgets`. Keep reading it as an import source.

**Doc updates** (with the phase that changes the behavior):

- `components/Home/README.md`: rewrite Overview widgets around kinds and copies; rename Days Until → Countdown and Vocab → Language study; fix the weather key and the Layout diagram; link this plan as **Planned** until built.
- `lib/README.md`: add `lib/widgets/` and the new store; rename the Days Until and Vocab store notes.
- `docs/widget-improvement/`: rename `home-widget-daysuntil.md`, add a Language study page, and use "kind" and "copy" throughout.
- `docs/FUTURE_WIDGET_IDEAS.md`, `docs/UI_NEXT.md`, `docs/PLAN_OF_ACTION.md`, `docs/SPEC_MAPPING.md`, `docs/tree.md`, `docs/KNOWLEDGE_GRAPH_PLAN.md`, `docs/LINKS_REDESIGN.md`, `docs/analytics-vision/`: rename mentions.
- `docs/DESIGN_STYLE.md`: add the Dash style; keep Milled fascia as is.
- Commit this plan as `docs/WIDGETS_REDESIGN.md`, matching the other `*_REDESIGN.md` plans.

**Open questions**

- Is English your native language for Language study, and are any others native?
- Should a fresh install start on Dash, or on Milled like everyone else?
- Should Points, Weather, and Solar remainder allow more than one copy, as proposed?
- Is the Widgets key renamed **Gallery**, or kept as Widgets with Gallery inside?
