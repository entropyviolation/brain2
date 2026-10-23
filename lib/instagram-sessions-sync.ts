/**
 * lib/instagram-sessions-sync.ts — Paint Instagram sessions on iPhone Screen Time
 *
 * Reads the current Analytics → Sources → Instagram build through
 * `instagramSource()` and hands its `time_active.sessions_recent` to
 * `applyInstagramSessions` (`lib/instagram-sessions.ts`). A build is applied once
 * per vault (the id is kept in localStorage); the **Update my lists** key in
 * Sources → Instagram passes `force`. Re-applying is safe: ids are per session.
 */
import { instagramSource, type InstagramSource } from "@/lib/instagram-report"
import { applyInstagramSessions, readInstagramSessions } from "@/lib/instagram-sessions"

const APPLIED_KEY = "brain2-ig-sessions-build"

function readApplied(): string | null {
  try {
    return window.localStorage.getItem(APPLIED_KEY)
  } catch {
    return null
  }
}

function writeApplied(buildId: string): void {
  try {
    window.localStorage.setItem(APPLIED_KEY, buildId)
  } catch {
    // The next start applies it again; the merge is idempotent.
  }
}

export interface InstagramSessionsSyncResult {
  /** `skipped` means this build was already applied; `none` means no sessions to read. */
  status: "applied" | "skipped" | "none"
  message: string
  added: number
  updated: number
}

export async function syncInstagramSessionsFromReport(
  opts: { force?: boolean; source?: InstagramSource | null } = {},
): Promise<InstagramSessionsSyncResult> {
  const source = opts.source === undefined ? instagramSource() : opts.source
  const none = (message: string): InstagramSessionsSyncResult => ({ status: "none", message, added: 0, updated: 0 })
  if (!source) return none("This build has no Instagram report to read.")
  let summary
  try {
    summary = await source.summary()
  } catch {
    return none("The running Brain2 desktop app is older than this code. Quit and reopen it, then try again.")
  }
  if (!summary) return none("No Instagram report has been built yet.")
  if (!opts.force && readApplied() === summary.buildId) {
    return { status: "skipped", message: "These sessions already match the current report.", added: 0, updated: 0 }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(summary.text.replace(/^﻿/, ""))
  } catch {
    return none("The report's summary.json was not in the expected shape.")
  }
  const sessions = readInstagramSessions(parsed)
  if (!sessions.length) {
    return none("This report has no session list yet. Rebuild it so Time active can be painted on iPhone Screen Time.")
  }
  const result = applyInstagramSessions(sessions)
  writeApplied(summary.buildId)
  return {
    status: "applied",
    message: `Painted ${result.added} Instagram session${result.added === 1 ? "" : "s"} on iPhone Screen Time (${result.updated} stretched, ${sessions.length} in the report).`,
    added: result.added,
    updated: result.updated,
  }
}
