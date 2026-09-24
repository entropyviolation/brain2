/**
 * components/Operations/OperationPostMortemDialog.tsx — Operation post-mortem (#277)
 *
 * Captures the operation-level retrospective (summary, what worked, what failed,
 * lessons, and a couple of 1-10 ratings) and persists it through the
 * reviews-store `addOperationReview` action (added by Worker G) via
 * `saveOperationPostMortem`. If that action isn't wired yet, the dialog surfaces
 * a non-blocking notice instead of throwing (see README integration note).
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useReviewsStore } from "@/lib/reviews-store"
import type { Task } from "@/lib/types"
import { saveOperationPostMortem } from "./operation-actions"
import "./operations-chrome.css"

const RATINGS: Array<{ key: string; label: string }> = [
  { key: "execution", label: "Execution" },
  { key: "planning", label: "Planning" },
  { key: "morale", label: "Morale" },
]

export function OperationPostMortemDialog({
  operation,
  open,
  onClose,
}: {
  operation: Task
  open: boolean
  onClose: () => void
}) {
  const existing = useReviewsStore((s) => s.operationReviews.find((r) => r.operationId === operation.id))
  const [summary, setSummary] = useState(existing?.summary ?? "")
  const [whatWorked, setWhatWorked] = useState(existing?.whatWorked ?? "")
  const [whatFailed, setWhatFailed] = useState(existing?.whatFailed ?? "")
  const [lessons, setLessons] = useState((existing?.lessons ?? []).join("\n"))
  const [ratings, setRatings] = useState<Record<string, number>>(existing?.ratings ?? {})
  const [notice, setNotice] = useState<string | null>(null)

  const handleSave = () => {
    const result = saveOperationPostMortem(operation.id, {
      summary: summary.trim(),
      whatWorked: whatWorked.trim() || undefined,
      whatFailed: whatFailed.trim() || undefined,
      lessons: lessons
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      ratings,
    })
    if (!result) {
      setNotice(
        "Saved locally is unavailable — the reviews-store operation-review action isn't wired yet. Try again after integration.",
      )
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="ops95-dialog sm:max-w-lg">
        <DialogHeader className="ops-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="ops-title-text">After-action report</DialogTitle>
          <button type="button" className="ops-title-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </DialogHeader>

        <div className="ops-dialog-body">
          <p className="ops-hint">{operation.description}</p>
          <div>
            <label htmlFor="opm-summary">Summary</label>
            <textarea
              id="opm-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="How did this operation go overall?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="opm-worked">What worked</label>
              <textarea id="opm-worked" value={whatWorked} onChange={(e) => setWhatWorked(e.target.value)} rows={3} />
            </div>
            <div>
              <label htmlFor="opm-failed">What to do differently</label>
              <textarea id="opm-failed" value={whatFailed} onChange={(e) => setWhatFailed(e.target.value)} rows={3} />
            </div>
          </div>

          <div>
            <label htmlFor="opm-lessons">Lessons (one per line)</label>
            <textarea
              id="opm-lessons"
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              rows={3}
              placeholder={"Ship smaller increments\nBook focus blocks earlier"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {RATINGS.map((r) => (
              <div key={r.key}>
                <label htmlFor={`opm-${r.key}`}>{r.label}</label>
                <input
                  id={`opm-${r.key}`}
                  type="number"
                  min={1}
                  max={10}
                  value={ratings[r.key] ?? ""}
                  onChange={(e) => setRatings((prev) => ({ ...prev, [r.key]: Number(e.target.value) }))}
                  placeholder="1-10"
                />
              </div>
            ))}
          </div>

          {notice && <p className="ops-hint">{notice}</p>}
        </div>

        <div className="ops-actions">
          <button type="button" className="ops-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn-default" onClick={handleSave}>
            File report
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default OperationPostMortemDialog
