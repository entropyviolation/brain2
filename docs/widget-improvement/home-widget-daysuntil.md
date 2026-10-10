# Days Until

Widget id: `daysuntil`

Many countdown-to or count-up-from tiles. The strip mounts `DaysUntilTiles` → one `DaysUntilTile` per mark in `components/Home/home-days-until.tsx`. The face is `daysUntilLiveFace` / `daysUntilRemainingMs` / `daysUntilCaption` in `lib/home-widgets.ts`. Marks live in `useHomeDaysUntilStore` (`lib/home-days-until-store.ts`, persist **v3** `items[]`). Optional Plan all-day link is `lib/home-days-until-event.ts`. Chrome is `HomeWidgetDialog`, `WidgetWell`, `TileOpen`, and `TileHide` in `components/Home/home-widget-dialog.tsx`, mounted from `components/Home/home-overview.tsx`. Layout visibility for the family is still one catalog id in `brain2-home-widgets`.

## Shape (v3)

Each item:

| Field | Role |
| --- | --- |
| `id` | Stable mark id |
| `label` | Event name (40) |
| `date` | `YYYY-MM-DD` |
| `time` | Optional `HH:MM`; empty = local midnight |
| `format` | `unit` or `decimal` |
| `mode` | `countdown`, `countup`, or `auto` (Until ahead, Since once past) |
| `eventId` | Optional linked `CalendarEvent.id` |
| `scheduleAllDay` | When true and a date is set, create/refresh an all-day Plan event |

A v2 flat `{ label, date, time, format }` migrates to one item with `mode: "auto"` so a past mark still reads Since. New marks default to `countdown`.

## How to add and edit

- Widgets menu: while Days Until is showing, **+** adds another mark.
- Widget catalog: while showing, **Add another** (Hide still tucks the family).
- Detail dialog: mode, label, date, optional clock, display format, attach an existing Plan event, **Schedule as an all-day event**, **Add another**, **Remove this**.
- Tile × hides the whole family (same as menu Hide). It does not delete marks.
- Clearing the all-day checkbox stops syncing; it does not delete the Plan event.

## Decision

Multiple timers needed their own squares without inventing a second catalog id. The family stays one `daysuntil` visibility bit; the store holds N marks and the overview expands them in strip order at that slot. Plan attachment uses `CalendarEvent` (all-day banner), not a Task.

## Earlier vault read (9 Oct 2026)

The live LevelDB still had one hidden countdown (`Elijah Comes Home`, `2026-09-28`, `unit`). That blob migrates to one `auto` item. Showing the family again is still a user Add — this pass does not edit `DEFAULT_HOME_WIDGET_HIDDEN` or force the tile out of `hidden`.
