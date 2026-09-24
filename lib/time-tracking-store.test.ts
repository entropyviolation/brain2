import { beforeEach, describe, expect, it, vi } from "vitest"
import { defaultScopes, migrateCompanyAndDepth, migrateIphoneScreenTime, migrateRecentPens, migrateScreenTime, migrateSlotsToEntries, penCellStyle, restoreOccupiedScope, useTimeTrackingStore } from "./time-tracking-store"
import { entriesForDay } from "./time-entries"
import { undoLastAction } from "./action-history"

const DAY = "2026-09-17"

beforeEach(() => {
  useTimeTrackingStore.setState({
    entries: [],
    dayNotes: {},
    selectedVariantIds: [],
    gridStep: 5,
    gridSpan: "day",
    infiniteScroll: false,
    scopes: defaultScopes(),
    selectedPenId: null,
    penSort: "recent",
  })
})

describe("painting", () => {
  it("records minute-accurate intervals", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 541, 544, "act-work")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    expect(entry).toMatchObject({ startMin: 541, endMin: 544, penId: "act-work" })
  })

  it("erases with a null pen without disturbing the rest", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 660, "act-work")
    store.paintMinutes(DAY, "activity", 570, 600, null)
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity").map((e) => [e.startMin, e.endMin])).toEqual([
      [540, 570],
      [600, 660],
    ])
  })

  it("stamps the selected variants onto the block", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-social", ["a", "b"])
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0].variantIds).toEqual(["a", "b"])
  })

  it("clears one scope-day and leaves the others", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    store.paintMinutes(DAY, "location", 540, 600, "loc-home")
    store.clearDay(DAY, "activity")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")).toHaveLength(0)
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "location")).toHaveLength(1)
  })

  it("continues a 11 PM–2 AM fill onto the next morning", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 1380, 120, "act-work")
    const thu = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    const fri = useTimeTrackingStore.getState().entriesFor("2026-09-18", "activity")
    expect(thu).toMatchObject([{ startMin: 1380, endMin: 1440, penId: "act-work" }])
    expect(fri).toMatchObject([{ startMin: 0, endMin: 120, penId: "act-work" }])
    expect(thu[0].spanId).toBe(fri[0].spanId)
  })
})

describe("editing entries", () => {
  it("moves a block and clears what it lands on", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    store.paintMinutes(DAY, "activity", 600, 700, "act-rest")
    const work = useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]
    useTimeTrackingStore.getState().updateEntry(work.id, { startMin: 620, endMin: 680 })
    const day = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    expect(day.find((e) => e.penId === "act-work")).toMatchObject({ startMin: 620, endMin: 680 })
    expect(day.filter((e) => e.penId === "act-rest")).toHaveLength(2)
  })

  it("keeps notes on both halves of a split", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 660, "act-work")
    const entry = useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]
    useTimeTrackingStore.getState().updateEntry(entry.id, { notes: "standup" })
    const withNotes = useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]
    useTimeTrackingStore.getState().splitEntryAt(withNotes.id, 600)
    const halves = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    expect(halves).toHaveLength(2)
    expect(halves.every((e) => e.notes === "standup")).toBe(true)
  })

  it("deletes a block", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const entry = useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]
    useTimeTrackingStore.getState().removeEntry(entry.id)
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")).toHaveLength(0)
  })

  it("undoes a deleted block", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const entry = useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]
    useTimeTrackingStore.getState().removeEntry(entry.id)
    undoLastAction()
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")).toHaveLength(1)
  })
})

describe("pens and variants", () => {
  it("returns the new pen's id so it can be selected immediately", () => {
    const id = useTimeTrackingStore.getState().addPen("activity", { name: "Dishes", color: "#0af" })
    expect(id).toBeTruthy()
    expect(useTimeTrackingStore.getState().scopes[0].pens.at(-1)).toMatchObject({ id, name: "Dishes" })
  })

  it("reuses a variant rather than creating a duplicate name", () => {
    const store = useTimeTrackingStore.getState()
    const first = store.addVariant("activity", "act-social", "Elijah")
    const again = useTimeTrackingStore.getState().addVariant("activity", "act-social", "  elijah  ")
    expect(again).toBe(first)
    const pen = useTimeTrackingStore.getState().scopes[0].pens.find((p) => p.id === "act-social")
    expect(pen?.variants).toHaveLength(1)
  })

  it("keeps the time when a variant is deleted, dropping only the label", () => {
    const store = useTimeTrackingStore.getState()
    const id = store.addVariant("activity", "act-social", "Elijah")
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-social", [id])
    useTimeTrackingStore.getState().removeVariant("activity", "act-social", id)
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    expect(entry.endMin - entry.startMin).toBe(60)
    expect(entry.variantIds).toBeUndefined()
  })

  it("removes time painted with a deleted pen", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    store.removePen("activity", "act-work")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")).toHaveLength(0)
  })

  it("drops a stale variant selection when the pen changes", () => {
    const store = useTimeTrackingStore.getState()
    store.setSelectedPen("act-social")
    store.toggleSelectedVariant("elijah")
    expect(useTimeTrackingStore.getState().selectedVariantIds).toEqual(["elijah"])
    useTimeTrackingStore.getState().setSelectedPen("act-work")
    expect(useTimeTrackingStore.getState().selectedVariantIds).toEqual([])
  })
})

