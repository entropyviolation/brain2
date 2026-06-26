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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useReviewsStore } from "@/lib/reviews-store"
import type { Task } from "@/lib/types"
import { saveOperationPostMortem } from "./operation-actions"

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Operation post-mortem</DialogTitle>
          <DialogDescription className="truncate">{operation.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="opm-summary">
              Summary
            </Label>
            <Textarea
              id="opm-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="How did this operation go overall?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor="opm-worked">
                What worked
              </Label>
              <Textarea id="opm-worked" value={whatWorked} onChange={(e) => setWhatWorked(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor="opm-failed">
                What to do differently
              </Label>
              <Textarea id="opm-failed" value={whatFailed} onChange={(e) => setWhatFailed(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="opm-lessons">
              Lessons (one per line)
            </Label>
            <Textarea
              id="opm-lessons"
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              rows={3}
              placeholder={"Ship smaller increments\nBook focus blocks earlier"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {RATINGS.map((r) => (
              <div key={r.key} className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor={`opm-${r.key}`}>
                  {r.label}
                </Label>
                <Input
                  id={`opm-${r.key}`}
                  type="number"
                  min={1}
                  max={10}
                  value={ratings[r.key] ?? ""}
                  onChange={(e) =>
                    setRatings((prev) => ({ ...prev, [r.key]: Number(e.target.value) }))
                  }
                  placeholder="1-10"
                />
              </div>
            ))}
          </div>

          {notice && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save post-mortem</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default OperationPostMortemDialog
