# Named events — plan

_Last mapped: 2026-11-02_

**Planned.** Nothing here is built. This is section 7 of [`STREAM_LOG_PLAN.md`](STREAM_LOG_PLAN.md), the one marked **!!!**, and the first item of Wave 16 in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).

## What you asked for

Events with names that happen more than once, or once: Elijah comes home, Elijah went to bed, Claude resets, the portal opens, the store opens, the frog concert with Becca.

- Use one as a due date. When the event moves, the due date moves.
- Make a list of what must be done before it.
- Record when it really happened, in many ways at once: put it on a day ahead of time, log it when it happens, let BIM ask for the date and make the event, and let BIM infer past ones from data.
- Analyze repeats ("how much later do I go to bed than Elijah?").
- Stats on planned events: how far ahead they were planned, and how they went.

## Decisions (asked 2026-11-02)

- **Many doors, one record.** A future instance can be added to a day as a Plan event. A past one can be typed into the log with its exact time. BIM chat can ask for a missing date and create the event item. BIM may infer past instances from texts, location, and calls. All of these write the same kind of instance.
- **Inferred instances are proposals.** They follow the Tracking Helper rule: the model points, code computes, and you accept. Nothing inferred is written silently.

## What already exists

| Piece | Where | What it gives |
|---|---|---|
| Plan events | `lib/types.ts` `CalendarEvent`, `lib/event-store.ts` | Date, start and end time, all-day, location, place pin. No name link and no `createdAt`. |
| Before-event checklists | `lib/event-links.ts` (HM1) | A task links to an event with `checklist-of` and stores `schedulingConstraints.mustBeDoneBefore` from the event start. Plan shows "must be done before …" (`components/Home/Plan/agenda-grid.tsx`). |
| The gap | — | `mustBeDoneBefore` is copied once. Moving the event does not move it. |
| Lived ticks | `lib/ingest/apply-discrete-event.ts`, `lib/ingest/text-triggers.ts` | `log:` points with an `eventKind` slug (`eventKindSlug`), whole-message triggers, and inbox transfers at the original time. |
| Countdowns | `lib/home-days-until-event.ts` | A countdown widget reads a Plan event. BIM can create the event and the countdown from text, asking for a date when it has none (`components/Bim/README.md`). |
| Suggestions | `lib/bim-flow/suggestions.ts`, `docs/TRACKING_HELPER.md` | Proposals from BIM messages, texts, Screen Time, and files, checked against the vault and accepted by hand. Accepted rows are stamped `llm`. |
| The rule | [`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md) | A plan sits beside what happened and is never merged into it. Do not rewrite a plan from lived data without a confirm. |

## The shape

**A named event** is a small record: a name, aliases ("Elijah home", "E home", "elijah's back"), an optional usual company, and whether it repeats. It is an item in a built-in **Named events** list, so it opens in item detail and shows up in search and the graph.

**An instance** is one occurrence, and it has two sides:

- **Planned.** A Plan event with `namedEventId`. It can be added by hand on a day, by BIM ("when is Elijah home?" → you answer → BIM makes the event), or by a repeat rule.
- **Lived.** A Tracking tick with the same `namedEventId`. It can be typed (`log: Elijah home 6:40`), set off by a trigger phrase, transferred from the inbox, or proposed by inference and accepted.

The two sides pair by name and day. Planned and lived stay separate records, so "planned 6:00, home 6:40" is a comparison, never an edit.

**A due date that follows.** A task can be due at an instance instead of a fixed date: `due: { namedEventId, instanceId }` or "the next one". The date shown is always read from the instance at the moment it is shown. `mustBeDoneBefore` stays as a cached copy, and every write to the event refreshes it.

**Before lists.** Any list can be bound to "before the next X". Its rows are the event's checklist (`checklist-of`), and the list shows the countdown.

## Inference (past instances)

Code finds the candidates; a model is only used to name the event or pick which tag belongs to it.

| Signal | Example | Rule |
|---|---|---|
| A text from the person | Elijah: "home" / "omw" / "here" | A word list per named event, set in its settings |
| Location | Your phone arrives at Home after he does | Needs location live (see [`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md)) |
| Calls | A call ends and a Company block starts | Weak; offered, never assumed |
| Your own words | "elijah's back" in BIM chat | Alias match |

Each candidate becomes a proposal on the Tracking Helper board, with its evidence. Accept writes the lived tick, stamped `llm`.

## Stats (Data → Named events)

- **One name.** How many, the usual time (median and spread), and by weekday.
- **Two names.** The gap between them per day ("you go to bed 48 min after Elijah, median, n = 31").
- **Planned against lived.** How late or early, and the share that happened at all.
- **Lead time.** How many days ahead each instance was planned. This needs `createdAt` on Plan events (new, optional; old events read as unknown).
- **Planned-event groups.** Doctor's appointments, concerts: by type, lead time, and who you went with.

Every number shows its n, like the rest of Data.

## Planned events that track themselves

"Frog concert with Becca" is a planned instance with Company Becca. When it starts, BIM asks "at the frog concert?". A yes paints the block with that company and writes the lived tick. A no asks what happened instead. Off by default per event, on by default for events with a time and a place.

## Steps

1. **Type and list.** The named-event record, aliases, and the built-in list. `namedEventId` on `CalendarEvent` and on Tracking ticks (optional fields).
2. **Following due dates.** Refresh `mustBeDoneBefore` on every event write. Add `due: { namedEventId }` and read it wherever due dates are shown: To do, Scheduler, the rituals look-ahead, and Plan.
3. **Doors.** `log:` matches aliases. BIM asks for a missing date and creates the instance. A repeat rule creates planned instances.
4. **Before lists.** A list setting that binds a list to the next instance, with a countdown.
5. **Pairing.** Planned and lived pair by name and day, shown side by side on Plan and Tracking.
6. **Data view.** One name, two names, planned against lived, lead time.
7. **Inference.** Candidates from texts first, location second, as proposals.
8. **Self-tracking planned events.** The start-time ask.

## Done when

- A task due "before Elijah comes home" shows the new date after the event is moved.
- `log: Elijah home` writes a lived tick that pairs with today's planned one.
- Data answers how much later you go to bed than Elijah, with n.
- An inferred instance appears as a proposal with its evidence and is only written on accept.

## Open questions

- Should a repeating event with no plan for today show a predicted time (your median) as an **est.** ghost, so a due date still has a target? It would follow the existing **est.** chip.
- Does "Claude resets" come from a known clock (a fixed weekly time) or only from what you log?
