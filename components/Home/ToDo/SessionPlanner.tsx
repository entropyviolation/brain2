/**
 * components/Home/ToDo/SessionPlanner.tsx — Plan a session, run it, review it
 *
 * One popup (`data-ui-name="Session"`) over `lib/session-plan.ts`:
 * - **Draft** (redesign 2026-10-22): a pick list of every open task and step (this period, or
 *   all open) with Min / Goal / Exc keys, a typed length tube, one fit bar
 *   that B, G and E fill in turn, and three tier wells of tiles you drag.
 *   Bare minimum must be estimated before Start.
 *   **Break down** opens the lid's steps editor for a task in place.
 * - **Run** (redesign 2026-10-22): a big countdown, the line you are on, then
 *   every line in its tier with Est and Actual side by side. ▶ on any line,
 *   or **Random task** / **Next shortest task** to be offered one. ⏸ holds the
 *   clock, ■ lets go of the line, Done ticks it. Optionally the Tracking pen
 *   clock on the current step.
 * - **Review**: estimate vs actual per line, the tier reached and its points,
 *   and what to do with each unfinished line (keep for next session, push,
 *   leave). Save writes a Plan block for the session and files it in history.
 * - **Park** (slice H): the run view's Park key, or **Park** when closing a
 *   running session, puts it down with its line and time left. Starting or
 *   resuming another parks the running one. **Sessions** (caption and fascia)
 *   opens the shelves: Drafts, Parked, Done; a done one opens read-only and
 *   offers **Run again**.
 * - **Slice H2**: templates (built-in Just 25, Morning 90m, Evening 3h, and
 *   **Save as template**), the `"timebox"` shape, break lines, a note to
 *   tomorrow-you at Park and End, a Hofstadter mark on each gauge, the
 *   Bare-minimum floor suggestion, and the flat **Pick list** view
 *   (`startOn="list"`). Requests from outside To Do come through
 *   `lib/session-open-store.ts` and `SessionDock.tsx`.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { openTaskCard } from "@/lib/task-card"
import { liveSession, useSessionPlanStore } from "@/lib/session-plan-store"
import type { SessionOpenRequest } from "@/lib/session-open-store"
import { releasePenClock } from "@/lib/session-pen"
import {
  BREAK_EVERY_PRESETS,
  BUILT_IN_TEMPLATES,
  JUST_25_TEMPLATE_ID,
  SESSION_DURATION_PRESETS,
  SESSION_TIERS,
  TIMEBOX_DURATION_PRESETS,
  addLine,
  breakDue,
  breakMinutes,
  floorSuggestion,
  isTimebox,
  sessionFromTemplate,
  settleBreak,
  templateFromSession,
  allLines,
  cannotStartReason,
  closeSession,
  emptySession,
  endSession,
  extendSession,
  finishLine,
  focusLine,
  keptRefs,
  lineFocusStep,
  lineIsBlocked,
  lineIsDone,
  lineLabel,
  lineMinutes,
  lineSeconds,
  lineTarget,
  lineUnestimated,
  linePercent,
  missingPrereqs,
  addPrereqAbove,
  moveLine,
  nudgeLine,
  parkSession,
  parkedLong,
  pauseSession,
  focusLineStep,
  playLine,
  playStep,
  setLineEstimate,
  stepSeconds,
  randomLine,
  shortestLine,
  stopLine,
  elapsedMin,
  ranMinutes,
  resumeParked,
  runAgain,
  sessionTimeLogs,
  remainingSec,
  removeLine,
  resumeSession,
  sessionFit,
  setLineOutcome,
  startSession,
  tierReached,
  type FutureNote,
  type SessionLine,
  type SessionPlan,
  type SessionTemplate,
  type SessionTier,
} from "@/lib/session-plan"
import { placeSteps, startOrderFor } from "@/lib/next-step"
import { formatPercent } from "@/lib/step-progress"
import { isStepAvailable } from "@/lib/prereqs"
import { hasUnmetDependencies } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { finishStep } from "@/lib/next-step"
import { updateNestedStep } from "@/lib/todo-steps"
import { activeTierPoints } from "@/lib/completion-tiers"
import { usePointsStore } from "@/lib/points-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { placementFromDrop } from "@/lib/planned-actions"
import { formatLocalDateKey } from "@/lib/date-utils"
import { completeTask } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { togglePenColorNowObjectiveComplete } from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import JustStartMode from "@/components/Focus/JustStartMode"
import SittingEnd from "@/components/Focus/SittingEnd"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { SegDigits } from "../dash/dash-primitives"
import { TodoBreakdown } from "./TodoBreakdown"
import { useTodoTime } from "./use-todo-time"
import { setTodoPrefs, useTodoPrefs } from "./todo-prefs"
import { paddedLabel, sessionPaceFactor } from "@/lib/estimate-pace"
import "./session-planner.css"
import { ParkingLotModeKeys, ParkingLotStage } from "./parking-lot/ParkingLot"
import type { LotCar, LotScene } from "./parking-lot/types"
import { NativeSelect } from "@/components/ui/native-select"

const TIER_LABEL: Record<SessionTier, string> = { min: "Bare minimum", goal: "Goal", exceptional: "Exceptional" }
const TIER_SHORT: Record<SessionTier, string> = { min: "Min", goal: "Goal", exceptional: "Exc" }
const TIER_LETTER: Record<SessionTier, string> = { min: "B", goal: "G", exceptional: "E" }

/** Drag payloads in the draft: a line already in a tier, or a task or step from the pick list. */
const LINE_MIME = "application/x-b2-session-line"
const REF_MIME = "application/x-b2-session-ref"
const isSessionDrag = (e: DragEvent) => e.dataTransfer.types.includes(LINE_MIME) || e.dataTransfer.types.includes(REF_MIME)

