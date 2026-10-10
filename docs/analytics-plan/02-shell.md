# Build brief — Analytics group rail

This brief describes a later shell change. It does not edit `components/`, `analytics-tabs.ts`, or any other file in `docs/analytics-plan/`.

The studio stays one Analytics tab. Groups sit on the left rail; the views of the selected group sit beneath. That contract is `AnalyticsNav.tsx` today. The five group ids (`behavior`, `time`, `accuracy`, `meta`, `library`) are replaced by the rooms below. Every existing view id moves into exactly one room. None are renamed or deleted.

Source of the rooms: the Information architecture and “Rooms that stay blocked” sections of `docs/analytics-vision/ANALYTICS_VISION.md`, plus the appendix (history that is not stored — empty frames stay empty; this shell does not add those columns). Meaning stays a later group, still unbuilt, specified in Wave 14 of `docs/JungBrain2.md` and noted in `components/Analytics/README.md`. It is not on this rail and it is not dropped.

**Later owner:** one shell agent. Files:

- `components/Analytics/analytics-tabs.ts`
- `components/Analytics/analytics-views.tsx`
- `components/Analytics/AnalyticsNav.tsx`
- `components/Analytics/enhanced-analytics.tsx` — only the default tab and help wiring
- `components/Analytics/analytics-tabs.test.ts`

No chart math. No new plates inside existing views. New rooms that have no component yet mount a lazy stub that states what the room is for and links to the seed views named below. The stub is a sentence and a frame, the same empty-frame law as a blocked room.

`analytics-tabs.test.ts` currently locks the five group ids and several `groupForTab` homes (`overcommit` → behavior, `circadian` → time, `observatory` → meta, `firstTabInGroup("meta")` → observatory, and the rest of that file). Update that test **when the shell is implemented**, not in the docs pass that writes this brief.

---

## Order

Thirteen rooms, in this order. The order is the day, then the lenses you reach from the day, then the catalog.

| # | Group id | Label | Why it sits here |
| --- | --- | --- | --- |
| 1 | `day` | Day | Landing. One local date as the five blocks. Drill starts here. |
| 2 | `shape` | Shape | One step out: the last 28 days. Click a cell to return to Day. |
| 3 | `clock` | Clock | The hour stack (0–23). Circadian already is that grain, so it is this room’s seed. |
| 4 | `tracking` | Tracking | Occupancy detail behind the day’s ribbon. |
| 5 | `habits` | Habits | Practice: completion, streaks, points, reflection. |
| 6 | `plan` | Plan | Commitment: plan vs reality, calibration, reviews, overcommit. |
| 7 | `presence` | Presence | Wellbeing series (Now). Mood field stays in Tracking; this room links to it. |
| 8 | `phone` | Phone | Text-pipeline coverage. Not mixed into Tracking. |
| 9 | `cross` | Cross | Combination analyses. Each card keeps its join key. |
| 10 | `forecast` | Forecast | Three baselines, each with its error. No forecast caption until that error exists. Markov dwell stays in Presence and is linked, not copied. |
| 11 | `quality` | Quality | Cross-section quality. Always one click from Day. |
| 12 | `language` | Language | Intention over prose already stored. A room, not a field invented on items. |
| 13 | `library` | Library | Item catalog. Unchanged membership. Last, because it is the vault’s schema, not the day. |

Meaning is absent from this list on purpose. When Wave 14 is built, it is a further group after these rooms. This shell does not add Coincidence, Symbols, or Exceptions.

---

## Membership

Old ids move. New ids are only for rooms that have no existing seed: Day, Shape, Forecast, Quality, Language.

### `day` — Day

New id: `day`. Label: **Day**. First view in the group.

Composition landing, not a rename of Habits or Tracking. The first paint, when a later plate agent builds it, is the day card: tracking ribbon, plan lanes, habit strip with raw beside curved, wellbeing ticks, provenance hairline only where a stamp exists, quality strip. No single score. The shell agent only registers the id, the help sentence, and a lazy stub that names those blocks and links to `tracking`, `plan`, `habits`, `metrics`, and `quality`.

### `shape` — Shape

New id: `shape`. Label: **Shape**. Only view for now.

Last 28 days as five thin calendars (coverage, commitment, raw day % with curved as a layer, wellbeing count, telegram-day marks). Stub links to `tracking`, `plan`, `habits`, `metrics`, `text-events`. Clicking a date is a later plate; the shell does not implement the click.

