/**
 * lib/mobile/location-autostart.ts — Keep background location on
 *
 * Runs every time the phone app opens (`components/Mobile/MobileApp.tsx`), logged
 * in or not. Once the upload is set up (`MobileLocationCard` → Upload setup), it
 * asks for permission and starts recording without a tap, so location ends up on
 * and stays on. After `start()`, the native side keeps recording across
 * relaunches by itself (`AppDelegate` → `resumeIfEnabled()`), with no web view.
 *
 * "Turn off" on the card wins: it sets `LOCATION_USER_OFF_KEY`, and this does
 * nothing until "Turn on" clears it. Native `stop()` alone cannot tell "never
 * started" from "turned off", so the flag lives here.
 */
import {
  getLocationStatus,
  requestAlwaysLocation,
  startLocationRecording,
  type LocationStatus,
} from "./location-bridge"

export const LOCATION_USER_OFF_KEY = "brain2-mobile-location-user-off"

export type LocationStep =
  /** Web, Electron, or a phone build without the plugin. */
  | "unavailable"
  /** The person turned it off on the card. */
  | "userOff"
  /** No upload set up yet. The card shows the setup form. */
  | "needsSetup"
  /** iOS has not asked yet, or only "While Using" is granted. */
  | "ask"
  /** Allowed, not recording. */
  | "start"
  /** Denied, restricted, or no answer: only the person can change it, in iOS Settings. */
  | "settings"
  /** Recording. Nothing left to do. */
  | "on"

/**
 * The next thing to do. Pure. `asked` is true once this run has already asked,
 * so a "While Using" answer moves on to `start` instead of asking again.
 */
export function nextLocationStep(status: LocationStatus, userOff: boolean, asked = false): LocationStep {
  if (!status.available) return "unavailable"
  if (userOff) return "userOff"
  if (!status.configured) return "needsSetup"
  if (status.permission === "denied" || status.permission === "restricted") return "settings"
  if (!asked && (status.permission === "notDetermined" || status.permission === "whenInUse")) return "ask"
  if (status.permission !== "always" && status.permission !== "whenInUse") return "settings"
  if (!status.recording) return "start"
  return "on"
}

export function isLocationUserOff(): boolean {
  try {
    return window.localStorage.getItem(LOCATION_USER_OFF_KEY) === "1"
  } catch {
    return false
  }
}

/** Card "Turn off" sets it; "Turn on" clears it. */
export function setLocationUserOff(off: boolean): void {
  try {
    if (off) window.localStorage.setItem(LOCATION_USER_OFF_KEY, "1")
    else window.localStorage.removeItem(LOCATION_USER_OFF_KEY)
  } catch {
    /* private mode: autostart just keeps trying */
  }
}

/**
 * Walk the steps until location is on or only the person can move it further.
 * Each step runs at most once per call. Returns the last status read.
 */
export async function ensureLocationOn(): Promise<LocationStatus> {
  let status = await getLocationStatus()
  const done = new Set<LocationStep>()
  for (;;) {
    const step = nextLocationStep(status, isLocationUserOff(), done.has("ask"))
    if (step !== "ask" && step !== "start") return status
    if (done.has(step)) return status
    done.add(step)
    if (step === "ask") await requestAlwaysLocation()
    else await startLocationRecording()
    status = await getLocationStatus()
  }
}
