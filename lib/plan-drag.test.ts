import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  beginPlanDrag,
  emitPlanPointerDrop,
  endPlanDrag,
  onPlanPointerDrop,
  packPlanDrag,
  parsePlanDrag,
  peekPlanDrag,
  readPlanDrag,
  resetPlanDrag,
  writePlanDrag,
} from "./plan-drag"

function fakeTransfer(initial: Record<string, string> = {}): DataTransfer {
  const bag = { ...initial }
  return {
    dropEffect: "none",
    effectAllowed: "none",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: Object.keys(bag),
    setData(type: string, value: string) {
      bag[type] = value
    },
    getData(type: string) {
      return bag[type] ?? ""
    },
    clearData() {
      for (const key of Object.keys(bag)) delete bag[key]
    },
    setDragImage() {},
  } as DataTransfer
}

/** jsdom ships neither hit-test API, so both are assigned rather than spied. */
function stubElementsFromPoint(found: Element[]) {
  Object.defineProperty(document, "elementsFromPoint", {
    value: () => found,
    configurable: true,
    writable: true,
  })
}

function stubElementFromPoint(found: Element) {
  Object.defineProperty(document, "elementFromPoint", {
    value: () => found,
    configurable: true,
    writable: true,
  })
}

describe("plan-drag", () => {
  beforeEach(() => {
    resetPlanDrag()
  })

  it("packs and parses a namespaced payload", () => {
    expect(parsePlanDrag(packPlanDrag("task", "todo-1"))).toEqual({ kind: "task", id: "todo-1" })
    expect(parsePlanDrag(packPlanDrag("habit", "h1"))).toEqual({ kind: "habit", id: "h1" })
    expect(parsePlanDrag("not-ours")).toBeNull()
  })

  it("reads text/plain when custom taskId was stripped (Chromium drop)", () => {
    const packed = packPlanDrag("task", "rail-todo")
    const dt = fakeTransfer({ "text/plain": packed })
    expect(dt.getData("taskId")).toBe("")
    expect(readPlanDrag(dt)).toEqual({ kind: "task", id: "rail-todo" })
  })

  it("writes text/plain plus legacy keys", () => {
    const dt = fakeTransfer()
    writePlanDrag(dt, "habit", "walk")
    expect(dt.getData("text/plain")).toBe("brain2-plan:habit:walk")
    expect(dt.getData("habitId")).toBe("walk")
    expect(readPlanDrag(dt)).toEqual({ kind: "habit", id: "walk" })
  })

  it("falls back to legacy taskId when that is all the host kept", () => {
    const dt = fakeTransfer({ taskId: "old-todo" })
    expect(readPlanDrag(dt)).toEqual({ kind: "task", id: "old-todo" })
  })

  it("keeps a live payload when DataTransfer is empty on drop", () => {
    writePlanDrag(fakeTransfer(), "habit", "walk")
    expect(peekPlanDrag()).toEqual({ kind: "habit", id: "walk" })
    expect(readPlanDrag(fakeTransfer())).toEqual({ kind: "habit", id: "walk" })
    expect(readPlanDrag(null)).toEqual({ kind: "habit", id: "walk" })
    endPlanDrag()
    expect(readPlanDrag(fakeTransfer())).toBeNull()
  })

  it("emits a pointer drop onto the nearest data-plan-drop target", () => {
    const heard: Array<{ id: string; tag: string }> = []
    const stop = onPlanPointerDrop((payload, _x, _y, target) => {
      heard.push({ id: payload.id, tag: target.dataset.planDrop ?? "" })
    })
    const slot = document.createElement("div")
    slot.dataset.planDrop = "hour"
    document.body.appendChild(slot)
    const inner = document.createElement("span")
    slot.appendChild(inner)
    stubElementsFromPoint([inner, slot])
    beginPlanDrag("task", "rail-todo", "Call")
    expect(emitPlanPointerDrop(12, 40)).toBe(true)
    expect(heard).toEqual([{ id: "rail-todo", tag: "hour" }])
    stop()
    slot.remove()
  })

  it("falls back to elementFromPoint when the host has no elementsFromPoint", () => {
    const heard: string[] = []
    const stop = onPlanPointerDrop((payload) => heard.push(payload.id))
    const slot = document.createElement("div")
    slot.dataset.planDrop = "hour"
    document.body.appendChild(slot)
    delete (document as Partial<Document>).elementsFromPoint
    stubElementFromPoint(slot)
    beginPlanDrag("habit", "walk", "Walk")
    expect(emitPlanPointerDrop(4, 4)).toBe(true)
    expect(heard).toEqual(["walk"])
    stop()
    slot.remove()
  })
})
