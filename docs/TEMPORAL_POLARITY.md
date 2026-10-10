# Temporal polarity — Prospective vs Retrospective

Brain2 keeps intention beside lived time and never merges them. This file is the
**catalog** of which stores, fields, and surfaces sit on which side. The short
definition lives in [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) (Temporal
polarity). The join sentence is in [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md).
Code helpers: [`lib/temporal-polarity.ts`](../lib/temporal-polarity.ts).

**What it is not:** an order of abstraction (observed → recorded → derived →
inferred), a certainty flag (`est.`, `precision`, `FieldEstimate`), or a
Source/Belief knowledge-graph claim. Those axes stay separate.

**What it does not change:** persist keys, field names, or Plan/Tracking APIs.
Implementation names stay; polarity is the overlay.

---

## The rule

> A plan is drawn beside what happened and is never merged into it.

Prospective inputs are written *before* or *toward* a period. Retrospective
inputs are written *as* or *after* the period — what the record says happened.
Bridge surfaces confirm or compare; they are not a third polarity.

---

## Prospective

Four Plan writings, plus the open schedule ledger and related intentions.

| Writing / surface | Store / fields | Notes |
|---|---|---|
| Calendar event | `brain2-event-storage` / `CalendarEvent` | Opalescent chip. Not lived time. |
| Planned action | `brain2-planned-actions` / `PlannedAction` | Dashed linen. `source`: free \| todo \| habit. |
| Period plan text | `dayPlan-*` / `weekPlan-*` / `monthPlan-*` / `quarterPlan-*` | Written intentions. Not day-summary prose. |
| Live schedule | `scheduledDate` / `Time` / `Week` / `Month` / `Year`, `estimatedDuration`, `pertEstimate`, `todoMarks` | Finest grain wins. |
| Rail intentions | Computed (untimed todos, undone habits, next actions) | Often unlabeled placements — still prospective. |
| Period To do (narrow) | `tasksProspectiveForPeriod` — ledger kind stays `"todo"` | Open scheduled work for the period. Narrower than *all* prospective inputs. |
| Header plan residue | `attributes.headerTracking: "plan"` | Header Now plan writer. |
| Capacity numerators | `plan-capacity.ts` | Planned minutes into the waking window. |
| Morning intentions | Reviews `morning.intentions` | Ahead-of-day prose. |

---

## Retrospective

Layered — not one store.

| Layer | Store / fields | Notes |
|---|---|---|
| Painted time | `brain2-timegrid-store` → `TimeEntry` | Solids on Day Log; `precision`, `confirmedEventIds`. |
| Task actuals | `actualDuration`, `timeLogs`, `completedChunks`, certainty | Amber on Day Log; feeds plan-vs-reality (task layer, not grid occupancy). |
| Habit auto-fill | `trackedValue` / `manualValue` / `trackedCompleted` | Minutes from tagged paint into a cell — not a slab. |
| Day-summary prose | `brain2-tracking-day-notes` | Retrospective *prose* (“what actually happened”). UI may say Day summary. |
| Done / period completed | `tasksCompletedInPeriod`, `completed` / `completedDate` | Lived completion sets. |
| Evening / night review | Reviews reflection fields | After-the-period prose. |
| Sleep as lived | Sleep nights + painted Sleep blocks | Lived night, not a plan. |

---

## Bridge and comparison

Read both sides. Do not invent a third polarity name for these.

| Surface | Role |
|---|---|
| `confirm-planned-dialog.tsx` | Prospective chip → paint + complete (“Plan became real”). |
| **est.** chip / `FieldEstimate.confirmedAt` / clear `precision` | Settle an assumed value. Certainty/bridge, not polarity chrome. |
| Day Log “Plan vs tracked” | Solid = paint (retrospective); dashed = plan ghosts (prospective); amber = `timeLogs`. |
| Plan day tracked ghosts | Lived outlines under intention (`plan-tracked-ghosts.ts`, `tracked-agenda-blocks.ts`). |
| `plan-vs-reality.ts` | Intention → outcome from plan text + scheduled tasks + task actuals — **not** Time Grid occupancy. |
| Plan and lived widget | Forward plan minutes vs waking paint (`livedPaintMinutes`). Comparison face. |

---

## Glossary (words that fight)

| Word | Meaning here | Do not confuse with |
|---|---|---|
| **Prospective** | Umbrella for ahead / intention inputs | Only the Plan tab (schedule fields, morning intentions, period To do count too) |
| **Retrospective** | Umbrella for past / confirmed inputs | Only the day-summary textarea (that is retrospective *prose*) |
| Painted **tracked** | Time Grid / Day Log solids / `trackedAgendaBlocks` | Habit cell auto-fill |
| Habit **`trackedValue`** | Auto-fill from tagged paint | A painted slab |
| `EstimateKind "tracked"` | Duration window read off paint | Habit `trackedValue` |
| Sleep `source: "tracked"` | Inferred from the grid | The paint pen |
| Widget “Tracked” / “lived” | Plan-and-lived CRT face | Day Log silk |
| **estimated** on a clock | Certainty (`~`, hatch, `precision`) | Prospective belief about the future (may sit on either side) |
| `AgendaGridMode "plan"\|"log"` | Opposite ghost polarity on one grid | Keep the API; document the flip |
| Rail “Planned tasks” | Often *unplaced* prospective intentions | `PlannedAction` rows |
| “Actual” | Filename `actual-day-view`, Analytics `actualMinutes` (task layer), UI “Actual Duration” | Three different grains |

---

## Laws for builders

1. Ghosts stay beside paint. Never merge Plan chips into Tracking blocks.
2. Do not rewrite a prospective field from retrospective data without an explicit confirm path.
3. Analytics joins name which side each number is on (native vs outside join).
4. Do not call plan text “retrospective.”
5. Period-ledger “prospective” means open scheduled To do — not every intention in the house.
6. Do not add a Task `polarity` column. Overlay only (`data-temporal`, docs, help).

---

## Related rooms

- Plan: [`components/Home/Plan/README.md`](../components/Home/Plan/README.md)
- Tracking: [`components/Home/Tracking/README.md`](../components/Home/Tracking/README.md)
- Analytics vision: [`analytics-vision/03-plan.md`](analytics-vision/03-plan.md), [`01-tracking.md`](analytics-vision/01-tracking.md)
- Counts-as (different axis): [`COUNTS_AS.md`](COUNTS_AS.md)
