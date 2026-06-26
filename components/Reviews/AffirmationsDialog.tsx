/**
 * components/Reviews/AffirmationsDialog.tsx — Spoken affirmations ritual
 *
 * Launched from the Morning Review (stacks *above* it). Pulls lines from the
 * Lists → "Affirmations" list (seeding sensible defaults the first time), picks
 * five at random, and walks the user through speaking each one aloud while the
 * mic is streamed through `useVocalConfidence`. The "Next" gate only unlocks
 * once the delivery registers as genuinely confident (loud + steady + complete),
 * so you can't rush past an affirmation you didn't actually mean.
 *
 * Voice scoring is a transparent client-side heuristic (lib/vocal-confidence.ts)
 * with no API keys; it degrades gracefully when the mic is unavailable.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Mic,
  Sparkles,
  Check,
  CheckCircle2,
  ArrowRight,
  Volume2,
  Activity,
  Gauge,
  AudioLines,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { createListItem } from "@/lib/item-utils"
import type { List } from "@/lib/types"
import {
  AFFIRMATIONS_LIST_NAME,
  AFFIRMATIONS_PER_SESSION,
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
  pickRandom,
} from "@/lib/affirmations"
import { requiredVoicedSecondsFor, type ConfidenceScore } from "@/lib/vocal-confidence"
import { useVocalConfidence } from "@/hooks/useVocalConfidence"

type Phase = "intro" | "active" | "done"

function coachHint(score: ConfidenceScore): string {
  if (score.confident) return "Confidence reached — you mean it."
  const { volume, steadiness, conviction, sustain } = score.components
  if (sustain < 0.6) return "Say the whole affirmation, out loud."
  if (volume < 0.5) return "A little louder — speak with conviction."
  if (steadiness < 0.5) return "Hold a steady, clear voice — no waver."
  if (conviction < 0.5) return "Land it — finish strong, don't trail up."
  return "Almost there — keep that conviction."
}

function MeterRow({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}

export function AffirmationsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { status, score, error, start, reset, stop } = useVocalConfidence()

  const [phase, setPhase] = useState<Phase>("intro")
  const [session, setSession] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [unlocked, setUnlocked] = useState(false)

  /** Ensure the "Affirmations" list exists (seeding defaults) and return its lines. */
  const ensureAffirmationsPool = useCallback((): string[] => {
    const store = useTaskStore.getState() as unknown as {
      lists: List[]
      addList: (l: List) => void
      addTask: (t: ReturnType<typeof createListItem>) => void
    }
    const addListFn = store.addList
    let category = findAffirmationsCategory(store.lists)
    if (!category && addListFn) {
      category = {
        id: `affirmations-${Date.now()}`,
        name: AFFIRMATIONS_LIST_NAME,
        color: "#a855f7",
        description: "Spoken morning affirmations",
        createdAt: new Date(),
        scheduleable: false,
        itemLabel: "affirmation",
      }
      addListFn(category)
      DEFAULT_AFFIRMATIONS.forEach((text, i) => {
        const item = createListItem(text, [category!.id])
        item.id = `${category!.id}-seed-${i}`
        store.addTask(item)
      })
    }
    const freshTasks = useTaskStore.getState().tasks
    const items = category
      ? getAffirmationItems(freshTasks, category.id).map(affirmationText).filter(Boolean)
      : []
    return items.length ? items : [...DEFAULT_AFFIRMATIONS]
  }, [])

  // Make the list show up under Lists → All as soon as the ritual is opened.
  useEffect(() => {
    if (open) ensureAffirmationsPool()
  }, [open, ensureAffirmationsPool])

  // Latch the "Next" gate the moment a confident delivery is detected.
  useEffect(() => {
    if (phase === "active" && score.confident) setUnlocked(true)
  }, [phase, score.confident])

  const handleStart = useCallback(async () => {
    const pool = ensureAffirmationsPool()
    const picked = pickRandom(pool, AFFIRMATIONS_PER_SESSION)
    setSession(picked)
    setIndex(0)
    setUnlocked(false)
    setPhase("active")
    await start(requiredVoicedSecondsFor(picked[0] ?? ""))
  }, [ensureAffirmationsPool, start])

  const goToIndex = useCallback(
    (next: number) => {
      setIndex(next)
      setUnlocked(false)
      reset(requiredVoicedSecondsFor(session[next] ?? ""))
    },
    [reset, session],
  )

  const handleNext = useCallback(() => {
    if (index >= session.length - 1) {
      stop()
      setPhase("done")
      return
    }
    goToIndex(index + 1)
  }, [index, session.length, stop, goToIndex])

  const handleClose = useCallback(() => {
    stop()
    setPhase("intro")
    setIndex(0)
    setUnlocked(false)
    setSession([])
    onClose()
  }, [onClose, stop])

  const currentText = session[index] ?? ""
  const micUnavailable = status === "denied" || status === "unsupported" || status === "error"
  const scorePct = Math.round(score.score * 100)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Affirmations
          </DialogTitle>
          <DialogDescription>
            {phase === "intro" && "Speak five affirmations aloud — with conviction."}
            {phase === "active" && `Affirmation ${index + 1} of ${session.length}`}
            {phase === "done" && "Ritual complete"}
          </DialogDescription>
        </DialogHeader>

        {/* Intro */}
        {phase === "intro" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="h-24 w-24 rounded-full bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-500/30">
              <Mic className="h-10 w-10 text-purple-500" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              We&apos;ll pull {AFFIRMATIONS_PER_SESSION} affirmations from your{" "}
              <span className="font-medium text-foreground">Affirmations</span> list and listen as
              you say each one. You can move to the next only once it&apos;s said with full
              confidence.
            </p>
            <Button size="lg" className="gap-2" onClick={handleStart}>
              <Mic className="h-4 w-4" />
              Start affirmations
            </Button>
            <p className="text-[11px] text-muted-foreground">Your audio never leaves this device.</p>
          </div>
        )}

        {/* Active */}
        {phase === "active" && (
          <div className="space-y-5 py-2">
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5">
              {session.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < index
                      ? "w-4 bg-purple-500"
                      : i === index
                        ? "w-6 bg-purple-500"
                        : "w-4 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Affirmation text */}
            <div className="relative rounded-xl border bg-muted/30 p-6 text-center">
              <p className="text-lg font-medium leading-snug">{currentText}</p>
              {unlocked && (
                <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-green-500 text-white flex items-center justify-center shadow">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>

            {micUnavailable ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-center space-y-3">
                <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {error ?? "Microphone unavailable."}
                </p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => start(requiredVoicedSecondsFor(currentText))}>
                    Try mic again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleNext}>
                    {index >= session.length - 1 ? "Finish" : "Read & continue"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Listening orb + overall confidence */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span
                      className={`absolute rounded-full bg-purple-500/20 transition-all duration-150 ${
                        status === "listening" ? "animate-pulse" : ""
                      }`}
                      style={{
                        height: `${56 + score.components.volume * 44}px`,
                        width: `${56 + score.components.volume * 44}px`,
                      }}
                    />
                    <div
                      className={`relative h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
                        score.confident ? "bg-green-500 text-white" : "bg-purple-500 text-white"
                      }`}
                    >
                      {status === "requesting" ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : score.confident ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <AudioLines className="h-6 w-6" />
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold tabular-nums">{scorePct}%</div>
                    <p className="text-xs text-muted-foreground">{coachHint(score)}</p>
                  </div>
                </div>

                {/* Sub-meters */}
                <div className="space-y-3">
                  <MeterRow label="Volume" value={score.components.volume} icon={<Volume2 className="h-3.5 w-3.5" />} />
                  <MeterRow label="Steadiness" value={score.components.steadiness} icon={<Activity className="h-3.5 w-3.5" />} />
                  <MeterRow label="Conviction" value={score.components.conviction} icon={<Gauge className="h-3.5 w-3.5" />} />
                  <MeterRow label="Full delivery" value={score.components.sustain} icon={<Mic className="h-3.5 w-3.5" />} />
                </div>
              </>
            )}

            {!micUnavailable && (
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleClose}>
                  Stop
                </Button>
                <Button onClick={handleNext} disabled={!unlocked} className="gap-1.5">
                  {index >= session.length - 1 ? "Finish" : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center ring-1 ring-green-500/30">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">All {session.length} affirmed.</p>
              <p className="text-sm text-muted-foreground">You said every one with conviction. Go own the day.</p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AffirmationsDialog
