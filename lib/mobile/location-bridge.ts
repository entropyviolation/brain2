/**
 * lib/mobile/location-bridge.ts — The JS side of the iOS location plugin
 *
 * The native side is `ios/App/App/LocationPlugin.swift` (jsName
 * `BrainLocation`). It records significant moves and visits in the
 * background, keeps an offline queue on the phone, seals each batch to the
 * capture public key, and posts it to the Oracle box. Recording and upload
 * run in Swift, so they keep going when the web view is not loaded.
 *
 * On the web and in Electron every call is a no-op that reports
 * `available: false`. Nothing here reads coordinates.
 *
 * Permission: iOS asks "While Using" first, then offers "Always" later. The
 * plugin asks for both in that order. Without "Always", iOS stops waking the
 * app in the background and the day has gaps.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"

export type LocationPermission = "always" | "whenInUse" | "denied" | "restricted" | "notDetermined" | "unknown"

export interface LocationStatus {
  /** False on the web, in Electron, and on a phone build without the plugin. */
  available: boolean
  permission: LocationPermission
  recording: boolean
  /** Upload URL, token and public key are all set. */
  configured: boolean
  /** Events waiting on the phone. */
  queued: number
  /** Events dropped because the queue was full (oldest first). */
  dropped: number
  lastUploadAt?: number
  lastError?: string
}

export interface LocationUploadConfig {
  /** The capture box's upload route, for example `http://100.x.y.z:8788/upload`. */
  uploadUrl: string
  /** Upload-only token (`COGS_CAPTURE_UPLOAD_TOKEN`). Not the hub's pull token. */
  token: string
  /** `COGS_CAPTURE_PUBLIC_KEY`, base64 SPKI DER. */
  publicKey: string
}

interface BrainLocationPlugin {
  getStatus(): Promise<Omit<LocationStatus, "available">>
  configure(options: LocationUploadConfig): Promise<void>
  requestPermission(): Promise<{ permission: LocationPermission }>
  start(): Promise<void>
  stop(): Promise<void>
  flush(): Promise<{ ok: boolean }>
}

const BrainLocation = registerPlugin<BrainLocationPlugin>("BrainLocation")

const OFF: LocationStatus = {
  available: false,
  permission: "unknown",
  recording: false,
  configured: false,
  queued: 0,
  dropped: 0,
}

export function isLocationPluginAvailable(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainLocation")
}

export async function getLocationStatus(): Promise<LocationStatus> {
  if (!isLocationPluginAvailable()) return OFF
  try {
    return { ...OFF, ...(await BrainLocation.getStatus()), available: true }
  } catch (err) {
    return { ...OFF, available: true, lastError: err instanceof Error ? err.message : String(err) }
  }
}

export async function configureLocationUpload(config: LocationUploadConfig): Promise<boolean> {
  if (!isLocationPluginAvailable()) return false
  await BrainLocation.configure(config)
  return true
}

/** Ask for "While Using", then "Always". Resolves with what the person chose. */
export async function requestAlwaysLocation(): Promise<LocationPermission> {
  if (!isLocationPluginAvailable()) return "unknown"
  return (await BrainLocation.requestPermission()).permission
}

export async function startLocationRecording(): Promise<boolean> {
  if (!isLocationPluginAvailable()) return false
  await BrainLocation.start()
  return true
}

export async function stopLocationRecording(): Promise<boolean> {
  if (!isLocationPluginAvailable()) return false
  await BrainLocation.stop()
  return true
}

/** Upload what is queued now. False when offline, not configured, or not on the phone. */
export async function flushLocationQueue(): Promise<boolean> {
  if (!isLocationPluginAvailable()) return false
  return (await BrainLocation.flush()).ok
}

export interface LocationChip {
  label: string
  tone: "ok" | "warn" | "off"
}

/** Words for a small status chip. Pure. */
export function locationChip(status: LocationStatus, now = Date.now()): LocationChip {
  if (!status.available) return { label: "Location: phone app only", tone: "off" }
  if (status.permission === "denied" || status.permission === "restricted") return { label: "Location: not allowed", tone: "warn" }
  if (status.permission === "notDetermined" || status.permission === "unknown") return { label: "Location: allow access", tone: "warn" }
  if (!status.recording) return { label: "Location: off", tone: "off" }
  if (status.permission === "whenInUse") return { label: "Location: set to Always", tone: "warn" }
  if (!status.configured) return { label: "Location: no upload set", tone: "warn" }
  if (status.lastError && status.queued > 0) return { label: `Location: ${status.queued} waiting`, tone: "warn" }
  if (status.queued > 0) return { label: `Location: ${status.queued} to send`, tone: "ok" }
  if (status.lastUploadAt) {
    const mins = Math.max(0, Math.round((now - status.lastUploadAt) / 60000))
    const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`
    return { label: `Location: sent ${ago}`, tone: "ok" }
  }
  return { label: "Location: on", tone: "ok" }
}