### `clock` — Clock

`circadian` **moves** here. It does not stay under Tracking. One home, so the id is not duplicated.

| Id | Label | Note |
| --- | --- | --- |
| `circadian` | Circadian | Existing `CircadianView`. First view in the group. |

The Clock room is a composition (tracking mix, plan minute load, capture bursts, wellbeing `at` versus `createdAt`, sun toggle). Those plates are later work inside this room. They are not a second id for the circadian chart, and they are not new ids in this shell. Help for `circadian` stays the sentence already in `ANALYTICS_TAB_HELP` until a plate agent changes the picture.

### `tracking` — Tracking

| Id | Label |
| --- | --- |
| `tracking` | Tracking |
| `sleep` | Sleep |
| `screentime` | Screen Time |
| `places` | Places |
| `mood-field` | Mood field |
| `diversity` | Diversity |
| `transitions` | Transitions |
| `context-switch` | Context Switch |
| `log` | Log |
| `cycle-phase` | Cycle phase |
| `operations` | Operations |

`circadian` is not in this list. `text-events` and `text-spans` are not in this list. Mood field stays here because it is painted mood on the tracking grain. Presence links to `mood-field`; it does not host a second tab with the same id.

### `habits` — Habits

| Id | Label |
| --- | --- |
| `habits` | Habits |
| `streaks` | Streaks |
| `points` | Points |
| `velocity` | Velocity |
| `reflection` | Reflection |
| `todo-pulse` | To-do pulse |
| `seasons` | Seasons |

`reviews` and `overcommit` leave Behavior and sit in Plan. Reviews are saved period and morning reviews of the day you committed to. Overcommit is reconstructed day-pushes. Both are plan of the day, not habit practice.

### `plan` — Plan

| Id | Label |
| --- | --- |
| `plan` | Plan vs Reality |
| `calibration` | Calibration |
| `cycle` | Cycle |
| `regret` | Regret |
| `goals` | Goals |
| `overcommit` | Overcommit |
| `reviews` | Reviews |

### `presence` — Presence

| Id | Label |
| --- | --- |
| `metrics` | Metrics |

Seed is the existing wellbeing small-multiples view. The room’s help (and the stub chrome around that view, if the shell adds a one-line link row) points at `mood-field` in Tracking. Do not move `mood-field`. Footnote on reconstructed occupancy and “no dialog-open count” belong to a later presence plate, not to this shell. Blocked presence frames (assertion log, retained previous intervals) stay empty until the appendix columns exist.

### `phone` — Phone

| Id | Label |
| --- | --- |
| `text-events` | Text events |
| `text-spans` | Text spans |

Coverage line first is a later plate. The shell only moves these two ids out of Time.

### `cross` — Cross

| Id | Label |
| --- | --- |
| `observatory` | Observatory |
| `cross-section` | Cross-section |
| `correlation` | Correlation |
| `spectrum` | Spectrum |

`metrics` leaves Meta for Presence. Spectrum stays here: lag and periodogram are combination readings, and the existing help already says they are not a forecast.

### `forecast` — Forecast

New id: `forecast`. Label: **Forecast**. Only view for now.

Stub states the law: three baselines, each with its error; no forecast caption until that error has been computed; the Markov dwell forecast stays in Presence and is linked, not mixed in. A joint learned grade is blocked until a joint label exists (`Rooms that stay blocked`). The shell does not compute a baseline.

### `quality` — Quality

New id: `quality`. Label: **Quality**. Only view for now.

Stub says this room is one click from Day and names the worst overlapping minutes and the estimated share as the later plate. It does not invent a quality score. Link back to `day`.

### `language` — Language

New id: `language`. Label: **Language**. Only view for now.

Stub points at `docs/analytics-vision/06-language.md`: intention over prose already stored. It does not add a language field to items.

### `library` — Library

Unchanged membership and order.

| Id | Label |
| --- | --- |
| `item-types` | Item Types |
| `lists-areas` | Lists & areas |
| `attributes` | Attributes |
| `tags` | Tags |
| `stages` | Stages |
| `weight` | Weight |

Group id stays `library`, so a stored last-view for that group can still resolve.

---

## Full id map

Every current id, old group → new group. Count of old ids: 39. Plus five new ids (`day`, `shape`, `forecast`, `quality`, `language`).

