import { beforeEach, describe, expect, it } from "vitest"
import { applyModuleOutput } from "@/lib/module-output-apply"
import { pageReadOutput } from "@/lib/speed-read-output"
import { breakdownForCell, recordOf } from "@/lib/habit-contributions"
import { habitsForOutput } from "@/lib/habit-feeds"
import { resolveDetailPanels } from "@/lib/habit-detail-view"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { BOOK_ATTR } from "@/lib/book-types"

const DAY = new Date(2026, 10, 7, 9, 30)
const read = (page: number, at = DAY.getTime() + page * 60_000) =>
  pageReadOutput({ libraryId: "lib-dune", fileName: "Dune_-_Frank_Herbert.pdf", page, openedAt: DAY.getTime(), startedAt: at - 40_000, finishedAt: at })

beforeEach(() => {
  useTaskStore.setState({ tasks: [] })
  useHabitsStore.setState({ weeklyData: {} })
  const habits = useHabitsStore.getState()
  const reading = habits.tasks.find((t) => t.id === "task-9")!
  habits.updateTask({ ...reading, moduleFeeds: [{ moduleId: "speed-read", measure: "pages" }] })
})

describe("applyModuleOutput", () => {
  it("creates the book, logs the day, fills the habit, and breaks the cell down", () => {
    const tasksBefore = useTaskStore.getState().tasks.length
    const a = applyModuleOutput(read(1))
    const b = applyModuleOutput(read(2))
    const c = applyModuleOutput(read(3))
    expect(a.ok && a.subject?.created).toBe(true)
    expect(b.ok && b.subject?.created).toBe(false)
    expect(c.ok && c.habits.map((h) => h.id)).toEqual(["task-9"])
    const books = useTaskStore.getState().tasks.filter((t) => t.type === "book")
    expect(books.some((x) => x.title === "Dune - Frank Herbert" && x.attributes?.[BOOK_ATTR.pagesRead] === 3 && x.attributes?.[BOOK_ATTR.status] === "reading")).toBe(true)
    expect(useTaskStore.getState().tasks.length).toBe(tasksBefore + 2) // the book and one log row for the day
    const cell = useHabitsStoreCell()
    expect(cell).toBe(3)
    const rows = useTaskStore.getState().tasks
    const view = breakdownForCell(rows, "task-9", "pages", formatLocalDateKey(DAY), cell)
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]).toMatchObject({ title: "Dune - Frank Herbert", amount: 3 })
    expect(view.groups[0]!.sessions.map((s) => s.at)).toHaveLength(3)
    expect(view.rest).toBe(0)
  })

  it("counts an output id once", () => {
    applyModuleOutput(read(1))
    const again = applyModuleOutput(read(1))
    expect(again.ok && again.counted).toBe(false)
    expect(useHabitsStoreCell()).toBe(1)
  })

  it("keeps a typed number as its own line", () => {
    const habits = useHabitsStore.getState()
    habits.updateCompletion("task-9", DAY, { value: 5 })
    applyModuleOutput(read(1))
    const rows = useTaskStore.getState().tasks
    const view = breakdownForCell(rows, "task-9", "pages", formatLocalDateKey(DAY), useHabitsStoreCell())
    expect(view.groups[0]!.amount).toBe(1)
    expect(view.rest).toBe(5)
  })

  it("does nothing to habits that are not wired, but still logs the book", () => {
    const habits = useHabitsStore.getState()
    habits.updateTask({ ...habits.tasks.find((t) => t.id === "task-9")!, moduleFeeds: null })
    const out = applyModuleOutput(read(1))
    expect(out.ok && out.habits).toEqual([])
    expect(useHabitsStoreCell()).toBe(0)
    expect(useTaskStore.getState().tasks.some((t) => recordOf(t)?.total === 1)).toBe(true)
  })

  it("refuses a bad report and writes nothing", () => {
    const before = useTaskStore.getState().tasks.length
    const out = applyModuleOutput({ id: "x", moduleId: "speed-read", measure: "parsecs", amount: 1, at: DAY.toISOString() })
    expect(out.ok).toBe(false)
    expect(useTaskStore.getState().tasks.length).toBe(before)
  })

  it("routes by module and measure only", () => {
    const tasks = useHabitsStore.getState().tasks
    expect(habitsForOutput(tasks, { moduleId: "speed-read", measure: "pages" }).map((t) => t.id)).toEqual(["task-9"])
    expect(habitsForOutput(tasks, { moduleId: "speed-read", measure: "minutes" })).toEqual([])
    expect(habitsForOutput(tasks, { moduleId: "other", measure: "pages" })).toEqual([])
    expect(resolveDetailPanels(tasks.find((t) => t.id === "task-9")!).map((p) => p.kind)).toEqual(["sources", "breakdown"])
  })
})

function useHabitsStoreCell(): number {
  return useHabitsStore.getState().weeklyData[formatLocalDateKey(DAY)]?.["task-9"]?.value ?? 0
}
