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
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  0: "#e5e7eb",
  1: "#99f6e4",
  2: "#5eead4",
  3: "#14b8a6",
  4: "#0f766e",
}

function HeatGrid({ cells }: { cells: HeatCell[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cells.map((cell) => (
        <div
          key={cell.date}
          title={`${cell.date}: ${cell.minutes} min`}
          className="h-3.5 w-3.5 rounded-[2px] border border-black/10"
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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="op-mission">
            Mission
          </Label>
          <Input
            id="op-mission"
            value={missionDraft}
            onChange={(e) => setMissionDraft(e.target.value)}
            onBlur={() => setMission(operation.id, missionDraft)}
            placeholder="What is this operation trying to achieve?"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="op-stage">
            Stage
          </Label>
          <Select value={stage} onValueChange={(v) => setStage(operation.id, v as OperationStage)}>
            <SelectTrigger id="op-stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {progress.done}/{progress.total} phases · {Math.round(progress.fraction * 100)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium" htmlFor="op-notes">
          Notes
        </Label>
        <Textarea
          id="op-notes"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => setHomeNotes(operation.id, notesDraft)}
          rows={6}
          placeholder="Scratch pad: plans, decisions, links, anything about this operation…"
        />
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Work / neglect (last 35 days)</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {hours}h logged · {neglected} neglected day{neglected === 1 ? "" : "s"}
          </span>
        </div>
        <HeatGrid cells={cells} />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              className="h-3 w-3 rounded-[2px] border border-black/10"
              style={{ backgroundColor: HEAT_COLORS[lvl] }}
            />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  )
}

export default OperationHome
