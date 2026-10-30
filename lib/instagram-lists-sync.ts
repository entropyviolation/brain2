/**
 * lib/instagram-lists-sync.ts — Fill the Instagram lists from the Data build
 *
 * Data → Sources → Instagram builds `summary.json` for each export
 * (`electron/instagram-report.js`). The seven Instagram lists used to fill only
 * when that file was uploaded by hand. This reads the current build through
 * `instagramSource()` and runs the same `applyInstagramAnalysisImport`. A build
 * is applied once per vault (the id is kept in localStorage); the button in
 * Sources → Instagram passes `force`.
 */
import { applyInstagramAnalysisImport, describeInstagramAnalysisResult, readInstagramAnalysisText } from "@/lib/instagram-lists"
import { instagramSource, type InstagramSource } from "@/lib/instagram-report"

const APPLIED_KEY = "brain2-ig-lists-build"

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
    // The next start applies it again; the import is idempotent.
  }
}

export interface InstagramListsSyncResult {
  /** `skipped` means this build was already applied; `none` means no report to read. */
  status: "applied" | "skipped" | "none"
  message: string
  added: number
  updated: number
}

export async function syncInstagramListsFromReport(
  opts: { force?: boolean; source?: InstagramSource | null } = {},
): Promise<InstagramListsSyncResult> {
  const source = opts.source === undefined ? instagramSource() : opts.source
  const none = (message: string): InstagramListsSyncResult => ({ status: "none", message, added: 0, updated: 0 })
  if (!source) return none("This build has no Instagram report to read.")
  let summary
  try {
    summary = await source.summary()
  } catch {
    return none("The running Brain2 desktop app is older than this code. Quit and reopen it, then try again.")
  }
  if (!summary) return none("No Instagram report has been built yet.")
  if (!opts.force && readApplied() === summary.buildId) {
    return { status: "skipped", message: "These lists already match the current report.", added: 0, updated: 0 }
  }
  const parsed = readInstagramAnalysisText(summary.text)
  if (!parsed) return none("The report's summary.json was not in the expected shape.")
  const result = applyInstagramAnalysisImport(parsed)
  writeApplied(summary.buildId)
  return { status: "applied", message: describeInstagramAnalysisResult(parsed, result), ...result }
}
