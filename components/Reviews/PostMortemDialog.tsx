/**
 * components/Reviews/PostMortemDialog.tsx — Task post-mortem (Brain2 #40)
 *
 * A later reflection, opened from Reflect on a period ritual or from Analytics.
 * It is not the completion popup. That popup (`CompletionDialog`) is what
 * appears when a task is marked done: goals, objectives, the clock, the quick
 * review, and its points. This dialog only adds the older 1–10 notes
 * (satisfaction, resistance, focus, distraction) and its own written note
 * (`reflectNotes`). It does not award the quick review, and it does not rewrite
 * the quick-review notes, the points ledger, duration, or start. A score left
 * off is cleared. Close saves a changed reflection.
 * Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles } from "lucide-react"
import type { Task } from "@/lib/types"
import { postMortemReviewInput, saveCompletionReview } from "@/lib/services/completion-service"
import { itemTitle } from "@/lib/item-utils"

const SCALES: { key: "satisfaction" | "resistance" | "focus" | "distraction"; label: string; hint: string }[] = [
  { key: "satisfaction", label: "Satisfaction", hint: "How happy are you with the result?" },
  { key: "resistance", label: "Resistance", hint: "How hard was it to start or stay with it?" },
  { key: "focus", label: "Focus", hint: "How absorbed were you?" },
  { key: "distraction", label: "Distraction", hint: "How often were you pulled away?" },
]

function ScoreRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-medium" title={hint}>
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{value ? `${value}/10` : "optional"}</span>
      </div>
      <div className="flex gap-0.5" role="group" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1
          const on = value === n
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n}`}
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : n)}
              className={`h-6 flex-1 rounded border text-[10px] ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {n}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function reflectDraft(review: Task["completionReview"]): string {
  if (!review) return ""
  if (review.reflectNotes) return review.reflectNotes
  if (review.reviewPoints == null && review.notes) return review.notes
  return ""
}

function PostMortemForm({
  task,
  open,
  onClose,
  onSaved,
}: {
  task: Task
  open: boolean
  onClose: () => void
  onSaved?: (task: Task) => void
}) {
  const existing = task.completionReview
  const [scores, setScores] = useState<{
    satisfaction?: number
    resistance?: number
    focus?: number
    distraction?: number
  }>(() => ({
    satisfaction: existing?.satisfaction,
    resistance: existing?.resistance,
    focus: existing?.focus,
    distraction: existing?.distraction,
  }))
  const [notes, setNotes] = useState(() => reflectDraft(existing))

  const setScore = (key: "satisfaction" | "resistance" | "focus" | "distraction", value: number | undefined) =>
    setScores((prev) => {
      const next = { ...prev }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const closedRef = useRef(false)
  const initialRef = useRef(JSON.stringify({ scores: {
    satisfaction: existing?.satisfaction,
    resistance: existing?.resistance,
    focus: existing?.focus,
    distraction: existing?.distraction,
  }, notes: reflectDraft(existing) }))
  const dirty = () => JSON.stringify({ scores, notes }) !== initialRef.current

  const write = () => {
    if (!task) return
    const updated = saveCompletionReview(
      task.id,
      postMortemReviewInput({
        satisfaction: scores.satisfaction,
        resistance: scores.resistance,
        focus: scores.focus,
        distraction: scores.distraction,
        note: notes,
      }),
    )
    if (updated && onSaved) onSaved(updated)
  }

  const handleSave = () => {
    closedRef.current = true
    write()
    onClose()
  }

  const dismiss = () => {
    if (closedRef.current) return
    closedRef.current = true
    if (dirty()) write()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="hpp95 hpp95-dialog sm:max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Reflect on this task
            </DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead truncate">{task ? itemTitle(task) : ""}</DialogDescription>
        </DialogHeader>

        <div className="hpp-body space-y-4 py-1">
          <p className="text-xs text-muted-foreground">
            This is a later note. Length, start, enjoyment, the quick-review notes, and the quick-review points stay on the completion popup.
          </p>
          {SCALES.map((scale) => (
            <ScoreRow
              key={scale.key}
              label={scale.label}
              hint={scale.hint}
              value={scores[scale.key]}
              onChange={(value) => setScore(scale.key, value)}
            />
          ))}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="pm-notes">
              Notes
            </Label>
            <Textarea
              id="pm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What worked, what to do differently next time…"
            />
          </div>
        </div>

        <div className="hpp-actions">
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button className="hpp-key-go" onClick={handleSave} disabled={!task}>
            Save reflection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PostMortemDialog(props: {
  task: Task | null
  open: boolean
  onClose: () => void
  onSaved?: (task: Task) => void
}) {
  if (!props.open || !props.task) return null
  return <PostMortemForm key={props.task.id} {...props} task={props.task} />
}

export default PostMortemDialog
