/**
 * lib/habit-helper/open.ts — Take the person to the Habits BIMBY's chat from anywhere
 *
 * Points the desk at Home → Habits and raises a flag. The Chat key (`habit-helper-key.tsx`) mounts with
 * the Habits desk, sees the flag, opens the dialog and clears it. Built like `lib/tracking-helper/open.ts`.
 */
import { create } from "zustand"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"

export const useHabitsBimbyOpenRequest = create<{ wanted: boolean; set: (wanted: boolean) => void }>()((set) => ({
  wanted: false,
  set: (wanted) => set({ wanted }),
}))

export function openHabitsBimby(): void {
  writeStoredTab(APP_NAV_KEYS.appTab, "home")
  writeStoredTab(APP_NAV_KEYS.homeTab, "habits")
  useHabitsBimbyOpenRequest.getState().set(true)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}
