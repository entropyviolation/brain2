/**
 * lib/plan-drag.ts — Plan rail ↔ calendar drag payload
 *
 * Chromium / Electron often strips custom DataTransfer types (`taskId`)
 * outside `dragstart`, so a drop reads an empty string and looks like a
 * no-op. Always write `text/plain` (`brain2-plan:<kind>:<id>`) and read
 * that first. A module-level live payload covers hosts that empty *every*
 * type on drop. Pointer fallback (rail press + move) emits onto
 * `[data-plan-drop]` when native HTML5 drag never starts.
 * Legacy `taskId` / `eventId` stay as extra keys.
 */
export const PLAN_DRAG_KINDS = ["task", "habit", "event", "action"] as const
export type PlanDragKind = (typeof PLAN_DRAG_KINDS)[number]

export const PLAN_DRAG_MIME = "application/x-brain2-plan"
export const PLAN_DRAG_PREFIX = "brain2-plan:"
export const PLAN_DROP_SELECTOR = "[data-plan-drop]"
const POINTER_MOVE_PX = 6

export interface PlanDragPayload {
  kind: PlanDragKind
  id: string
}

export type PlanPointerDropHandler = (
  payload: PlanDragPayload,
  clientX: number,
  clientY: number,
  target: HTMLElement,
) => void

let live: PlanDragPayload | null = null
let liveLabel = ""
let pointerMoved = false
let suppressClick = false
let ghost: HTMLDivElement | null = null
const pointerDropHandlers = new Set<PlanPointerDropHandler>()

export function packPlanDrag(kind: PlanDragKind, id: string): string {
  return `${PLAN_DRAG_PREFIX}${kind}:${id}`
}

export function parsePlanDrag(raw: string): PlanDragPayload | null {
  const text = raw.trim()
  if (!text.startsWith(PLAN_DRAG_PREFIX)) return null
  const rest = text.slice(PLAN_DRAG_PREFIX.length)
  const colon = rest.indexOf(":")
  if (colon <= 0) return null
  const kind = rest.slice(0, colon)
  const id = rest.slice(colon + 1)
  if (!(PLAN_DRAG_KINDS as readonly string[]).includes(kind) || !id) return null
  return { kind: kind as PlanDragKind, id }
}

export function peekPlanDrag(): PlanDragPayload | null {
  return live
}

export function beginPlanDrag(kind: PlanDragKind, id: string, label = ""): void {
  live = { kind, id }
  liveLabel = label
  pointerMoved = false
}

export function notePlanNativeDrag(): void {
  hidePlanDragGhost()
}

export function onPlanPointerDrop(handler: PlanPointerDropHandler): () => void {
  pointerDropHandlers.add(handler)
  return () => {
    pointerDropHandlers.delete(handler)
  }
}

export function writePlanDrag(dt: DataTransfer, kind: PlanDragKind, id: string, label = ""): void {
  live = { kind, id }
  if (label) liveLabel = label
  notePlanNativeDrag()
  const packed = packPlanDrag(kind, id)
  try {
    dt.setData(PLAN_DRAG_MIME, packed)
  } catch {
    /* some hosts refuse unknown MIME */
  }
  dt.setData("text/plain", packed)
  try {
    dt.setData("text", packed)
  } catch {
    /* IE-era alias */
  }
  if (kind === "task") dt.setData("taskId", id)
  if (kind === "habit") dt.setData("habitId", id)
  if (kind === "event") dt.setData("eventId", id)
  if (kind === "action") dt.setData("plannedActionId", id)
  dt.effectAllowed = "move"
}

export function readPlanDrag(dt?: DataTransfer | null): PlanDragPayload | null {
  if (dt) {
    const candidates = [PLAN_DRAG_MIME, "text/plain", "text"]
    for (const type of candidates) {
      let raw = ""
      try {
        raw = dt.getData(type)
      } catch {
        raw = ""
      }
      const parsed = parsePlanDrag(raw)
      if (parsed) return parsed
    }
    const legacy: Array<[PlanDragKind, string]> = [
      ["task", "taskId"],
      ["habit", "habitId"],
      ["event", "eventId"],
      ["action", "plannedActionId"],
    ]
    for (const [kind, key] of legacy) {
      let id = ""
      try {
        id = dt.getData(key)
      } catch {
        id = ""
      }
      if (id) return { kind, id }
    }
  }
  return live
}

export function endPlanDrag(): void {
  live = null
  liveLabel = ""
  pointerMoved = false
  hidePlanDragGhost()
}

export function consumePlanDragClick(): boolean {
  if (!suppressClick) return false
  suppressClick = false
  return true
}

function pointsFrom(clientX: number, clientY: number): Element[] {
  if (typeof document === "undefined") return []
  if (typeof document.elementsFromPoint === "function") {
    return document.elementsFromPoint(clientX, clientY)
  }
  const one = document.elementFromPoint(clientX, clientY)
  return one ? [one] : []
}

export function findPlanDropTarget(clientX: number, clientY: number): HTMLElement | null {
  for (const node of pointsFrom(clientX, clientY)) {
    if (!(node instanceof Element)) continue
    const found = node.closest(PLAN_DROP_SELECTOR)
    if (found instanceof HTMLElement) return found
  }
  return null
}

function showPlanDragGhost(clientX: number, clientY: number): void {
  if (typeof document === "undefined") return
  if (!ghost) {
    ghost = document.createElement("div")
    ghost.className = "plan-drag-ghost"
    ghost.setAttribute("aria-hidden", "true")
    document.body.appendChild(ghost)
  }
  ghost.textContent = liveLabel || "Plan"
  ghost.style.left = `${clientX + 12}px`
  ghost.style.top = `${clientY + 12}px`
}

function hidePlanDragGhost(): void {
  ghost?.remove()
  ghost = null
}

export function emitPlanPointerDrop(clientX: number, clientY: number): boolean {
  const payload = live
  if (!payload) return false
  const target = findPlanDropTarget(clientX, clientY)
  if (!target) return false
  for (const handler of pointerDropHandlers) handler(payload, clientX, clientY, target)
  return true
}

export function notePlanPointerMove(clientX: number, clientY: number, originX: number, originY: number): boolean {
  if (Math.hypot(clientX - originX, clientY - originY) < POINTER_MOVE_PX) return pointerMoved
  pointerMoved = true
  showPlanDragGhost(clientX, clientY)
  return true
}

export function finishPlanPointerDrag(clientX: number, clientY: number): boolean {
  const shouldDrop = !!live && pointerMoved
  suppressClick = pointerMoved
  let dropped = false
  if (shouldDrop) dropped = emitPlanPointerDrop(clientX, clientY)
  endPlanDrag()
  return dropped
}

/** Test/reset helper — clears live drag so suites cannot leak into each other. */
export function resetPlanDrag(): void {
  suppressClick = false
  endPlanDrag()
}
