import { describe, expect, it } from "vitest"
import {
  applyLegacyView,
  dashboardFromLegacy,
  installBlocker,
  legacyViewOf,
  makeCopy,
  reconcileCountdowns,
  reconcileLanguages,
  sanitizeDashboard,
  stepInOrder,
  visibleCopies,
  withCopy,
} from "@/lib/widgets/dashboard"
import { allWidgetKinds, sanitizeWidgetSettings, snapWidgetSize } from "@/lib/widgets/kinds"
import {
  DEFAULT_HOME_WIDGET_HIDDEN,
  DEFAULT_HOME_WIDGET_ORDER,
  HOME_WIDGET_IDS,
  migrateHomeWidgetPersist,
} from "@/lib/home-widgets"

const VOCAB = { languages: ["en"], active: "en", levels: {} }

function legacy(order: string[], hidden: string[], extra: Partial<Parameters<typeof dashboardFromLegacy>[0]> = {}) {
  return dashboardFromLegacy({
    order,
    hidden,
    countdownIds: ["default"],
    vocab: VOCAB,
    hadSavedLayout: true,
    now: "2026-10-20T00:00:00.000Z",
    ...extra,
  })
}

describe("widget kinds", () => {
  it("registers every old strip id as a kind", () => {
    const ids = allWidgetKinds().map((kind) => kind.id)
    for (const id of HOME_WIDGET_IDS) expect(ids).toContain(id)
  })

  it("names Countdown and Language study, and gives each kind a gallery page", () => {
    const byId = Object.fromEntries(allWidgetKinds().map((kind) => [kind.id, kind]))
    expect(byId.daysuntil!.name).toBe("Countdown")
    expect(byId.vocab!.name).toBe("Language study")
    expect(byId.vocab!.installs).toBe("perKey")
    for (const kind of allWidgetKinds()) {
      expect(kind.gallery.what.length).toBeGreaterThan(20)
      expect(kind.gallery.how.length).toBeGreaterThan(0)
      expect(kind.sizes).toContain(kind.defaultSize)
    }
  })

  it("lets the pet and Solar remainder be small", () => {
    const byId = Object.fromEntries(allWidgetKinds().map((kind) => [kind.id, kind]))
    expect(byId.pet!.sizes).toContain("1x1")
    expect(byId.solar!.sizes).toContain("1x1")
  })

  it("cleans settings but keeps fields a newer build wrote", () => {
    const clean = sanitizeWidgetSettings("points", { period: "year", chart: "yes", future: "kept" })
    expect(clean.period).toBe("day")
    expect(clean.chart).toBe(true)
    expect(clean.future).toBe("kept")
  })

  it("snaps a size to one the kind can draw", () => {
    expect(snapWidgetSize("solar", "2x2")).toMatch(/^(1x1|2x1)$/)
    expect(snapWidgetSize("moon", "1x3")).toBe("1x3")
  })
})

