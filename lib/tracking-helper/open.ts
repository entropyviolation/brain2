/**
 * lib/tracking-helper/open.ts — Take the person to the Tracking BIMBY's chat from anywhere
 *
 * Points the desk at Home → Tracking and raises a flag. The Chat key (`tracking-helper-key.tsx`) mounts
 * with the Tracking desk, sees the flag, opens the dialog and clears it. A flag set before the desk
 * mounts is still there when it does.
 */
import { create } from "zustand"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"

export const useHelperOpenRequest = create<{ wanted: boolean; set: (wanted: boolean) => void }>()((set) => ({
  wanted: false,
  set: (wanted) => set({ wanted }),
}))

export function openTrackingHelper(): void {
  writeStoredTab(APP_NAV_KEYS.appTab, "home")
  writeStoredTab(APP_NAV_KEYS.homeTab, "tracking")
  useHelperOpenRequest.getState().set(true)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}
