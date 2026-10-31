/**
 * lib/bim-flow/archive.ts — Keep every BIM flow run on disk, whoever ran it
 *
 * The browser keeps a few runs in `localStorage` and drops the rest. Model runs
 * cost minutes, so each one is also sent to `/api/bim-flow-archive`, which
 * appends a line to `data/bim-flow-runs/YYYY-MM-DD.jsonl` (git-ignored). The
 * lab calls this for every model call, flow run, and test result, so a run
 * started by Claude while testing is kept like any other. Fire and forget: a
 * failed write never stops a run.
 */

export type ArchiveKind = "model-call" | "flow-run" | "test-result" | "suggestion-verdict"

export function archive(kind: ArchiveKind, record: unknown): void {
  if (typeof fetch === "undefined" || typeof window === "undefined") return
  try {
    void fetch("/api/bim-flow-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, record }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}
