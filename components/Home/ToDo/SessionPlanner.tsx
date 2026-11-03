/**
 * components/Home/ToDo/SessionPlanner.tsx — public door for the Session popup.
 *
 * The views, keys, and helpers live in `session-planner/`. Callers keep importing from this file.
 * The sheet loads here, so a key import still gets the styles.
 */
"use client"

import "./session-planner.css"

export { SessionPlanner } from "./session-planner/dialog"
export { fmtMinutes, fmtClock, parseLength } from "./session-planner/format"
export { SESSION_CLOCK_DEFAULT } from "./session-planner/session-view-prefs"
export { SessionKey, SessionsKey, PickListKey } from "./session-planner/fascia-keys"
