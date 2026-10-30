/**
 * components/Home/Tracking/entry-dialog/entry-objectives.tsx — Objectives on this block
 *
 * The root is `NowObjectivesList`. The parent mounts it only when the block is
 * the live sitting or already carries objectives. Callbacks stay here. No hooks.
 */
"use client"

import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import {
  addCompletedNowObjective,
  addNowObjective,
  attachNowObjective,
  editNowObjectiveText,
  moveNowObjectiveToNext,
  moveNowObjectiveToNow,
  removeNowObjective,
  setNowObjectiveCompletes,
  tieNowObjectiveToStep,
  toggleNowObjectiveComplete,
  type NowObjective,
} from "@/lib/now-objective"
import { openStepChoices } from "@/lib/task-clock-log"
import {
  createTaskForObjective,
  fileObjectivesOnTask,
  homeForObjective,
  objectivesAttachedToTask,
  toParked,
} from "@/lib/unfinished-objectives"
import { useUnfinishedObjectivesStore } from "@/lib/unfinished-objectives-store"
import type { TimeEntry } from "@/lib/time-tracking-store"
import { blockFloor } from "./labels"

export function EntryObjectives({
  entry,
  objectivesLive,
  nowObjectives,
  setNowObjectives,
  attachChoices,
}: {
  entry: TimeEntry
  objectivesLive: boolean
  nowObjectives: NowObjective[] | undefined
  setNowObjectives: (update: (list: NowObjective[] | undefined) => NowObjective[] | undefined) => void
  attachChoices: { taskId: string; stepId?: string; label: string }[]
}) {
  return (
    <NowObjectivesList
      mode="inline"
      allowAdd={objectivesLive}
      objectives={nowObjectives}
      onAdd={(text, lane) => setNowObjectives((list) => addNowObjective(list, text, new Date(), { lane }))}
      onMoveToNow={(id) => setNowObjectives((list) => moveNowObjectiveToNow(list, id))}
      onMoveToNext={(id) => setNowObjectives((list) => moveNowObjectiveToNext(list, id))}
      onAddCompleted={(text) =>
        setNowObjectives((list) => addCompletedNowObjective(list, text, blockFloor(entry)))
      }
      onEditText={(id, text) => setNowObjectives((list) => editNowObjectiveText(list, id, text))}
      onToggleComplete={(id) => setNowObjectives((list) => toggleNowObjectiveComplete(list, id))}
      onRemove={(id) => setNowObjectives((list) => removeNowObjective(list, id))}
      onSaveForLater={(id) => {
        const row = (nowObjectives ?? []).find((item) => item.id === id)
        if (row && !row.completedAt) {
          const home = homeForObjective(row, {
            taskId: entry.taskId,
            stepId: entry.stepId,
            scopeId: entry.scopeId,
            penId: entry.penId,
          })
          const parked = home ? toParked(row, home) : null
          if (parked) useUnfinishedObjectivesStore.getState().upsert([parked])
        }
        setNowObjectives((list) => removeNowObjective(list, id))
      }}
      onAttach={(id, target) => {
        const taskId =
          "createName" in target
            ? createTaskForObjective(target.createName, { scopeId: entry.scopeId, penId: entry.penId })
            : target.taskId
        if (!taskId) return
        const stepId = "createName" in target ? undefined : target.stepId
        setNowObjectives((list) => {
          const next = attachNowObjective(list, id, { taskId, stepId })
          fileObjectivesOnTask(taskId, objectivesAttachedToTask(next, taskId))
          return next
        })
      }}
      attachChoices={attachChoices}
      stepChoices={entry.taskId ? openStepChoices(entry.taskId) : undefined}
      onTieStep={
        entry.taskId
          ? (id, stepId) =>
              setNowObjectives((list) =>
                stepId === "new"
                  ? list
                  : setNowObjectiveCompletes(tieNowObjectiveToStep(list, id, stepId), id, false),
              )
          : undefined
      }
      onSetCompletes={(id, completes) => setNowObjectives((list) => setNowObjectiveCompletes(list, id, completes))}
    />
  )
}
