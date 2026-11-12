import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { buildContext } from "@/lib/habit-helper/accept"
import { starterFlow } from "@/lib/habit-helper/flow"
import { runHabitsBimby } from "@/lib/habit-helper/run"
import { useHabitsBimby } from "@/lib/habit-helper/store"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { HabitsBimbyDialog } from "./habit-helper-dialog"

// No model in tests: the BIMBY reads by rules, as it does with Ollama off.
vi.mock("@/lib/bim-flow/chat-models", () => ({ chatCrew: async () => null }))

const habit = (o: Partial<WeeklyTask> & Pick<WeeklyTask, "id" | "name">): WeeklyTask => ({ type: TaskType.BOOLEAN, frequency: "daily", ...o })

async function seed(text: string) {
  const run = await runHabitsBimby({ text, flow: starterFlow(), ctx: buildContext(), call: null, ladder: [] })
  useHabitsBimby.setState({
    busy: false,
    pending: null,
    greetedOn: formatLocalDateKey(new Date()),
    lines: [
      { id: "u", who: "you", text, at: new Date().toISOString() },
      { id: "h", who: "bimby", text: run.reply, at: new Date().toISOString(), route: run.route, proposals: run.proposals, decided: {}, asks: run.asks, chosen: {} },
    ],
  })
  return run
}

describe("Habits BIMBY dialog", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({
      tasks: [
        habit({ id: "water", name: "Drink water" }),
        habit({ id: "read", name: "Read 5 pages", type: TaskType.GOAL, goal: 5, unit: "pages" }),
        habit({ id: "outside", name: "Go outside" }),
      ],
      weeklyData: {},
    })
  })

  it("writes nothing until a row is accepted, then writes that row only", async () => {
    await seed("drank water, read 10 pages")
    render(<HabitsBimbyDialog open onOpenChange={() => {}} />)
    expect(document.querySelectorAll(".hh-row")).toHaveLength(2)
    const today = formatLocalDateKey(new Date())
    expect(useHabitsStore.getState().weeklyData[today]).toBeUndefined()
    fireEvent.click(screen.getAllByText("Accept")[1]!)
    expect(useHabitsStore.getState().weeklyData[today]?.read?.value).toBe(10)
    expect(useHabitsStore.getState().weeklyData[today]?.water).toBeUndefined()
  })

  it("Neutral writes the row the same way and marks it, so it is never a good example", async () => {
    await seed("drank water, read 10 pages")
    render(<HabitsBimbyDialog open onOpenChange={() => {}} />)
    fireEvent.click(screen.getAllByText("Neutral")[1]!)
    const today = formatLocalDateKey(new Date())
    expect(useHabitsStore.getState().weeklyData[today]?.read?.value).toBe(10)
    const line = useHabitsBimby.getState().lines.find((l) => l.id === "h")!
    const id = Object.keys(line.decided ?? {})[0]!
    expect(line.decided?.[id]).toBe("accepted")
    expect(line.grades?.[id]).toBe("ok")
    expect(screen.getByText("accepted · neutral")).toBeTruthy()
  })

  it("Accept all writes every open row, and a miss keeps its reason word for word", async () => {
    await seed("drank water. I didn't go outside today because I woke up too late and it was dark")
    render(<HabitsBimbyDialog open onOpenChange={() => {}} />)
    fireEvent.click(screen.getByText("Accept all 2"))
    const cell = useHabitsStore.getState().weeklyData[formatLocalDateKey(new Date())]
    expect(cell?.water?.completed).toBe(true)
    expect(cell?.outside?.missedOpportunity).toBe(true)
    expect(cell?.outside?.missReason).toBe("I woke up too late and it was dark")
  })

  it("writes a shorthand name after approval", async () => {
    await seed("give my habits shorthand names")
    render(<HabitsBimbyDialog open onOpenChange={() => {}} />)
    fireEvent.click(screen.getByText("Accept all 3"))
    expect(useHabitsStore.getState().tasks.map((t) => t.shorthandName)).toEqual(["water", "read", "outside"])
  })
})

describe("handed over from BIM chat", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsBimby.setState({ lines: [], busy: false, pending: { habitId: "water", day: "2026-01-01" }, pendingSpan: null })
    useHabitsStore.setState({
      tasks: [
        habit({ id: "skin", name: "Skin care" }),
        habit({ id: "stretch", name: "Stretch" }),
        habit({ id: "water", name: "Drink water" }),
        habit({ id: "unf", name: "Unfollow 1 person" }),
      ],
      weeklyData: {},
    })
  })

  it("tell habits bimby … proposes every habit, saves nothing, and Accept writes them all", async () => {
    const { tryHandoff } = await import("@/lib/ingest/bimby-handoff")
    const { awaitingFromBim } = await import("@/lib/habit-helper/store")
    const out = await tryHandoff("Tell habits bimby i did skincare, stretched, drank water, unfollowed 1 person")
    expect(out?.route).toBe("HANDOFF · Habits BIMBY")
    const s = useHabitsBimby.getState()
    const line = s.lines[s.lines.length - 1]!
    // BIM chat draws the rows from this line (`components/Bim/habit-card.tsx`), so the reply names it and does not list them.
    expect(out?.habitLineId).toBe(line.id)
    expect(line.proposals?.map((p) => p.habit)).toEqual(["Skin care", "Stretch", "Drink water", "Unfollow 1 person"])
    // An open why-question is not answered by words from BIM chat.
    expect(line.route).toBe("log")
    expect(s.pending).not.toBeNull()
    expect(awaitingFromBim(s.lines)).toBe(4)
    const today = formatLocalDateKey(new Date())
    expect(useHabitsStore.getState().weeklyData[today]).toBeUndefined()
    s.accept(line.id)
    const cell = useHabitsStore.getState().weeklyData[today]
    expect(["skin", "stretch", "water", "unf"].map((id) => !!cell?.[id]?.completed)).toEqual([true, true, true, true])
    expect(awaitingFromBim(useHabitsBimby.getState().lines)).toBe(0)
  })

  it("a plain list of habits done is handed over without naming the BIMBY", async () => {
    const { tryHabitAuto } = await import("@/lib/ingest/bimby-handoff")
    const now = new Date()
    // One habit after BIM's own `did` command, any other command, and a line about something else stay where they were.
    expect(await tryHabitAuto("did skincare", now, true)).toBeNull()
    expect(await tryHabitAuto("log stretched, drank water", now, true)).toBeNull()
    expect(await tryHabitAuto("called mom, paid rent", now)).toBeNull()
    expect(useHabitsBimby.getState().lines).toEqual([])
    const out = await tryHabitAuto("did skincare, stretched, drank water", now, true)
    expect(out?.route).toBe("HANDOFF · Habits BIMBY · auto")
    const s = useHabitsBimby.getState()
    const line = s.lines[s.lines.length - 1]!
    expect(out?.habitLineId).toBe(line.id)
    expect(line.fromBim).toBe(true)
    expect(line.proposals?.map((p) => p.habit)).toEqual(["Skin care", "Stretch", "Drink water"])
    expect(useHabitsStore.getState().weeklyData[formatLocalDateKey(now)]).toBeUndefined()
  })
})
