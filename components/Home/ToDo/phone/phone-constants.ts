/**
 * components/Home/ToDo/phone/phone-constants.ts — Phone tab ids and the logged-done assumption.
 */
export const TODO_TABS = ["day", "week", "month", "quarter", "other"] as const
export type TodoTab = (typeof TODO_TABS)[number]

/** Assumed length for work logged after the fact, until the user says otherwise. */
export const DEFAULT_LOGGED_DONE_MINUTES = 30

/** Stable empty snapshot for Zustand — `?? []` would allocate every getSnapshot and loop. */
export const EMPTY_PRIORITY_IDS: string[] = []
