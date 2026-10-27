/**
 * lib/ingest/hub-auth.ts — Shared-secret gate for the phone hub's vault API
 *
 * The hub serves `/api/persist` and `/api/recovery-backups` (the whole vault).
 * On localhost that is fine. On a public host it must not be. When
 * `COGS_PHONE_HUB_TOKEN` is set, those routes need `Authorization: Bearer <token>`.
 * A browser Origin from a public website is refused (`request-origin.mjs`).
 * `/health`, `/api/ingest/status`, and the Telegram webhook (its own secret) stay open.
 */
import { timingSafeEqual } from "node:crypto"

export function isGatedHubPath(pathname: string): boolean {
  return (
    pathname === "/api/persist" ||
    pathname.startsWith("/api/persist/") ||
    pathname === "/api/recovery-backups" ||
    pathname.startsWith("/api/recovery-backups/")
  )
}

/** Equal length and equal bytes. Mismatched lengths are false, not a throw. */
export function tokensEqual(expected: string, given: string | undefined): boolean {
  if (!expected || typeof given !== "string") return false
  const want = Buffer.from(expected)
  const got = Buffer.from(given)
  return want.length === got.length && timingSafeEqual(want, got)
}

/** True when no token is configured, or the header carries it. */
export function hubRequestAuthorized(token: string, authorization: string | undefined): boolean {
  if (!token) return true
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "")
  if (!match) return false
  return tokensEqual(token, match[1].trim())
}
