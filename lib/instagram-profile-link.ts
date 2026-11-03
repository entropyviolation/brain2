/**
 * lib/instagram-profile-link.ts — The "go to Instagram" link for one item
 *
 * Rows made from Instagram data carry the username in `ig-username`
 * (`lib/instagram-export.ts`), or `ig-profile` from an analysis import.
 *
 * The href is always the https profile page, a universal link that Mobile
 * Safari hands to the Instagram app. In the iOS shell a click goes through
 * `openInstagramProfile`, which asks for `instagram://user?username=` first
 * so the app opens rather than a browser, then falls back to the page.
 */
import { IG_PROFILE } from "@/lib/instagram-analysis"
import { normalizeInstagramUsername } from "@/lib/instagram-accounts"
import { IG_USERNAME } from "@/lib/instagram-export"
import type { Task } from "@/lib/types"

/** The item's Instagram username, or "" when it has none. */
export function instagramUsernameOf(task: Pick<Task, "attributes">): string {
  const attrs = task.attributes ?? {}
  for (const key of [IG_USERNAME, IG_PROFILE]) {
    const raw = attrs[key]
    if (typeof raw !== "string" || !raw.trim()) continue
    const name = normalizeInstagramUsername(raw.replace(/^(www\.)?instagram\.com\//i, ""))
    if (name) return name
  }
  return ""
}

export function instagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`
}

/** The Instagram app's own link for a profile. Only the iOS shell uses it. */
export function instagramAppUrl(username: string): string {
  return `instagram://user?username=${encodeURIComponent(username)}`
}

function isNativeShell(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform()
}

/**
 * Click handler for a Visit profile link whose href is `instagramProfileUrl`.
 * On the web and desktop the link opens as usual. In the iOS shell it opens
 * the Instagram app by its own scheme (Capacitor hands a non-app URL to
 * `UIApplication.shared.open`), and falls back to the https page when the
 * app did not take over within a moment (Instagram not installed).
 */
export function openInstagramProfile(username: string, event?: { preventDefault(): void; stopPropagation(): void }): void {
  event?.stopPropagation()
  if (!isNativeShell()) return
  event?.preventDefault()
  let left = false
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true
  }
  document.addEventListener("visibilitychange", onHide)
  window.location.href = instagramAppUrl(username)
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide)
    if (!left) window.open(instagramProfileUrl(username), "_blank")
  }, 1200)
}
