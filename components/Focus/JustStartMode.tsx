/**
 * components/Focus/JustStartMode.tsx — Distraction-free "Just Start" overlay
 *
 * An anti-paralysis focus room for one task (Brain2 #59/#128). It shows the
 * one step to do next (`pickStartStep` in lib/next-step.ts): the lowest-level
 * open step whose prerequisites are met, that has an estimate, with the
 * lowest estimate. The clock counts down that estimate (or a 2-minute opener)
 * and keeps counting past zero.
 *
 * Verbs: Done (ticks the step with its real minutes and logs the time on the
 * task), Skip, Blocked by… (pick the steps it waits on), Too big (split it).
 * When nothing is ready it says why and fixes it in place: name a first step,
 * estimate the bare steps, or see what everything is waiting on.
 *
 * Default export: `JustStartMode({ taskId, stepId?, onClose })`. `stepId`
 * starts that exact step first. Reads + writes the task via useTaskStore.
 *
 * The pen clock: when the task has a pen, or is already on the clock, each
 * step shown goes on the Tracking pen clock (`lib/task-clock.ts`), and Done
 * ticks the step's objective there, so the clock logs the time once. Without
 * a pen, **Paint on Tracking** asks for one.
 *
 * Phase 15 A: it opens on **Today's choices** (`rankStartSteps`, two or three
 * leaves, the first highlighted; Enter or Space starts it, arrows move). A
 * `stepId` skips the choices. A time-box ring (the estimate, or 10 / 25 / 50)
 * closes with "Time's up. That counted.": the minutes go on the step and the
 * task, the step stays open, **Keep going** restarts the ring. Leaving after a
 * minute or more off the pen clock shows the end-of-sitting strip. **Pull me**
 * (P) on the choices screen starts the latest sparked step (`pullMeStep`).
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Play, Pause, RotateCcw, SkipForward, Link2, Scissors } from "lucide-react"
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { addNestedStep, updateNestedStep } from "@/lib/todo-steps"
import {
  addStepMinutes,
  blockerCandidates,
  findPlacedStep,
  finishStep,
  pickStartStep,
  pullMeStep,
  rankStartSteps,
  setStepDependsOn,
  splitStep,
  startProgress,
  type StartPick,
} from "@/lib/next-step"
import { formatLocalDateKey } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import {
  pausePenColorSession,
  resumePenColorSession,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { clockPenFor, startTaskClock } from "@/lib/task-clock"
import { useTaskClockStarter } from "./TaskClockStarter"
import SittingEnd from "./SittingEnd"
import "./just-start.css"

const OPENER_SECONDS = 120
const QUICK_MINUTES = [2, 5, 10, 15, 30]
const BOX_MINUTES = [10, 25, 50] as const
type Box = "est" | (typeof BOX_MINUTES)[number]
const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

function formatClock(seconds: number): string {
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${seconds < 0 ? "+" : ""}${m}:${s.toString().padStart(2, "0")}`
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function pathLabel(path: Subtask[]): string {
  return path.map((p) => p.description).join(" › ")
}

type Panel = null | "blocked" | "split"

export default function JustStartMode({
  taskId,
  stepId,
  onClose,
}: {
  taskId: string
  stepId?: string
  onClose: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)

  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId])
  const [skip, setSkip] = useState<string[]>([])
  const [pinnedId, setPinnedId] = useState<string | undefined>(stepId)
  const [ignoreTaskDeps, setIgnoreTaskDeps] = useState(false)
  const [choosing, setChoosing] = useState(!stepId)
  const [highlight, setHighlight] = useState(0)
  /** Minutes sat, once leaving shows the end-of-sitting strip. */
  const [ending, setEnding] = useState<number | null>(null)
  const openedAt = useRef(Date.now())

  const pick: StartPick | null = useMemo(() => {
    if (!task) return null
    if (pinnedId) {
      const pinned = findPlacedStep(task.subtasks, pinnedId)
      if (pinned && !pinned.step.completed) {
        return {
          kind: "step",
          step: pinned.step,
          path: pinned.path,
          minutes: pinned.step.estimatedDuration ?? 0,
          ready: 1,
        }
      }
    }
    return pickStartStep(task, { allTasks: tasks, skip, ignoreTaskDependencies: ignoreTaskDeps })
  }, [task, tasks, skip, pinnedId, ignoreTaskDeps])

  const ranked = useMemo(
    () =>
      task && !pinnedId
        ? rankStartSteps(task, 3, { allTasks: tasks, skip, ignoreTaskDependencies: ignoreTaskDeps })
        : [],
    [task, tasks, skip, pinnedId, ignoreTaskDeps],
  )
  // Pull me (FN-5): the latest spark, whatever its estimate. Absent when nothing is sparked.
  const pull = useMemo(
    () => (task && !pinnedId ? pullMeStep(task, { allTasks: tasks, ignoreTaskDependencies: ignoreTaskDeps }) : undefined),
    [task, tasks, pinnedId, ignoreTaskDeps],
  )
  const showChoices =
    choosing &&
    !pinnedId &&
    pick?.kind === "step" &&
    (ranked.length >= 2 || (!!pull && pull.step.id !== ranked[0]?.step.id))
  const pullMe = () => {
    if (!pull) return
    setPinnedId(pull.step.id)
    setChoosing(false)
    setHighlight(0)
  }
  const choose = (i: number) => {
    const hit = ranked[i]
    if (!hit) return
    setPinnedId(hit.step.id)
    setChoosing(false)
    setHighlight(0)
  }

  const step = pick?.kind === "step" && !showChoices ? pick.step : undefined
  const progress = startProgress(task?.subtasks)
  const clockSession = usePenColorSessionStore((s) => s.session)
  const onClock = !!task && clockSession?.taskId === task.id
  const taskClock = useTaskClockStarter()
  const hasPen = !!clockPenFor(task, step?.id)

  // Each step shown rides the pen clock when the task already has one running or a pen to paint with.
  useEffect(() => {
    if (!task || !step) return
    const live = usePenColorSessionStore.getState().session
    const riding = live?.taskId === task.id
    if (riding && live?.stepId === step.id) return
    if (riding || clockPenFor(task, step.id)) startTaskClock(task.id, { stepId: step.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, step?.id])

  const [opener, setOpener] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const [startedAt, setStartedAt] = useState(() => new Date())
  const [panel, setPanel] = useState<Panel>(null)
  const [box, setBox] = useState<Box>("est")
  const [stopAtBox, setStopAtBox] = useState(true)
  const [timesUp, setTimesUp] = useState(false)
  /** Minutes already logged on this step by closed time boxes. */
  const [banked, setBanked] = useState(0)

  const estSeconds = !pick || pick.kind !== "step" || pick.minutes <= 0 ? OPENER_SECONDS : pick.minutes * 60
  const targetSeconds = opener ? OPENER_SECONDS : box === "est" ? estSeconds : box * 60

  useEffect(() => {
    setElapsed(0)
    setRunning(true)
    setStartedAt(new Date())
    setPanel(null)
    setTimesUp(false)
    setBanked(0)
  }, [step?.id])

  useEffect(() => {
    if (!running || !step) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running, step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showChoices && !panel && ending == null) {
        if ((e.key === "p" || e.key === "P") && pull) {
          e.preventDefault()
          pullMe()
          return
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          choose(highlight)
          return
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault()
          const dir = e.key === "ArrowDown" ? 1 : -1
          setHighlight((h) => (h + dir + ranked.length) % ranked.length)
          return
        }
      }
      if (e.key !== "Escape") return
      if (panel) setPanel(null)
      else if (ending != null) onClose()
      else exit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  /** Leaving ends the sitting. Off the pen clock, a minute or more shows the strip first. */
  const exit = () => {
    const sat = (Date.now() - openedAt.current) / 60_000
    if (ending == null && task && !onClock && sat >= 1) setEnding(sat)
    else onClose()
  }

  const writeSteps = (subtasks: Subtask[], extra: Partial<Task> = {}) => {
    if (!task) return
    updateTask({ ...task, ...extra, subtasks })
  }

  const timeLog = (from: Date, to: Date, minutes: number, where: Subtask[], what: Subtask): TimeLogEntry => ({
    id: `tl-${to.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: formatLocalDateKey(from),
    startTime: hhmm(from),
    endTime: hhmm(to),
    durationMinutes: minutes,
    notes: `Just Start · ${where.length ? `${pathLabel(where)} › ` : ""}${what.description}`,
    taskId: task!.id,
  })

  // The ring closed: log the box on the step and the task, leave the step open.
  const closeBox = () => {
    if (!task || !step || pick?.kind !== "step") return
    setRunning(false)
    setTimesUp(true)
    const minutes = elapsed / 60
    setElapsed(0)
    if (onClock) {
      // The pen clock logs at Stop; pausing it is the clock stopping.
      pausePenColorSession(new Date(), { hold: true })
      return
    }
    const now = new Date()
    const logged = Math.round(minutes)
    setBanked((b) => b + logged)
    writeSteps(addStepMinutes(task.subtasks, step.id, logged), {
      timeLogs: logged >= 1 ? [...(task.timeLogs ?? []), timeLog(startedAt, now, logged, pick.path, step)] : task.timeLogs,
    })
  }

  useEffect(() => {
    if (stopAtBox && running && step && !timesUp && elapsed >= targetSeconds) closeBox()
  })

  const keepGoing = () => {
    setTimesUp(false)
    setElapsed(0)
    setStartedAt(new Date())
    setRunning(true)
    if (onClock) resumePenColorSession()
  }

  const handleDone = () => {
    if (!task || !step || pick?.kind !== "step") return
    setChoosing(true)
    if (onClock) {
      if (timesUp) resumePenColorSession()
      // The clock logs the time at Stop. Ticking the step's objective ticks the step with its own span.
      const row = activeNowObjectives(clockSession?.nowObjectives).find((o) => o.stepId === step.id)
      if (row) togglePenColorNowObjectiveComplete(row.id)
      else writeSteps(finishStep(task.subtasks, step.id, elapsed / 60 >= 0.5 ? elapsed / 60 : undefined))
      setPinnedId(undefined)
      return
    }
    const now = new Date()
    const minutes = elapsed / 60
    const logged = Math.round(minutes)
    const extra: Partial<Task> = {}
    if (logged >= 1) extra.timeLogs = [...(task.timeLogs ?? []), timeLog(startedAt, now, logged, pick.path, step)]
    const total = banked + minutes
    writeSteps(finishStep(task.subtasks, step.id, total >= 0.5 ? total : undefined, now), extra)
    setPinnedId(undefined)
  }

  const handleSkip = () => {
    if (!step) return
    setPinnedId(undefined)
    setChoosing(false)
    setSkip((prev) => [...prev.filter((id) => id !== step.id), step.id])
  }

  const timeUp = timesUp || elapsed >= targetSeconds
  const pct = timesUp ? 100 : Math.min(100, Math.round((elapsed / targetSeconds) * 100))

  return (
    <div className="just-start" data-item-layer="" data-ui-name="Just Start" data-ui-docs="components/Focus/README.md">
      <Button variant="ghost" size="icon" onClick={exit} className="just-start-exit" aria-label="Exit focus mode">
        <X className="h-5 w-5" />
      </Button>

      <div className="just-start-stage">
        {!task || !pick ? (
          <div className="just-start-step">
            <h1>Task not found</h1>
            <div className="just-start-controls is-spaced">
              <button data-no95 type="button" className="just-start-key" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="just-start-head">
              <p className="just-start-eyebrow">Just start</p>
              <p className="just-start-path" title={itemTitle(task)}>
                {itemTitle(task)}
                {pick.kind === "step" && pick.path.length ? (
                  <>
                    <span className="just-start-path-sep" aria-hidden> › </span>
                    {pathLabel(pick.path)}
                  </>
                ) : null}
              </p>
            </div>

            {showChoices ? (
              <div className="just-start-step is-form">
                <h1>Today&apos;s choices</h1>
                <p className="just-start-step-context">
                  {pick.kind === "step" ? `${pick.ready} ready steps, smallest first. ` : ""}Enter starts the highlighted one.
                </p>
                <ul className="just-start-list is-choices" role="group" aria-label="Today's choices">
                  {ranked.map((r, i) => (
                    <li key={r.step.id}>
                      <button
                        data-no95
                        type="button"
                        className={i === highlight ? "just-start-choice is-on" : "just-start-choice"}
                        aria-pressed={i === highlight}
                        onClick={() => choose(i)}
                        onFocus={() => setHighlight(i)}
                      >
                        <span className="just-start-list-name">
                          {r.path.length ? <em>{pathLabel(r.path)} › </em> : null}
                          {r.step.description}
                        </span>
                        <span className="just-start-chip-read">{r.minutes}m</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {pull ? (
                  <div className="just-start-verbs">
                    <button
                      data-no95
                      type="button"
                      className="just-start-key"
                      onClick={pullMe}
                      title={`Start the latest spark: ${pull.step.description} (P)`}
                    >
                      ✦ Pull me
                    </button>
                  </div>
                ) : null}
              </div>
            ) : pick.kind === "step" && step ? (
              <>
                <div className="just-start-step">
                  <h1>{step.description}</h1>
                  {step.context ? <p className="just-start-step-context">{step.context}</p> : null}
                  <p className="just-start-step-meta">
                    {pick.minutes > 0 ? `${pick.minutes}m estimate` : "no estimate"}
                    {pick.ready > 1 ? ` · smallest of ${pick.ready} ready steps` : pinnedId ? " · chosen step" : ""}
                    {step.isMolecular ? " · atomic" : ""}
                  </p>
                </div>

                {panel === "blocked" ? (
                  <BlockedByPanel
                    steps={task.subtasks ?? []}
                    step={step}
                    onCancel={() => setPanel(null)}
                    onSave={(ids) => {
                      writeSteps(setStepDependsOn(task.subtasks, step.id, ids))
                      setPinnedId(undefined)
                      setPanel(null)
                    }}
                  />
                ) : panel === "split" ? (
                  <SplitPanel
                    step={step}
                    onCancel={() => setPanel(null)}
                    onSave={(parts) => {
                      writeSteps(splitStep(task.subtasks, step.id, parts))
                      setPinnedId(undefined)
                      setPanel(null)
                    }}
                  />
                ) : (
                  <div className="just-start-timer">
                    <div className="just-start-clock-row">
                      <div className={timeUp ? "just-start-clock is-up" : "just-start-clock"} aria-live="off">
                        {formatClock(timesUp ? 0 : targetSeconds - elapsed)}
                      </div>
                      <svg className="just-start-ring" viewBox="0 0 44 44" role="img" aria-label={`Time box ${Math.round(targetSeconds / 60)}m`}>
                        <circle className="just-start-ring-track" cx="22" cy="22" r={RING_R} />
                        <circle
                          className={timesUp ? "just-start-ring-arc is-closed" : "just-start-ring-arc"}
                          cx="22"
                          cy="22"
                          r={RING_R}
                          strokeDasharray={RING_C}
                          strokeDashoffset={RING_C * (1 - pct / 100)}
                        />
                      </svg>
                    </div>
                    <div className={timeUp ? "just-start-meter is-up" : "just-start-meter"} aria-hidden>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    {timesUp ? (
                      <p className="just-start-timer-hint is-up" role="status">
                        <span className="just-start-lamp" aria-hidden /> Time&apos;s up. That counted.{" "}
                        <button data-no95 type="button" className="just-start-key" onClick={keepGoing}>
                          Keep going
                        </button>
                      </p>
                    ) : (
                      <p className="just-start-timer-hint">
                        {timeUp
                          ? "Past the mark. The clock keeps counting."
                          : opener
                            ? "A two-minute opener."
                            : box === "est"
                              ? `Counting down the ${pick.minutes}m estimate.`
                              : `Counting down a ${box}m box.`}
                      </p>
                    )}
                    <div className="just-start-box-row">
                      <span className="just-start-chips" role="group" aria-label="Time box">
                        {(["est", ...BOX_MINUTES] as Box[]).map((b) => (
                          <button
                            key={b}
                            data-no95
                            type="button"
                            className={box === b ? "just-start-chip is-on" : "just-start-chip"}
                            aria-pressed={box === b}
                            onClick={() => setBox(b)}
                          >
                            {b === "est" ? "est" : `${b}m`}
                          </button>
                        ))}
                      </span>
                      <label className="just-start-opener">
                        <input type="checkbox" checked={stopAtBox} onChange={(e) => setStopAtBox(e.target.checked)} />
                        Stop when the ring closes
                      </label>
                    </div>
                    {pick.minutes > 0 ? (
                      <label className="just-start-opener">
                        <input type="checkbox" checked={opener} onChange={(e) => setOpener(e.target.checked)} />
                        2-minute opener
                      </label>
                    ) : null}
                  </div>
                )}

                {panel ? null : (
                  <>
                    <div className="just-start-controls">
                      <button data-no95
                        type="button"
                        className="just-start-key is-icon"
                        onClick={() => setRunning((r) => !r)}
                        aria-label={running ? "Pause timer" : "Resume timer"}
                        title={running ? "Pause" : "Resume"}
                      >
                        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button data-no95
                        type="button"
                        className="just-start-key is-icon"
                        onClick={() => {
                          setElapsed(0)
                          setStartedAt(new Date())
                          setRunning(true)
                        }}
                        aria-label="Reset timer"
                        title="Reset"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button data-no95 type="button" onClick={handleDone} className="just-start-done">
                        <Check className="h-5 w-5" aria-hidden /> Done
                      </button>
                    </div>
                    <div className="just-start-verbs" role="toolbar" aria-label="Step options">
                      <button data-no95 type="button" className="just-start-key" onClick={handleSkip} title="Show the next smallest step">
                        <SkipForward className="h-3.5 w-3.5" aria-hidden /> Skip
                      </button>
                      <button data-no95
                        type="button"
                        className="just-start-key"
                        onClick={() => setPanel("blocked")}
                        title="Name the steps this one waits on"
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden /> Blocked by…
                      </button>
                      <button data-no95
                        type="button"
                        className="just-start-key"
                        onClick={() => setPanel("split")}
                        title="Break this step into smaller steps"
                      >
                        <Scissors className="h-3.5 w-3.5" aria-hidden /> Too big
                      </button>
                      {onClock ? (
                        <span className="just-start-on-clock" title="This step is on the Tracking pen clock">
                          ● on the clock
                        </span>
                      ) : hasPen ? null : (
                        <button data-no95
                          type="button"
                          className="just-start-key"
                          onClick={() => taskClock.start(task.id, step.id)}
                          title="Put this step on a Tracking pen clock"
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden /> Paint on Tracking
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <NotReady
                pick={pick as Exclude<StartPick, { kind: "step" }>}
                task={task}
                tasks={tasks}
                onSteps={(subtasks) => writeSteps(subtasks)}
                onStartAnyway={() => setIgnoreTaskDeps(true)}
                onClose={onClose}
              />
            )}

            {progress.total > 0 ? (
              <p className="just-start-progress">
                {progress.done} of {progress.total} steps done
                {progress.minutesTotal > 0 ? ` · ${progress.minutesLeft}m of ${progress.minutesTotal}m left` : ""}
              </p>
            ) : null}
          </>
        )}
      </div>
      {ending != null ? (
        <div className="just-start-sitting">
          <SittingEnd task={task} minutes={ending} onDone={onClose} />
        </div>
      ) : null}
      {taskClock.picker}
    </div>
  )
}

function MinuteChips({ onPick, label }: { onPick: (m: number) => void; label: string }) {
  return (
    <span className="just-start-chips" role="group" aria-label={label}>
      {QUICK_MINUTES.map((m) => (
        <button key={m} data-no95 type="button" className="just-start-chip" onClick={() => onPick(m)}>
          {m}m
        </button>
      ))}
    </span>
  )
}

function NotReady({
  pick,
  task,
  tasks,
  onSteps,
  onStartAnyway,
  onClose,
}: {
  pick: Exclude<StartPick, { kind: "step" }>
  task: Task
  tasks: Task[]
  onSteps: (subtasks: Subtask[]) => void
  onStartAnyway: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState("")
  const [minutes, setMinutes] = useState<number | undefined>(undefined)

  if (pick.kind === "no-steps") {
    const add = () => {
      if (!draft.trim()) return
      onSteps(addNestedStep(task.subtasks, null, { description: draft, estimatedDuration: minutes }))
      setDraft("")
      setMinutes(undefined)
    }
    return (
      <div className="just-start-step is-form">
        <h1>What would you actually do first?</h1>
        <input
          className="just-start-field"
          type="text"
          autoFocus
          value={draft}
          placeholder="One small, physical step"
          aria-label="First step"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add()
          }}
        />
        <div className="just-start-form-row">
          <MinuteChips label="Estimate" onPick={setMinutes} />
          <button data-no95 type="button" className="just-start-done" disabled={!draft.trim()} onClick={add}>
            Add{minutes ? ` · ${minutes}m` : ""}
          </button>
        </div>
      </div>
    )
  }

  if (pick.kind === "all-done") {
    return (
      <div className="just-start-step">
        <h1>Every step is done.</h1>
        <p className="just-start-step-context">That branch is clear. Mark the task done from To Do when it is.</p>
        <div className="just-start-controls is-spaced">
          <button data-no95 type="button" className="just-start-done" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  if (pick.kind === "needs-estimates") {
    return (
      <div className="just-start-step is-form">
        <h1>Estimate a step to start</h1>
        <p className="just-start-step-context">Just Start takes the smallest step, so it needs a number on at least one.</p>
        <ul className="just-start-list">
          {pick.leaves.map(({ step, path }) => (
            <li key={step.id}>
              <span className="just-start-list-name">
                {path.length ? <em>{pathLabel(path)} › </em> : null}
                {step.description}
              </span>
              <MinuteChips
                label={`Estimate for ${step.description}`}
                onPick={(m) => onSteps(updateNestedStep(task.subtasks, step.id, { estimatedDuration: m }))}
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (pick.kind === "blocked") {
    return (
      <div className="just-start-step is-form">
        <h1>Every open step is waiting</h1>
        <ul className="just-start-list">
          {pick.leaves.map(({ step, blockers }) => (
            <li key={step.id}>
              <span className="just-start-list-name">{step.description}</span>
              <span className="just-start-list-needs">
                needs {blockers.map((b) => b.description).join(", ")}
              </span>
              <button data-no95
                type="button"
                className="just-start-chip"
                onClick={() => onSteps(setStepDependsOn(task.subtasks, step.id, []))}
              >
                Clear
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const names = pick.blockerIds.map((id) => {
    const dep = tasks.find((t) => t.id === id)
    return dep ? itemTitle(dep) : id
  })
  return (
    <div className="just-start-step is-form">
      <h1>This task is waiting on another</h1>
      <p className="just-start-step-context">Needs: {names.join(", ")}</p>
      <div className="just-start-controls is-spaced">
        <button data-no95 type="button" className="just-start-key" onClick={onStartAnyway}>
          Start anyway
        </button>
      </div>
    </div>
  )
}

function BlockedByPanel({
  steps,
  step,
  onSave,
  onCancel,
}: {
  steps: Subtask[]
  step: Subtask
  onSave: (ids: string[]) => void
  onCancel: () => void
}) {
  const candidates = useMemo(() => blockerCandidates(steps, step.id), [steps, step.id])
  const [chosen, setChosen] = useState<string[]>(step.dependsOn ?? [])
  const toggle = (id: string) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  return (
    <div className="just-start-panel" role="dialog" aria-label="Blocked by">
      <p className="just-start-panel-title">What has to happen first?</p>
      {candidates.length === 0 ? (
        <p className="just-start-step-context">No other open steps in this task.</p>
      ) : (
        <ul className="just-start-list is-pick">
          {candidates.map(({ step: c, path }) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="just-start-list-name">
                  {path.length ? <em>{pathLabel(path)} › </em> : null}
                  {c.description}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="just-start-controls">
        <button data-no95 type="button" className="just-start-key" onClick={onCancel}>
          Cancel
        </button>
        <button data-no95 type="button" className="just-start-done" onClick={() => onSave(chosen)}>
          Save
        </button>
      </div>
    </div>
  )
}

function SplitPanel({
  step,
  onSave,
  onCancel,
}: {
  step: Subtask
  onSave: (parts: { description: string; estimatedDuration?: number }[]) => void
  onCancel: () => void
}) {
  const [rows, setRows] = useState<{ description: string; estimatedDuration?: number }[]>([
    { description: "" },
    { description: "" },
  ])
  const set = (i: number, patch: Partial<{ description: string; estimatedDuration?: number }>) =>
    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const filled = rows.filter((r) => r.description.trim())
  return (
    <div className="just-start-panel" role="dialog" aria-label="Split step">
      <p className="just-start-panel-title">Split “{step.description}” into smaller steps</p>
      <ul className="just-start-list is-split">
        {rows.map((row, i) => (
          <li key={i}>
            <input
              className="just-start-field"
              type="text"
              autoFocus={i === 0}
              value={row.description}
              placeholder={i === 0 ? "First smaller step" : "Next step"}
              aria-label={`Part ${i + 1}`}
              onChange={(e) => set(i, { description: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && i === rows.length - 1 && row.description.trim()) {
                  setRows((prev) => [...prev, { description: "" }])
                }
              }}
            />
            <MinuteChips label={`Estimate for part ${i + 1}`} onPick={(m) => set(i, { estimatedDuration: m })} />
            <span className="just-start-chip-read">{row.estimatedDuration ? `${row.estimatedDuration}m` : "–"}</span>
          </li>
        ))}
      </ul>
      <div className="just-start-controls">
        <button data-no95 type="button" className="just-start-key" onClick={() => setRows((prev) => [...prev, { description: "" }])}>
          Add row
        </button>
        <button data-no95 type="button" className="just-start-key" onClick={onCancel}>
          Cancel
        </button>
        <button data-no95 type="button" className="just-start-done" disabled={filled.length === 0} onClick={() => onSave(filled)}>
          Split
        </button>
      </div>
    </div>
  )
}
