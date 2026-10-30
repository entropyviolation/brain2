import { describe, expect, it } from "vitest"
import { combineImpactSentence, combineSatisfied, shareCheck } from "./dependency-combine"
import type { CombineChild, CombineParent } from "./dependency-combine"

const today = "2026-10-28"

function child(partial: CombineChild): CombineChild {
  return partial
}

function link(targetId: string, weight?: number) {
  return { id: `l-${targetId}`, relation: "part-of", targetId, ...(weight === undefined ? {} : { weight }) }
}

describe("combineSatisfied", () => {
  const open = child({ id: "open", title: "Open route", completed: false })
  const done = child({ id: "done", title: "Done route", completed: true })
  const missed = child({ id: "late", title: "Late route", completed: false, status: "missed" })
  const cancelled = child({ id: "drop", title: "Dropped", completed: false, status: "cancelled" })

  it("with no mode, every open child blocks and weight is ignored", () => {
    const parent: CombineParent = {
      id: "goal",
      dependencies: ["done", "open"],
      links: [link("done", 1)],
    }
    expect(combineSatisfied(parent, [done, open])).toBe(false)
    expect(combineSatisfied({ dependencies: ["done", "late"] }, [done, missed])).toBe(true)
    expect(combineSatisfied({ dependencies: ["drop"] }, [cancelled])).toBe(false)
    expect(combineSatisfied({ dependencies: [] }, [open])).toBe(true)
    expect(combineSatisfied({ dependencies: ["ghost"] }, [open])).toBe(true)
  })

  it("additive: met shares sum, and an unset weight splits the remainder without writing it", () => {
    const parent: CombineParent = {
      id: "goal",
      dependencies: ["read", "write"],
      dependencyCombine: { mode: "additive" },
      links: [link("read", 0.25), link("write", 0.75)],
    }
    const read = child({ id: "read", title: "Read", completed: true })
    const write = child({ id: "write", title: "Write", completed: false })
    expect(combineSatisfied(parent, [read, write])).toBe(false)
    expect(combineSatisfied(parent, [read, { ...write, completed: true }])).toBe(true)
    expect(parent.links?.[0].weight).toBe(0.25)

    const split: CombineParent = {
      id: "goal",
      dependencies: ["a", "b", "c"],
      dependencyCombine: { mode: "additive" },
      links: [link("a", 0.5)],
    }
    const a = child({ id: "a", title: "A", completed: true })
    const b = child({ id: "b", title: "B", completed: true })
    const c = child({ id: "c", title: "C", completed: false })
    expect(combineSatisfied(split, [a, b, c])).toBe(false)
    expect(combineSatisfied(split, [a, b, { ...c, completed: true }])).toBe(true)
    expect(split.links).toEqual([link("a", 0.5)])
  })

  it("additive does not rescale shares that sum short of 1", () => {
    const parent: CombineParent = {
      id: "goal",
      dependencies: ["a", "b"],
      dependencyCombine: { mode: "additive" },
      links: [link("a", 0.4), link("b", 0.4)],
    }
    const both = [
      child({ id: "a", title: "A", completed: true }),
      child({ id: "b", title: "B", completed: true }),
    ]
    expect(combineSatisfied(parent, both)).toBe(false)
    expect(shareCheck(parent, both)).toBe("Shares sum to 0.80, not 1.")
    expect(parent.links?.map((row) => row.weight)).toEqual([0.4, 0.4])
  })

  it("reads the child's link to the parent when the parent link has no weight", () => {
    const parent: CombineParent = {
      id: "goal",
      dependencies: ["a", "b"],
      dependencyCombine: { mode: "additive" },
    }
    const a = child({
      id: "a",
      title: "A",
      completed: true,
      links: [link("goal", 1)],
    })
    const b = child({ id: "b", title: "B", completed: false })
    expect(combineSatisfied(parent, [a, b])).toBe(true)
  })

  it("redundant: any one met child is enough, including missed", () => {
    const parent: CombineParent = {
      dependencies: ["open", "late"],
      dependencyCombine: { mode: "redundant" },
    }
    expect(combineSatisfied(parent, [open, missed])).toBe(true)
    expect(combineSatisfied(parent, [open, { ...missed, status: "active", completed: false }])).toBe(false)
  })

  it("threshold: need is a count of met children", () => {
    const kids = [
      child({ id: "a", completed: true }),
      child({ id: "b", completed: false, status: "missed" }),
      child({ id: "c", completed: false }),
      child({ id: "d", completed: false }),
    ]
    const parent: CombineParent = {
      dependencies: ["a", "b", "c", "d"],
      dependencyCombine: { mode: "threshold", need: 2 },
    }
    expect(combineSatisfied(parent, kids)).toBe(true)
    expect(combineSatisfied({ ...parent, dependencyCombine: { mode: "threshold", need: 3 } }, kids)).toBe(false)
    expect(combineSatisfied({ ...parent, dependencyCombine: { mode: "threshold" } }, kids)).toBe(false)
  })
})

