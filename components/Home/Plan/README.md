# `components/Home/Plan/` — Plan (Calendar) Panel

The Home **Plan** sub-tab. Month / Week / Day calendar views with drag-and-drop scheduling, calendar events, planned-task sidebars, and free-text plan areas.

## Data sources

| Data | Store / persistence |
|------|---------------------|
| Tasks (scheduled) | `lib/task-store.ts` |
| Calendar events | `lib/event-store.ts` |
| Day / week / month plan text | `lib/plan-text.ts` → localStorage today (`dayPlan-*`, `weekPlan-*`, `monthPlan-*`); target MongoDB `plans` collection |

Plan text is saved immediately on edit and shown in end-of-period **Reviews** (day/week/month) with a reflection field.

## Files

| File | Purpose |
|------|---------|
| `plan-panel.tsx` | Container: header, Add Event, Paste Events, Settings, Month/Week/Day tabs, wires dialogs |
| `month-view.tsx` | Month grid; event/task chips; drag to reschedule; planned-tasks sidebar; Month Plan textarea |
| `week-view.tsx` | Seven-day hourly grid; drag tasks/events to time slots; Week Plan textarea |
| `day-view.tsx` | Single-day hour grid via `AgendaGrid`; all-day events; auto-growing Day Plan textarea |
| `agenda-grid.tsx` | Shared hour-by-hour grid (used by day view and Tracking day log). Current-time line plus sunrise/sunset from Settings home location. |
| `planned-tasks-sidebar.tsx` | Tasks planned for the period but not yet time-slotted; drag onto calendar. Day mode can add a Home/To-Do item for that day. |
| `event-dialog.tsx` | Create/edit `CalendarEvent` (title, times, all-day, multi-day, location, description, color) |
| `paste-events-dialog.tsx` | Paste unstructured itinerary text → preview → bulk-create editable events (`lib/parse-event-text.ts`) |
| `settings-dialog.tsx` | Export/clear plan text and calendar data |

## Views

### Month
- Multi-day all-day events appear on every day in their `[date, endDate]` span (month chips, week all-day row, day banner).
- Drag tasks from sidebar onto days.
- Month Plan text at bottom.

### Week
- 7-column × 24-hour grid.
- Drag-drop scheduling with event duration preserved.
- Week Plan text at bottom.

### Paste Events
- **Paste Events** opens `paste-events-dialog.tsx`: paste unstructured itinerary / tour text, preview parsed drafts (`lib/parse-event-text.ts`), edit, then bulk-create `CalendarEvent`s (including multi-day all-day spans).

### Day
- Full day schedule with current-time indicator.
- Sunrise / sunset lines for the **Settings → Home location** city (default San Diego).
- All-day event banner.
- Day Plan text at bottom: starts ~12 lines tall and grows with the writing (no inner scrollbar).
- Left rail: untimed tasks for the day + quick-add that writes the same records as Home → To Do.

## Shared components

`AgendaGrid` renders timed tasks and events in hourly rows. Used by:
- `day-view.tsx` (editable plan mode)
- `Tracking/actual-day-view.tsx` (read-only plan comparison)

The red now-line is today-only. Amber sunrise and orange sunset lines load for whichever day is open, using Open-Meteo times for the saved home city.

## Gaps

- Carry-over of incomplete tasks to the next period is handled in Reviews, not automatically in Plan.
- Plan text is localStorage-only today; target is MongoDB `plans` collection documents (§3).
