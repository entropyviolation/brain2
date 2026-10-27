# `session-planner/`

_Last mapped: 2026-10-27._

This folder is a split of the Session popup. The door is still `components/Home/ToDo/SessionPlanner.tsx`. Callers import from that file. Behavior is documented in [`../README.md`](../README.md).

`SessionPlanner.tsx` keeps `"use client"` and the side-effect import of `session-planner.css`, so a key import still loads the sheet. It re-exports `SessionPlanner`, `fmtMinutes`, `fmtClock`, `parseLength`, `SESSION_CLOCK_DEFAULT`, `SessionKey`, `SessionsKey`, and `PickListKey`. Helpers such as `putSession`, `newDraft`, and `useNow` stay inside this folder.

`DraftView` and `RunView` moved as whole functions. Their inner JSX stays in one closure. **Break down** still mounts `TodoBreakdown`. The To do task card, item detail, and the drawer stay separate.

The pause-reason path moved with the working-tree `RunView`: when the linked pen is running, pause asks for a reason (`usePauseReason`, `queuePauseReason`, `takeQueuedPauseReason`). Cancel leaves the clock running.

## Files

| File | Job |
| --- | --- |
| `dialog.tsx` | The popup. Switches Pick list, Sessions, draft, run, parked, and review. Closing a running session asks **Park** or **Keep running** |
| `draft-view.tsx` | Pick list, three tier wells, drag, templates, timebox, breaks, **Padded for you**, **Break down**, Start |
| `run-view.tsx` | Countdown, transport, pause reason, park, end of sitting, suggestions, tier lines, Just Start portal |
| `flat-list-view.tsx` | Fascia **Pick list**. No session until **Session** or **Just 25** |
| `parked-view.tsx` | Parked clock, line list, parking-lot stage, Resume |
| `shelves-view.tsx` | Drafts, Parked, and Done shelves |
| `done-view.tsx` | Read-only review of a finished session, **Run again** |
| `review-view.tsx` | Outcomes, points, the Plan block (`source: "session"`), time logs, archive |
| `fascia-keys.tsx` | **Session**, **Sessions**, and **Pick list** keys |
| `format.ts` | `fmtMinutes`, `fmtClock`, `parseLength` |
| `tiers.ts` | Bare minimum / Goal / Exceptional, Min / Goal / Exc, B / G / E |
| `drag.ts` | `LINE_MIME`, `REF_MIME`, `isSessionDrag` |
| `drafts.ts` | `newDraftFrom`, `findTemplate`, `newDraft`, `putSession` |
| `future-note.tsx` | Note to later-you |
| `tier-keys.tsx` | Draft tier latch keys |
| `time-tube.tsx` | Dash length tube |
| `fit-glass.tsx` | One fit bar |
| `estimate-bits.tsx` | Frozen or live estimate, click-to-edit, under/over words, hairline bar |
| `session-view-prefs.ts` | `brain2.sessionView` in localStorage. Clock colour default `#8cd4a5` |
| `use-now.ts` | One-second clock. Skips the tick while `document.hidden` |

Styles stay in `../session-planner.css`. Logic stays in `lib/session-plan.ts`. The blob stays in `lib/session-plan-store.ts`. Parking lot stays in `../parking-lot/`.