describe("shareCheck", () => {
  it("is quiet when unset weights complete the remainder, and when the mode is not additive", () => {
    const additive: CombineParent = {
      id: "goal",
      dependencies: ["a", "b"],
      dependencyCombine: { mode: "additive" },
      links: [link("a", 0.4)],
    }
    const kids = [child({ id: "a", completed: false }), child({ id: "b", completed: false })]
    expect(shareCheck(additive, kids)).toBeNull()
    expect(shareCheck({ ...additive, links: [link("a", 0.99), link("b", 0.01)] }, kids)).toBeNull()
    expect(shareCheck({ ...additive, links: [link("a", 0.96), link("b", 0.01)] }, kids)).toBe(
      "Shares sum to 0.97, not 1.",
    )
    expect(shareCheck({ dependencies: ["a"], links: [link("a", 0.2)] }, kids)).toBeNull()
    expect(
      shareCheck({ dependencies: ["a", "b"], dependencyCombine: { mode: "redundant" }, links: [link("a", 0.2)] }, kids),
    ).toBeNull()
    expect(
      shareCheck(
        {
          id: "goal",
          dependencies: ["a", "b", "c"],
          dependencyCombine: { mode: "additive" },
          links: [link("a", 0.9), link("b", 0.9)],
        },
        [child({ id: "a", completed: false }), child({ id: "b", completed: false }), child({ id: "c", completed: false })],
      ),
    ).toBe("Shares sum to 1.80, not 1.")
  })
})

describe("combineImpactSentence", () => {
  it("dates a redundant route and names its deadline or scheduled day", () => {
    const parent: CombineParent = {
      dependencies: ["ship", "backup"],
      dependencyCombine: { mode: "redundant" },
    }
    const ship = child({ id: "ship", title: "Ship", completed: true })
    const backup = child({
      id: "backup",
      title: "Backup",
      completed: false,
      deadline: "2026-11-03",
      scheduledDate: "2026-11-01",
    })
    expect(combineImpactSentence(parent, [ship, backup], today)).toBe(
      "As of 2026-10-28, redundant: the goal loses nothing while Backup is open (deadline 2026-11-03).",
    )
    const scheduledOnly = { ...backup, deadline: undefined, scheduledDate: "2026-11-04" }
    expect(combineImpactSentence(parent, [ship, scheduledOnly], today)).toBe(
      "As of 2026-10-28, redundant: the goal loses nothing while Backup is open (scheduled 2026-11-04).",
    )
  })

  it("dates the share still open, the routes still needed, and the old waiting-on sentence", () => {
    const kids = [
      child({ id: "read", title: "Read", completed: true }),
      child({ id: "write", title: "Write", completed: false }),
    ]
    expect(
      combineImpactSentence(
        {
          id: "goal",
          dependencies: ["read", "write"],
          dependencyCombine: { mode: "additive" },
          links: [link("read", 0.4), link("write", 0.6)],
        },
        kids,
        today,
      ),
    ).toBe("As of 2026-10-28, additive: 0.60 of the share is still open.")
    expect(
      combineImpactSentence(
        { dependencies: ["read", "write", "edit", "ship"], dependencyCombine: { mode: "threshold", need: 2 } },
        [
          ...kids,
          child({ id: "edit", title: "Edit", completed: false }),
          child({ id: "ship", title: "Ship", completed: false }),
        ],
        today,
      ),
    ).toBe("As of 2026-10-28, threshold: 1 route remains against a count of 2.")
    expect(combineImpactSentence({ dependencies: ["write", "read"] }, kids, today)).toBe(
      "As of 2026-10-28, waiting on Write.",
    )
    expect(combineImpactSentence({ dependencies: ["read"] }, kids, today)).toBe(
      "As of 2026-10-28, waiting on nothing.",
    )
  })
})
