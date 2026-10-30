"use client"

/**
 * Draft a session: pick list, three tier wells, drag, templates, timebox, breaks, and Start.
 */
import { useMemo, useState, type DragEvent } from "react"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { openTaskCard } from "@/lib/task-card"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import {
  BREAK_EVERY_PRESETS,
  BUILT_IN_TEMPLATES,
  SESSION_DURATION_PRESETS,
  SESSION_TIERS,
  TIMEBOX_DURATION_PRESETS,
  addLine,
  addPrereqAbove,
  allLines,
  breakMinutes,
  cannotStartReason,
  emptySession,
  floorSuggestion,
  isTimebox,
  lineIsDone,
  lineLabel,
  lineMinutes,
  linePercent,
  lineTarget,
  lineUnestimated,
  missingPrereqs,
  moveLine,
  nudgeLine,
  removeLine,
  sessionFit,
  sessionFromTemplate,
  startSession,
  templateFromSession,
  type SessionLine,
  type SessionPlan,
  type SessionTier,
} from "@/lib/session-plan"
import { placeSteps } from "@/lib/next-step"
import { formatPercent } from "@/lib/step-progress"
import { isStepAvailable } from "@/lib/prereqs"
import { hasUnmetDependencies } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { updateNestedStep } from "@/lib/todo-steps"
import { TodoBreakdown } from "../TodoBreakdown"
import { useTodoTime } from "../use-todo-time"
import { setTodoPrefs, useTodoPrefs } from "../todo-prefs"
import { paddedLabel, sessionPaceFactor } from "@/lib/estimate-pace"
import { NativeSelect } from "@/components/ui/native-select"
import { LINE_MIME, REF_MIME, isSessionDrag } from "./drag"
import { findTemplate } from "./drafts"
import { fmtMinutes } from "./format"
import { FutureNoteBanner } from "./future-note"
import { FitGlass } from "./fit-glass"
import { TierKeys } from "./tier-keys"
import { TIER_LABEL, TIER_SHORT } from "./tiers"
import { TimeTube } from "./time-tube"