export function fmtMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function fmtClock(seconds: number): string {
  const over = seconds < 0
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
  return over ? `+${body}` : body
}

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const tick = () => {
      if (!document.hidden) setNow(new Date())
    }
    const id = window.setInterval(tick, 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [active])
  return now
}

export function SessionPlanner({
  open,
  onClose,
  periodTasks,
  periodLabel,
  startOn = "session",
  request,
}: {
  open: boolean
  onClose: () => void
  /** Open tasks on the To Do lens right now. */
  periodTasks: Task[]
  periodLabel: string
  /** `shelves` opens on the Sessions history panel; `list` on the flat pick list. */
  startOn?: "session" | "shelves" | "list"
  /** From another way in: a new draft of this length, template or seed. */
  request?: Omit<SessionOpenRequest, "startOn">
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const openPlans = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const history = useSessionPlanStore((s) => s.history)
  const [view, setView] = useState<"session" | "shelves" | "list">(startOn)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [parkNote, setParkNote] = useState("")

  // Opening shows the live session, else the focused one, else a new draft
  // seeded with lines kept from last time. Only on open: a session saved while
  // the popup is still up must not spawn a new draft.
  useEffect(() => {
    if (!open || startOn !== "session") return
    const store = useSessionPlanStore.getState()
    if (request && (request.durationMin || request.templateId || request.seed?.length)) {
      newDraftFrom(request)
      return
    }
    const live = liveSession(store.open)
    if (live) {
      store.focus(live.id)
      return
    }
    if (store.focusId && store.open.some((p) => p.id === store.focusId)) return
    newDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const plan = openPlans.find((p) => p.id === focusId) ?? null
  const parkedCount = openPlans.filter((p) => p.phase === "parked").length
  const done = doneId ? history.find((p) => p.id === doneId) : undefined
  const update = (next: SessionPlan) => putSession(next)

  const requestClose = () => {
    if (plan?.phase === "run" && view === "session") {
      setParkNote(plan.futureNote?.text ?? "")
      setAsking(true)
    } else onClose()
  }
  const parkAndClose = () => {
    if (plan) putSession(parkSession(plan, new Date(), parkNote))
    setAsking(false)
    onClose()
  }
  const showShelves = () => {
    setDoneId(null)
    if (view === "shelves" && !plan) newDraft()
    setView(view === "shelves" ? "session" : "shelves")
  }
  const openFromShelf = (id: string) => {
    useSessionPlanStore.getState().focus(id)
    setDoneId(null)
    setView("session")
  }

  const title =
    view === "shelves"
      ? done
        ? `Session · ${done.title}`
        : "Sessions"
      : view === "list"
        ? "Pick list"
        : plan?.phase === "run"
        ? `Session · ${plan.title}`
        : plan?.phase === "parked"
          ? `Parked · ${plan.title}`
          : plan?.phase === "review"
            ? "Session review"
            : "Plan a session"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="todo95-dialog todo-session"
        hideClose
        // The focus bar (pen clock) stays usable over the popup; a click on it is not a click outside.
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.(".focus-bar")) e.preventDefault()
        }}
        aria-describedby={undefined}
        data-ui-name="Session"
        data-ui-help="Plan a time box in three tiers, work it with a clock, and review it."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>{title}</DialogTitle>
          <span className="todo-session-caption-keys">
            <button
              type="button"
              data-no95
              className={`ses-caption-key${view === "shelves" ? " is-on" : ""}`}
              aria-pressed={view === "shelves"}
              title={view === "shelves" ? "Back to the session" : "Drafts, parked and done sessions"}
              onClick={showShelves}
            >
              <i className="ses-caption-lamp" aria-hidden />
              Sessions
              {parkedCount ? (
                <span className="ses-parked" aria-hidden title={`${parkedCount} parked`}>
                  ⏸ {parkedCount}
                </span>
              ) : null}
            </button>
            <button type="button" className="b2-close-key" aria-label="Close" title="Close" onClick={requestClose}>
              ×
            </button>
          </span>
        </div>
        {asking ? (
          <div className="todo-session-ask" role="alertdialog" aria-label="The session is running">
            <span>The session is still running.</span>
            <FutureNoteInput value={parkNote} onChange={setParkNote} />
            <button type="button" className="todo-btn is-primary" onClick={parkAndClose}>
              Park
            </button>
            <button
              type="button"
              className="todo-btn"
              onClick={() => {
                setAsking(false)
                onClose()
              }}
            >
              Keep running
            </button>
          </div>
        ) : null}
        <div className="todo-dialog-body todo-session-body">
          {view === "list" ? (
            <FlatListView
              tasks={tasks}
              periodTasks={periodTasks}
              periodLabel={periodLabel}
              onSession={(ref, templateId) => {
                newDraftFrom({ seed: [ref], templateId })
                setView("session")
              }}
            />
          ) : view === "shelves" ? (
            done ? (
              <DoneView plan={done} tasks={tasks} onBack={() => setDoneId(null)} onRunAgain={() => openFromShelf(putSession(runAgain(done, new Date())))} />
            ) : (
              <ShelvesView
                open={openPlans}
                history={history}
                tasks={tasks}
                onOpen={openFromShelf}
                onOpenDone={setDoneId}
                onRunAgain={(p) => openFromShelf(putSession(runAgain(p, new Date())))}
                onNew={() => {
                  newDraft()
                  setView("session")
                }}
              />
            )
          ) : !plan ? null : plan.phase === "draft" ? (
            <DraftView plan={plan} tasks={tasks} history={history} periodTasks={periodTasks} periodLabel={periodLabel} onChange={update} />
          ) : plan.phase === "run" ? (
            <RunView plan={plan} tasks={tasks} onChange={update} />
          ) : plan.phase === "parked" ? (
            <ParkedView plan={plan} tasks={tasks} onChange={update} onShelves={showShelves} />
          ) : (
            <ReviewView plan={plan} tasks={tasks} onDone={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A new draft from another way in: a template, a length, a title and seed lines. Focused. */
function newDraftFrom(request: Omit<SessionOpenRequest, "startOn">): string {
  const store = useSessionPlanStore.getState()
  const tasks = useTaskStore.getState().tasks
  const template = request.templateId ? findTemplate(request.templateId, store.templates) : undefined
  let plan = template ? sessionFromTemplate(template, tasks, new Date(), request.seed) : emptySession(new Date(), request.durationMin ?? 180)
  if (!template) for (const ref of request.seed ?? []) plan = addLine(plan, "min", ref, tasks)
  if (request.durationMin) plan = { ...plan, durationMin: request.durationMin }
  if (request.title?.trim()) plan = { ...plan, title: request.title.trim() }
  store.put(plan)
  store.focus(plan.id)
  return plan.id
}

function findTemplate(id: string, saved: readonly SessionTemplate[]): SessionTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? saved.find((t) => t.id === id)
}

/** The one optional line for the next sitting (FN-1). */
function FutureNoteInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <input
      className="todo-session-futurenote-input"
      value={value}
      aria-label="Note to you later"
      placeholder="Note to you later (optional)"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function FutureNoteBanner({ note }: { note?: FutureNote }) {
  if (!note) return null
  const when = new Date(note.at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  return (
    <p className="todo-session-futurenote" role="note">
      <b>From {when}:</b> {note.text}
    </p>
  )
}

/** A new draft, seeded with what the last review kept, and focused. */
function newDraft(): void {
  const store = useSessionPlanStore.getState()
  let plan = emptySession(new Date())
  for (const ref of store.kept) plan = addLine(plan, ref.tier, ref, useTaskStore.getState().tasks)
  store.put(plan)
  store.focus(plan.id)
  store.clearKept()
}

/**
 * Store a session. A session parked to make room for another lets go of the
 * Tracking pen clock if it was painting there (the time so far is written as
 * on Stop). One parked by hand only pauses the pen (`lib/session-pen.ts`).
 * Returns the id.
 */
function putSession(next: SessionPlan): string {
  const bumped = useSessionPlanStore.getState().put(next, new Date())
  releasePenClock(bumped)
  return next.id
}

// ---- Draft --------------------------------------------------------------------

function TierKeys({
  inTier,
  onPick,
  label,
}: {
  inTier?: SessionTier
  onPick: (tier: SessionTier) => void
  label: string
}) {
  return (
    <span className="todo-session-tierkeys" role="group" aria-label={`Add ${label} to`}>
      {SESSION_TIERS.map(({ id }) => (
        <button
          key={id}
          type="button"
          data-no95
          className={`todo-session-tierkey is-${id}${inTier === id ? " is-on" : ""}`}
          aria-pressed={inTier === id}
          title={inTier === id ? `Take ${label} out of ${TIER_LABEL[id]}` : `${TIER_LABEL[id]}: ${label}`}
          onClick={() => onPick(id)}
        >
          {TIER_SHORT[id]}
        </button>
      ))}
    </span>
  )
}

/** "90", "1:30", "1h30", "1h 30m", "1.5h", "45m" → minutes. Null when it does not read as a time. */
export function parseLength(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "")
  if (!t) return null
  const clock = t.match(/^(\d+):(\d{1,2})$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const hm = t.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m?)?$/)
  if (hm && (hm[1] || hm[2])) {
    const hours = hm[1] ? Number(hm[1]) : 0
    const mins = hm[2] ? Number(hm[2]) : 0
    // A bare number is minutes; after an "h" it is the minutes part.
    return Math.round(hours * 60 + mins)
  }
  return null
}

/**
 * The length as a Dash tube: segment digits with a typed field over them
 * (`docs/DESIGN_STYLE.md` → Dash readouts). While typing, the field shows
 * what you type, so "1:30" or "2h" reads as written; Enter or leaving it sets it.
 */
function TimeTube({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const next = draft == null ? null : parseLength(draft)
    if (next != null) onChange(Math.max(0, Math.min(24 * 60, next)))
    setDraft(null)
  }
  return (
    <span className={`ses-tube${draft != null ? " is-typing" : ""}`} title="Type minutes, or 1:30, 1h30, 2h">
      <span className="ses-tube-face">
        <SegDigits value={String(Math.round(minutes))} cells={3} label="" />
        <input
          className="ses-tube-input"
          type="text"
          inputMode="numeric"
          aria-label="Length in minutes"
          value={draft ?? String(minutes)}
          onFocus={(e) => {
            setDraft(String(minutes))
            e.currentTarget.select()
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") {
              e.stopPropagation()
              setDraft(null)
              e.currentTarget.blur()
            }
          }}
        />
      </span>
      <span className="ses-tube-unit">
        min
        {minutes >= 60 ? <b>{fmtMinutes(minutes)}</b> : null}
      </span>
    </span>
  )
}

/**
 * One container for the whole session: the bar is the length (less breaks),
 * and Bare minimum, Goal and Exceptional fill it in turn, padded by your pace.
 * Past the wall it hatches warm red. The Hofstadter tick is where it all
 * lands with estimates doubled.
 */
function FitGlass({
  fit,
  pace,
  padLabel,
  room,
  durationMin,
}: {
  fit: ReturnType<typeof sessionFit>
  pace: number
  padLabel: string | null
  room: number
  durationMin: number
}) {
  const used = fit.reduce((sum, f) => sum + f.minutes * pace, 0)
  const scale = Math.max(room, used, 1)
  const pct = (m: number) => (m / scale) * 100
  const last = fit[fit.length - 1]
  const band = used === 0 ? "empty" : last.band
  const hof = used > 0 ? Math.round(last.padded * 100) : 0
  const hofAt = Math.min(100, pct(used * 2))
  const left = room - used
  const longBy = Math.round((pace - 1) * 100)
  return (
    <div className="ses-fit" data-band={band} role="group" aria-label="Fit">
      <div className="ses-fit-row">
        <span className="ses-fit-leg">
          Fit · {fmtMinutes(durationMin)}
          {room !== durationMin ? ` · ${fmtMinutes(room)} to work` : ""}
        </span>
        <span className="ses-fit-leg is-right">
          {padLabel ? `${padLabel}${longBy > 0 ? ` · you run ~${longBy}% long` : ""}` : "raw estimates"}
        </span>
      </div>
      <div className="ses-fit-bar" aria-hidden>
        {fit.map((f) =>
          f.minutes > 0 ? <span key={f.tier} className={`ses-fit-seg is-${f.tier}`} style={{ width: `${pct(f.minutes * pace)}%` }} /> : null,
        )}
        {used > room && room > 0 ? (
          <>
            <span className="ses-fit-over" style={{ left: `${pct(room)}%`, width: `${pct(used - room)}%` }} />
            <span className="ses-fit-wall" style={{ left: `${pct(room)}%` }} />
          </>
        ) : null}
        {used > 0 ? <span className="ses-fit-hof" data-off={used * 2 > scale || undefined} style={{ left: `${hofAt}%` }} /> : null}
      </div>
      <div className="ses-fit-row is-foot">
        {fit.map((f) => (
          <span key={f.tier} className={`ses-fit-read is-${f.tier}`} title={TIER_LABEL[f.tier]}>
            {TIER_LETTER[f.tier]} <b>{fmtMinutes(f.minutes * pace)}</b>
          </span>
        ))}
        <span className={`ses-fit-read is-left${left < 0 ? " is-over" : ""}`}>
          {used === 0 ? "empty" : left >= 0 ? `${fmtMinutes(left)} free` : `${fmtMinutes(-left)} over`}
        </span>
        {used > 0 ? (
          <span
            className={`ses-fit-read is-hof${hof > 100 ? " is-over" : ""}`}
            title="Hofstadter's Law: it takes longer than you expect, even counting that. This is the session with estimates doubled."
          >
            Hofstadter <b>{hof}%</b>
          </span>
        ) : null}
      </div>
    </div>
  )
}

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

// ---- Flat list ------------------------------------------------------------------

/**
 * The pick list on its own (opened from the fascia **Pick list** key or the
 * caption): every open lowest-level step and step-less task, flat, with its
 * minutes and lock. Nothing is made until **Session** or **Just 25** is pressed.
 */
function FlatListView({
  tasks,
  periodTasks,
  periodLabel,
  onSession,
}: {
  tasks: Task[]
  periodTasks: Task[]
  periodLabel: string
  onSession: (ref: { taskId: string; stepId?: string }, templateId?: string) => void
}) {
  const [scope, setScope] = useState<"period" | "all">("period")
  const [query, setQuery] = useState("")
  const [onlyReady, setOnlyReady] = useState(false)
  const rows = useMemo(() => {
    const base = scope === "period" ? periodTasks : tasks.filter((t) => !t.completed && !isClearedFromWork(t))
    const live = base.map((t) => tasks.find((x) => x.id === t.id) ?? t).filter((t) => !t.completed)
    const needle = query.trim().toLowerCase()
    const out: { key: string; ref: { taskId: string; stepId?: string }; label: string; minutes: number; locked: boolean }[] = []
    for (const task of live) {
      const taskLocked = hasUnmetDependencies(task, tasks)
      // Same rank as Just Start (`startOrderFor`): level, unlock value, estimate, spark, atomic, tree order.
      const leaves = placeSteps(task.subtasks)
        .filter((p) => !p.step.completed && !p.step.subtasks?.some((c) => !c.completed))
        .sort(startOrderFor(task.subtasks))
      const refs: { taskId: string; stepId?: string }[] = task.subtasks?.length ? leaves.map((p) => ({ taskId: task.id, stepId: p.step.id })) : [{ taskId: task.id }]
      for (const ref of refs) {
        const locked = taskLocked || (!!ref.stepId && !isStepAvailable(task.subtasks, ref.stepId))
        if (onlyReady && locked) continue
        const label = lineLabel(ref, tasks)
        if (needle && !label.toLowerCase().includes(needle)) continue
        out.push({ key: `${ref.taskId}|${ref.stepId ?? ""}`, ref, label, minutes: lineMinutes(ref, tasks), locked })
      }
    }
    return out
  }, [scope, periodTasks, tasks, query, onlyReady])
  return (
    <section className="todo-session-pick todo-session-flat" aria-label="Flat pick list">
      <div className="todo-session-pick-bar">
        <NativeSelect aria-label="Which tasks" value={scope} onChange={(e) => setScope(e.target.value as "period" | "all")}>
          <option value="period">{periodLabel || "This day"}</option>
          <option value="all">All open tasks</option>
        </NativeSelect>
        <input type="search" placeholder="Search tasks and steps" aria-label="Search pick list" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Available now
        </label>
      </div>
      <ul className="todo-session-picklist">
        {rows.length === 0 ? <li className="todo-empty">Nothing open here.</li> : null}
        {rows.map((row) => (
          <li key={row.key} className="todo-session-pickline">
            <span className="todo-session-pickname">{row.label}</span>
            {row.locked ? <span className="todo-row-lock">waits</span> : null}
            <span className="todo-session-mins">{row.minutes ? fmtMinutes(row.minutes) : "–"}</span>
            <button type="button" className="todo-verb" aria-label={`Session with ${row.label}`} onClick={() => onSession(row.ref)}>
              Session
            </button>
            <button type="button" className="todo-verb" aria-label={`Just 25 on ${row.label}`} onClick={() => onSession(row.ref, JUST_25_TEMPLATE_ID)}>
              Just 25
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- Run ----------------------------------------------------------------------

/** A line's estimate: frozen at Start, else what it adds up to now. */
function lineEst(line: SessionLine, tasks: Task[]): number {
  return line.estMin ?? lineMinutes(line, tasks)
}

/** An estimate you can click to change (minutes). Enter or leaving the field saves; Esc cancels. */
function EstEdit({ minutes, label, onSave }: { minutes: number; label: string; onSave: (minutes: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <button type="button" data-no95 className="ses-est" aria-label={`Edit estimate for ${label}`} title="Edit estimate" onClick={() => setDraft(minutes ? String(Math.round(minutes)) : "")}>
        {minutes ? fmtMinutes(minutes) : "–"}
      </button>
    )
  }
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() !== "" && Number.isFinite(n) && n >= 0) onSave(n)
    setDraft(null)
  }
  return (
    <span className="ses-est-field">
      <input
        className="ses-est-input"
        type="number"
        min={0}
        step={1}
        autoFocus
        aria-label={`Estimate for ${label} in minutes`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            e.stopPropagation()
            setDraft(null)
          }
        }}
      />
      m
    </span>
  )
}

/** Estimate vs actual in plain words: "3m under", "+5m over", "on the nose". Warm red only for overruns. */
function EstDelta({ estMin, actualSec, done }: { estMin: number; actualSec: number; done: boolean }) {
  if (!estMin || (!done && actualSec < estMin * 60)) return null
  const diff = Math.round(actualSec / 60 - estMin)
  if (diff > 0) return <span className="ses-delta is-over">+{fmtMinutes(diff)} over</span>
  if (!done) return null
  return <span className="ses-delta is-under">{diff === 0 ? "on the nose" : `${fmtMinutes(-diff)} under`}</span>
}

/** Actual against estimate as a hairline: fills to the estimate, then runs rose past it. */
function EstBar({ estMin, actualSec }: { estMin: number; actualSec: number }) {
  if (!estMin) return null
  const ratio = actualSec / (estMin * 60)
  return (
    <span className="ses-bar" aria-hidden>
      <span className={`ses-bar-fill${ratio > 1 ? " is-over" : ""}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </span>
  )
}

/** Session view settings (2026-10-22). Per device, in localStorage; the page works without it. */
interface SessionViewPrefs {
  clockColor: string
  hideDone: boolean
  showBars: boolean
}

/** Plan's opal mint (`--p-opal-mint`), soft on the dark clock glass. */
export const SESSION_CLOCK_DEFAULT = "#8cd4a5"
const SESSION_VIEW_KEY = "brain2.sessionView"
const SESSION_VIEW_DEFAULTS: SessionViewPrefs = { clockColor: SESSION_CLOCK_DEFAULT, hideDone: false, showBars: true }

function readSessionView(): SessionViewPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SESSION_VIEW_KEY) ?? "{}") as Partial<SessionViewPrefs>
    return {
      clockColor: typeof raw.clockColor === "string" && /^#[0-9a-f]{6}$/i.test(raw.clockColor) ? raw.clockColor : SESSION_CLOCK_DEFAULT,
      hideDone: raw.hideDone === true,
      showBars: raw.showBars !== false,
    }
  } catch {
    return SESSION_VIEW_DEFAULTS
  }
}

function useSessionView(): [SessionViewPrefs, (patch: Partial<SessionViewPrefs>) => void] {
  const [prefs, setPrefs] = useState<SessionViewPrefs>(() => (typeof window === "undefined" ? SESSION_VIEW_DEFAULTS : readSessionView()))
  const update = (patch: Partial<SessionViewPrefs>) =>
    setPrefs((old) => {
      const next = { ...old, ...patch }
      try {
        window.localStorage.setItem(SESSION_VIEW_KEY, JSON.stringify(next))
      } catch {
        // Private window or blocked storage: the change holds for this sitting.
      }
      return next
    })
  return [prefs, update]
}

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

  const holdOrGo = () => onChange(paused ? resumeSession(plan, new Date()) : pauseSession(plan, new Date()))

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
      {/* Portaled: the dialog's transform would trap Just Start's fixed overlay. */}
      {justStart && typeof document !== "undefined"
        ? createPortal(<JustStartMode taskId={justStart.taskId} stepId={justStart.stepId} onClose={() => setJustStart(null)} />, document.body)
        : null}
    </div>
  )
}

// ---- Parked -------------------------------------------------------------------

function ParkedView({
  plan,
  tasks,
  onChange,
  onShelves,
}: {
  plan: SessionPlan
  tasks: Task[]
  onChange: (plan: SessionPlan) => void
  onShelves: () => void
}) {
  const now = new Date()
  const stale = parkedLong(plan, now)
  const remembered = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
  const { parkingLotMode } = useTodoPrefs()
  const open = useSessionPlanStore((s) => s.open)
  const sceneRef = useRef<LotScene | null>(null)
  const [leaving, setLeaving] = useState(false)
  const cars: LotCar[] = open
    .filter((p) => p.phase === "parked")
    .map((p) => {
      const lines = allLines(p)
      const at = lines.find(({ line }) => line.id === p.activeLineId) ?? lines[0]
      return { id: p.id, title: p.title, leftLabel: `${fmtClock(remainingSec(p, now))} left`, tier: at?.tier ?? "min" }
    })
  const resumeNow = (mode: "as-was" | "fresh") => onChange(resumeParked(plan, useTaskStore.getState().tasks, new Date(), mode))
  // A scene plays its resume motion first; Classic resumes at once.
  const resume = async (mode: "as-was" | "fresh") => {
    const scene = sceneRef.current
    if (!scene) return resumeNow(mode)
    if (leaving) return
    setLeaving(true)
    try {
      await scene.playResume(plan.id)
    } finally {
      setLeaving(false)
    }
    resumeNow(mode)
  }
  return (
    <div className={`todo-session-parked pl-skin-${parkingLotMode}`}>
      <ParkingLotModeKeys mode={parkingLotMode} onChange={(m) => setTodoPrefs({ parkingLotMode: m })} />
      {parkingLotMode !== "classic" ? (
        <ParkingLotStage
          mode={parkingLotMode}
          cars={cars}
          selectedId={plan.id}
          onPick={(id) => {
            // A pick mid-resume would show one session while the old one resumes.
            if (!leaving) useSessionPlanStore.getState().focus(id)
          }}
          sceneRef={sceneRef}
        />
      ) : null}
      <div className="pl-detail">
      <FutureNoteBanner note={plan.futureNote} />
      <p className="todo-session-parked-head">
        <span className="todo-session-clock is-paused">{fmtClock(remainingSec(plan, now))}</span>
        <span>
          left of {fmtMinutes(plan.durationMin)}
          {plan.parkedAt ? ` · parked ${new Date(plan.parkedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </p>
      {remembered ? <p className="todo-session-current-path">Was on: {lineLabel(remembered, tasks)}</p> : null}
      <ol className="todo-session-runlist">
        {allLines(plan).map(({ line, tier }) => {
          const gone = !tasks.some((t) => t.id === line.taskId) || (!!line.stepId && !lineTarget(line, tasks).step)
          const done = !gone && lineIsDone(line, tasks)
          return (
            <li key={line.id} className={`todo-session-runline is-${tier}${done ? " is-done" : ""}${gone ? " is-gone" : ""}${line.id === plan.activeLineId ? " is-current" : ""}`}>
              <span className="todo-session-mark" aria-hidden>
                {done ? "✓" : line.id === plan.activeLineId ? "●" : "○"}
              </span>
              <span className="todo-session-tiertag">{TIER_SHORT[tier]}</span>
              <span className="todo-session-runname">{gone ? "Deleted task" : lineLabel(line, tasks)}</span>
              {gone ? (
                <button type="button" className="todo-verb is-quiet" onClick={() => onChange(removeLine(plan, line.id))}>
                  Remove
                </button>
              ) : (
                <span className="todo-session-mins">
                  {fmtMinutes(lineSeconds(plan, line, now) / 60)} / {line.estMin ? fmtMinutes(line.estMin) : "–"}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      </div>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onShelves}>
          Sessions
        </button>
        {stale ? (
          <>
            <span className="todo-session-reason">Parked over a day ago.</span>
            <button type="button" className="todo-btn" disabled={leaving} onClick={() => void resume("fresh")}>
              Fresh clock, same lines
            </button>
            <button type="button" className="todo-btn is-primary" disabled={leaving} onClick={() => void resume("as-was")}>
              Resume as was
            </button>
          </>
        ) : (
          <button type="button" className="todo-btn is-primary" disabled={leaving} onClick={() => void resume("as-was")}>
            Resume
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Sessions shelves ---------------------------------------------------------

function sessionStamp(plan: SessionPlan): string {
  return plan.endedAt ?? plan.parkedAt ?? plan.startedAt ?? plan.createdAt
}

function ShelfRow({ plan, tasks, children }: { plan: SessionPlan; tasks: Task[]; children: ReactNode }) {
  const lines = allLines(plan)
  const done = lines.filter(({ line }) => lineIsDone(line, tasks)).length
  const when = new Date(sessionStamp(plan)).toLocaleDateString([], { month: "short", day: "numeric" })
  return (
    <li className="todo-session-shelfrow">
      <span className="todo-session-shelfname">{plan.title || "Session"}</span>
      <span className="todo-session-mins">
        {when} · {fmtMinutes(plan.durationMin)} · {done}/{lines.length} lines
        {plan.phase === "done" && plan.reachedTier ? ` · ${plan.reachedTier === "none" ? "no tier" : TIER_LABEL[plan.reachedTier]}` : ""}
        {plan.phase === "run" ? " · running" : plan.phase === "review" ? " · in review" : ""}
      </span>
      <span className="todo-session-shelfkeys">{children}</span>
    </li>
  )
}

function ShelvesView({
  open,
  history,
  tasks,
  onOpen,
  onOpenDone,
  onRunAgain,
  onNew,
}: {
  open: SessionPlan[]
  history: SessionPlan[]
  tasks: Task[]
  onOpen: (id: string) => void
  onOpenDone: (id: string) => void
  onRunAgain: (plan: SessionPlan) => void
  onNew: () => void
}) {
  const remove = useSessionPlanStore((s) => s.remove)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const match = (plan: SessionPlan) =>
    !needle ||
    plan.title.toLowerCase().includes(needle) ||
    (plan.note ?? "").toLowerCase().includes(needle) ||
    allLines(plan).some(({ line }) => lineLabel(line, tasks).toLowerCase().includes(needle))
  const newest = (a: SessionPlan, b: SessionPlan) => sessionStamp(b).localeCompare(sessionStamp(a))
  const drafts = open.filter((p) => p.phase === "draft" && match(p)).sort(newest)
  const parked = open.filter((p) => p.phase !== "draft" && match(p)).sort(newest)
  const done = history.filter(match).sort(newest)
  const shelf = (label: string, count: number, body: ReactNode) => (
    <section className="todo-session-shelf" aria-label={label}>
      <h3 className="todo-session-shelf-head">
        {label} <span className="todo-session-mins">{count}</span>
      </h3>
      <ul className="todo-session-shelflist">{count ? body : <li className="todo-session-empty">None.</li>}</ul>
    </section>
  )
  return (
    <div className="todo-session-shelves">
      <div className="todo-session-pick-bar">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="todo-btn" onClick={onNew}>
          New session
        </button>
      </div>
      {shelf(
        "Drafts",
        drafts.length,
        drafts.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb is-quiet" aria-label={`Delete draft ${p.title}`} onClick={() => remove(p.id)}>
              Delete
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Parked",
        parked.length,
        parked.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              {p.phase === "parked" ? "Open" : "Show"}
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Done",
        done.length,
        done.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpenDone(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb" onClick={() => onRunAgain(p)}>
              Run again
            </button>
          </ShelfRow>
        )),
      )}
    </div>
  )
}

/** A done session, read-only, with its review. */
function DoneView({ plan, tasks, onBack, onRunAgain }: { plan: SessionPlan; tasks: Task[]; onBack: () => void; onRunAgain: () => void }) {
  const reached = plan.reachedTier ?? "none"
  return (
    <div className="todo-session-review is-readonly">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "No tier reached" : `${TIER_LABEL[reached]} reached`}
        {plan.points ? ` · +${plan.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      {plan.note ? <p className="todo-session-current-path">“{plan.note}”</p> : null}
      <FutureNoteBanner note={plan.futureNote} />
      <table className="todo-session-table">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Tier</th>
            <th scope="col">Est</th>
            <th scope="col">Actual</th>
            <th scope="col">Then</th>
          </tr>
        </thead>
        <tbody>
          {allLines(plan).map(({ line, tier }) => {
            const actual = (line.actualSec ?? 0) / 60
            return (
              <tr key={line.id} className={line.doneAt ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>{line.doneAt ? "done" : line.outcome === "push" ? "pushed" : line.outcome === "leave" ? "left" : "kept"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onBack}>
          Back to Sessions
        </button>
        <button type="button" className="todo-btn is-primary" onClick={onRunAgain}>
          Run again
        </button>
      </div>
    </div>
  )
}

// ---- Review -------------------------------------------------------------------

function ReviewView({ plan, tasks, onDone }: { plan: SessionPlan; tasks: Task[]; onDone: () => void }) {
  const setCurrent = (next: SessionPlan) => putSession(next)
  const archive = useSessionPlanStore((s) => s.archive)
  const [note, setNote] = useState(plan.note ?? "")
  const [futureNote, setFutureNote] = useState(plan.futureNote?.text ?? "")
  const amounts = activeTierPoints()
  const reached = tierReached(plan, tasks)
  const preview = closeSession(plan, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional })

  const save = () => {
    // An unfinished line with no choice made reads as "Keep for next session", as the menu shows.
    let decided = plan
    for (const { line } of allLines(plan)) {
      if (!line.outcome && !lineIsDone(line, tasks)) decided = setLineOutcome(decided, line.id, "keep")
    }
    const closed = closeSession(decided, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional }, note, futureNote)
    if (closed.points && closed.points > 0) {
      usePointsStore.getState().addPoints(`session:${closed.id}`, closed.points, `Session · ${closed.title} (${TIER_LABEL[reached as SessionTier] ?? "none"})`)
    }
    for (const { line } of allLines(closed)) {
      if (line.outcome === "push" && !lineIsDone(line, tasks)) pushTask(line.taskId, "day")
    }
    const ran = ranMinutes(closed)
    if (closed.startedAt && ran > 0) {
      const start = new Date(closed.startedAt)
      usePlannedActionStore.getState().addAction(
        placementFromDrop({
          date: formatLocalDateKey(start),
          hour: start.getHours(),
          minute: start.getMinutes(),
          durationMinutes: ran,
          source: "session",
          sourceId: closed.id,
          title: `Session · ${closed.title}`,
          notes: `${reached === "none" ? "No tier reached" : `${TIER_LABEL[reached as SessionTier]} reached`}${closed.note ? ` · ${closed.note}` : ""}`,
        }),
      )
    }
    writeSessionTimeLogs(closed)
    archive(closed, keptRefs(closed, tasks))
    onDone()
  }

  return (
    <div className="todo-session-review">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "Bare minimum not reached yet." : `${TIER_LABEL[reached as SessionTier]} reached`}
        {preview.points ? ` · +${preview.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      <table className="todo-session-table">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Tier</th>
            <th scope="col">Est</th>
            <th scope="col">Actual</th>
            <th scope="col">Then</th>
          </tr>
        </thead>
        <tbody>
          {allLines(plan).map(({ line, tier }) => {
            const done = lineIsDone(line, tasks)
            const actual = (line.actualSec ?? 0) / 60
            const over = line.estMin && actual > line.estMin * 1.25
            return (
              <tr key={line.id} className={done ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td className={over ? "is-over" : undefined}>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>
                  {done ? (
                    "done"
                  ) : (
                    <NativeSelect
                      aria-label={`What next for ${lineLabel(line, tasks)}`}
                      value={line.outcome ?? "keep"}
                      onChange={(e) => setCurrent(setLineOutcome(plan, line.id, e.target.value as SessionLine["outcome"]))}
                    >
                      <option value="keep">Keep for next session</option>
                      {line.stepId ? null : <option value="push">Push to tomorrow</option>}
                      <option value="leave">Leave</option>
                    </NativeSelect>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <label className="todo-session-note">
        <span>One line on how it went</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What helped, what got in the way" />
      </label>
      <label className="todo-session-note">
        <span>Note to tomorrow-you</span>
        <FutureNoteInput value={futureNote} onChange={setFutureNote} />
      </label>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={() => setCurrent({ ...plan, phase: "run", clock: plan.clock ? { ...plan.clock } : null })}>
          Back to the session
        </button>
        <button type="button" className="todo-btn is-primary" onClick={save}>
          Save session
        </button>
      </div>
    </div>
  )
}

/** The fascia key: "Session", or the live countdown while one runs. Ticks on its own so the panel does not. */
/** Each line's minutes onto its task's `timeLogs`, less what the pen clock already logged. */
function writeSessionTimeLogs(plan: SessionPlan): void {
  const store = useTaskStore.getState()
  for (const { taskId, entry } of sessionTimeLogs(plan, store.tasks)) {
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (task) store.updateTask({ ...task, timeLogs: [...(task.timeLogs ?? []), entry] })
  }
}

export function SessionKey({ onOpen }: { onOpen: () => void }) {
  const open = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const live = liveSession(open)
  const running = live?.phase === "run"
  const parked = open.filter((p) => p.phase === "parked").length
  const now = useNow(running)
  const shown = open.find((p) => p.id === focusId)
  const label = live
    ? live.phase === "run"
      ? `Session ${fmtClock(remainingSec(live, now))}`
      : "Review session"
    : shown?.phase === "draft" && allLines(shown).length
      ? "Session (draft)"
      : "Session"
  return (
    <button
      type="button"
      className={`todo-btn todo-session-key${running ? " is-running" : ""}`}
      title="Plan a time box in three tiers and work through it"
      onClick={onOpen}
    >
      {label}
      {parked ? (
        <span className="todo-session-parkcount" aria-label={`${parked} parked`}>
          {" "}⏸{parked}
        </span>
      ) : null}
    </button>
  )
}

/** The fascia key for the Sessions history panel (Drafts / Parked / Done). */
export function SessionsKey({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="todo-btn todo-sessions-key" title="Drafts, parked and done sessions" onClick={onOpen}>
      Sessions
    </button>
  )
}

/** The fascia key for the flat pick list: every open step, no session made until asked. */
export function PickListKey({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="todo-btn todo-picklist-key" title="Every open step in one flat list" onClick={onOpen}>
      Pick list
    </button>
  )
}
