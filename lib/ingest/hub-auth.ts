/**
 * lib/ingest/hub-auth.ts — Shared-secret gate for the phone hub's vault API
 *
 * The hub serves `/api/persist` and `/api/recovery-backups` (the whole vault).
 * On localhost that is fine. On a public host it must not be. When
 * `COGS_PHONE_HUB_TOKEN` is set, those routes need `Authorization: Bearer <token>`.
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

/** True when no token is configured, or the header carries it. */
export function hubRequestAuthorized(token: string, authorization: string | undefined): boolean {
  if (!token) return true
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "")
  if (!match) return false
  const given = Buffer.from(match[1].trim())
  const want = Buffer.from(token)
  return given.length === want.length && timingSafeEqual(given, want)
}
