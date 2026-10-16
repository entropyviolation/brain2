/**
 * lib/session-open-store.ts — Open the session popup from anywhere
 *
 * The ways into a session that are not the To Do fascia (the focus bar, Plan's
 * day view, the header Now box) set a request here. `SessionDock`
 * (`components/Home/ToDo/SessionDock.tsx`, mounted by the header Now box)
 * loads the planner when a request is set. Kept tiny on purpose: the header
 * reads it on every page and must not pull in the planner or the task tree.
 * Not persisted.
 */
"use client"

import { create } from "zustand"

export interface SessionOpenRequest {
  /** What to show: a session (live, focused or new), the shelves, or the flat pick list. */
  startOn: "session" | "shelves" | "list"
  /** A fresh draft of this length (Plan's drag across empty time). */
  durationMin?: number
  title?: string
  /** Start the draft from this template (`JUST_25_TEMPLATE_ID` for Just 25). */
  templateId?: string
  /** Lines to seed the new draft with. */
  seed?: { taskId: string; stepId?: string }[]
}

interface SessionOpenState {
  request: SessionOpenRequest | null
  openSession: (request: SessionOpenRequest) => void
  clear: () => void
}

export const useSessionOpenStore = create<SessionOpenState>()((set) => ({
  request: null,
  openSession: (request) => set({ request }),
  clear: () => set({ request: null }),
}))

export function openSession(request: SessionOpenRequest): void {
  useSessionOpenStore.getState().openSession(request)
}
