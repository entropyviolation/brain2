/**
 * components/Focus/JustStartMode.tsx — Distraction-free "Just Start" overlay
 *
 * An anti-paralysis focus mode for one stalled task (Brain2 #59/#128). It strips
 * the screen down to a single thing: the task's *smallest next molecular step*
 * (see lib/molecular.ts) plus a 2-minute countdown and one button — "Done with
 * this step". The 2-minute timer is the classic ADHD task-initiation trick: you
 * only have to start, and starting is usually enough.
 *
 * Default export: `JustStartMode({ taskId, onClose })`. Reads + writes the task
 * via useTaskStore (marks the surfaced subtask complete, then advances to the
 * next step or congratulates + closes).
 *
 * Wired from the To-Do panel today; the integration pass may surface it
 * elsewhere (e.g. Needs-Attention). Owner: Worker A.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Play, Pause, RotateCcw, Sparkles } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { completeSubtask, nextMolecularStep, subtaskProgress } from "@/lib/molecular"

const FOCUS_SECONDS = 120

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function JustStartMode({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)

  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId])
  const step = useMemo(() => nextMolecularStep(task), [task])
  const progress = subtaskProgress(task)

  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS)
  const [running, setRunning] = useState(true)

  // Reset the timer whenever we move to a new step.
  useEffect(() => {
    setSecondsLeft(FOCUS_SECONDS)
    setRunning(true)
  }, [step?.id])

  useEffect(() => {
    if (!running || secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running, secondsLeft])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const handleDoneWithStep = () => {
    if (!task || !step) return
    updateTask({ ...task, subtasks: completeSubtask(task.subtasks ?? [], step.id) })
  }

  const timeUp = secondsLeft <= 0
  const pct = Math.round(((FOCUS_SECONDS - secondsLeft) / FOCUS_SECONDS) * 100)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-950 text-neutral-50 p-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800"
        aria-label="Exit focus mode"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="w-full max-w-xl text-center space-y-10">
        {task ? (
          step ? (
            <>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Just start — one step</p>
                <p className="text-sm text-neutral-400 truncate">{task.description}</p>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-semibold leading-snug">{step.description}</h1>
                {step.context && (
                  <p className="text-base text-neutral-400 max-w-prose mx-auto whitespace-pre-wrap">{step.context}</p>
                )}
                {step.isMolecular && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" /> atomic step
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className={`text-6xl font-mono tabular-nums ${timeUp ? "text-emerald-400" : ""}`}>
                  {formatClock(secondsLeft)}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${timeUp ? "bg-emerald-500" : "bg-neutral-300"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-sm text-neutral-500">
                  {timeUp ? "Time's up — but keep going if you're in flow." : "Just two minutes. You only have to start."}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRunning((r) => !r)}
                  className="border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
                  aria-label={running ? "Pause timer" : "Resume timer"}
                >
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSecondsLeft(FOCUS_SECONDS)
                    setRunning(true)
                  }}
                  className="border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
                  aria-label="Reset timer"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  onClick={handleDoneWithStep}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Check className="h-5 w-5 mr-2" /> Done with this step
                </Button>
              </div>

              {progress.total > 0 && (
                <p className="text-xs text-neutral-600">
                  {progress.completed} of {progress.total} steps done
                </p>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <Sparkles className="h-10 w-10 mx-auto text-emerald-400" />
              <h1 className="text-3xl font-semibold">
                {progress.total > 0 ? "Every step is done." : "No steps to start yet."}
              </h1>
              <p className="text-neutral-400">
                {progress.total > 0
                  ? "Nice work — you cleared this task's molecular steps."
                  : "Break this task into steps first, then come back to just start."}
              </p>
              <Button size="lg" onClick={onClose} className="bg-neutral-100 text-neutral-900 hover:bg-white">
                Done
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Task not found</h1>
            <Button size="lg" onClick={onClose} variant="outline" className="border-neutral-700 bg-transparent">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
