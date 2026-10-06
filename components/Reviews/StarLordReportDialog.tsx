/**
 * components/Reviews/StarLordReportDialog.tsx — Star Lord Report
 *
 * New moon, full moon, or birthday. Preparation, six questions (ledger, then
 * inner alchemy), and a closing said toward the north. Close saves a draft
 * and awards nothing. Save submits and awards section points plus the
 * whole-ritual bonus. Shell: `.hpp95`.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles } from "lucide-react"
import { RitualMoonIcon } from "@/components/Icons"
import { usePointsStore } from "@/lib/points-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { periodLabel } from "@/lib/reviews-store"
import { useStarLordStore } from "@/lib/star-lord-store"
import {
  STAR_LORD_ALCHEMY_NOTE,
  STAR_LORD_CLOSING,
  STAR_LORD_PREPARATION,
  STAR_LORD_RITUALS,
  cleanStarLordAnswers,
  completedStarLordSections,
  starLordAwardPoints,
  starLordPointsLabel,
  starLordPointsTaskId,
  starLordReportId,
  type StarLordKind,
} from "@/lib/star-lord"

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0)
}

export function StarLordReportDialog({
  open,
  kind,
  dateKey,
  onClose,
}: {
  open: boolean
  kind: StarLordKind
  dateKey: string
  onClose: () => void
}) {
  const ritual = STAR_LORD_RITUALS[kind]
  const reports = useStarLordStore((s) => s.reports)
  const saveReport = useStarLordStore((s) => s.saveReport)
  const upsertPoints = usePointsStore((s) => s.upsertPoints)
  const sectionPoints = useUserSettingsStore((s) => s.ritualSectionPoints)
  const completionBonus = useUserSettingsStore((s) => s.ritualCompletionBonus)
  const existing = reports.find((row) => row.id === starLordReportId(kind, dateKey))

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const baselineRef = useRef("")
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const next = { ...(existing?.answers ?? {}) }
    setAnswers(next)
    baselineRef.current = JSON.stringify(cleanStarLordAnswers(kind, next))
    submittedRef.current = false
    // Load once per open. A save in this dialog updates the store; we keep local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, dateKey])

  const snapshot = () => JSON.stringify(cleanStarLordAnswers(kind, answers))

  const persist = (markDone: boolean) => {
    const done = markDone || existing?.completed === true
    const cleaned = cleanStarLordAnswers(kind, answers)
    saveReport({
      id: starLordReportId(kind, dateKey),
      kind,
      dateKey,
      answers: cleaned,
      completed: done,
      completedAt: done ? (existing?.completedAt ?? new Date().toISOString()) : undefined,
    })
    if (!done) return
    const settings = {
      sectionPoints: sectionPoints ?? 10,
      completionBonus: completionBonus ?? 30,
    }
    const points = starLordAwardPoints(kind, cleaned, settings, true)
    const sections = completedStarLordSections(kind, cleaned).length
    upsertPoints(
      starLordPointsTaskId(kind, dateKey),
      points,
      starLordPointsLabel(kind, sections, settings.completionBonus),
      dateFromKey(dateKey),
    )
  }

  const dismiss = () => {
    if (!submittedRef.current && snapshot() !== baselineRef.current) persist(false)
    else if (existing?.completed && snapshot() !== baselineRef.current) persist(true)
    onClose()
  }

  const handleSave = () => {
    submittedRef.current = true
    persist(true)
    onClose()
  }

  const ledger = ritual.questions.filter((q) => q.group === "ledger")
  const alchemy = ritual.questions.filter((q) => q.group === "alchemy")

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        data-ui-name="Star Lord Report"
        data-ui-docs="components/Reviews/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2">
              {kind === "birth" ? <Sparkles className="h-5 w-5" /> : <RitualMoonIcon className="h-5 w-5" />}
              Star Lord Report
            </DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            {ritual.title} · {periodLabel("day", dateKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="hpp-body flex-1 overflow-y-auto space-y-6 pr-1">
          <section className="space-y-1">
            <p className="text-sm font-semibold">{ritual.theme}</p>
            <p className="text-sm text-muted-foreground">{ritual.themeLine}</p>
            <p className="text-sm text-muted-foreground">{ritual.place}</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Before you begin</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              {STAR_LORD_PREPARATION.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold text-sm">The ledger</h3>
            {ledger.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <p id={`star-lord-${q.id}-q`} className="text-sm leading-snug">
                  {q.prompt}
                </p>
                <Textarea
                  id={`star-lord-${q.id}`}
                  aria-labelledby={`star-lord-${q.id}-q`}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                />
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold text-sm">Inner alchemy</h3>
            <p className="text-sm text-muted-foreground">{STAR_LORD_ALCHEMY_NOTE}</p>
            {alchemy.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <p id={`star-lord-${q.id}-q`} className="text-sm leading-snug">
                  {q.prompt}
                </p>
                <Textarea
                  id={`star-lord-${q.id}`}
                  aria-labelledby={`star-lord-${q.id}-q`}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                />
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Closing</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              {STAR_LORD_CLOSING.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        </div>

        <div className="hpp-actions">
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button className="hpp-key-go" onClick={handleSave}>
            Save Star Lord Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
