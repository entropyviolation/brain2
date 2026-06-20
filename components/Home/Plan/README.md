# `components/Home/Plan/` ? Plan (Calendar) Panel

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
| `plan-panel.tsx` | Container: header, Add Event, Settings, Month/Week/Day tabs, wires `EventDialog` and `TaskDetailPopup` |
| `month-view.tsx` | Month grid; event/task chips; drag to reschedule; planned-tasks sidebar; Month Plan textarea |
| `week-view.tsx` | Seven-day hourly grid; drag tasks/events to time slots; Week Plan textarea |
| `day-view.tsx` | Single-day hour grid via `AgendaGrid`; all-day events; Day Plan textarea |
| `agenda-grid.tsx` | Shared hour-by-hour grid (used by day view and Tracking day log) |
| `planned-tasks-sidebar.tsx` | Tasks planned for the period but not yet time-slotted; drag onto calendar |
| `event-dialog.tsx` | Create/edit `CalendarEvent` (title, times, all-day, multi-day, location, description, color) |
| `settings-dialog.tsx` | Export/clear plan text and calendar data |

## Views

### Month
- Calendar grid with navigation.
- Drag tasks from sidebar onto days.
- Month Plan text at bottom.

### Week
- 7-column ? 24-hour grid.
- Drag-drop scheduling with event duration preserved.
- Week Plan text at bottom.

### Day
- Full day schedule with current-time indicator.
- All-day event banner.
- Day Plan text at bottom.

## Shared components

`AgendaGrid` renders timed tasks and events in hourly rows. Used by:
- `day-view.tsx` (editable plan mode)
- `Tracking/actual-day-view.tsx` (read-only plan comparison)

## Gaps

- Carry-over of incomplete tasks to the next period is handled in Reviews, not automatically in Plan.
- Multi-day event banners are basic (all-day chips); rich banners are not built.
- Plan text is localStorage-only today; target is MongoDB `plans` collection documents (§3).
