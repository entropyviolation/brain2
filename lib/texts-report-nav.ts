/**
 * lib/texts-report-nav.ts — the texts report's sections, shown in the Analytics sidebar
 *
 * The report frame sends its headings and the one on screen (`TextsReportView`).
 * `AnalyticsNav` lists them under Views and asks the frame to scroll with `goto`.
 * Nothing is persisted.
 */
import { create } from "zustand"
import type { TextsSection } from "./texts-report"

type TextsNavState = {
  sections: TextsSection[]
  active: string | null
  goto: ((id: string) => void) | null
  setSections: (sections: TextsSection[]) => void
  setActive: (id: string | null) => void
  setGoto: (goto: ((id: string) => void) | null) => void
}

export const useTextsNavStore = create<TextsNavState>((set) => ({
  sections: [],
  active: null,
  goto: null,
  setSections: (sections) => set({ sections }),
  setActive: (active) => set({ active }),
  setGoto: (goto) => set(goto ? { goto } : { goto: null, sections: [], active: null }),
}))