| Id | From | To |
| --- | --- | --- |
| `habits` | behavior | habits |
| `streaks` | behavior | habits |
| `points` | behavior | habits |
| `velocity` | behavior | habits |
| `reflection` | behavior | habits |
| `todo-pulse` | behavior | habits |
| `seasons` | behavior | habits |
| `reviews` | behavior | plan |
| `overcommit` | behavior | plan |
| `tracking` | time | tracking |
| `sleep` | time | tracking |
| `screentime` | time | tracking |
| `circadian` | time | clock |
| `places` | time | tracking |
| `mood-field` | time | tracking |
| `diversity` | time | tracking |
| `transitions` | time | tracking |
| `context-switch` | time | tracking |
| `log` | time | tracking |
| `cycle-phase` | time | tracking |
| `operations` | time | tracking |
| `text-events` | time | phone |
| `text-spans` | time | phone |
| `plan` | accuracy | plan |
| `calibration` | accuracy | plan |
| `cycle` | accuracy | plan |
| `regret` | accuracy | plan |
| `goals` | accuracy | plan |
| `observatory` | meta | cross |
| `cross-section` | meta | cross |
| `correlation` | meta | cross |
| `spectrum` | meta | cross |
| `metrics` | meta | presence |
| `item-types` | library | library |
| `lists-areas` | library | library |
| `attributes` | library | library |
| `tags` | library | library |
| `stages` | library | library |
| `weight` | library | library |

`ANALYTICS_TABS` is still the flat list of every id, old and new. `groupForTab`, `tabLabel`, `firstTabInGroup`, and `ANALYTICS_TAB_HELP` cover all of them. Help for a moved view keeps its current sentence. Help for each new id is one honest line: what the room is, that the picture is not built yet, and which existing views it will compose. `analytics-views.tsx` lazy-loads the existing components on the old ids and a single stub module for the five new ids (one component, five entries, or five thin re-exports — the shell agent’s choice, as long as opening Day does not import Tracking’s chart library).

First view when a group has no stored last-view:

| Group | First tab |
| --- | --- |
| day | `day` |
| shape | `shape` |
| clock | `circadian` |
| tracking | `tracking` |
| habits | `habits` |
| plan | `plan` |
| presence | `metrics` |
| phone | `text-events` |
| cross | `observatory` |
| forecast | `forecast` |
| quality | `quality` |
| language | `language` |
| library | `item-types` |

---

## Persistence and capture

**Active view.** `enhanced-analytics.tsx` uses `usePersistedTab(APP_NAV_KEYS.analyticsTab, ANALYTICS_TABS, "habits")`. Change the fallback to `"day"`. `readStoredTab` already returns the fallback when the stored string is not in `allowed`. A person who already chose a view keeps that view, because the old ids remain in `ANALYTICS_TABS`. A stored id that is unknown falls back to Day. Do not migrate stored ids. Do not rewrite anyone’s last view to Day if it still names a real tab.

**Last view per group.** `AnalyticsNav` reads `APP_NAV_KEYS.analyticsGroupViews` and keeps a pair only when the group id exists and the tab id is in that group (`readGroupViews`). Unknown stored group keys are ignored. After this change, stored keys `behavior`, `time`, `accuracy`, and `meta` are ignored. `library` still matches. A new group starts on its first tab until the person picks a view, then that pick is written under the new group id. Do not copy an old group’s last view onto a new group.

**Capture.** Keep `data-ui-name="Analytics index"` on the nav. Keep `role="tab"` and `aria-selected` on both group buttons and view buttons, so screenshot capture can click the group, then the view. Group button `title` stays the group label plus the view labels, as it is now.

**Fascia.** Do not restyle the milled keys, the bay, the nameplates, or the 168px rail. Thirteen groups will not fit the bay at once. Give `.an-group-bar` the same `min-height: 0` and `overflow: auto` the view bar already has, so the group list scrolls inside the existing bay. The view bar keeps scrolling on its own. No wrap onto a second visual language, no icons, no horizontal group strip.

---

## Out of scope for the shell agent

- Chart math, new plates, drill from Day to minute to record.
- Moving Meaning onto the rail.
- Rewriting `ANALYTICS_TAB_HELP` for views whose picture did not change.
- Screenshot PNGs (capture after the shell lands, in a later pass).
- Docs other than what that later agent is told to update when the code lands. This brief is the spec until then.
