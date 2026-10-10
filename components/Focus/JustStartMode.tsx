/**
 * components/Focus/JustStartMode.tsx — Distraction-free "Just Start" overlay
 *
 * An anti-paralysis focus mode for one stalled task (Brain2 #59/#128). It strips
 * the screen down to a single thing: the task's *smallest next molecular step*
 * (see lib/molecular.ts) plus a 2-minute countdown and one phosphor Done key.
 * The dark room keeps one mill cue so it still feels like Brain2.
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
import { itemTitle } from "@/lib/item-utils"
import "./just-start.css"

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

  useEffect(() => {
    setSecondsLeft(FOCUS_SECONDS)
    setRunning(true)
  }, [step?.id])

  useEffect(() => {
    if (!running || secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running, secondsLeft])

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
    <div className="just-start" data-ui-name="Just Start" data-ui-docs="components/Focus/README.md">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="just-start-exit"
        aria-label="Exit focus mode"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="just-start-stage">
        {task ? (
          step ? (
            <>
              <div>
                <p className="just-start-eyebrow">Just start — one step</p>
                <p className="just-start-task">{itemTitle(task)}</p>
              </div>

              <div className="just-start-step">
                <h1>{step.description}</h1>
                {step.context ? <p className="just-start-step-context">{step.context}</p> : null}
                {step.isMolecular ? (
                  <span className="just-start-atomic">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> atomic step
                  </span>
                ) : null}
              </div>

              <div className="just-start-timer">
                <div className={timeUp ? "just-start-clock is-up" : "just-start-clock"}>{formatClock(secondsLeft)}</div>
                <div className={timeUp ? "just-start-meter is-up" : "just-start-meter"} aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="just-start-timer-hint">
                  {timeUp ? "Time's up — but keep going if you're in flow." : "Just two minutes. You only have to start."}
                </p>
              </div>

              <div className="just-start-controls">
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
                <Button type="button" size="lg" onClick={handleDoneWithStep} className="just-start-done">
                  <Check className="h-5 w-5 mr-2" aria-hidden /> Done
                </Button>
              </div>

              {progress.total > 0 ? (
                <p className="just-start-progress">
                  {progress.completed} of {progress.total} steps done
                </p>
              ) : null}
            </>
          ) : (
            <div className="just-start-step">
              <Sparkles className="h-10 w-10 mx-auto text-[var(--js-crt)]" aria-hidden />
              <h1 style={{ marginTop: "1rem" }}>
                {progress.total > 0 ? "Every step is done." : "No steps to start yet."}
              </h1>
              <p className="just-start-step-context">
                {progress.total > 0
                  ? "Nice work — you cleared this task's molecular steps."
                  : "Break this task into steps first, then come back to just start."}
              </p>
              <div className="just-start-controls" style={{ marginTop: "1.25rem" }}>
                <Button type="button" size="lg" onClick={onClose} className="just-start-done">
                  Done
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="just-start-step">
            <h1>Task not found</h1>
            <div className="just-start-controls" style={{ marginTop: "1.25rem" }}>
              <Button size="lg" onClick={onClose} variant="outline" className="border-neutral-700 bg-transparent">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