describe("dashboardFromLegacy", () => {
  it("turns every old id into a copy and keeps hidden ids hidden", () => {
    const data = legacy(DEFAULT_HOME_WIDGET_ORDER, DEFAULT_HOME_WIDGET_HIDDEN)
    for (const id of HOME_WIDGET_IDS) {
      expect(data.copies.some((copy) => copy.kind === id)).toBe(true)
    }
    for (const id of DEFAULT_HOME_WIDGET_HIDDEN) {
      expect(data.copies.filter((copy) => copy.kind === id).every((copy) => copy.hidden)).toBe(true)
    }
    expect(data.unknown).toEqual([])
    expect(data.style).toBe("milled")
    // Kinds that never had a legacy square (Budget) are not part of the old strip.
    const view = legacyViewOf(data)
    const old = (ids: string[]) => ids.filter((id) => id !== "budget")
    expect({ order: old(view.order), hidden: old(view.hidden) }).toEqual({ order: DEFAULT_HOME_WIDGET_ORDER, hidden: [...DEFAULT_HOME_WIDGET_HIDDEN].sort((a, b) => DEFAULT_HOME_WIDGET_ORDER.indexOf(a as never) - DEFAULT_HOME_WIDGET_ORDER.indexOf(b as never)) })
  })

  it("keeps the old reading order for the showing copies", () => {
    const data = legacy(DEFAULT_HOME_WIDGET_ORDER, DEFAULT_HOME_WIDGET_HIDDEN)
    const showing = visibleCopies(data).map((copy) => copy.kind)
    expect(showing).toEqual(DEFAULT_HOME_WIDGET_ORDER.filter((id) => !DEFAULT_HOME_WIDGET_HIDDEN.includes(id)))
  })

  it("makes one Countdown copy per Days Until mark, in place", () => {
    const data = legacy(["review", "daysuntil", "moon"], [], { countdownIds: ["a", "b", "c"] })
    const kinds = visibleCopies(data).map((copy) => `${copy.kind}:${copy.settings.markId ?? ""}`)
    expect(kinds.slice(0, 5)).toEqual(["review:", "daysuntil:a", "daysuntil:b", "daysuntil:c", "moon:"])
  })

  it("hides every Countdown copy when the family was hidden", () => {
    const data = legacy(["daysuntil"], ["daysuntil"], { countdownIds: ["a", "b"] })
    expect(data.copies.filter((copy) => copy.kind === "daysuntil").every((copy) => copy.hidden)).toBe(true)
  })

  it("makes one Language study copy per Vocab language; only the active one shows", () => {
    const data = legacy(["vocab"], [], {
      vocab: { languages: ["en", "fr", "ja"], active: "fr", levels: { fr: "everyday" } },
    })
    const study = data.copies.filter((copy) => copy.kind === "vocab")
    expect(study.map((copy) => copy.key)).toEqual(["en", "fr", "ja"])
    expect(study.filter((copy) => !copy.hidden).map((copy) => copy.key)).toEqual(["fr"])
    expect(study.find((copy) => copy.key === "en")!.settings.role).toBe("native")
    expect(study.find((copy) => copy.key === "fr")!.settings.cefr).toBe("B1")
    expect(study.find((copy) => copy.key === "ja")!.settings.cefr).toBe("A1")
  })

  it("reads the saved Points period into the Points copy", () => {
    const data = legacy(["points"], [], { pointsPeriod: "month" })
    expect(data.copies.find((copy) => copy.kind === "points")!.settings.period).toBe("month")
  })

  it("keeps an id this build does not know instead of dropping it", () => {
    const data = legacy(["review", "user:garden"], [])
    expect(data.unknown.map((entry) => entry.kind)).toEqual(["user:garden"])
    const again = sanitizeDashboard(JSON.parse(JSON.stringify(data)))
    expect(again.unknown).toHaveLength(1)
  })

  it("starts a fresh vault on Dash and a saved one on Milled", () => {
    expect(legacy(DEFAULT_HOME_WIDGET_ORDER, DEFAULT_HOME_WIDGET_HIDDEN, { hadSavedLayout: false }).style).toBe("dash")
    expect(legacy(DEFAULT_HOME_WIDGET_ORDER, DEFAULT_HOME_WIDGET_HIDDEN).style).toBe("milled")
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("keeps every widget from a persist v%i strip", (version) => {
    const old = migrateHomeWidgetPersist(
      { order: ["review", "alltime", "today", "progress", "daysuntil", "weather"], hidden: ["weather"] },
      version,
    )
    const data = legacy(old.order, old.hidden, { countdownIds: ["x", "y"] })
    for (const id of old.order) {
      const kept = data.copies.some((copy) => copy.kind === id) || data.unknown.some((entry) => entry.kind === id)
      expect(kept).toBe(true)
    }
    const view = legacyViewOf(data)
    for (const id of old.hidden) expect(view.hidden).toContain(id)
    expect(data.copies.filter((copy) => copy.kind === "daysuntil")).toHaveLength(2)
  })
})

describe("layout edits", () => {
  it("survives a save and reload", () => {
    const data = legacy(DEFAULT_HOME_WIDGET_ORDER, DEFAULT_HOME_WIDGET_HIDDEN)
    const resized = { ...data, dash: { ...data.dash, sizes: { pet: "1x1" as const, moon: "3x2" as const } } }
    const again = sanitizeDashboard(JSON.parse(JSON.stringify(resized)))
    expect(again.copies).toEqual(data.copies)
    expect(again.dash.sizes.pet).toBe("1x1")
    // Moon cannot draw 3x2; it snaps to a size it has.
    expect(["1x1", "2x1", "1x2", "1x3"]).toContain(again.dash.sizes.moon)
  })

  it("steps a copy past hidden neighbors", () => {
    const order = ["a", "hidden", "b", "c"]
    expect(stepInOrder(order, "b", -1, new Set(["a", "b", "c"]))).toEqual(["b", "a", "hidden", "c"])
    expect(stepInOrder(order, "a", 1, new Set(["a", "b", "c"]))).toEqual(["hidden", "b", "a", "c"])
  })

  it("follows install rules: once, per key, many", () => {
    let data = legacy(["moon", "vocab", "points"], [], { vocab: { languages: ["en"], active: "en", levels: {} } })
    expect(installBlocker(data, "moon")?.kind).toBe("moon")
    expect(installBlocker(data, "vocab", "en")?.key).toBe("en")
    expect(installBlocker(data, "vocab", "fr")).toBeNull()
    expect(installBlocker(data, "points")).toBeNull()
    data = withCopy(data, makeCopy("points", { settings: { period: "week" } }))
    expect(data.copies.filter((copy) => copy.kind === "points")).toHaveLength(2)
  })

  it("applies an old order / hidden pair written elsewhere", () => {
    const data = legacy(["review", "points", "moon"], [])
    const next = applyLegacyView(data, { order: ["moon", "review", "points"], hidden: ["points"] })
    expect(visibleCopies(next, "milled").map((copy) => copy.kind).slice(0, 2)).toEqual(["moon", "review"])
    expect(next.copies.find((copy) => copy.kind === "points")!.hidden).toBe(true)
  })

  it("keeps Countdown copies one to one with marks", () => {
    const data = legacy(["daysuntil"], [], { countdownIds: ["a"] })
    const added = reconcileCountdowns(data, ["a", "b"])
    expect(added.copies.filter((copy) => copy.kind === "daysuntil").map((copy) => copy.settings.markId)).toEqual(["a", "b"])
    const removed = reconcileCountdowns(added, ["b"])
    expect(removed.copies.filter((copy) => copy.kind === "daysuntil").map((copy) => copy.settings.markId)).toEqual(["b"])
  })

  it("gives every Vocab language a hidden Language study copy", () => {
    const data = legacy(["vocab"], [])
    const next = reconcileLanguages(data, ["en", "de"])
    const de = next.copies.find((copy) => copy.kind === "vocab" && copy.key === "de")!
    expect(de.hidden).toBe(true)
    expect(de.settings.role).toBe("studied")
  })

  it("reads an old amber lamp as violet", () => {
    const data = legacy(["moon"], [])
    const raw = JSON.parse(JSON.stringify(data))
    raw.copies[0].lamp = "amber"
    expect(sanitizeDashboard(raw).copies[0]!.lamp).toBe("violet")
  })
})
