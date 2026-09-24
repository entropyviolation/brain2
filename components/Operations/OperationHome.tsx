/**
 * components/Operations/OperationHome.tsx — Operation home (notes pad + heatmap)
 *
 * The "home base" tab of an Operation workspace: a free-text notes pad (the
 * operation's `homeNotes` attribute), a mission line, the stage selector, an
 * overall-progress bar, and the work/neglect heatmap built from the time logged
 * across the operation's whole task tree (`lib/operations.buildHeatmap`).
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import {
  buildHeatmap,
  getOperationTaskTree,
  loggedMinutes,
  neglectedDays,
  operationProgress,
  rollupHours,
  type HeatCell,
} from "@/lib/operations"
import {
  OPERATION_ATTR,
  OPERATION_STAGES,
  type OperationStage,
} from "@/lib/operation-types"
import type { Task } from "@/lib/types"
import { setHomeNotes, setMission, setStage } from "./operation-actions"

const HEAT_COLORS: Record<number, string> = {
  0: "#132418",
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
          title={`${cell.date}: ${cell.minutes} min`}
          className="ops-heat-cell"
          style={{ backgroundColor: HEAT_COLORS[cell.level] }}
        />
      ))}
    </div>
  )
}

export function OperationHome({ operation }: { operation: Task }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const [notesDraft, setNotesDraft] = useState<string>(
    typeof operation.attributes?.[OPERATION_ATTR.homeNotes] === "string"
      ? (operation.attributes[OPERATION_ATTR.homeNotes] as string)
      : "",
  )
  const [missionDraft, setMissionDraft] = useState<string>(
    typeof operation.attributes?.[OPERATION_ATTR.mission] === "string"
      ? (operation.attributes[OPERATION_ATTR.mission] as string)
      : "",
  )

  const stage = (operation.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"

  const { cells, hours, neglected, progress } = useMemo(() => {
    const tree = getOperationTaskTree(operation.id, allTasks)
    const timeContributors = [operation, ...tree]
    const cells = buildHeatmap(timeContributors, { days: 35 })
    const totalMinutes = timeContributors.reduce((sum, t) => sum + loggedMinutes(t), 0)
    return {
      cells,
      hours: rollupHours(timeContributors),
      neglected: neglectedDays(cells),
      progress: operationProgress(operation.id, allTasks),
      totalMinutes,
    }
  }, [operation, allTasks])

  return (
    <div className="ops-panel">
      <div className="ops-brief">
        <div className="ops-field">
          <label className="ops-label" htmlFor="op-mission">
            Mission
          </label>
          <input
            id="op-mission"
            className="ops-input"
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
          <select
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
          </select>
        </div>
      </div>

      <fieldset className="ops-group">
        <legend>Progress</legend>
        <div className="flex items-center justify-between text-[11px]">
          <span>
            {progress.done}/{progress.total} phases · {Math.round(progress.fraction * 100)}%
          </span>
        </div>
        <div className="ops-progress" role="progressbar" aria-valuenow={Math.round(progress.fraction * 100)}>
          <span style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
        </div>
      </fieldset>

      <div className="ops-pad">
        <label className="ops-label" htmlFor="op-notes">
          NOTES
        </label>
        <textarea
          id="op-notes"
          className="ops-notes"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => setHomeNotes(operation.id, notesDraft)}
          rows={8}
          placeholder="Plans, decisions, links…"
        />
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
    </div>
  )
}

export default OperationHome
