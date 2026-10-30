/**
 * lib/phone-device.ts — Is this browser the phone's small web-storage box?
 *
 * The iOS app, `/mobile`, and Mobile Safari share a box of about 5 MB.
 * Electron and desktop browsers do not. A phone save uses this to keep the
 * small copy instead of the desktop vault.
 */

export function isPhoneWebStorage(): boolean {
  if (typeof window === "undefined") return false
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  if (/Electron/i.test(ua)) return false
  const protocol = window.location?.protocol ?? ""
  if (protocol === "capacitor:" || protocol === "ionic:") return true
  const path = window.location?.pathname ?? ""
  if (path === "/mobile" || path.startsWith("/mobile/")) return true
  if (/iPhone|iPad|iPod/.test(ua)) return true
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor
  if (typeof cap?.isNativePlatform === "function" && cap.isNativePlatform()) return true
  if (typeof cap?.getPlatform === "function" && cap.getPlatform() === "ios") return true
  return false
}
