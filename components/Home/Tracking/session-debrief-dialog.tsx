/**
 * components/Home/Tracking/session-debrief-dialog.tsx
 *
 * After Working on now stops, one sheet for the sitting that just passed:
 * estimates against the minutes, when each step was worked, completion,
 * the log note, a note for next time, satisfaction, energy, and what got
 * in the way. Done writes them. Close leaves the clock's log as it is.
 *
 * `SessionDebriefHost` is mounted once on the app page.
 */
"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import {
  saveSessionDebrief,
  versusLabel,
  type DebriefStepEdit,
  type SessionDebriefDraft,
  type SittingEnergy,
} from "@/lib/session-debrief"
import { useSessionDebriefStore } from "@/lib/session-debrief-store"
import "./session-debrief.css"

const SATISFACTION: { value: number; word: string }[] = [
  { value: 1, word: "Little" },
  { value: 2, word: "Some" },
  { value: 3, word: "Enough" },
  { value: 4, word: "Good" },
  { value: 5, word: "Full" },
]

const ENERGY: { value: SittingEnergy; word: string }[] = [
  { value: "low", word: "Low" },
  { value: "steady", word: "Steady" },
  { value: "high", word: "High" },
]

function readMinutes(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function minutesField(value: number | null): string {
  return value == null ? "" : String(value)
}

function versusClass(label: string): string {
  if (label.endsWith("over")) return "trk-debrief-over"
  if (label.endsWith("under")) return "trk-debrief-under"
  return ""
}

function SessionDebriefDialog({ draft }: { draft: SessionDebriefDraft }) {
  const dismiss = useSessionDebriefStore((state) => state.dismiss)
  const [note, setNote] = useState(draft.note)
  const [handoff, setHandoff] = useState("")
  const [handoffTask, setHandoffTask] = useState(Boolean(draft.taskId))
  const [handoffPen, setHandoffPen] = useState(Boolean(draft.penId))
  const [satisfaction, setSatisfaction] = useState<number | undefined>(undefined)
  const [energy, setEnergy] = useState<SittingEnergy | undefined>(undefined)
  const [blocker, setBlocker] = useState("")
  const [taskCompleted, setTaskCompleted] = useState(draft.taskCompleted)
  const [taskEstimate, setTaskEstimate] = useState(minutesField(draft.taskEstimate))
  const [logMinutes, setLogMinutes] = useState(String(draft.activeMinutes))
  const [steps, setSteps] = useState(() =>
    draft.steps.map((step) => ({
      stepId: step.stepId,
      completed: step.completed,
      estimated: minutesField(step.estimated),
    })),
  )

  const started = new Date(draft.startedAt)
  const ended = new Date(draft.endedAt)
  const when =
    Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())
      ? ""
      : `${started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–${ended.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
  const touched = draft.steps.filter((step) => (step.sittingMinutes ?? 0) > 0 && readMinutes(steps.find((row) => row.stepId === step.stepId)?.estimated ?? "") != null)
  const touchedEstimate = touched.reduce((sum, step) => sum + (readMinutes(steps.find((row) => row.stepId === step.stepId)?.estimated ?? "") ?? 0), 0)
  const touchedSpent = touched.reduce((sum, step) => sum + (step.sittingMinutes ?? 0), 0)
  const touchedVersus = touched.length ? versusLabel(touchedEstimate, touchedSpent) : ""

  const done = () => {
    const edits: DebriefStepEdit[] = steps.map((step) => ({
      stepId: step.stepId,
      completed: step.completed,
      estimated: readMinutes(step.estimated),
    }))
    saveSessionDebrief(draft, {
      note,
      handoff,
      handoffTask,
      handoffPen,
      satisfaction,
      energy,
      blocker,
      taskCompleted,
      taskEstimate: readMinutes(taskEstimate),
      logMinutes: readMinutes(logMinutes) ?? draft.activeMinutes,
      steps: edits,
    })
    dismiss()
  }

  const setStep = (stepId: string, patch: Partial<(typeof steps)[number]>) => {
    setSteps((rows) => rows.map((row) => (row.stepId === stepId ? { ...row, ...patch } : row)))
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="trk-debrief-back" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <div
        className="trk-debrief"
        role="dialog"
        aria-labelledby="trk-debrief-title"
        data-testid="session-debrief"
        data-ui-name="Sitting review"
      >
        <header className="trk-debrief-head">
          {draft.penColor ? <span className="trk-debrief-swatch" style={{ background: draft.penColor }} aria-hidden /> : null}
          <div>
            <h2 id="trk-debrief-title" className="trk-debrief-title">
              This sitting
            </h2>
            <p className="trk-debrief-path">{draft.path}</p>
            <p className="trk-debrief-when">
              {when}
              {draft.penName ? ` · ${draft.penName}` : ""}
            </p>
          </div>
        </header>
        <div className="trk-debrief-body">
          <div className="trk-debrief-log">
            <label>
              Logged
              <input
                aria-label="Minutes logged for this sitting"
                inputMode="numeric"
                value={logMinutes}
                onChange={(event) => setLogMinutes(event.target.value)}
              />
              m
            </label>
            <p className="trk-debrief-caption">The painted block stays. This number is the log.</p>
          </div>

          {draft.taskId ? (
            <section className="trk-debrief-section">
              <h3 className="trk-debrief-k">Task and steps</h3>
              <div className="trk-debrief-task">
                <input
                  type="checkbox"
                  aria-label={`${draft.taskTitle} completed`}
                  checked={taskCompleted}
                  onChange={(event) => setTaskCompleted(event.target.checked)}
                />
                <span className="trk-debrief-name">{draft.taskTitle}</span>
                <div className="trk-debrief-meta">
                  <label>
                    est
                    <input
                      className="trk-debrief-est"
                      aria-label="Task estimate in minutes"
                      inputMode="numeric"
                      value={taskEstimate}
                      onChange={(event) => setTaskEstimate(event.target.value)}
                    />
                  </label>
                  <span>sat {draft.activeMinutes}m</span>
                  {versusLabel(readMinutes(taskEstimate), draft.activeMinutes) ? (
                    <span className={versusClass(versusLabel(readMinutes(taskEstimate), draft.activeMinutes))}>
                      {versusLabel(readMinutes(taskEstimate), draft.activeMinutes)}
                    </span>
                  ) : null}
                </div>
              </div>
              {draft.steps.map((step) => {
                const edit = steps.find((row) => row.stepId === step.stepId)
                const estimated = readMinutes(edit?.estimated ?? "")
                const versus = versusLabel(estimated, step.sittingMinutes)
                return (
                  <div key={step.stepId} className="trk-debrief-step" style={{ marginLeft: step.depth * 12 }}>
                    <input
                      type="checkbox"
                      aria-label={`${step.label} completed`}
                      checked={edit?.completed ?? false}
                      onChange={(event) => setStep(step.stepId, { completed: event.target.checked })}
                    />
                    <span className="trk-debrief-name">{step.label}</span>
                    <div className="trk-debrief-meta">
                      <label>
                        est
                        <input
                          className="trk-debrief-est"
                          aria-label={`${step.label} estimate in minutes`}
                          inputMode="numeric"
                          value={edit?.estimated ?? ""}
                          onChange={(event) => setStep(step.stepId, { estimated: event.target.value })}
                        />
                      </label>
                      <span>{step.sittingMinutes == null ? "sat —" : `sat ${step.sittingMinutes}m`}</span>
                      {step.when ? <span>{step.when}</span> : null}
                      {versus ? <span className={versusClass(versus)}>{versus}</span> : null}
                    </div>
                  </div>
                )
              })}
              {touchedVersus ? (
                <p className="trk-debrief-caption">
                  Steps you spent time on: {touchedVersus === "even" ? "even with the estimates" : `${touchedVersus} the estimates`}.
                </p>
              ) : null}
            </section>
          ) : null}

          {draft.objectives.length ? (
            <section className="trk-debrief-section">
              <h3 className="trk-debrief-k">Objectives this sitting</h3>
              <ul className="trk-debrief-obj">
                {draft.objectives.map((row, index) => (
                  <li key={`${row.text}-${index}`} className={row.completed ? "is-done" : undefined}>
                    {row.completed ? "Done" : "Open"} · {row.text}
                    {row.minutes != null ? ` · ${row.minutes}m` : ""}
                    {row.when ? ` · ${row.when}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <label className="trk-debrief-section">
            <span className="trk-debrief-k">Note on this sitting</span>
            <textarea className="trk-debrief-area" aria-label="Note on this sitting" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          <fieldset className="trk-debrief-section">
            <legend>Anything to pass on to the next time?</legend>
            <textarea
              className="trk-debrief-area"
              aria-label="Note for the next time"
              value={handoff}
              onChange={(event) => setHandoff(event.target.value)}
              placeholder="Shown when you start this again"
            />
            <div className="trk-debrief-checks">
              {draft.taskId ? (
                <label>
                  <input type="checkbox" checked={handoffTask} onChange={(event) => setHandoffTask(event.target.checked)} />
                  Next time you work on this {draft.kind === "operation" ? "operation" : "task"}
                </label>
              ) : null}
              {draft.penId ? (
                <label>
                  <input type="checkbox" checked={handoffPen} onChange={(event) => setHandoffPen(event.target.checked)} />
                  Next time you use {draft.penName ? draft.penName : "this pen"}
                </label>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="trk-debrief-section">
            <legend>How satisfied are you with what you got done?</legend>
            <div className="trk-debrief-scale" role="radiogroup" aria-label="Satisfaction with this sitting">
              {SATISFACTION.map((mark) => (
                <button
                  key={mark.value}
                  type="button"
                  aria-pressed={satisfaction === mark.value}
                  onClick={() => setSatisfaction((current) => (current === mark.value ? undefined : mark.value))}
                >
                  {mark.value} {mark.word}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="trk-debrief-section">
            <legend>Energy while you worked</legend>
            <div className="trk-debrief-scale" role="radiogroup" aria-label="Energy while you worked">
              {ENERGY.map((mark) => (
                <button
                  key={mark.value}
                  type="button"
                  aria-pressed={energy === mark.value}
                  onClick={() => setEnergy((current) => (current === mark.value ? undefined : mark.value))}
                >
                  {mark.word}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="trk-debrief-section">
            <span className="trk-debrief-k">What got in the way?</span>
            <input className="trk-debrief-field" aria-label="What got in the way" value={blocker} onChange={(event) => setBlocker(event.target.value)} />
          </label>
        </div>
        <div className="trk-debrief-actions">
          <button type="button" onClick={dismiss}>
            Close
          </button>
          <button type="button" onClick={done}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function SessionDebriefHost() {
  const pending = useSessionDebriefStore((state) => state.pending)
  if (!pending) return null
  return <SessionDebriefDialog draft={pending} />
}
