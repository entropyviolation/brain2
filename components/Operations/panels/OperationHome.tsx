/**
 * components/Operations/panels/OperationHome.tsx — Operation home (note log + heatmap)
 *
 * The home tab of an Operation workspace: mission (one line, growing with the
 * text), stage, progress (phases and the to-do list), the item note log
 * (`Task.noteLog` and the standing `Task.notes` — the same notes as item
 * detail), and the work/neglect heatmap (`lib/operations.buildHeatmap`).
 * **Open item detail** hosts `TaskDetailPopup` over this page.
 * A leftover `homeNotes` attribute is folded into that log.
 */
"use client"

import { trackedTimeForItems } from "@/lib/tracked-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import {
  buildHeatmap,
  foldOperationHomeNotes,
  getOperationTaskTree,
  getPhases,
  minutesToHours,
  neglectedDays,
  operationProgress,
  type HeatCell,
  type PhaseProgress,
} from "@/lib/operations"
import { collectOperationTodoTasks } from "@/lib/operation-parts"
import { findOperationTaskList } from "@/lib/operation-lists"
import {
  OPERATION_ATTR,
  OPERATION_STAGES,
  type OperationStage,
} from "@/lib/operation-types"
import type { Task } from "@/lib/types"
import { setMission, setStage } from "../operation-actions"
import { NativeSelect } from "@/components/ui/native-select"
import { ItemNotesLog } from "@/components/ItemDetail/tabs/notes/ItemNotesLog"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import "@/components/ItemDetail/chrome/item-detail-chrome.css"

/**
 * The bar is the mean of the phase rollup and the to-do list, skipping a side
 * whose total is zero so an empty list does not drag the other to 0%. Phases
 * come from `operationProgress` (only when the operation has phases — the
 * parts fallback is the to-do list, not a phase count). To-dos are
 * `collectOperationTodoTasks`. Same two readings the workspace already keeps.
 */
function homeProgressPercent(phase: PhaseProgress, todoDone: number, todoTotal: number): number {
  const fractions: number[] = []
  if (phase.total > 0) fractions.push(phase.done / phase.total)
  if (todoTotal > 0) fractions.push(todoDone / todoTotal)
  if (fractions.length === 0) return 0
  return Math.round((fractions.reduce((sum, fraction) => sum + fraction, 0) / fractions.length) * 100)
}

/** Cold days read hotter (neglect signal); worked days stay phosphor green. */
const HEAT_COLORS: Record<number, string> = {
  0: "#6b1020",
  1: "#1f5c2c",
  2: "#2f9a3a",
  3: "#5ee05e",
  4: "#d4ff8a",
}

function HeatGrid({ cells }: { cells: HeatCell[] }) {
  return (
    <div className="ops-heat">
      {cells.map((cell) => (
        <div
          key={cell.date}
          title={`${cell.date}: ${cell.minutes} min${cell.level === 0 ? " · neglected" : ""}`}
          className={`ops-heat-cell${cell.level === 0 ? " is-cold" : ""}`}
          style={{ backgroundColor: HEAT_COLORS[cell.level] }}
        />
      ))}
    </div>
  )
}

function writeOperationNotes(operationId: string, patch: Partial<Task>): void {
  const store = useTaskStore.getState()
  const latest = store.tasks.find((task) => task.id === operationId)
  if (!latest) return
  const folded = foldOperationHomeNotes(latest)
  store.updateTask({
    ...folded,
    ...patch,
    attributes: folded.attributes,
    noteLog: patch.noteLog !== undefined ? patch.noteLog : folded.noteLog,
    notes: patch.notes !== undefined ? patch.notes : folded.notes,
  })
}

