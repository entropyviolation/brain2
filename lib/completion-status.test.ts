import { describe, it, expect } from "vitest"
import {
  COMPLETION_STATUSES,
  COMPLETION_STATUS_LABELS,
  getStatusColor,
  isCompletionStatus,
  effectiveStatus,
  isConsistent,
  withStatus,
  withCompleted,
  normalizeTask,
  isDone,
  isActive,
  isPartial,
  isDeferred,
  isCancelled,
  isOpen,
  isResolved,
  isBlocked,
  isAvailable,
  STATUS_TRANSITIONS,
  allowedTransitions,
  canTransition,
} from "./completion-status"
import type { CompletionStatus, Task } from "@/lib/types"

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  description: "Task",
  stage: "scheduled",
  createdAt: new Date("2026-06-20T12:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("constants", () => {
  it("exposes all five statuses with labels and colours", () => {
    expect([...COMPLETION_STATUSES].sort()).toEqual(
      ["active", "cancelled", "deferred", "done", "partial"].sort(),
    )
    for (const s of COMPLETION_STATUSES) {
      expect(COMPLETION_STATUS_LABELS[s]).toBeTruthy()
      expect(getStatusColor(s)).toContain("bg-")
    }
  })
})

describe("isCompletionStatus", () => {
  it("recognises valid statuses and rejects others", () => {
    expect(isCompletionStatus("done")).toBe(true)
    expect(isCompletionStatus("partial")).toBe(true)
    expect(isCompletionStatus("nope")).toBe(false)
    expect(isCompletionStatus(undefined)).toBe(false)
    expect(isCompletionStatus(null)).toBe(false)
    expect(isCompletionStatus(5)).toBe(false)
  })
})

describe("effectiveStatus", () => {
  it("uses the explicit status when present", () => {
    expect(effectiveStatus(task({ status: "deferred" }))).toBe("deferred")
    expect(effectiveStatus(task({ status: "partial" }))).toBe("partial")
  })

  it("derives from the completed flag when no status is stored", () => {
    expect(effectiveStatus(task({ completed: false }))).toBe("active")
    expect(effectiveStatus(task({ completed: true }))).toBe("done")
  })

  it("treats an explicit status as authoritative over completed", () => {
    expect(effectiveStatus(task({ status: "cancelled", completed: true }))).toBe("cancelled")
  })
})

describe("invariant: status === done ⇔ completed === true", () => {
  it("withStatus keeps completed in sync", () => {
    expect(withStatus(task(), "done")).toMatchObject({ status: "done", completed: true })
    for (const s of ["active", "partial", "deferred", "cancelled"] as CompletionStatus[]) {
      const t = withStatus(task({ completed: true }), s)
      expect(t.status).toBe(s)
      expect(t.completed).toBe(false)
      expect(isConsistent(t)).toBe(true)
    }
  })

  it("every withStatus result is consistent", () => {
    for (const s of COMPLETION_STATUSES) {
      expect(isConsistent(withStatus(task(), s))).toBe(true)
    }
  })

  it("does not mutate the original task", () => {
    const original = task({ status: "active" })
    const next = withStatus(original, "done")
    expect(original.status).toBe("active")
    expect(original.completed).toBe(false)
    expect(next).not.toBe(original)
  })
})

describe("withCompleted", () => {
  it("completing forces done", () => {
    const t = withCompleted(task({ status: "partial" }), true)
    expect(t).toMatchObject({ completed: true, status: "done" })
  })

  it("un-completing a done task reverts to active", () => {
    const t = withCompleted(task({ status: "done", completed: true }), false)
    expect(t).toMatchObject({ completed: false, status: "active" })
  })

  it("un-completing preserves a non-done status", () => {
    const t = withCompleted(task({ status: "deferred", completed: false }), false)
    expect(t).toMatchObject({ completed: false, status: "deferred" })
  })

  it("un-completing a legacy task with no status yields active", () => {
    const t = withCompleted(task({ completed: true }), false)
    expect(t).toMatchObject({ completed: false, status: "active" })
  })
})

describe("isConsistent / normalizeTask", () => {
  it("flags inconsistent records", () => {
    expect(isConsistent(task({ status: "active", completed: true }))).toBe(false)
    expect(isConsistent(task({ status: "done", completed: false }))).toBe(false)
    expect(isConsistent(task({ status: "done", completed: true }))).toBe(true)
    expect(isConsistent(task({ completed: false }))).toBe(true)
  })

  it("normalizeTask repairs inconsistencies with status as authority", () => {
    expect(normalizeTask(task({ status: "active", completed: true }))).toMatchObject({
      status: "active",
      completed: false,
    })
    expect(normalizeTask(task({ status: "done", completed: false }))).toMatchObject({
      status: "done",
      completed: true,
    })
    // legacy completed with no status → done
    expect(normalizeTask(task({ completed: true }))).toMatchObject({ status: "done", completed: true })
  })
})

