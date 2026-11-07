import { beforeEach, describe, expect, it } from "vitest"
import { applyModuleSession } from "@/lib/module-session-apply"
import { sessionOutput } from "@/lib/speed-read-output"
import { sessionBlocks } from "@/lib/module-session"
import { normalizeModuleSession, type ModuleSession } from "@/lib/module-output"
import { applyStep, liveDeps } from "@/lib/wire-bimby/apply"
import { checkStep, stepPasses } from "@/lib/wire-bimby/checks"
import { penNamesIn, planWire, wantsTrack } from "@/lib/wire-bimby/plan"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { BOOK_ATTR } from "@/lib/book-types"

const SAY =
  'whenever I am actively speedreading, I want that time from those sessions to literally be tracked with a new pen called "speedreading" which should be a "counts as" for a pen called reading and autocreate a note for the book being read and how many pages were read in that timeblock and create that timeblock'

const START = new Date(2026, 10, 7, 9, 30).getTime()
const ses = (min = 22, pages = 7) => sessionOutput({ libraryId: "lib-dune", fileName: "Dune_-_Frank_Herbert.pdf", startedAt: START, endedAt: START + min * 60_000, pages })

beforeEach(() => {
  useTaskStore.setState({ tasks: [] })
})

describe("session blocks", () => {
  it("one block with the book and pages in the note", () => {
    const r = normalizeModuleSession(ses())
    expect(r.ok).toBe(true)
    const [b] = sessionBlocks((r as unknown as { session: ModuleSession }).session)
    expect(b).toMatchObject({ date: "2026-11-07", startMin: 570, endMin: 592, title: "Speed Read: Dune - Frank Herbert" })
    expect(b!.notes).toMatch(/Read 7 pages of Dune - Frank Herbert\./)
    expect(b!.notes).toMatch(/9:30 am to 9:52 am/)
  })
  it("splits pages across midnight so the notes add up", () => {
    const start = new Date(2026, 10, 7, 23, 50).getTime()
    const r = normalizeModuleSession(sessionOutput({ fileName: "x.pdf", startedAt: start, endedAt: start + 20 * 60_000, pages: 5 }))
    const blocks = sessionBlocks((r as unknown as { session: ModuleSession }).session)
    expect(blocks).toHaveLength(2)
    expect(blocks.flatMap((b) => [...b.notes.matchAll(/(\d+) pages? of/g)].map((m) => Number(m[1]))).reduce((a, b) => a + b, 0)).toBe(5)
  })
})

describe("the Tracking BIMBY instruction", () => {
  it("reads the sentence", () => {
    expect(wantsTrack(SAY)).toBe(true)
    expect(penNamesIn(SAY)).toEqual(["speedreading", "reading"])
    const plan = planWire(SAY, liveDeps(), new Date())
    expect(plan.steps.map((s) => s.kind)).toEqual(["track"])
    expect(stepPasses(checkStep(plan.steps[0]!, liveDeps()))).toBe(true)
  })

  it("accept makes the pens, nests them, and then a session paints a block with a note and logs the book", () => {
    const step = planWire(SAY, liveDeps(), new Date()).steps[0]!
    expect(applyStep(step).ok).toBe(true)
    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens
    const fast = pens.find((p) => p.name === "speedreading")!
    const reading = pens.find((p) => p.name === "reading")!
    expect(fast.moduleFeed?.moduleId).toBe("speed-read")
    expect(fast.parentIds).toContain(reading.id)

    const done = applyModuleSession(ses())
    expect(done.ok && done.wrote).toBe(1)
    const rows = useTimeTrackingStore.getState().entries.filter((e) => e.penId === fast.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.notes).toMatch(/Read 7 pages of Dune/)
    expect(useTaskStore.getState().tasks.some((t) => t.type === "book" && t.title === "Dune - Frank Herbert")).toBe(true)

    // The same session again replaces its block instead of doubling it.
    applyModuleSession(ses())
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.penId === fast.id)).toHaveLength(1)
    // A second accept is harmless.
    expect(applyStep(step).ok).toBe(true)
    expect(useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens.filter((p) => p.name === "speedreading")).toHaveLength(1)
  })

  it("does nothing when no pen follows the module, and skips a sub-minute stretch", () => {
    useTimeTrackingStore.setState((s) => ({ scopes: s.scopes.map((sc) => ({ ...sc, pens: sc.pens.map((p) => ({ ...p, moduleFeed: undefined })) })) }))
    const none = applyModuleSession(ses())
    expect(none.ok && none.wrote).toBe(0)
    expect(book()).toBe(false)
  })
})
const book = () => useTaskStore.getState().tasks.some((t) => t.attributes?.[BOOK_ATTR.pagesRead] !== undefined)