describe("v3 → v4 migration", () => {
  it("turns runs of identical slots into one interval each", () => {
    const slots: (string | null)[] = new Array(96).fill(null)
    for (let i = 32; i < 36; i++) slots[i] = "act-work" // 08:00–09:00
    for (let i = 36; i < 38; i++) slots[i] = "act-rest" // 09:00–09:30

    const migrated = migrateSlotsToEntries({
      data: { [DAY]: { activity: slots } },
      blockDetails: [],
    })

    expect(
      entriesForDay(migrated.entries!, DAY, "activity").map((e) => [e.penId, e.startMin, e.endMin]),
    ).toEqual([
      ["act-work", 480, 540],
      ["act-rest", 540, 570],
    ])
  })

  it("splits a pen that was painted twice in the day", () => {
    const slots: (string | null)[] = new Array(96).fill(null)
    slots[4] = "act-work"
    slots[40] = "act-work"
    const migrated = migrateSlotsToEntries({ data: { [DAY]: { activity: slots } } })
    expect(migrated.entries).toHaveLength(2)
  })

  it("carries block details onto the interval they covered", () => {
    const slots: (string | null)[] = new Array(96).fill(null)
    for (let i = 32; i < 36; i++) slots[i] = "act-work"

    const migrated = migrateSlotsToEntries({
      data: { [DAY]: { activity: slots } },
      blockDetails: [
        {
          date: DAY,
          scopeId: "activity",
          penId: "act-work",
          startSlot: 32,
          endSlot: 35,
          notes: "shipped the thing",
          title: "Deep work",
        },
      ],
    })

    expect(migrated.entries?.[0]).toMatchObject({ notes: "shipped the thing", title: "Deep work" })
  })

  it("leaves an already-migrated store alone", () => {
    const entries = [{ id: "e1", date: DAY, scopeId: "activity", penId: "act-work", startMin: 0, endMin: 60 }]
    expect(migrateSlotsToEntries({ entries }).entries).toBe(entries)
  })

  it("adds Company to a vault that does not have it", () => {
    const next = migrateCompanyAndDepth({
      scopes: [{ id: "activity", name: "Activity", pens: [] }],
    })
    expect(next.scopes?.some((s) => s.id === "company")).toBe(true)
  })

  it("does not duplicate an existing Company view", () => {
    const next = migrateCompanyAndDepth({
      scopes: [{ id: "custom", name: "Company", pens: [] }],
    })
    expect(next.scopes?.filter((s) => s.name === "Company")).toHaveLength(1)
  })

  it("v11 adds Screen Time without switching the active view", () => {
    const next = migrateScreenTime({
      scopes: [{ id: "activity", name: "Activity", pens: [] }],
      activeScopeId: "activity",
    })
    expect(next.activeScopeId).toBe("activity")
    const added = next.scopes?.find((s) => s.id === "screentime")
    expect(added?.name).toBe("Screen Time")
    expect(added?.pens.map((p) => p.name)).toEqual([
      "Work",
      "Communication",
      "Browsing",
      "Media",
      "System",
      "Other",
    ])
    expect(added?.depthLabels).toEqual(["Category", "App", "Exact"])
  })

  it("does not duplicate an existing Screen Time view", () => {
    const next = migrateScreenTime({
      scopes: [{ id: "custom", name: "Screen Time", pens: [] }],
      activeScopeId: "custom",
    })
    expect(next.scopes?.filter((s) => s.name === "Screen Time")).toHaveLength(1)
    expect(next.scopes?.some((s) => s.id === "screentime")).toBe(false)
    expect(next.activeScopeId).toBe("custom")
  })

  it("v12 adds iPhone Screen Time without switching the active view", () => {
    const next = migrateIphoneScreenTime({
      scopes: [{ id: "activity", name: "Activity", pens: [] }],
      activeScopeId: "activity",
    })
    expect(next.activeScopeId).toBe("activity")
    const added = next.scopes?.find((s) => s.id === "iphone-screentime")
    expect(added?.name).toBe("iPhone Screen Time")
    expect(added?.pens.map((p) => p.id)).toEqual([
      "iphone-st-cat-work",
      "iphone-st-cat-communication",
      "iphone-st-cat-browsing",
      "iphone-st-cat-media",
      "iphone-st-cat-system",
      "iphone-st-cat-other",
    ])
    expect(added?.depthLabels).toEqual(["Category", "App", "Exact"])
    expect(next.scopes?.find((s) => s.id === "iphone-calls")?.name).toBe("iPhone Calls")
    expect(next.scopes?.find((s) => s.id === "iphone-texts")?.name).toBe("iPhone Texts")
    expect(next.scopes?.find((s) => s.id === "iphone-calls")?.depthLabels).toEqual(["Who", "Exact"])
    expect(next.scopes?.some((s) => s.id === "screentime")).toBe(false)
  })

  it("does not duplicate an existing iPhone Screen Time view", () => {
    const next = migrateIphoneScreenTime({
      scopes: [{ id: "custom-iphone", name: "iPhone Screen Time", pens: [] }],
      activeScopeId: "activity",
    })
    expect(next.scopes?.filter((s) => s.name === "iPhone Screen Time")).toHaveLength(1)
    expect(next.scopes?.some((s) => s.id === "iphone-screentime")).toBe(false)
    expect(next.scopes?.some((s) => s.id === "iphone-calls")).toBe(true)
    expect(next.scopes?.some((s) => s.id === "iphone-texts")).toBe(true)
    expect(next.activeScopeId).toBe("activity")
  })
})

