/**
 * components/Reviews/PostMortemDialog.tsx — Task post-mortem (Brain2 #40)
 *
 * A small reflection dialog launched from a "Reflect" affordance on a completed
 * task (in the Reviews ritual or Analytics). Captures the four post-mortem
 * dimensions (satisfaction / resistance / focus / distraction, 1-10), an
 * optional actual-duration correction, and free-text notes, then persists a
 * `TaskCompletionReview` onto the task via `saveCompletionReview` (a task-store
 * action CALL — this feature never touches the hot completeTask path).
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles } from "lucide-react"
import type { Task } from "@/lib/types"
import { saveCompletionReview } from "@/lib/services/completion-service"

interface ScaleDef {
  key: "satisfaction" | "resistance" | "focus" | "distraction"
  label: string
  hint: string
}

const SCALES: ScaleDef[] = [
  { key: "satisfaction", label: "Satisfaction", hint: "How happy are you with the result?" },
  { key: "resistance", label: "Resistance", hint: "How hard was it to get started?" },
  { key: "focus", label: "Focus", hint: "How focused were you while working?" },
  { key: "distraction", label: "Distraction", hint: "How often were you pulled away?" },
]

function Scale({
  def,
  value,
  onChange,
}: {
  def: ScaleDef
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{def.label}</Label>
        <span className="text-sm tabular-nums font-semibold text-primary">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary cursor-pointer"
        aria-label={def.label}
      />
      <p className="text-xs text-muted-foreground">{def.hint}</p>
    </div>
  )
}

export function PostMortemDialog({
  task,
  open,
  onClose,
  onSaved,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
  onSaved?: (task: Task) => void
}) {
  const existing = task?.completionReview
  const [satisfaction, setSatisfaction] = useState(existing?.satisfaction ?? 5)
  const [resistance, setResistance] = useState(existing?.resistance ?? 5)
  const [focus, setFocus] = useState(existing?.focus ?? 5)
  const [distraction, setDistraction] = useState(existing?.distraction ?? 5)
  const [actualDuration, setActualDuration] = useState<string>(
    existing?.actualDuration?.toString() ?? task?.actualDuration?.toString() ?? "",
  )
  const [notes, setNotes] = useState(existing?.notes ?? "")

  const values = { satisfaction, resistance, focus, distraction }
  const setters: Record<ScaleDef["key"], (v: number) => void> = {
    satisfaction: setSatisfaction,
    resistance: setResistance,
    focus: setFocus,
    distraction: setDistraction,
  }

  const handleSave = () => {
    if (!task) return
    const parsedDuration = actualDuration.trim() === "" ? undefined : Number(actualDuration)
    const updated = saveCompletionReview(task.id, {
      satisfaction,
      resistance,
      focus,
      distraction,
      notes: notes.trim() || undefined,
      actualDuration: Number.isFinite(parsedDuration) ? parsedDuration : undefined,
    })
    if (updated && onSaved) onSaved(updated)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Reflect on this task
          </DialogTitle>
          <DialogDescription className="truncate">{task?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {SCALES.map((def) => (
            <Scale key={def.key} def={def} value={values[def.key]} onChange={setters[def.key]} />
          ))}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor="pm-actual-duration">
              Actual time spent (minutes)
            </Label>
            <Input
              id="pm-actual-duration"
              type="number"
              min={0}
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
              placeholder="e.g. 45"
            />
          </div>

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

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!task}>
            Save reflection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PostMortemDialog