describe("classification predicates", () => {
  it("classify each status exactly once", () => {
    const preds = { active: isActive, partial: isPartial, deferred: isDeferred, cancelled: isCancelled, done: isDone }
    for (const s of COMPLETION_STATUSES) {
      for (const [name, pred] of Object.entries(preds)) {
        expect(pred(task({ status: s }))).toBe(name === s)
      }
    }
  })

  it("isOpen covers active and partial only", () => {
    expect(isOpen(task({ status: "active" }))).toBe(true)
    expect(isOpen(task({ status: "partial" }))).toBe(true)
    expect(isOpen(task({ status: "deferred" }))).toBe(false)
    expect(isOpen(task({ status: "cancelled" }))).toBe(false)
    expect(isOpen(task({ status: "done" }))).toBe(false)
  })

  it("isResolved covers done and cancelled only", () => {
    expect(isResolved(task({ status: "done" }))).toBe(true)
    expect(isResolved(task({ status: "cancelled" }))).toBe(true)
    expect(isResolved(task({ status: "active" }))).toBe(false)
    expect(isResolved(task({ status: "partial" }))).toBe(false)
    expect(isResolved(task({ status: "deferred" }))).toBe(false)
  })

  it("works on legacy tasks via the completed flag", () => {
    expect(isDone(task({ completed: true }))).toBe(true)
    expect(isActive(task({ completed: false }))).toBe(true)
  })
})

describe("dependency-aware availability", () => {
  it("a task with no dependencies is never blocked", () => {
    expect(isBlocked(task(), [])).toBe(false)
    expect(isAvailable(task({ status: "active" }), [])).toBe(true)
  })

  it("is blocked while a dependency is still open", () => {
    const dep = task({ id: "dep", status: "active" })
    const t = task({ id: "t", status: "active", dependencies: ["dep"] })
    expect(isBlocked(t, [dep, t])).toBe(true)
    expect(isAvailable(t, [dep, t])).toBe(false)
  })

  it("is unblocked once the dependency is done or cancelled", () => {
    const t = task({ id: "t", status: "active", dependencies: ["dep"] })
    expect(isAvailable(t, [task({ id: "dep", status: "done", completed: true }), t])).toBe(true)
    expect(isAvailable(t, [task({ id: "dep", status: "cancelled" }), t])).toBe(true)
  })

  it("treats a missing dependency as satisfied", () => {
    const t = task({ id: "t", status: "active", dependencies: ["ghost"] })
    expect(isBlocked(t, [t])).toBe(false)
    expect(isAvailable(t, [t])).toBe(true)
  })

  it("a non-open task is never available even if unblocked", () => {
    expect(isAvailable(task({ status: "deferred" }), [])).toBe(false)
    expect(isAvailable(task({ status: "done", completed: true }), [])).toBe(false)
  })

  it("accepts a Map as well as an array", () => {
    const dep = task({ id: "dep", status: "active" })
    const t = task({ id: "t", status: "active", dependencies: ["dep"] })
    const map = new Map([
      ["dep", dep],
      ["t", t],
    ])
    expect(isBlocked(t, map)).toBe(true)
  })
})

describe("transitions", () => {
  it("never lists a self-transition", () => {
    for (const s of COMPLETION_STATUSES) {
      expect(STATUS_TRANSITIONS[s]).not.toContain(s)
      expect(allowedTransitions(s)).not.toContain(s)
    }
  })

  it("open statuses can move anywhere else", () => {
    expect(canTransition("active", "done")).toBe(true)
    expect(canTransition("active", "partial")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("partial", "done")).toBe(true)
    expect(canTransition("deferred", "active")).toBe(true)
  })

  it("resolved statuses can only reopen to active", () => {
    expect(allowedTransitions("done")).toEqual(["active"])
    expect(allowedTransitions("cancelled")).toEqual(["active"])
    expect(canTransition("done", "partial")).toBe(false)
    expect(canTransition("cancelled", "deferred")).toBe(false)
    expect(canTransition("done", "active")).toBe(true)
  })

  it("self-transition is rejected", () => {
    for (const s of COMPLETION_STATUSES) {
      expect(canTransition(s, s)).toBe(false)
    }
  })
})
