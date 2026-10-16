/**
 * lib/step-item-stack.ts — Item detail layers opened on top (Phase 11, R3)
 *
 * Opening a step's item pushes a layer; Back and Esc pop only the top. What
 * is underneath stays mounted, so its lid, scroll, selection and running
 * session keep their state. `components/steps/StepItemStack.tsx` draws it.
 */
import { useSyncExternalStore } from "react"
import { ensureStepItem } from "@/lib/step-items"

export type ItemLayer = { key: number; taskId: string }

let layers: ItemLayer[] = []
let nextKey = 1
const listeners = new Set<() => void>()

function emit(next: ItemLayer[]) {
  layers = next
  for (const l of listeners) l()
}

export function itemLayers(): ItemLayer[] {
  return layers
}

/** Push any item as a new layer (a crumb, the Parent chip). */
export function pushItemLayer(taskId: string): void {
  emit([...layers, { key: nextKey++, taskId }])
}

/** Open a step's item on top, making it first if needed. False when the step is gone. */
export function openStepItem(taskId: string, stepId: string): boolean {
  const id = ensureStepItem(taskId, stepId)
  if (!id) return false
  pushItemLayer(id)
  return true
}

export function popItemLayer(key?: number): void {
  if (!layers.length) return
  emit(key == null ? layers.slice(0, -1) : layers.filter((l) => l.key !== key))
}

export function clearItemLayers(): void {
  if (layers.length) emit([])
}

export function subscribeItemLayers(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useItemLayers(): ItemLayer[] {
  return useSyncExternalStore(subscribeItemLayers, itemLayers, itemLayers)
}