export function OperationHome({ operation }: { operation: Task }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const live = allTasks.find((task) => task.id === operation.id) ?? operation
  const [detailOpen, setDetailOpen] = useState(false)
  const notes = useMemo(() => foldOperationHomeNotes(live), [live])
  const [missionDraft, setMissionDraft] = useState<string>(
    typeof operation.attributes?.[OPERATION_ATTR.mission] === "string"
      ? (operation.attributes[OPERATION_ATTR.mission] as string)
      : "",
  )
  const missionRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = missionRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [missionDraft])

  useEffect(() => {
    const latest = useTaskStore.getState().tasks.find((task) => task.id === operation.id)
    if (!latest) return
    const folded = foldOperationHomeNotes(latest)
    if (folded !== latest) useTaskStore.getState().updateTask(folded)
  }, [operation.id, live.attributes])

  const stage = (operation.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"

  const { cells, hours, neglected, phaseDone, phaseTotal, todoDone, todoTotal, percent } = useMemo(() => {
    const tree = getOperationTaskTree(operation.id, allTasks)
    const timeContributors = [operation, ...tree]
    const cells = buildHeatmap(timeContributors, { days: 35 })
    const totalMinutes = trackedTimeForItems(timeContributors, trackingEntries).total
    const phases = getPhases(operation.id, allTasks)
    const phase =
      phases.length > 0
        ? operationProgress(operation.id, allTasks)
        : { done: 0, total: 0, fraction: 0, complete: false }
    const listId = findOperationTaskList(live, lists)?.id ?? null
    const todos = collectOperationTodoTasks(operation.id, allTasks, listId)
    const todoDone = todos.filter((task) => task.completed).length
    return {
      cells,
      hours: minutesToHours(totalMinutes),
      neglected: neglectedDays(cells),
      phaseDone: phase.done,
      phaseTotal: phase.total,
      todoDone,
      todoTotal: todos.length,
      percent: homeProgressPercent(phase, todoDone, todos.length),
      totalMinutes,
    }
  }, [operation, allTasks, lists, live, trackingEntries])

  return (
    <div className="ops-panel ops-home-instrument">
      <div className="ops-home-head">
        <span className="ops-label">This operation</span>
        <button
          type="button"
          className="ops-btn ops-keycap"
          data-no95=""
          onClick={() => setDetailOpen(true)}
        >
          Open item detail
        </button>
      </div>

      <div className="ops-brief">
        <div className="ops-field">
          <label className="ops-label" htmlFor="op-mission">
            Mission
          </label>
          <textarea
            ref={missionRef}
            id="op-mission"
            className="ops-input ops-mission"
            rows={1}
            value={missionDraft}
            onChange={(e) => setMissionDraft(e.target.value)}
            onBlur={() => setMission(operation.id, missionDraft)}
            placeholder="What is this operation trying to achieve?"
          />
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="op-stage">
            Stage
          </label>
          <NativeSelect
            id="op-stage"
            className="ops-input"
            value={stage}
            onChange={(e) => setStage(operation.id, e.target.value as OperationStage)}
          >
            {OPERATION_STAGES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="ops-group">
        <legend>Progress</legend>
        <div className="flex items-center justify-between text-[11px]">
          <span>
            {phaseDone}/{phaseTotal} phases · {todoDone}/{todoTotal} to-dos · {percent}%
          </span>
        </div>
        <div
          className="ops-progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${phaseDone} of ${phaseTotal} phases, ${todoDone} of ${todoTotal} to-dos`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </fieldset>

      <div className="ops-pad">
        <span className="ops-label" id="op-notes-label">
          Notes
        </span>
        <div className="id95 ops-notes-log" aria-labelledby="op-notes-label">
          <ItemNotesLog
            entries={notes.noteLog}
            standing={notes.notes}
            onChangeEntries={(noteLog) => writeOperationNotes(operation.id, { noteLog })}
            onChangeStanding={(text) => writeOperationNotes(operation.id, { notes: text })}
          />
        </div>
      </div>

      <div className="ops-scope">
        <div className="ops-scope-head">
          <span>Last 35 days</span>
          <span>
            {hours}h logged · {neglected} neglected day{neglected === 1 ? "" : "s"}
          </span>
        </div>
        <HeatGrid cells={cells} />
        <div className="ops-heat-legend">
          <span>cold</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span key={lvl} className="ops-heat-cell" style={{ backgroundColor: HEAT_COLORS[lvl] }} />
          ))}
          <span>hot</span>
        </div>
      </div>

      <TaskDetailPopup taskId={operation.id} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  )
}

export default OperationHome
