/**
 * components/Home/widgets/edit-mode.ts — Edit mode for the Visual dashboard
 *
 * Off by default and never saved: a reload always starts locked. While it is
 * on, faces show a grip, a resize corner, and ×, and a click does not open
 * the detail.
 */
"use client"

import { create } from "zustand"

interface EditModeState {
  editing: boolean
  setEditing: (on: boolean) => void
}

export const useDashboardEditMode = create<EditModeState>()((set) => ({
  editing: false,
  setEditing: (on) => set({ editing: on }),
}))
