import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { GEM_IMAGES, GEM_PATHS } from "@/lib/gems-manifest"
import {
  HABIT_GEM_SLOTS,
  defaultHabitGem,
  ensureTaskGem,
  pickRandomCatalogGem,
  resolveHabitGem,
  resolveTaskGem,
  sanitizeHabitGems,
  seedRng,
  stampMissingTaskGems,
} from "@/lib/habit-gems"
import { TaskType, type WeeklyTask } from "@/lib/types"

describe("habit gems catalog", () => {
  it("lists every PNG in public/gems-removebackground", () => {
    const dir = join(process.cwd(), "public/gems-removebackground")
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".png"))
      .sort()
    expect(GEM_IMAGES.slice().sort()).toEqual(files)
    expect(GEM_PATHS).toHaveLength(files.length)
    expect(GEM_PATHS.length).toBeGreaterThanOrEqual(114)
    expect(GEM_PATHS.every((path) => path.startsWith("/gems-removebackground/"))).toBe(true)
  })

  it("defaults each furniture slot to a catalog gem", () => {
    for (const slot of HABIT_GEM_SLOTS) {
      const src = defaultHabitGem(slot)
      expect(src.startsWith("/gems-removebackground/")).toBe(true)
    }
  })

  it("prefers a stored furniture override", () => {
    expect(resolveHabitGem("edit", "/gems-removebackground/gem.png")).toBe("/gems-removebackground/gem.png")
    expect(resolveHabitGem("edit", null)).toBe(defaultHabitGem("edit"))
  })

  it("sanitizes persist blobs", () => {
    expect(sanitizeHabitGems({ boolean: "/gems-removebackground/gem5.png", nope: "x" })).toEqual({
      boolean: "/gems-removebackground/gem5.png",
    })
    expect(sanitizeHabitGems(null)).toEqual({})
  })

  it("prefers a user-picked gem over any catalog fallback", () => {
    expect(resolveTaskGem({ gem: "/gems-removebackground/gem.png" })).toBe("/gems-removebackground/gem.png")
    expect(
      resolveTaskGem({
        gem: "data:image/png;base64,aaa",
      }),
    ).toBe("data:image/png;base64,aaa")
  })

  it("does not use type or category when the habit gem is unset", () => {
    const unsetBoolean = resolveTaskGem({ type: TaskType.BOOLEAN } as Pick<WeeklyTask, "gem">)
    const unsetGoal = resolveTaskGem({ type: TaskType.GOAL } as Pick<WeeklyTask, "gem">)
    expect(unsetBoolean).not.toBe(defaultHabitGem("boolean"))
    expect(unsetGoal).not.toBe(defaultHabitGem("goal"))
    expect(unsetBoolean).toBe(unsetGoal)
    expect(GEM_PATHS).toContain(unsetBoolean)
  })

  it("picks a catalog gem from the full pool", () => {
    const seen = new Set<string>()
    for (let i = 0; i < GEM_PATHS.length; i++) {
      seen.add(pickRandomCatalogGem(() => (i + 0.5) / GEM_PATHS.length))
    }
    expect(seen.size).toBeGreaterThan(1)
    expect([...seen].every((path) => GEM_PATHS.includes(path))).toBe(true)
  })

  it("ensureTaskGem persists a random gem and leaves a custom one", () => {
    const custom = ensureTaskGem({ id: "kept", type: TaskType.BOOLEAN, gem: "/gems-removebackground/gem.png" })
    expect(custom.gem).toBe("/gems-removebackground/gem.png")
    const assigned = ensureTaskGem({ id: "new", type: TaskType.BOOLEAN }, () => 0.1)
    expect(GEM_PATHS).toContain(assigned.gem)
    expect(assigned.gem).not.toBe(defaultHabitGem("boolean"))
    expect(ensureTaskGem(assigned, () => 0.9).gem).toBe(assigned.gem)
  })

  it("stamps missing gems once without re-rolling stored ones", () => {
    const kept = "/gems-removebackground/gem.png"
    const tasks: WeeklyTask[] = [
      { id: "a", name: "A", type: TaskType.BOOLEAN, gem: kept },
      { id: "b", name: "B", type: TaskType.BOOLEAN },
      { id: "c", name: "C", type: TaskType.GOAL },
    ]
    const first = stampMissingTaskGems(tasks, () => 0.2)
    expect(first[0].gem).toBe(kept)
    expect(GEM_PATHS).toContain(first[1].gem)
    expect(GEM_PATHS).toContain(first[2].gem)
    expect(first[1].gem).not.toBe(first[2].gem)
    expect(stampMissingTaskGems(first, () => 0.99)).toBe(first)
  })

  it("seedRng is deterministic", () => {
    const a = seedRng(0x68616231)
    const b = seedRng(0x68616231)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
