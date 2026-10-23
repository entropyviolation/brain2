/**
 * lib/instagram-accounts.ts — Renderer side of Settings → Instagram accounts
 *
 * The desktop main process (`electron/instagram-accounts.js`) owns the login
 * window and the keychain-sealed sessions. This file only types the public
 * view it returns and reads `window.desktop.instagramAccounts`. No cookie or password
 * ever reaches the renderer. Plan: docs/INSTAGRAM_DATA_SOURCES.md.
 */

export type InstagramCheckState = "ok" | "expired" | "checkpoint" | "limited" | "mismatch" | "no-session" | "error"

export type InstagramCheck = {
  at: string
  state: InstagramCheckState
  note: string
}

export type InstagramAccountView = {
  id: string
  username: string
  userId: string
  label: string
  addedAt: string
  loggedInAt: string
  sessionExpiresAt: string | null
  hasSession: boolean
  hasPassword: boolean
  lastCheck: InstagramCheck | null
}

type Result<T> = ({ ok: true } & T) | { ok: false; error?: string; cancelled?: boolean }

export type DesktopInstagramBridge = {
  status: () => Promise<{ ok: boolean; encryption: boolean; loggingIn: boolean }>
  list: () => Promise<Result<{ accounts: InstagramAccountView[] }>>
  login: (req: { username: string; label?: string }) => Promise<Result<{ account: InstagramAccountView }>>
  update: (id: string, patch: { label?: string; username?: string }) => Promise<Result<{ account: InstagramAccountView }>>
  remove: (id: string) => Promise<{ ok: boolean }>
  setPassword: (id: string, password: string) => Promise<Result<{ account: InstagramAccountView }>>
  check: (id: string) => Promise<Result<{ account: InstagramAccountView; check: InstagramCheck }>>
}

export function instagramBridge(): DesktopInstagramBridge | null {
  if (typeof window === "undefined") return null
  const desktop = (window as unknown as { desktop?: { instagramAccounts?: DesktopInstagramBridge } }).desktop
  return desktop?.instagramAccounts ?? null
}

/** Same rules as main: drop @, a profile URL, a trailing path; lower case. */
export function normalizeInstagramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
}

/** Instagram usernames: letters, digits, period, underscore; at most 30. */
export function isPlausibleInstagramUsername(name: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(name)
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/** One plain sentence about the saved session. */
export function describeInstagramAccount(account: InstagramAccountView, now: Date = new Date()): string {
  if (!account.hasSession) return "No saved session. Log in again."
  const check = account.lastCheck
  if (check && check.state !== "ok") return check.note
  const expires = account.sessionExpiresAt ? new Date(account.sessionExpiresAt) : null
  if (expires && !Number.isNaN(expires.getTime()) && expires.getTime() < now.getTime()) {
    return `The session cookie expired on ${shortDate(account.sessionExpiresAt)}. Log in again.`
  }
  const parts = [`Logged in ${shortDate(account.loggedInAt)}.`]
  if (check) parts.push(`Checked ${shortDate(check.at)}: session works.`)
  else parts.push("Not checked yet.")
  return parts.join(" ")
}
