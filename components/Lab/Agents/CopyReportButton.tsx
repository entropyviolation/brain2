/**
 * components/Lab/Agents/CopyReportButton.tsx — Clipboard key for a run report
 *
 * Sits in the upper right of a "Try it" well. Copies `formatRunReport` text. Disabled until a run exists.
 */
"use client"

import { useState } from "react"
import { Check, ClipboardCopy } from "lucide-react"
import { formatRunReport, type RunReport } from "./run-report"

export function CopyReportButton({ report }: { report: RunReport | null }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle")

  const copy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(formatRunReport(report))
      setState("done")
    } catch {
      setState("failed")
    }
    window.setTimeout(() => setState("idle"), 1800)
  }

  return (
    <button
      type="button"
      data-no95
      className="bf-cap ag-copy"
      disabled={!report}
      onClick={() => void copy()}
      aria-label="Copy run report"
      title={report ? "Copy a step-by-step report of this run to paste to a coding agent" : "Run something first"}
      data-testid="copy-run-report"
    >
      {state === "done" ? <Check aria-hidden="true" size={14} /> : <ClipboardCopy aria-hidden="true" size={14} />}
      {state === "done" ? "Copied" : state === "failed" ? "Copy failed" : null}
    </button>
  )
}
