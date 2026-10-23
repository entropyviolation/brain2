/**
 * lib/spotify-accounts.ts — Renderer side of Settings → Spotify accounts
 *
 * The desktop main process (`electron/spotify-accounts.js`) owns the PKCE
 * login window and the keychain-sealed refresh tokens. This file types the
 * public view and reads `window.desktop.spotify`. No token reaches the
 * renderer. Plan: docs/SPOTIFY_LISTENING.md.
 */

export type SpotifyCheckState = "ok" | "expired" | "mismatch" | "no-session" | "error"

export type SpotifyCheck = { at: string; state: SpotifyCheckState; note: string }

export type SpotifyAccountView = {
  id: string
  spotifyId: string
  displayName: string
  label: string
  addedAt: string
  loggedInAt: string
  scopes: string[]
  hasSession: boolean
  lastCheck: SpotifyCheck | null
}

type Result<T> = ({ ok: true } & T) | { ok: false; error?: string; cancelled?: boolean }

export type SpotifyStatus = {
  ok: boolean
  encryption: boolean
  clientId: string
  redirectUri: string
  scopes: string[]
}

export type DesktopSpotifyBridge = {
  status: () => Promise<SpotifyStatus>
  list: () => Promise<Result<{ accounts: SpotifyAccountView[] }>>
  setClientId: (id: string) => Promise<Result<{ clientId: string }>>
  login: (req: { label?: string }) => Promise<Result<{ account: SpotifyAccountView }>>
  update: (id: string, patch: { label?: string }) => Promise<Result<{ account: SpotifyAccountView }>>
  remove: (id: string) => Promise<{ ok: boolean }>
  check: (id: string) => Promise<Result<{ account: SpotifyAccountView; check: SpotifyCheck }>>
}

/** Shown before the desktop answers, and in the web build. Matches main. */
export const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:43821/callback"

export function spotifyBridge(): DesktopSpotifyBridge | null {
  if (typeof window === "undefined") return null
  const desktop = (window as unknown as { desktop?: { spotify?: DesktopSpotifyBridge } }).desktop
  return desktop?.spotify ?? null
}

export function isPlausibleSpotifyClientId(id: string): boolean {
  return /^[0-9a-f]{32}$/i.test(id.trim())
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function describeSpotifyAccount(account: SpotifyAccountView): string {
  if (!account.hasSession) return "No saved login. Log in again."
  const check = account.lastCheck
  if (check && check.state !== "ok") return check.note
  const parts = [`Logged in ${shortDate(account.loggedInAt)}.`]
  parts.push(check ? `Checked ${shortDate(check.at)}: login works.` : "Not checked yet.")
  return parts.join(" ")
}
