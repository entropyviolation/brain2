import { beforeEach, describe, expect, it } from "vitest"
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