describe("day notes", () => {
  it("stores plaintext against a local date and drops empty keys", () => {
    const store = useTimeTrackingStore.getState()
    store.setDayNotes(DAY, "went to the zoo from 4-5")
    expect(useTimeTrackingStore.getState().dayNotes[DAY]).toBe("went to the zoo from 4-5")
    store.setDayNotes(DAY, "")
    expect(useTimeTrackingStore.getState().dayNotes[DAY]).toBeUndefined()
  })

  it("writes day notes into the dedicated persist key and keeps them across rehydrate", async () => {
    useTimeTrackingStore.getState().setDayNotes(DAY, "went to the zoo from 4-5")
    expect(JSON.parse(localStorage.getItem("brain2-tracking-day-notes") ?? "{}")[DAY]).toBe("went to the zoo from 4-5")

    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().dayNotes[DAY]).toBe("went to the zoo from 4-5")
  })

  it("keeps in-memory notes when a rehydrate blob dropped them", async () => {
    useTimeTrackingStore.getState().setDayNotes(DAY, "ate something at 1pm")
    const raw = localStorage.getItem("cogs-timegrid-store")
    const parsed = JSON.parse(raw ?? "{}") as { state?: Record<string, unknown>; version?: number }
    localStorage.setItem(
      "cogs-timegrid-store",
      JSON.stringify({ ...parsed, state: { ...(parsed.state ?? {}), dayNotes: {} } }),
    )
    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().dayNotes[DAY]).toBe("ate something at 1pm")
  })

  it("restores notes from the dedicated key after a timegrid wipe and empty memory", async () => {
    useTimeTrackingStore.getState().setDayNotes(DAY, "river otter pup notes 2026-09-21 — stayed after refresh")
    const raw = localStorage.getItem("cogs-timegrid-store")
    const parsed = JSON.parse(raw ?? "{}") as { state?: Record<string, unknown>; version?: number }
    localStorage.setItem(
      "cogs-timegrid-store",
      JSON.stringify({ ...parsed, state: { ...(parsed.state ?? {}), dayNotes: {} } }),
    )
    useTimeTrackingStore.setState({ dayNotes: {} })
    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().dayNotes[DAY]).toBe(
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
  })
})

