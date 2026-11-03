/**
 * components/Home/Habits/settings/settings-pages.ts — Habits settings page list
 *
 * The order of the flip-through pages, their plain names, and the one-line
 * hint under each name. The last page opened is kept in localStorage; losing
 * it only means the dialog opens on the first page.
 */

export type SettingsPageId = "good-day" | "beat-past" | "new-habits" | "colors" | "pictures" | "backup"

export interface SettingsPage {
  id: SettingsPageId
  title: string
  hint: string
}

export const SETTINGS_PAGES: readonly SettingsPage[] = [
  { id: "good-day", title: "Good day", hint: "What counts as a good day, and what today's wins pay." },
  { id: "beat-past", title: "Beat your past", hint: "Bonuses for beating your own record. 0 turns one off." },
  { id: "new-habits", title: "New habits", hint: "Points a new habit starts with. Habits you already set keep theirs." },
  { id: "colors", title: "Colors", hint: "Lamps, point readouts, and habit icon colors." },
  { id: "pictures", title: "Pictures", hint: "The willpower crystal and the gem on each mark." },
  { id: "backup", title: "Backup", hint: "Save, restore, or clear all habit data." },
]

export const SETTINGS_PAGE_STORAGE_KEY = "brain2-habits-settings-page"

export function isSettingsPageId(value: unknown): value is SettingsPageId {
  return SETTINGS_PAGES.some((p) => p.id === value)
}

export function readStoredSettingsPage(): SettingsPageId {
  try {
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(SETTINGS_PAGE_STORAGE_KEY)
    return isSettingsPageId(stored) ? stored : SETTINGS_PAGES[0].id
  } catch {
    return SETTINGS_PAGES[0].id
  }
}

export function storeSettingsPage(id: SettingsPageId): void {
  try {
    window.localStorage.setItem(SETTINGS_PAGE_STORAGE_KEY, id)
  } catch {
    // Private windows and blocked storage just forget the page.
  }
}

/** The page `step` away from `id`, held at the first and last page. */
export function stepSettingsPage(id: SettingsPageId, step: number): SettingsPageId {
  const index = SETTINGS_PAGES.findIndex((p) => p.id === id)
  const next = Math.min(SETTINGS_PAGES.length - 1, Math.max(0, index + step))
  return SETTINGS_PAGES[next].id
}
