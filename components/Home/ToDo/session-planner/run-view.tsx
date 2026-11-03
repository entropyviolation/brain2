"use client"

/**
 * Run a session: countdown, transport, pause reason when the pen is running, park, end of sitting, and the tier lines.
 */
import { useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { linkedPenIsRunning, releasePenClock } from "@/lib/session-pen"
import {
  SESSION_TIERS,
  allLines,
  breakDue,
  elapsedMin,
  endSession,
  extendSession,
  finishLine,
  focusLineStep,
  isTimebox,
  lineFocusStep,
  lineIsBlocked,
  lineIsDone,
  lineLabel,
  linePercent,
  lineSeconds,
  lineTarget,
  parkSession,
  pauseSession,
  playLine,
  playStep,
  randomLine,
  remainingSec,
  resumeSession,
  setLineEstimate,
  settleBreak,
  shortestLine,
  stepSeconds,
  stopLine,
  tierReached,
  type SessionLine,
  type SessionPlan,
} from "@/lib/session-plan"
import { queuePauseReason, takeQueuedPauseReason } from "@/lib/work-pause"
import { usePauseReason } from "@/components/Home/Tracking/pause-reason-dialog"
import { formatPercent } from "@/lib/step-progress"
import { finishStep, placeSteps } from "@/lib/next-step"
import { isStepAvailable } from "@/lib/prereqs"
import { updateNestedStep } from "@/lib/todo-steps"
import { completeTask } from "@/lib/services/completion-service"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { togglePenColorNowObjectiveComplete } from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import JustStartMode from "@/components/Focus/JustStartMode"
import SittingEnd from "@/components/Focus/SittingEnd"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { useTodoTime } from "../use-todo-time"
import { putSession } from "./drafts"
import { EstBar, EstDelta, EstEdit, lineEst } from "./estimate-bits"
import { fmtClock, fmtMinutes } from "./format"
import { FutureNoteInput } from "./future-note"
import { SESSION_CLOCK_DEFAULT, useSessionView } from "./session-view-prefs"
import { useNow } from "./use-now"

type Suggestion = { kind: "random" | "shortest"; lineId: string; seen: string[] }

/**
 * Run (redesign 2026-10-22, after Tidy's "Working the plan"): a calm clock on
 * top, what you are on now, then every line in its tier with Est and Actual
 * side by side. You pick: ▶ on any line, or **Random task** / **Next shortest
 * task** for a suggestion. ⏸ holds the clock, ■ lets go of the line (its time
 * is kept), Done ticks it.
 */
function RunView({ plan, tasks, onChange }: { plan: SessionPlan; tasks: Task[]; onChange: (plan: SessionPlan) => void }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const { settle } = useTodoTime(tasks)
  const now = useNow(true)
  const [justStart, setJustStart] = useState<{ taskId: string; stepId?: string } | null>(null)
  const [parking, setParking] = useState<string | null>(null)
  const [suggest, setSuggest] = useState<Suggestion | null>(null)
  const taskClock = useTaskClockStarter()
  const penSession = usePenColorSessionStore((s) => s.session)
  const pauseAsk = usePauseReason()

  const left = remainingSec(plan, now)
  const paused = !plan.clock?.running
  const reached = tierReached(plan, tasks, now)
  const reachedRank = reached === "none" ? -1 : SESSION_TIERS.findIndex((t) => t.id === reached)
  const lines = allLines(plan)
  const current = lines.find(({ line }) => line.id === plan.activeLineId)?.line
  const timebox = isTimebox(plan)
  const due = breakDue(plan, now)
  const focus = current ? lineFocusStep(current, tasks) : null
  const focusStep = focus?.kind === "step" ? focus.step : undefined
  const open = lines.filter(({ line }) => !lineIsDone(line, tasks))
  const plannedMin = lines.reduce((sum, { line }) => sum + lineEst(line, tasks), 0)
  const workedSec = lines.reduce((sum, { line }) => sum + lineSeconds(plan, line, now), 0)
  const suggested = suggest ? lines.find(({ line }) => line.id === suggest.lineId)?.line : undefined

  // The current step rides the pen clock when the session paints.
  useEffect(() => {
    if (!plan.paint || !current || paused) return
    const live = usePenColorSessionStore.getState().session
    if (live?.taskId === current.taskId && live.stepId === (focusStep?.id ?? current.stepId)) return
    taskClock.start(current.taskId, focusStep?.id ?? current.stepId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.paint, current?.id, focusStep?.id, paused])

  /** Tick one step inside a line. On the step you are on, you move to the next step (or the next line when this one is done). */
  const finishStepOf = (line: SessionLine, stepId: string) => {
    const task = tasks.find((t) => t.id === line.taskId)
    if (!task) return
    const row = penSession?.taskId === task.id ? activeNowObjectives(penSession.nowObjectives).find((o) => o.stepId === stepId) : undefined
    if (row) togglePenColorNowObjectiveComplete(row.id)
    else updateTask({ ...task, subtasks: settle(task, finishStep(task.subtasks, stepId, undefined)) })
    const latest = useTaskStore.getState().tasks
    if (lineIsDone(line, latest)) return onChange(finishLine(plan, line.id, latest, new Date()))
    if (line.id !== plan.activeLineId || focusStep?.id !== stepId) return onChange(plan)
    const next = lineFocusStep({ ...line, focusStepId: undefined }, latest)
    onChange(focusLineStep(plan, line.id, next?.kind === "step" ? next.step.id : undefined, new Date()))
  }

  const stepDone = () => {
    if (current && focusStep) finishStepOf(current, focusStep.id)
  }

  /** A leaf's estimate lives on the task; a line with steps keeps its own session estimate. */
  const saveLineEst = (line: SessionLine, minutes: number) => {
    const { task, step } = lineTarget(line, tasks)
    if (task && !(step ? step.subtasks : task.subtasks)?.length) {
      if (step) updateTask({ ...task, subtasks: updateNestedStep(task.subtasks, step.id, { estimatedDuration: minutes || undefined }) })
      else updateTask({ ...task, estimatedDuration: minutes || undefined })
    }
    onChange(setLineEstimate(plan, line.id, minutes))
  }

  const saveStepEst = (line: SessionLine, stepId: string, minutes: number) => {
    const task = tasks.find((t) => t.id === line.taskId)
    if (task) updateTask({ ...task, subtasks: updateNestedStep(task.subtasks, stepId, { estimatedDuration: minutes || undefined }) })
  }

  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({})
  const [view, setView] = useSessionView()
  const [settingsOpen, setSettingsOpen] = useState(false)

  /** Tick a whole line: the current one moves you on, any other leaves you where you are. */
  const lineDone = (line: SessionLine) => {
    const { task, step } = lineTarget(line, tasks)
    if (task && step && !step.completed) updateTask({ ...task, subtasks: settle(task, finishStep(task.subtasks, step.id, undefined)) })
    if (task && !step && !task.completed) completeTask(task.id)
    if (suggest?.lineId === line.id) setSuggest(null)
    onChange(finishLine(plan, line.id, useTaskStore.getState().tasks, new Date()))
  }

  /** ▶ on a line: you start on its next step (Just Start's pick), so that step is timed too. */
  const play = (lineId: string) => {
    if (suggest?.lineId === lineId) setSuggest(null)
    const line = lines.find(({ line }) => line.id === lineId)?.line
    const pick = line ? lineFocusStep({ ...line, focusStepId: undefined }, tasks) : null
    onChange(pick?.kind === "step" ? playStep(plan, lineId, pick.step.id, new Date()) : playLine(plan, lineId, new Date()))
  }

  /** ■: let go of the line. A painting session also lets go of the Tracking pen clock. */
  const stop = () => {
    releasePenClock([plan])
    onChange(stopLine(plan, new Date()))
  }

  const holdOrGo = () => {
    if (paused) {
      onChange(resumeSession(plan, new Date()))
      return
    }
    if (!linkedPenIsRunning(plan)) {
      onChange(pauseSession(plan, new Date()))
      return
    }
    void pauseAsk.ask().then((reason) => {
      if (!reason) return
      queuePauseReason(reason)
      onChange(pauseSession(plan, new Date()))
      takeQueuedPauseReason()
    })
  }

  const offer = (kind: Suggestion["kind"], again = false) => {
    const seen = again && suggest?.kind === kind ? suggest.seen : []
    const skip = [...seen, ...(plan.activeLineId ? [plan.activeLineId] : [])]
    let pick = kind === "random" ? randomLine(plan, tasks, skip) : shortestLine(plan, tasks, skip)
    // Went through them all: start the round again.
    let nextSeen = seen
    if (!pick && seen.length) {
      nextSeen = []
      pick = kind === "random" ? randomLine(plan, tasks, plan.activeLineId ? [plan.activeLineId] : []) : shortestLine(plan, tasks, plan.activeLineId ? [plan.activeLineId] : [])
    }
    setSuggest(pick ? { kind, lineId: pick.id, seen: [...nextSeen, pick.id] } : { kind, lineId: "", seen: [] })
  }

  const park = () => {
    putSession(parkSession(plan, new Date(), parking ?? undefined))
    setParking(null)
  }

  const end = () => {
    releasePenClock([plan])
    onChange(endSession(plan, tasks, new Date()))
  }

  // End of sitting (Phase 15 A): End pauses, shows "Sat 52m. Left it here:", then ends on Keep or Skip.
  const [sat, setSat] = useState<{ minutes: number; taskId: string } | null>(null)
  const endToStrip = () => {
    const taskId = (current ?? open[0]?.line)?.taskId
    if (!taskId || !tasks.some((t) => t.id === taskId)) return end()
    setSat({ minutes: elapsedMin(plan, new Date()), taskId })
    if (!paused) onChange(pauseSession(plan, new Date()))
  }

  const currentSec = current ? lineSeconds(plan, current, now) : 0
  const currentEst = current ? lineEst(current, tasks) : 0

  return (
    <div className="todo-session-run" style={{ "--ses-clock": view.clockColor } as CSSProperties}>
      <section className={`ses-hero${left < 0 ? " is-over" : ""}${paused ? " is-paused" : ""}`} aria-label="Session clock">
        <div className="ses-clock" aria-live="off">
          {fmtClock(left)}
        </div>
        <p className="ses-clock-label">{left < 0 ? "Over time" : paused ? "Paused" : "Time left"}</p>
        <div className="ses-transport">
          <DvdTransportKey className="ses-dvd is-big" mark={paused ? "play" : "pause"} label={paused ? "Resume session" : "Pause session"} onClick={holdOrGo} />
          <button type="button" data-no95 className="ses-key is-mod" onClick={() => onChange(extendSession(plan, 15, new Date()))}>
            +15
          </button>
          <button
            type="button"
            data-no95
            className={`ses-key is-mod${parking !== null ? " is-on" : ""}`}
            aria-pressed={parking !== null}
            title="Put it down and take it up later"
            onClick={() => setParking(parking === null ? (plan.futureNote?.text ?? "") : null)}
          >
            Park
          </button>
          <button type="button" data-no95 className="ses-key is-mod" onClick={endToStrip}>
            End
          </button>
          <button type="button" data-no95 className={`ses-key is-mod${settingsOpen ? " is-on" : ""}`} aria-pressed={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>
            Settings
          </button>
        </div>
        {settingsOpen ? (
          <div className="ses-settings" role="group" aria-label="Session settings">
            <label className="ses-setting is-name">
              Name
              <input value={plan.title} placeholder="Name this session" aria-label="Session name" onChange={(e) => onChange({ ...plan, title: e.target.value })} />
            </label>
            <label className="ses-setting">
              Timer colour
              <input type="color" value={view.clockColor} aria-label="Timer colour" onChange={(e) => setView({ clockColor: e.target.value })} />
            </label>
            {view.clockColor !== SESSION_CLOCK_DEFAULT ? (
              <button type="button" data-no95 className="ses-key is-mod is-small" onClick={() => setView({ clockColor: SESSION_CLOCK_DEFAULT })}>
                Back to mint
              </button>
            ) : null}
            <label className="ses-setting">
              <input type="checkbox" checked={view.hideDone} onChange={(e) => setView({ hideDone: e.target.checked })} />
              Hide finished tasks
            </label>
            <label className="ses-setting">
              <input type="checkbox" checked={view.showBars} onChange={(e) => setView({ showBars: e.target.checked })} />
              Estimate bars
            </label>
          </div>
        ) : null}
        <div className="ses-summary">
          <span>
            Planned <b>{fmtMinutes(plannedMin)}</b>
          </span>
          <span>
            Worked <b>{fmtClock(workedSec)}</b>
          </span>
          <span>
            Done <b>{lines.length - open.length}</b>/{lines.length}
          </span>
          <span className="ses-lamps" role="group" aria-label="Tiers reached">
            {SESSION_TIERS.map(({ id, label }, i) => (
              <span key={id} className={`ses-lamp is-${id}${i <= reachedRank ? " is-lit" : ""}`} title={i <= reachedRank ? `${label} reached` : label}>
                <span className="ses-lamp-glass" aria-hidden />
                {label}
              </span>
            ))}
          </span>
        </div>
      </section>

      {sat ? (
        <SittingEnd
          paper
          task={tasks.find((t) => t.id === sat.taskId)}
          minutes={sat.minutes}
          onDone={() => {
            setSat(null)
            end()
          }}
        />
      ) : null}
      {parking !== null ? (
        <div className="todo-session-ask" role="group" aria-label="Park the session">
          <FutureNoteInput value={parking} onChange={setParking} />
          <button type="button" className="todo-btn is-primary" onClick={park}>
            Park now
          </button>
          <button type="button" className="todo-btn" onClick={() => setParking(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      {left <= 0 ? (
        <p className="todo-session-timeup">
          {timebox ? "Time's up. That counted: Bare minimum reached. End and review, or add 15 minutes." : "Time is up. End and review, or add 15 minutes."}
        </p>
      ) : null}
      {due ? (
        <div className="todo-session-ask" role="group" aria-label="Break">
          <span>Break · {fmtMinutes(plan.breakMin ?? 5)}</span>
          <button type="button" className="todo-btn is-primary" onClick={() => onChange(settleBreak(plan, true, new Date()))}>
            Take it
          </button>
          <button type="button" className="todo-btn" onClick={() => onChange(settleBreak(plan, false, new Date()))}>
            Skip
          </button>
        </div>
      ) : null}

      {current ? (
        <section className={`ses-now${paused ? " is-paused" : ""}`} aria-label="Now">
          <p className="ses-now-eyebrow">{paused ? "Paused on" : "Now"} · {lineLabel(current, tasks)}</p>
          <h3 className="ses-now-step">
            {focusStep ? focusStep.description : focus?.kind === "needs-estimates" ? "Estimate a step to start" : focus?.kind === "blocked" ? "Every open step is waiting" : "This line is ready to close"}
          </h3>
          <div className="ses-now-numbers">
            <span className="ses-num">
              <span className="ses-num-label">Est</span>
              <span className="ses-num-val">
                <EstEdit minutes={currentEst} label={lineLabel(current, tasks)} onSave={(m) => saveLineEst(current, m)} />
              </span>
            </span>
            <span className="ses-num">
              <span className="ses-num-label">Actual</span>
              <span className={`ses-num-val is-live${currentEst && currentSec > currentEst * 60 ? " is-over" : ""}`}>{fmtClock(currentSec)}</span>
            </span>
            {focusStep && focusStep.id !== current.stepId ? (
              <span className="ses-num">
                <span className="ses-num-label">This step</span>
                <span className="ses-num-val">
                  <EstEdit minutes={focusStep.estimatedDuration ?? 0} label={focusStep.description} onSave={(m) => saveStepEst(current, focusStep.id, m)} />
                </span>
              </span>
            ) : null}
            <EstDelta estMin={currentEst} actualSec={currentSec} done={false} />
            {penSession?.taskId === current.taskId ? <span className="ses-now-pen">on the pen clock</span> : null}
          </div>
          {view.showBars ? <EstBar estMin={currentEst} actualSec={currentSec} /> : null}
          <div className="ses-now-keys">
            <DvdTransportKey className="ses-dvd" mark={paused ? "play" : "pause"} label={paused ? "Resume this task" : "Pause this task"} onClick={holdOrGo} />
            <DvdTransportKey className="ses-dvd" mark="stop" label="Stop this task" onClick={stop} />
            <button type="button" data-no95 className="ses-key is-primary" disabled={!focusStep} onClick={stepDone}>
              Step done
            </button>
            <button type="button" data-no95 className="ses-key" onClick={() => lineDone(current)}>
              Task done
            </button>
            <button type="button" data-no95 className="ses-key is-mod" onClick={() => setJustStart({ taskId: current.taskId, stepId: focusStep?.id })}>
              Just start
            </button>
            <label className="ses-paint">
              <input type="checkbox" checked={!!plan.paint} onChange={(e) => onChange({ ...plan, paint: e.target.checked })} />
              Paint on Tracking
            </label>
          </div>
        </section>
      ) : (
        <section className="ses-now is-idle" aria-label="Now">
          <h3 className="ses-now-step">
            {open.length ? "Pick what's next." : timebox ? "Every line is done. Stay with the clock." : "Every line is done."}
          </h3>
          <p className="ses-now-hint">
            {open.length
              ? "Press ▶ on any task below, or let a button choose one for you."
              : timebox
                ? `Bare minimum is showing up for ${fmtMinutes(plan.durationMin)}.`
                : "Nice work. End when you are ready to see how it went."}
          </p>
          {!open.length && !timebox ? (
            <div className="ses-now-keys">
              <button type="button" data-no95 className="ses-key is-primary" onClick={end}>
                End and review
              </button>
            </div>
          ) : null}
        </section>
      )}

      {open.length ? (
        <section className="ses-suggest" aria-label="Suggestions">
          <span className="ses-suggest-label">Not sure?</span>
          <button type="button" data-no95 className={`ses-key${suggest?.kind === "random" ? " is-on" : ""}`} onClick={() => offer("random")}>
            Random task
          </button>
          <button type="button" data-no95 className={`ses-key${suggest?.kind === "shortest" ? " is-on" : ""}`} onClick={() => offer("shortest")}>
            Next shortest task
          </button>
          {suggest ? (
            <div className="ses-suggest-card" role="status">
              {suggested ? (
                <>
                  <span className="ses-suggest-text">
                    Try <b>{lineLabel(suggested, tasks)}</b>
                    {lineEst(suggested, tasks) ? ` · Est ${fmtMinutes(lineEst(suggested, tasks))}` : " · no estimate"}
                  </span>
                  <button type="button" data-no95 className="ses-key is-primary" onClick={() => play(suggested.id)}>
                    ▶ Start this
                  </button>
                  <button type="button" data-no95 className="ses-key is-mod" onClick={() => offer(suggest.kind, true)}>
                    Another
                  </button>
                </>
              ) : (
                <span className="ses-suggest-text">Nothing else is open right now.</span>
              )}
              <button type="button" data-no95 className="ses-key is-mod" aria-label="Dismiss suggestion" onClick={() => setSuggest(null)}>
                ✕
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="ses-tiers">
        {SESSION_TIERS.map(({ id: tier, label }, i) => {
          const tierLines = plan.tiers[tier]
          const est = tierLines.reduce((sum, line) => sum + lineEst(line, tasks), 0)
          const actual = tierLines.reduce((sum, line) => sum + lineSeconds(plan, line, now), 0)
          const doneCount = tierLines.filter((line) => lineIsDone(line, tasks)).length
          return (
            <section key={tier} className={`ses-tier is-${tier}${i <= reachedRank ? " is-reached" : ""}`} aria-label={label}>
              <header className="ses-tier-head">
                <h4>{label}</h4>
                <span className="ses-tier-figs">
                  <span>
                    <b>{fmtMinutes(est)}</b> est
                  </span>
                  <span>
                    <b>{fmtClock(actual)}</b> actual
                  </span>
                  {tierLines.length ? (
                    <span>
                      <b>{doneCount}</b>/{tierLines.length} done
                    </span>
                  ) : null}
                </span>
                {i <= reachedRank ? <span className="ses-tier-reached">Reached</span> : null}
              </header>
              {tierLines.length ? (
                <ul className="ses-lines">
                  {tierLines.map((line) => {
                    const name = lineLabel(line, tasks)
                    const done = lineIsDone(line, tasks)
                    if (done && view.hideDone) return null
                    const blocked = !done && lineIsBlocked(line, tasks)
                    const isCurrent = line.id === plan.activeLineId
                    const sec = lineSeconds(plan, line, now)
                    const lineEstMin = lineEst(line, tasks)
                    const pct = done ? null : linePercent(line, tasks)
                    const target = lineTarget(line, tasks)
                    const kids = target.step ? target.step.subtasks : target.task?.subtasks
                    const hasSteps = !!kids?.length
                    const stepsOpen = hasSteps && (openSteps[line.id] ?? isCurrent)
                    return (
                      <li
                        key={line.id}
                        className={`ses-line${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}${blocked ? " is-blocked" : ""}${suggested?.id === line.id ? " is-suggested" : ""}`}
                      >
                        <span className="ses-line-ctl">
                          {done ? (
                            <span className="ses-line-check" role="img" aria-label="Done">
                              ✓
                            </span>
                          ) : isCurrent ? (
                            <>
                              <DvdTransportKey className="ses-dvd" mark={paused ? "play" : "pause"} label={paused ? `Resume ${name}` : `Pause ${name}`} onClick={holdOrGo} />
                              <DvdTransportKey className="ses-dvd" mark="stop" label={`Stop ${name}`} onClick={stop} />
                            </>
                          ) : (
                            <DvdTransportKey className="ses-dvd" mark="play" label={`Start ${name}`} disabled={blocked} onClick={() => play(line.id)} />
                          )}
                        </span>
                        <span className="ses-line-body">
                          <span className="ses-line-name">
                            {hasSteps ? (
                              <button
                                type="button"
                                data-no95
                                className="ses-twisty"
                                aria-expanded={stepsOpen}
                                aria-label={`${stepsOpen ? "Hide" : "Show"} steps of ${name}`}
                                onClick={() => setOpenSteps((o) => ({ ...o, [line.id]: !stepsOpen }))}
                              >
                                {stepsOpen ? "▾" : "▸"}
                              </button>
                            ) : null}
                            {name}
                          </span>
                          <span className="ses-line-meta">
                            <span>
                              Est <EstEdit minutes={lineEstMin} label={name} onSave={(m) => saveLineEst(line, m)} />
                            </span>
                            {isCurrent || sec >= 1 ? (
                              <span>
                                Actual <b className={isCurrent && !paused ? "is-live" : ""}>{fmtClock(sec)}</b>
                              </span>
                            ) : null}
                            <EstDelta estMin={lineEstMin} actualSec={sec} done={done} />
                            {pct !== null && pct > 0 ? <span>{formatPercent(pct)} of steps</span> : null}
                            {blocked ? <span className="ses-line-wait">waiting on another task</span> : null}
                          </span>
                          {view.showBars && !done && (isCurrent || sec >= 1) ? <EstBar estMin={lineEstMin} actualSec={sec} /> : null}
                          {stepsOpen && target.task ? (
                            <ul className="ses-steps" aria-label={`Steps of ${name}`}>
                              {placeSteps(kids).map(({ step: st, path }) => {
                                const leaf = !st.subtasks?.length
                                const onIt = isCurrent && focusStep?.id === st.id
                                const stSec = stepSeconds(plan, line, st.id, now)
                                const ready = isStepAvailable(target.task!.subtasks, st.id)
                                return (
                                  <li
                                    key={st.id}
                                    className={`ses-step${st.completed ? " is-done" : ""}${onIt ? " is-current" : ""}${leaf ? "" : " is-group"}`}
                                    style={{ paddingLeft: 8 + path.length * 18 }}
                                  >
                                    <span className="ses-line-ctl">
                                      {!leaf ? null : st.completed ? (
                                        <span className="ses-line-check is-small" role="img" aria-label="Done">
                                          ✓
                                        </span>
                                      ) : onIt ? (
                                        <>
                                          <DvdTransportKey className="ses-dvd is-small" mark={paused ? "play" : "pause"} label={paused ? `Resume ${st.description}` : `Pause ${st.description}`} onClick={holdOrGo} />
                                          <DvdTransportKey className="ses-dvd is-small" mark="stop" label={`Stop ${st.description}`} onClick={stop} />
                                        </>
                                      ) : (
                                        <DvdTransportKey
                                          className="ses-dvd is-small"
                                          mark="play"
                                          label={`Start ${st.description}`}
                                          disabled={!ready || blocked}
                                          onClick={() => onChange(playStep(plan, line.id, st.id, new Date()))}
                                        />
                                      )}
                                    </span>
                                    <span className="ses-line-body">
                                      <span className="ses-step-name">{st.description}</span>
                                      {leaf ? (
                                        <span className="ses-line-meta">
                                          <span>
                                            Est <EstEdit minutes={st.estimatedDuration ?? 0} label={st.description} onSave={(m) => saveStepEst(line, st.id, m)} />
                                          </span>
                                          {onIt || stSec >= 1 ? (
                                            <span>
                                              Actual <b className={onIt && !paused ? "is-live" : ""}>{fmtClock(stSec)}</b>
                                            </span>
                                          ) : null}
                                          <EstDelta estMin={st.estimatedDuration ?? 0} actualSec={stSec} done={!!st.completed} />
                                          {!st.completed && !ready ? <span className="ses-line-wait">waiting on another step</span> : null}
                                        </span>
                                      ) : null}
                                    </span>
                                    {leaf && !st.completed ? (
                                      <button type="button" data-no95 className="ses-key is-mod is-small" aria-label={`Done: ${st.description}`} onClick={() => finishStepOf(line, st.id)}>
                                        Done
                                      </button>
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </span>
                        {!done ? (
                          <button type="button" data-no95 className="ses-key is-mod ses-line-done" aria-label={`Done: ${name}`} title="Mark done" onClick={() => lineDone(line)}>
                            Done
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="ses-tier-empty">Nothing in this tier.</p>
              )}
            </section>
          )
        })}
      </div>
      {taskClock.picker}
      {pauseAsk.dialog}
      {/* Portaled: the dialog's transform would trap Just Start's fixed overlay. */}
      {justStart && typeof document !== "undefined"
        ? createPortal(<JustStartMode taskId={justStart.taskId} stepId={justStart.stepId} onClose={() => setJustStart(null)} />, document.body)
        : null}
    </div>
  )
}

export { RunView }
