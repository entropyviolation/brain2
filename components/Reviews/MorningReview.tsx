/**
 * components/Reviews/MorningReview.tsx — Morning review ritual (HM2, Worker G)
 *
 * The counterpart to the end-of-period (evening) review: a short start-of-day
 * ritual capturing wake time, a remembered dream, the day's intentions,
 * affirmations, and which scheduled tasks are being consciously postponed. The
 * `morning` slice is merged onto today's day `PeriodReview` via
 * `reviews-store.saveMorningReview` (so it coexists with the evening review).
 *
 * `MorningReview` is a self-contained entry point (button + dialog) surfaced
 * from the Review header and the Home banner; `MorningReviewDialog` is exported
 * for callers that manage their own open state.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sun, Plus, X, Moon, Mic } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore, localDayKey, periodLabel } from "@/lib/reviews-store"
import { taskScheduledOnDay } from "@/lib/date-utils"
import type { Task } from "@/lib/types"
import { AffirmationsDialog } from "@/components/Reviews/AffirmationsDialog"

function StringListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const rows = values.length ? values : [""]
  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, ""])}>
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  )
}

export function MorningReviewDialog({
  open,
  onClose,
  date = new Date(),
}: {
  open: boolean
  onClose: () => void
  date?: Date
}) {
  const dayKey = localDayKey(date)
  const tasks = useTaskStore((s) => s.tasks)
  const saveMorningReview = useReviewsStore((s) => s.saveMorningReview)
  const existing = useReviewsStore((s) => s.getReview("day", dayKey)?.morning)

  const [wakeTime, setWakeTime] = useState(existing?.wakeTime || "")
  const [dream, setDream] = useState(existing?.dream || "")
  const [intentions, setIntentions] = useState<string[]>(existing?.intentions?.length ? existing.intentions : [""])
  const [affirmations, setAffirmations] = useState<string[]>(
    existing?.affirmations?.length ? existing.affirmations : [""],
  )
  const [postponed, setPostponed] = useState<string[]>(existing?.postponedTaskIds || [])
  const [affirmationsOpen, setAffirmationsOpen] = useState(false)

  const todaysTasks = useMemo<Task[]>(
    () => tasks.filter((t) => !t.completed && taskScheduledOnDay(t, date)),
    [tasks, date],
  )

  const togglePostponed = (id: string) =>
    setPostponed((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const handleSave = () => {
    saveMorningReview(dayKey, {
      wakeTime: wakeTime.trim() || undefined,
      dream: dream.trim() || undefined,
      intentions: intentions.map((s) => s.trim()).filter(Boolean),
      affirmations: affirmations.map((s) => s.trim()).filter(Boolean),
      postponedTaskIds: postponed,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Morning Review
          </DialogTitle>
          <DialogDescription>{periodLabel("day", dayKey)}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Wake time</Label>
              <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </div>
          </div>

          <section className="space-y-2">
            <Label className="font-semibold text-sm flex items-center gap-1">
              <Moon className="h-4 w-4" />
              Dream journal
            </Label>
            <Textarea value={dream} onChange={(e) => setDream(e.target.value)} rows={2} placeholder="Anything you remember…" />
          </section>

          <section className="space-y-2">
            <Label className="font-semibold text-sm">Intentions for today</Label>
            <StringListEditor values={intentions} onChange={setIntentions} placeholder="Today I will…" />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-semibold text-sm">Affirmations</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setAffirmationsOpen(true)}
              >
                <Mic className="h-3.5 w-3.5" />
                Affirmations
              </Button>
            </div>
            <StringListEditor values={affirmations} onChange={setAffirmations} placeholder="I am…" />
          </section>

          {todaysTasks.length > 0 && (
            <section className="space-y-2">
              <Label className="font-semibold text-sm">Consciously postpone</Label>
              <p className="text-xs text-muted-foreground">
                Mark anything scheduled today you are deliberately deferring.
              </p>
              <div className="space-y-1">
                {todaysTasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={postponed.includes(t.id)}
                      onChange={() => togglePostponed(t.id)}
                    />
                    <span className="truncate flex-1">{t.description}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Morning Review</Button>
        </div>
      </DialogContent>

      <AffirmationsDialog open={affirmationsOpen} onClose={() => setAffirmationsOpen(false)} />
    </Dialog>
  )
}

export function MorningReview({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const [open, setOpen] = useState(false)
  const today = localDayKey(new Date())
  const done = useReviewsStore((s) => !!s.getReview("day", today)?.morning)

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} data-morning-review-entry>
        <Sun className="h-4 w-4 mr-2" />
        {done ? "Morning ✓" : "Morning"}
      </Button>
      <MorningReviewDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default MorningReview