describe("company, parents, precision", () => {
  it("seeds a Company view with conversation nested under Together", () => {
    const company = useTimeTrackingStore.getState().scopes.find((s) => s.id === "company")
    expect(company?.name).toBe("Company")
    expect(company?.pens.map((p) => [p.id, p.parentId])).toEqual([
      ["co-alone", undefined],
      ["co-together", undefined],
      ["co-talking", "co-together"],
    ])
  })

  it("seeds Screen Time with category roots only", () => {
    const screen = useTimeTrackingStore.getState().scopes.find((s) => s.id === "screentime")
    expect(screen?.name).toBe("Screen Time")
    expect(screen?.depthLabels).toEqual(["Category", "App", "Exact"])
    expect(screen?.pens.every((p) => !p.parentId)).toBe(true)
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("seeds iPhone Screen Time with distinct category ids", () => {
    const phone = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-screentime")
    expect(phone?.name).toBe("iPhone Screen Time")
    expect(phone?.depthLabels).toEqual(["Category", "App", "Exact"])
    expect(phone?.pens.every((p) => p.id.startsWith("iphone-st-cat-"))).toBe(true)
    expect(useTimeTrackingStore.getState().scopes.some((s) => s.id === "screentime")).toBe(true)
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("seeds iPhone Calls and iPhone Texts as empty people views", () => {
    const calls = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-calls")
    const texts = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-texts")
    expect(calls?.name).toBe("iPhone Calls")
    expect(texts?.name).toBe("iPhone Texts")
    expect(calls?.pens).toEqual([])
    expect(texts?.pens).toEqual([])
    expect(calls?.depthLabels).toEqual(["Who", "Exact"])
    expect(texts?.depthLabels).toEqual(["Who", "Exact"])
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("nests a pen and refuses a cycle", () => {
    const store = useTimeTrackingStore.getState()
    store.setPenParent("activity", "act-chores", "act-exercise")
    expect(
      useTimeTrackingStore.getState().scopes[0].pens.find((p) => p.id === "act-chores")?.parentId,
    ).toBe("act-exercise")
    store.setPenParent("activity", "act-exercise", "act-chores")
    expect(
      useTimeTrackingStore.getState().scopes[0].pens.find((p) => p.id === "act-exercise")?.parentId,
    ).toBeUndefined()
  })

  it("paints assumed time only when asked", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0].precision).toBeUndefined()
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 600, 660, "act-rest", undefined, undefined, "estimated")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")[1].precision).toBe("estimated")
  })

  it("stamps lastUsedAt when a pen is painted so Recent sort can float it", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-19T12:00:00"))
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-rest")
    const rest = useTimeTrackingStore.getState().scopes[0].pens.find((p) => p.id === "act-rest")
    expect(rest?.lastUsedAt).toBe(Date.parse("2026-09-19T12:00:00"))
    vi.useRealTimers()
  })

  it("v7 stamps lastUsedAt from existing paint", () => {
    const next = migrateRecentPens({
      scopes: [{ id: "activity", name: "Activity", pens: [{ id: "act-work", name: "Work", color: "#00f" }] }],
      entries: [{ id: "e", date: DAY, scopeId: "activity", penId: "act-work", startMin: 540, endMin: 600 }],
    })
    expect(next.penSort).toBe("recent")
    expect(next.scopes![0].pens[0].lastUsedAt).toBe(Date.parse(`${DAY}T00:00:00`) + 540 * 60_000)
  })

  it("v8 opens a view that has paint when the saved view is empty", () => {
    const next = restoreOccupiedScope({
      scopes: [
        { id: "activity", name: "Activity", pens: [{ id: "act-work", name: "Work", color: "#00f" }] },
        { id: "empty", name: "discrete events", pens: [{ id: "def", name: "Default", color: "#6366f1" }] },
      ],
      entries: [{ id: "e", date: DAY, scopeId: "activity", penId: "act-work", startMin: 540, endMin: 600 }],
      activeScopeId: "empty",
      selectedPenId: "def",
    })
    expect(next.activeScopeId).toBe("activity")
    expect(next.selectedPenId).toBe("act-work")
  })

  it("adding a view does not hide the view that already has hours", () => {
    useTimeTrackingStore.setState({ activeScopeId: "activity" })
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    useTimeTrackingStore.getState().addScope("discrete events")
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
    expect(useTimeTrackingStore.getState().scopes.some((s) => s.name === "discrete events")).toBe(true)
  })

  it("keeps a block when a secondary pen is deleted", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    useTimeTrackingStore.getState().updateEntry(entry.id, { secondaryPenIds: ["act-rest"] })
    useTimeTrackingStore.getState().removePen("activity", "act-rest")
    const kept = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    expect(kept).toHaveLength(1)
    expect(kept[0].penId).toBe("act-work")
    expect(kept[0].secondaryPenIds).toBeUndefined()
  })

  it("clears a block when its primary pen is deleted", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    useTimeTrackingStore.getState().updateEntry(entry.id, { secondaryPenIds: ["act-rest"] })
    useTimeTrackingStore.getState().removePen("activity", "act-work")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")).toHaveLength(0)
  })
})

describe("penCellStyle mosaic", () => {
  it("tiles a pen image instead of the solid color", () => {
    const style = penCellStyle({ color: "#10b981", image: "data:image/png;base64,xx" }, undefined, 75)
    expect(style.backgroundImage).toContain('url("data:image/png;base64,xx")')
    expect(style.backgroundSize).toBe("48px 48px")
    expect(style.backgroundPosition).toBe("-27px -1px")
    expect(style.background).toBeUndefined()
  })

  it("falls back to the solid color when there is no image", () => {
    const style = penCellStyle({ color: "#10b981" })
    expect(style.background).toBeTruthy()
    expect(style.backgroundImage).toBeUndefined()
  })
})
