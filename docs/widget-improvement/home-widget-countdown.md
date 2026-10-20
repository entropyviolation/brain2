# Countdown

Kind id: `daysuntil` (unchanged, so saved layouts keep it). Installs: `many`, one copy per mark. Replaces **Days Until** and **Days Since**.

## How it works now

_Last mapped: 2026-10-20_

Each installed Countdown copy counts one mark. The copy holds `settings.markId`; the mark's fields stay in `useHomeDaysUntilStore` (`lib/home-days-until-store.ts`, persist **v3** `items[]`). `reconcileCountdowns` (`lib/widgets/dashboard.ts`) keeps marks and copies one to one, so a mark added anywhere gets a copy, and a copy whose mark is gone is removed.

- **Face.** `DaysUntilTile` in `components/Home/home-days-until.tsx`, through `renderWidgetTile` (`components/Home/widgets/registry.tsx`). The face math is `countdownFace` in `lib/countdown.ts`. The `unit` and `decimal` formats keep the old `daysUntilLiveFace`.
- **Detail.** The silver handheld (`HomeWidgetDialog`), with **Add another Countdown**. The caption reads Countdown while counting toward the mark and Count up while counting from it.
- **Gear.** `CountdownSettings`: label, date, optional time, mode, units, repeat, start date, milestones, when it passes, attach a Plan event, and **Schedule as an all-day event**. **Remove** deletes the mark and its copy.
- **×** hides only that copy. The family is no longer one visibility bit.
- **Guide.** Two cards on first open: one mark per copy, and count up too.
- **Gallery.** Installing from the Widget gallery asks for a name, date, direction, and repeat (`widgets/gallery/install-setup.tsx`). Removing a copy there also deletes its mark.

## Shape (v3, with the Countdown fields)

| Field | Role |
| --- | --- |
| `id` | Stable mark id (the copy's `settings.markId`) |
| `label` | Event name (40) |
| `date` | `YYYY-MM-DD` |
| `time` | Optional `HH:MM`; empty = local midnight |
| `format` | `unit` or `decimal` (the old faces), or whole `days`, `weeks`, `sleeps`, `workdays` |
| `mode` | `countdown`, `countup`, or `auto` (Until ahead, Since once past) |
| `eventId` | Optional linked `CalendarEvent.id` |
| `scheduleAllDay` | When true and a date is set, create or refresh an all-day Plan event |
| `repeat` | `none`, `yearly`, or `monthly`. The face rolls to the next occurrence (`nextOccurrence`). |
| `start` | Optional `YYYY-MM-DD`. Draws how far along the span from start to mark is. |
| `milestones` | A count-up lights its lamp at round numbers (every 100 days, each year). |
| `whenPassed` | Countdown mode only: `stay` at 0, `countup`, or `hide` the face. |

New fields default when an older blob lacks them, so the store stayed at v3. A v2 flat `{ label, date, time, format }` still migrates to one item with `mode: "auto"`. An emptied list stays empty.

## Migration from Days Until

_Last mapped: 2026-10-20_

`dashboardFromLegacy` turns each mark into one Countdown copy, in mark order, at the place the family held. If the family was hidden, every copy starts hidden. Copy ids are `daysuntil:<markId>`, so a rebuild lands on the same ids. The dashboard still writes the `daysuntil` id back into `brain2-home-widgets`, so an older build shows the family as before.

## Decision

Days Until put many marks behind one catalog id, so × hid every mark at once. Countdown makes each mark an installed copy, which gives each mark its own place, size, lamp, title, and gear. The marks stayed in their store so nothing moved, and the Plan link still uses `CalendarEvent` (all-day banner), not a Task. Plan: [`docs/WIDGETS_REDESIGN.md`](../WIDGETS_REDESIGN.md#countdown-replaces-days-until--days-since).

## Earlier vault read (9 Oct 2026, as Days Until)

The live LevelDB had one hidden countdown (`Elijah Comes Home`, `2026-09-28`, `unit`). That blob migrates to one `auto` item, and then to one hidden Countdown copy. Showing it is still a user choice.
