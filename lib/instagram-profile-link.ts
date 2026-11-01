/**
 * lib/instagram-profile-link.ts — The "go to Instagram" link for one item
 *
 * Rows made from Instagram data carry the username in `ig-username`
 * (`lib/instagram-export.ts`), or `ig-profile` from an analysis import.
 *
 * The link is the https profile page, not `instagram://`. That page is a
 * universal link: Mobile Safari opens the Instagram app when it is
 * installed. In the iOS shell, Capacitor hands an outside link to
 * `UIApplication.shared.open`, which also opens the app. Without the app
 * both fall back to the web page, where `instagram://` would do nothing.
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
