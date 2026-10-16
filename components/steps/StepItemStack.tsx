/**
 * components/steps/StepItemStack.tsx — Item detail layers on top (Phase 11, R3)
 *
 * Mounted once by the app shell. Each layer in `lib/step-item-stack.ts` is a
 * `TaskDetailPopup` stacked above whatever is open, so the lid, scroll,
 * selection, link mode and running session underneath keep their state. Esc
 * closes only the top (Radix closes the top-most layer). A step item's layer
 * shows a breadcrumb (`Finish CDs › insert › disc`), **Back**, a **Parent**
 * chip and `est · parts · spent`. A crumb opens that ancestor as a new layer.
 *
 * Always on: step items whose step is gone are removed (or moved with their
 * step), and name or estimate edits on an open step item go back to the step.
 */
"use client"

import { useEffect, useRef } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import {
  applyStepItemFixes,
  findStep,
  mirrorPatch,
  sharedEdits,
  stepCrumbs,
  stepReadout,
  updateStepField,
} from "@/lib/step-items"
import { openStepItem, popItemLayer, pushItemLayer, useItemLayers, type ItemLayer } from "@/lib/step-item-stack"
import { withoutUndo } from "@/lib/action-history"
import "./step-tree.css"

// Static: To Do already loads the popup with the shell.
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"

/** Keep step items in step with their tree. Cheap when there are none. */
function useStepItemUpkeep() {
  useEffect(() => {
    let last: Task[] | null = null
    const run = () => {
      const tasks = useTaskStore.getState().tasks
      if (tasks === last) return
      last = tasks
      if (tasks.some((t) => t.stepOf)) applyStepItemFixes()
    }
    run()
    return useTaskStore.subscribe(run)
  }, [])
}

type Mirror = { description?: string; estimatedDuration?: number }

/**
 * While a step item is open: an edit made on the item (name, estimate) writes
 * the step; an edit made in the tree refreshes the item's mirror. `seen` is
 * the last agreed value, so the two never fight.
 */
function useSharedFieldSync(layers: ItemLayer[]) {
  const seen = useRef(new Map<string, Mirror>())
  useEffect(() => {
    if (!layers.length) return
    const ids = new Set(layers.map((l) => l.taskId))
    const run = () => {
      const tasks = useTaskStore.getState().tasks
      for (const id of ids) {
        const item = tasks.find((t) => t.id === id)
        if (!item?.stepOf) continue
        const step = findStep(tasks.find((t) => t.id === item.stepOf!.taskId), item.stepOf.stepId)
        if (!step) continue
        const was = seen.current.get(id)
        const itemMoved =
          was && (was.description !== item.description || (was.estimatedDuration || 0) !== (item.estimatedDuration || 0))
        const edits = itemMoved ? sharedEdits(item, step) : {}
        if (Object.keys(edits).length) {
          updateStepField(item.stepOf, edits)
        } else {
          const patch = mirrorPatch(item, step)
          if (Object.keys(patch).length) withoutUndo(() => useTaskStore.getState().updateTask({ ...item, ...patch }))
        }
        const now = useTaskStore.getState().tasks.find((t) => t.id === id)
        if (now) seen.current.set(id, { description: now.description, estimatedDuration: now.estimatedDuration })
      }
    }
    run()
    return useTaskStore.subscribe(run)
  }, [layers])
}

function StepLayerHeader({ layer, index }: { layer: ItemLayer; index: number }) {
  const tasks = useTaskStore((s) => s.tasks)
  const item = tasks.find((t) => t.id === layer.taskId)
  if (!item?.stepOf) {
    return index > 0 ? (
      <div className="step-layer-bar">
        <button type="button" className="step-layer-back" onClick={() => popItemLayer(layer.key)}>
          ‹ Back
        </button>
      </div>
    ) : null
  }
  const crumbs = stepCrumbs(tasks, item)
  const step = findStep(tasks.find((t) => t.id === item.stepOf!.taskId), item.stepOf.stepId)
  const readout = step ? stepReadout(step) : null
  return (
    <div className="step-layer-bar" data-ui-name="Step item bar">
      <button type="button" className="step-layer-back" onClick={() => popItemLayer(layer.key)}>
        ‹ Back
      </button>
      <nav className="step-layer-crumbs" aria-label="Where this step sits">
        {crumbs.map((c, i) => {
          const here = i === crumbs.length - 1
          return (
            <span key={`${c.taskId}-${c.stepId ?? "task"}`} className="step-layer-crumb">
              {i > 0 ? <span className="step-layer-sep">›</span> : null}
              {here ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => (c.stepId ? openStepItem(c.taskId, c.stepId) : pushItemLayer(c.taskId))}
                >
                  {c.label}
                </button>
              )}
            </span>
          )
        })}
      </nav>
      <button
        type="button"
        className="step-layer-chip"
        title="Open the task this step belongs to"
        onClick={() => pushItemLayer(item.stepOf!.taskId)}
      >
        Parent
      </button>
      {readout ? (
        <span className="step-layer-readout" title="est · parts · spent">
          {readout.est ? `${readout.est}m` : "no est"} · {readout.parts ?? "no parts"} · {readout.spent}m
        </span>
      ) : null}
    </div>
  )
}

export function StepItemStack() {
  useStepItemUpkeep()
  const layers = useItemLayers()
  useSharedFieldSync(layers)
  if (!layers.length) return null
  return (
    <>
      {layers.map((layer, index) => (
        <LayerPopup key={layer.key} layer={layer} index={index} />
      ))}
    </>
  )
}

function LayerPopup({ layer, index }: { layer: ItemLayer; index: number }) {
  const stepOf = useTaskStore((s) => s.tasks.find((t) => t.id === layer.taskId)?.stepOf)
  return (
    <TaskDetailPopup
      taskId={layer.taskId}
      open
      stackAbove
      onClose={() => popItemLayer(layer.key)}
      layerHeader={<StepLayerHeader layer={layer} index={index} />}
      onStepComplete={
        stepOf
          ? () => {
              updateStepField(stepOf, { completed: true })
              popItemLayer(layer.key)
            }
          : undefined
      }
    />
  )
}