function DraftView({
  plan,
  tasks,
  periodTasks,
  periodLabel,
  onChange,
}: {
  plan: SessionPlan
  tasks: Task[]
  history: SessionPlan[]
  periodTasks: Task[]
  periodLabel: string
  onChange: (plan: SessionPlan) => void
}) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const [scope, setScope] = useState<"period" | "all">("period")
  const [query, setQuery] = useState("")
  const [onlyBare, setOnlyBare] = useState(false)
  const [onlyReady, setOnlyReady] = useState(false)
  const [openTasks, setOpenTasks] = useState<Set<string>>(() => new Set())
  const [breakdownId, setBreakdownId] = useState<string | null>(null)
  const savedTemplates = useSessionPlanStore((s) => s.templates)
  const saveTemplate = useSessionPlanStore((s) => s.saveTemplate)
  const [templateName, setTemplateName] = useState<string | null>(null)
  const timebox = isTimebox(plan)
  const floor = floorSuggestion(plan, tasks, periodTasks)
  const breaks = breakMinutes(plan)

  const applyTemplate = (id: string) => {
    const template = findTemplate(id, savedTemplates)
    if (!template) return
    const fresh = sessionFromTemplate(template, tasks, new Date())
    // Keep this draft's id and any note to tomorrow-you; take the template's shape and lines.
    onChange({ ...fresh, id: plan.id, createdAt: plan.createdAt, ...(plan.futureNote ? { futureNote: plan.futureNote } : {}) })
  }

  // Your own pace (`lib/estimate-pace.ts`): finished steps and closed lines, or your override.
  const todoTime = useTodoTime(tasks)
  // Padded for you (FN-2): on, each line is weighted by your pace for its pen or list; off, raw estimates.
  const { sessionPadded } = useTodoPrefs()
  const pace = sessionPadded ? sessionPaceFactor(plan, tasks, todoTime.samples, todoTime.paceOverrides) : 1
  const padLabel = sessionPadded ? paddedLabel(pace) : null
  const fit = sessionFit(plan, tasks, pace)
  const reason = cannotStartReason(plan, tasks)
  const missing = missingPrereqs(plan, tasks)
  const tierOf = new Map(allLines(plan).map(({ line, tier }) => [`${line.taskId}|${line.stepId ?? ""}`, tier]))

  const source = useMemo(() => {
    const base = scope === "period" ? periodTasks : tasks.filter((t) => !t.completed && !isClearedFromWork(t))
    const live = base.map((t) => tasks.find((x) => x.id === t.id) ?? t).filter((t) => !t.completed)
    const needle = query.trim().toLowerCase()
    return live.filter((t) => {
      if (onlyReady && hasUnmetDependencies(t, tasks)) return false
      if (onlyBare && lineUnestimated({ taskId: t.id }, tasks) === 0) return false
      if (!needle) return true
      if (itemTitleOrUntitled(t).toLowerCase().includes(needle)) return true
      return placeSteps(t.subtasks).some((p) => p.step.description.toLowerCase().includes(needle))
    })
  }, [scope, periodTasks, tasks, query, onlyBare, onlyReady])

  const add = (tier: SessionTier, ref: { taskId: string; stepId?: string }) => onChange(addLine(plan, tier, ref, tasks))
  // A tier key latches: pressing the lit one again takes the line back out.
  const toggle = (tier: SessionTier, ref: { taskId: string; stepId?: string }) => {
    const hit = allLines(plan).find(({ line }) => line.taskId === ref.taskId && (line.stepId ?? "") === (ref.stepId ?? ""))
    if (hit && hit.tier === tier) onChange(removeLine(plan, hit.line.id))
    else add(tier, ref)
  }
  const setEstimate = (line: SessionLine, minutes: number) => {
    const { task, step } = lineTarget(line, tasks)
    if (!task) return
    if (step) updateTask({ ...task, subtasks: updateNestedStep(task.subtasks, step.id, { estimatedDuration: minutes }) })
    else updateTask({ ...task, estimatedDuration: minutes })
  }
  const breakdownTask = breakdownId ? tasks.find((t) => t.id === breakdownId) : undefined

  // Drag: a tile moves inside or across tiers; a pick-list row drops in as a new line.
  const [drop, setDrop] = useState<{ tier: SessionTier; index: number } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const dragRef = (e: DragEvent, ref: { taskId: string; stepId?: string }) => {
    e.dataTransfer.setData(REF_MIME, JSON.stringify(ref))
    e.dataTransfer.effectAllowed = "copyMove"
  }
  const dropInto = (e: DragEvent, tier: SessionTier, index: number) => {
    e.preventDefault()
    setDrop(null)
    setDragging(null)
    const lineId = e.dataTransfer.getData(LINE_MIME)
    if (lineId) {
      const hit = allLines(plan).find(({ line }) => line.id === lineId)
      if (!hit) return
      const from = plan.tiers[hit.tier].findIndex((l) => l.id === lineId)
      onChange(moveLine(plan, lineId, tier, hit.tier === tier && from < index ? index - 1 : index))
      return
    }
    const raw = e.dataTransfer.getData(REF_MIME)
    if (!raw) return
    const ref = JSON.parse(raw) as { taskId: string; stepId?: string }
    const next = addLine(plan, tier, ref, tasks)
    const made = next.tiers[tier].find((l) => l.taskId === ref.taskId && l.stepId === ref.stepId)
    onChange(made ? moveLine(next, made.id, tier, index) : next)
  }

  return (
    <div className="todo-session-draft">
      <FutureNoteBanner note={plan.futureNote} />
      <div className="ses-draft-head">
        <fieldset className="ses-group is-name">
          <legend>Session</legend>
          <label className="ses-field">
            <span>Name</span>
            <input value={plan.title} aria-label="Session name" onChange={(e) => onChange({ ...plan, title: e.target.value })} />
          </label>
        </fieldset>
        <fieldset className="ses-group is-time">
          <legend>Time</legend>
          <div className="ses-time">
            <span className="ses-presets" role="group" aria-label="Length">
              {(timebox ? TIMEBOX_DURATION_PRESETS : SESSION_DURATION_PRESETS).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-no95
                  className={`ses-cap is-latch${plan.durationMin === m ? " is-on" : ""}`}
                  aria-pressed={plan.durationMin === m}
                  onClick={() => onChange({ ...plan, durationMin: m })}
                >
                  <i aria-hidden />
                  {fmtMinutes(m)}
                </button>
              ))}
            </span>
            <TimeTube minutes={plan.durationMin} onChange={(m) => onChange({ ...plan, durationMin: m })} />
            <span className="ses-time-opts">
              <label className="todo-session-shape" title="The clock is the commitment">
                <input
                  type="checkbox"
                  checked={timebox}
                  onChange={(e) => onChange(e.target.checked ? { ...plan, shape: "timebox" } : (({ shape: _s, ...rest }) => rest)(plan))}
                />
                Timebox
              </label>
              <label className="todo-session-breaks">
                <span>Breaks</span>
                <NativeSelect
                  aria-label="Break every"
                  value={plan.breakEvery ?? 0}
                  onChange={(e) => {
                    const every = Number(e.target.value)
                    if (every > 0) onChange({ ...plan, breakEvery: every })
                    else onChange((({ breakEvery: _b, breakMin: _m, ...rest }) => rest)(plan))
                  }}
                >
                  <option value={0}>None</option>
                  {BREAK_EVERY_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      5m every {fmtMinutes(m)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </span>
          </div>
        </fieldset>
        <fieldset className="ses-group is-from">
          <legend>Start from</legend>
          <NativeSelect aria-label="Start from template" value="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
            <option value="">Template…</option>
            {[...BUILT_IN_TEMPLATES, ...savedTemplates].map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        </fieldset>
      </div>
      {timebox ? (
        <p className="todo-session-pace">
          Bare minimum is the clock: stay with it for {fmtMinutes(plan.durationMin)} and it counts, whatever gets done. Lines are optional.
        </p>
      ) : null}

      <div className="todo-session-panes">
        <section className="todo-session-pick" aria-label="Pick list">
          <div className="todo-session-pick-bar">
            <NativeSelect aria-label="Which tasks" value={scope} onChange={(e) => setScope(e.target.value as "period" | "all")}>
              <option value="period">{periodLabel}</option>
              <option value="all">All open tasks</option>
            </NativeSelect>
            <input type="search" placeholder="Search tasks and steps" aria-label="Search pick list" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label>
              <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Available now
            </label>
            <label>
              <input type="checkbox" checked={onlyBare} onChange={(e) => setOnlyBare(e.target.checked)} /> Unestimated
            </label>
          </div>
          <div className="ses-pick-cols" aria-hidden>
            <span>
              {scope === "period" ? periodLabel : "All open"} · {source.length} open
            </span>
            <span>Est · add to</span>
          </div>
          <ul className="todo-session-picklist">
            {source.length === 0 ? <li className="todo-empty">Nothing open here.</li> : null}
            {source.map((task) => {
              const expanded = openTasks.has(task.id) || !!query.trim()
              const steps = placeSteps(task.subtasks).filter((p) => !p.step.completed)
              const blocked = hasUnmetDependencies(task, tasks)
              return (
                <li key={task.id} className="todo-session-pickrow">
                  <div className="todo-session-pickline" draggable onDragStart={(e) => dragRef(e, { taskId: task.id })} title="Drag into a tier, or press Min, Goal or Exc">
                    {steps.length ? (
                      <button
                        type="button"
                        data-no95
                        className="todo-step-fold"
                        aria-expanded={expanded}
                        aria-label={expanded ? `Hide steps of ${itemTitleOrUntitled(task)}` : `Show steps of ${itemTitleOrUntitled(task)}`}
                        onClick={() =>
                          setOpenTasks((prev) => {
                            const next = new Set(prev)
                            if (next.has(task.id)) next.delete(task.id)
                            else next.add(task.id)
                            return next
                          })
                        }
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="todo-session-fold-gap" />
                    )}
                    <button
                      type="button"
                      data-no95
                      className="todo-session-pickname is-card"
                      title="Open its task card"
                      aria-label={`Card for ${itemTitleOrUntitled(task)}`}
                      onClick={() => openTaskCard(task.id)}
                    >
                      {itemTitleOrUntitled(task)}
                    </button>
                    {blocked ? <span className="todo-row-lock">waits</span> : null}
                    <span className="todo-session-mins">{lineMinutes({ taskId: task.id }, tasks) ? fmtMinutes(lineMinutes({ taskId: task.id }, tasks)) : "–"}</span>
                    <TierKeys inTier={tierOf.get(`${task.id}|`)} label={itemTitleOrUntitled(task)} onPick={(tier) => toggle(tier, { taskId: task.id })} />
                  </div>
                  {expanded && steps.length ? (
                    <ul className="todo-session-picksteps">
                      {steps
                        .filter((p) => !query.trim() || p.step.description.toLowerCase().includes(query.trim().toLowerCase()) || itemTitleOrUntitled(task).toLowerCase().includes(query.trim().toLowerCase()))
                        .map(({ step, path }) => {
                          const ref = { taskId: task.id, stepId: step.id }
                          const mins = lineMinutes(ref, tasks)
                          return (
                            <li
                              key={step.id}
                              className="todo-session-pickline is-step"
                              style={{ ["--todo-depth" as string]: path.length + 1 }}
                              draggable
                              onDragStart={(e) => dragRef(e, ref)}
                            >
                              <span className="todo-session-pickname">{step.description}</span>
                              {!isStepAvailable(task.subtasks, step.id) ? <span className="todo-row-lock">waits</span> : null}
                              <span className="todo-session-mins">{mins ? fmtMinutes(mins) : "–"}</span>
                              <TierKeys inTier={tierOf.get(`${task.id}|${step.id}`)} label={step.description} onPick={(tier) => toggle(tier, ref)} />
                            </li>
                          )
                        })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="todo-session-tiers" aria-label="Tiers">
          <FitGlass fit={fit} pace={pace} padLabel={padLabel} room={Math.max(0, plan.durationMin - breaks)} durationMin={plan.durationMin} />
          {fit.map((f) => {
            const lines = plan.tiers[f.tier]
            const dropHere = drop?.tier === f.tier
            return (
              <div
                key={f.tier}
                className={`todo-session-tier ses-well is-${f.tier}${dropHere && lines.length === 0 ? " is-drop" : ""}`}
                data-band={f.band}
                onDragOver={(e) => {
                  if (!isSessionDrag(e)) return
                  e.preventDefault()
                  if (drop?.tier !== f.tier || drop.index !== lines.length) setDrop({ tier: f.tier, index: lines.length })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null) && drop?.tier === f.tier) setDrop(null)
                }}
                onDrop={(e) => dropInto(e, f.tier, drop?.tier === f.tier ? drop.index : lines.length)}
              >
                <div className="todo-session-tier-head">
                  <i className="ses-well-lamp" aria-hidden />
                  <span className="todo-session-tier-name">{TIER_LABEL[f.tier]}</span>
                  {f.cumulative > 0 ? (
                    <span className={`ses-well-band is-${f.band}`}>
                      {f.band === "fits" ? "fits" : f.band === "tight" ? "tight" : "over"}
                      {f.band !== "fits" && pace > 1.05 ? " with padding" : ""}
                    </span>
                  ) : null}
                  <span className="ses-well-mins" title={`${fmtMinutes(f.cumulative)} of ${fmtMinutes(plan.durationMin)} up to here`}>
                    {fmtMinutes(f.minutes)}
                  </span>
                </div>
                {f.unestimated ? (
                  <p className="todo-session-warn">
                    {f.unestimated === 1 ? "1 step has no estimate." : `${f.unestimated} steps have no estimate.`}
                  </p>
                ) : null}
                <ul className="todo-session-lines ses-tiles">
                  {lines.length === 0 && f.tier === "min" && floor && !timebox ? (
                    <li className="todo-session-empty todo-session-floor">
                      Smallest step that counts: <i>{floor.label}</i> ({fmtMinutes(floor.minutes)}){" "}
                      <button type="button" data-no95 className="todo-session-tierkey is-add" onClick={() => add("min", { taskId: floor.taskId, stepId: floor.stepId })}>
                        Add
                      </button>
                    </li>
                  ) : lines.length === 0 ? (
                    <li className="todo-session-empty">
                      {timebox && f.tier === "min" ? "The clock is the Bare minimum." : "Drag here, or press a tier key in the list."}
                    </li>
                  ) : null}
                  {lines.map((line, i) => {
                    const mins = lineMinutes(line, tasks)
                    const leafBare = mins === 0
                    const label = lineLabel(line, tasks)
                    const pct = lineIsDone(line, tasks) ? null : linePercent(line, tasks)
                    const dropCls = dropHere && drop.index === i ? " is-drop-before" : dropHere && drop.index === lines.length && i === lines.length - 1 ? " is-drop-after" : ""
                    return (
                      <li
                        key={line.id}
                        className={`todo-session-line ses-tile${lineIsDone(line, tasks) ? " is-done" : ""}${dragging === line.id ? " is-dragging" : ""}${dropCls}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(LINE_MIME, line.id)
                          e.dataTransfer.effectAllowed = "move"
                          setDragging(line.id)
                        }}
                        onDragEnd={() => {
                          setDragging(null)
                          setDrop(null)
                        }}
                        onDragOver={(e) => {
                          if (!isSessionDrag(e)) return
                          e.preventDefault()
                          e.stopPropagation()
                          const box = e.currentTarget.getBoundingClientRect()
                          const index = e.clientY < box.top + box.height / 2 ? i : i + 1
                          if (drop?.tier !== f.tier || drop.index !== index) setDrop({ tier: f.tier, index })
                        }}
                      >
                        <span className="ses-tile-grip" aria-hidden>
                          ⠿
                        </span>
                        <button
                          type="button"
                          data-no95
                          className="todo-session-line-name"
                          title={`${label} · open its steps here`}
                          aria-pressed={breakdownId === line.taskId}
                          onClick={() => setBreakdownId(breakdownId === line.taskId ? null : line.taskId)}
                        >
                          {label}
                        </button>
                        {missing
                          .filter((m) => m.lineId === line.id)
                          .map((m) => (
                            <span key={`${m.ref.taskId}|${m.ref.stepId ?? ""}`} className="todo-session-needs">
                              <span className="todo-row-lock">needs {m.needs}</span>
                              <button type="button" data-no95 className="todo-session-tierkey is-add" onClick={() => onChange(addPrereqAbove(plan, line.id, m.ref, tasks))}>
                                Add {m.needs}
                              </button>
                            </span>
                          ))}
                        {pct == null ? null : <span className="todo-session-pct">{formatPercent(pct)}</span>}
                        <span className="ses-tile-tools">
                          <button type="button" data-no95 className="todo-session-mini" aria-label="Move up" disabled={i === 0} onClick={() => onChange(nudgeLine(plan, line.id, -1))}>
                            ▲
                          </button>
                          <button
                            type="button"
                            data-no95
                            className="todo-session-mini"
                            aria-label="Move down"
                            disabled={i === lines.length - 1}
                            onClick={() => onChange(nudgeLine(plan, line.id, 1))}
                          >
                            ▼
                          </button>
                          <NativeSelect aria-label="Tier" value={f.tier} onChange={(e) => onChange(moveLine(plan, line.id, e.target.value as SessionTier))}>
                            {SESSION_TIERS.map(({ id }) => (
                              <option key={id} value={id}>
                                {TIER_SHORT[id]}
                              </option>
                            ))}
                          </NativeSelect>
                          <button type="button" data-no95 className="todo-session-mini" title="Break down" aria-label={`Break down ${label}`} onClick={() => setBreakdownId(line.taskId)}>
                            ✎
                          </button>
                          <button type="button" data-no95 className="todo-session-mini" aria-label={`Remove ${label}`} onClick={() => onChange(removeLine(plan, line.id))}>
                            ×
                          </button>
                        </span>
                        {line.stepId ? <span className="ses-tile-tag">step</span> : null}
                        {leafBare ? (
                          <input
                            className="todo-session-est"
                            type="number"
                            min={1}
                            placeholder="min"
                            aria-label={`Estimate for ${label}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = Number((e.target as HTMLInputElement).value)
                                if (v > 0) setEstimate(line, v)
                              }
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v > 0) setEstimate(line, v)
                            }}
                          />
                        ) : (
                          <span className="todo-session-mins">{fmtMinutes(mins)}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {missing.length ? (
            <div className="todo-session-missing" role="note">
              <b>Not in this session but needed first:</b> {[...new Set(missing.map((m) => m.needs))].join(", ")}
            </div>
          ) : null}
          {breaks ? (
            <p className="todo-session-pace">{fmtMinutes(breaks)} of breaks set aside; the bar counts the rest.</p>
          ) : null}
          <label className="todo-session-padded">
            <input
              type="checkbox"
              checked={sessionPadded}
              onChange={(e) => setTodoPrefs({ sessionPadded: e.target.checked })}
            />
            Padded for you
            <span className="todo-session-mins">{sessionPadded ? (padLabel ?? "your pace is ×1.0") : "raw estimates"}</span>
          </label>
        </section>
      </div>

      {breakdownTask ? (
        <section className="todo-session-breakdown" aria-label={`Break down ${itemTitleOrUntitled(breakdownTask)}`}>
          <div className="todo-session-breakdown-head">
            <b>{itemTitleOrUntitled(breakdownTask)}</b>
            <button type="button" className="todo-verb" onClick={() => setBreakdownId(null)}>
              Close
            </button>
          </div>
          <TodoBreakdown
            estimate={breakdownTask.estimatedDuration}
            steps={breakdownTask.subtasks}
            onEstimateChange={(minutes) => updateTask({ ...breakdownTask, estimatedDuration: minutes })}
            onStepsChange={(subtasks) => updateTask({ ...breakdownTask, subtasks: todoTime.settle(breakdownTask, subtasks) })}
            time={todoTime.timeOf(breakdownTask.id)}
          />
        </section>
      ) : null}

      <div className="todo-dialog-actions todo-session-actions">
        <label className="todo-session-paint" title="Paint the current step on Tracking">
          <input type="checkbox" checked={!!plan.paint} onChange={(e) => onChange({ ...plan, paint: e.target.checked })} />
          Paint on Tracking
        </label>
        {templateName === null ? (
          <button type="button" data-no95 className="ses-key" onClick={() => setTemplateName(plan.title)} title="Keep this length, shape and lines to start from later">
            Save as template
          </button>
        ) : (
          <span className="todo-session-savetpl">
            <input aria-label="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <button
              type="button"
              data-no95
              className="ses-key is-primary"
              onClick={() => {
                saveTemplate(templateFromSession(plan, templateName))
                setTemplateName(null)
              }}
            >
              Save
            </button>
            <button type="button" data-no95 className="ses-key" onClick={() => setTemplateName(null)}>
              Cancel
            </button>
          </span>
        )}
        <button
          type="button"
          data-no95
          className="ses-key"
          onClick={() =>
            onChange({
              ...emptySession(new Date(), plan.durationMin),
              id: plan.id,
              title: plan.title,
              ...(plan.shape ? { shape: plan.shape } : {}),
              ...(plan.futureNote ? { futureNote: plan.futureNote } : {}),
            })
          }
        >
          Clear
        </button>
        <button
          type="button"
          data-no95
          className="ses-key is-primary"
          disabled={!!reason}
          title={reason ?? "Start the clock"}
          onClick={() => onChange(startSession(plan, tasks, new Date()))}
        >
          <span aria-hidden>▶</span>
          Start
        </button>
      </div>
      {reason ? <p className="todo-session-reason">{reason}</p> : null}
    </div>
  )
}

export { DraftView }
