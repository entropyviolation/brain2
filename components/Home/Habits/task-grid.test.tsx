import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskGrid } from "./task-grid"

function cssBox(el: Element) {
  const s = window.getComputedStyle(el)
  return {
    width: s.width,
    height: s.height,
    minWidth: s.minWidth,
    minHeight: s.minHeight,
    maxWidth: s.maxWidth,
    maxHeight: s.maxHeight,
  }
}

describe("TaskGrid", () => {
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 16 + i))
  const tasks = [
    { id: "h1", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" as const },
  ]

  it("renders habit rows and weekday headers", () => {
    const { container } = render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    expect(screen.getByText("Drink water")).toBeInTheDocument()
    expect(screen.getByText("Daily Completion")).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
    expect(screen.queryByText("Sun 6/21")).not.toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "%" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    const act = document.querySelector("th.col-act")
    const name = document.querySelector("th.col-name")
    expect(act && name && (act.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy()
    expect(document.querySelectorAll("tbody tr:first-child img.habit-gem")).toHaveLength(1)
    expect(document.querySelector(".habit-name img")).toBeNull()
    expect(document.querySelector(".habit-name-title")?.textContent).toBe("Drink water")
    const wrap = container.querySelector(".habit-grid-wrap") as HTMLElement
    expect(window.getComputedStyle(wrap).overflowY).toBe("visible")
    const socket = document.querySelector(".habit-gem-socket") as HTMLElement
    expect(socket).toBeTruthy()
    expect(window.getComputedStyle(socket).borderRadius).not.toBe("50%")
    expect(window.getComputedStyle(socket).backgroundImage).toBe("none")
    expect(window.getComputedStyle(socket).width).toBe("20px")
    const rowGem = document.querySelector(".habit-gem-socket img.habit-gem") as HTMLElement
    expect(window.getComputedStyle(rowGem).width).toBe("18px")
    const lampCell = document.querySelector(".habit-lamp-cell")
    expect(lampCell).toBeTruthy()
    expect(window.getComputedStyle(lampCell as Element).overflow).toBe("visible")
  })

  it("shows the full title and puts streak plus multiplier under it", () => {
    const long = {
      id: "h2",
      name: "Exercise for at least 30 min",
      type: TaskType.BOOLEAN,
      rewardValue: 10,
      frequency: "daily" as const,
      priorityPinned: true,
    }
    const weeklyData = {
      "2026-06-16": { h2: { completed: true } },
      "2026-06-17": { h2: { completed: true } },
    }
    const { container } = render(
      <TaskGrid
        tasks={[long]}
        weeklyData={weeklyData}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        selectedDate={weekDates[0]}
      />,
    )
    const title = container.querySelector(".habit-name-title")
    expect(title?.textContent).toBe("Exercise for at least 30 min")
    expect(window.getComputedStyle(title as Element).textOverflow).not.toBe("ellipsis")
    expect(window.getComputedStyle(title as Element).whiteSpace).toBe("normal")
    const meta = container.querySelector(".habit-name-meta")
    expect(meta).toBeTruthy()
    expect(meta?.textContent).toMatch(/×/)
    expect(meta?.textContent).toMatch(/2d/)
    expect(title?.compareDocumentPosition(meta as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll("img.habit-gem")).toHaveLength(1)
  })

  it("marks today's column without a blob in the header", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20))
    const { container } = render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    const todayHeader = container.querySelector("th.habit-day-today")
    expect(todayHeader).toBeTruthy()
    expect(todayHeader?.textContent).toContain("Sat")
    expect(todayHeader?.textContent).not.toMatch(/●/)
    expect(todayHeader?.className).toContain("habit-day-today")
    vi.useRealTimers()
  })

  it("calls onUpdateTaskCompletion when a boolean lamp is toggled", async () => {
    const user = userEvent.setup()
    const onUpdateTaskCompletion = vi.fn()
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={onUpdateTaskCompletion}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        viewMode="day"
        selectedDate={weekDates[4]}
      />,
    )

    const lamps = screen.getAllByRole("checkbox")
    await user.click(lamps[4])
    expect(onUpdateTaskCompletion).toHaveBeenCalledWith("h1", weekDates[4], { completed: true })
  })

  it("keeps a decimal completion while it is being typed", async () => {
    const user = userEvent.setup()
    const onUpdateTaskCompletion = vi.fn()
    const goal = {
      id: "pages",
      name: "Read",
      type: TaskType.GOAL,
      goal: 10,
      unit: "pages",
      rewardValue: 10,
      frequency: "daily" as const,
    }
    render(
      <TaskGrid
        tasks={[goal]}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={onUpdateTaskCompletion}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        viewMode="day"
        selectedDate={weekDates[4]}
      />,
    )
    const field = screen.getByRole("textbox", { name: "Read 2026-06-20" })
    await user.click(field)
    await user.type(field, "0.5")
    expect(field).toHaveValue("0.5")
    expect(onUpdateTaskCompletion).toHaveBeenLastCalledWith("pages", weekDates[4], { value: 0.5, goal: 10 })
  })

  it("maps the same percent onto LED readouts", () => {
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 46}
        calculateDayPercentage={() => 48}
      />,
    )
    expect(screen.getByRole("meter", { name: /Drink water week 46%/ })).toHaveAttribute("aria-valuenow", "46")
    expect(screen.getAllByRole("meter", { name: /daily 48%/ }).length).toBe(7)
    expect(document.querySelector(".hab-pled-bar")).toBeTruthy()
    expect(document.querySelector("[class*='progress']")).toBeNull()
  })

  it("shows only today and the week % column in day view", () => {
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 20}
        calculateDayPercentage={() => 40}
        dayView
        selectedDate={weekDates[4]}
      />,
    )
    expect(document.querySelectorAll("th.col-day")).toHaveLength(1)
    expect(document.querySelector("th.col-day")?.textContent).toMatch(/Sat/)
    expect(screen.queryByText("Sun")).not.toBeInTheDocument()
    expect(screen.queryByText("Mon")).not.toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "%" })).toBeInTheDocument()
    expect(screen.getByRole("meter", { name: /Drink water week 20%/ })).toBeInTheDocument()
    expect(screen.getAllByRole("meter", { name: /daily 40%/ })).toHaveLength(1)
    expect(document.querySelector(".habit-grid")?.classList.contains("is-day-view")).toBe(true)
    const title = document.querySelector(".habit-name-title") as HTMLElement
    expect(window.getComputedStyle(title).fontWeight).toMatch(/700|bold/)
    expect(window.getComputedStyle(title).fontSize).toBe("15px")
    const daily = screen.getByRole("meter", { name: /daily 40%/ })
    expect(daily).toHaveAttribute("data-density", "wide")
    expect(daily.querySelectorAll(".hab-pled-bar-tick")).toHaveLength(9)
    expect((daily.querySelector(".hab-pled-bar-fill") as HTMLElement).style.width).toBe("40%")
    expect(screen.getByRole("meter", { name: /Drink water week 20%/ })).toHaveAttribute("data-density", "compact")
    expect(screen.getByRole("meter", { name: /Drink water week 20%/ }).querySelectorAll(".hab-pled-bar-lamp")).toHaveLength(10)
    expect(window.getComputedStyle(document.querySelector("th.col-day") as Element).minWidth).toBe("12rem")
  })

  it("lets leftover width go to day columns and does not nest a Y scroller on a wide wrap", () => {
    const { container } = render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    const wrap = container.querySelector(".habit-grid-wrap") as HTMLElement
    const name = container.querySelector("th.col-name") as HTMLElement
    const day = container.querySelector("th.col-day") as HTMLElement
    expect(window.getComputedStyle(wrap).overflowY).toBe("visible")
    expect(window.getComputedStyle(wrap).overflowX).toBe("visible")
    expect(window.getComputedStyle(name).width).toBe("12.5rem")
    expect(window.getComputedStyle(day).minWidth).toBe("7.5rem")
    expect(window.getComputedStyle(day).width).toBe("auto")
    const title = container.querySelector(".habit-name-title") as HTMLElement
    expect(window.getComputedStyle(title).fontWeight).toBe("600")
    expect(window.getComputedStyle(title).fontSize).not.toBe("15px")
    expect(container.querySelector("tr.font-semibold .hab-pled-bar")).toHaveAttribute("data-density", "compact")
    expect(container.querySelector("tr.font-semibold .hab-pled-bar")?.querySelectorAll(".hab-pled-bar-lamp")).toHaveLength(10)
  })

  it("keeps every row percent channel the same slot width", () => {
    const rows = [
      { id: "a", name: "A", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" as const },
      { id: "b", name: "B", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" as const },
      { id: "c", name: "C", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" as const },
    ]
    const pct = (id: string) => (id === "a" ? 0 : id === "b" ? 28 : 100)
    const { container } = render(
      <TaskGrid
        tasks={rows}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={(id) => pct(id)}
        calculateDayPercentage={() => 0}
      />,
    )
    const slots = [...container.querySelectorAll("tbody td.col-pct .habit-pct")]
    const bars = [...container.querySelectorAll("tbody td.col-pct .hab-pled-bar")]
    const reads = [...container.querySelectorAll("tbody td.col-pct .hab-pled-bar-read")]
    expect(slots).toHaveLength(3)
    expect(new Set(slots.map((el) => cssBox(el).width)).size).toBe(1)
    expect(new Set(slots.map((el) => cssBox(el).height))).toEqual(new Set(["22px"]))
    expect(new Set(bars.map((el) => window.getComputedStyle(el).width))).toEqual(new Set(["100%"]))
    expect(new Set(reads.map((el) => window.getComputedStyle(el).width))).toEqual(new Set(["3.2em"]))
  })

  it("uses one number-slot size for goal cells even when suffixes differ", () => {
    const study = {
      id: "study",
      name: "Study for 1 hour",
      type: TaskType.GOAL,
      goal: 60,
      rewardValue: 10,
      frequency: "daily" as const,
    }
    const work = {
      id: "work",
      name: "Work for 5 hours",
      type: TaskType.GOAL,
      goal: 5,
      rewardValue: 10,
      frequency: "daily" as const,
    }
    const chess = {
      id: "chess",
      name: "Chess score +10",
      type: TaskType.INCREMENTAL,
      rewardValue: 10,
      frequency: "daily" as const,
      incrementalData: { cadence: "daily" as const, startValue: 345, increment: 10, unit: "match" },
    }
    const { container } = render(
      <TaskGrid
        tasks={[study, work, chess]}
        weeklyData={{ "2026-06-16": { chess: { value: 355 } } }}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    const slots = container.querySelectorAll(".habit-cell-num input.habit-cell-slot")
    expect(slots.length).toBeGreaterThan(2)
    const widths = [...slots].map((el) => window.getComputedStyle(el).width)
    expect(new Set(widths)).toEqual(new Set(["3.4rem"]))
    expect(window.getComputedStyle(slots[0]).minWidth).toBe("3.4rem")
    expect(window.getComputedStyle(slots[0]).height).toBe("22px")
    expect(container.querySelector(".habit-goal-unit")?.textContent?.trim()).toBe("match")
    const climbGoal = [...container.querySelectorAll(".habit-goal")].find((el) => el.textContent?.includes("match"))
    expect(climbGoal?.querySelector(".habit-goal-den")?.textContent).toMatch(/\/\d+/)
    expect(climbGoal?.textContent).not.toMatch(/\s{2,}/)
  })

  it("keeps day-cell and percent-slot size when Small LEDs and Loading Bar toggle", () => {
    resetAllStores()
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 46}
        calculateDayPercentage={() => 48}
      />,
    )
    const lampCell = document.querySelector(".habit-lamp-cell") as HTMLElement
    const dayTd = lampCell.closest("td") as HTMLElement
    const pctTd = document.querySelector("tbody td.col-pct") as HTMLElement
    const pctSlot = pctTd.querySelector(".habit-pct") as HTMLElement
    const footerSlot = document.querySelector("tr.font-semibold td.col-day .habit-pct") as HTMLElement
    const lamp = document.querySelector(".hab-lamp") as HTMLElement

    const lampCellBox = cssBox(lampCell)
    const dayBox = cssBox(dayTd)
    const pctBox = cssBox(pctTd)
    const slotBox = cssBox(pctSlot)
    const footerBox = cssBox(footerSlot)

    expect(lampCellBox.height).toBe("22px")
    expect(lampCellBox.minHeight).toBe("22px")
    expect(lampCellBox.maxHeight).toBe("22px")
    expect(lamp).not.toHaveAttribute("data-fill")
    expect(pctBox.width).toBe("6.25rem")
    expect(pctBox.minWidth).toBe("6.25rem")
    expect(pctBox.maxWidth).toBe("6.25rem")
    expect(slotBox.height).toBe("22px")
    expect(slotBox.maxHeight).toBe("22px")
    expect(footerBox.height).toBe("22px")
    expect(document.querySelector(".hab-pled-bar")).toBeTruthy()

    act(() => {
      useHabitsStore.getState().setHabitSmallLeds(false)
    })
    const fillLamp = document.querySelector(".hab-lamp") as HTMLElement
    expect(fillLamp).toHaveAttribute("data-fill", "true")
    expect(cssBox(document.querySelector(".habit-lamp-cell") as Element)).toEqual(lampCellBox)
    expect(cssBox((document.querySelector(".habit-lamp-cell") as Element).closest("td") as Element)).toEqual(dayBox)
    expect(window.getComputedStyle(fillLamp).minHeight).toBe("0px")

    act(() => {
      useHabitsStore.getState().setPercentLoadingBar(false)
    })
    expect(document.querySelector(".hab-pled-face")).toBeTruthy()
    expect(document.querySelector(".hab-pled-bar")).toBeNull()
    expect(cssBox(document.querySelector("tbody td.col-pct") as Element)).toEqual(pctBox)
    expect(cssBox(document.querySelector("tbody td.col-pct .habit-pct") as Element)).toEqual(slotBox)
    expect(cssBox(document.querySelector("tr.font-semibold td.col-day .habit-pct") as Element)).toEqual(footerBox)
    act(() => {
      resetAllStores()
    })
  })

  it("inverts the row gem while the habit contributes a WILLPOWER stone this week", () => {
    const { rerender } = render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{ "2026-06-16": { h1: { completed: true } } }}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    const gem = document.querySelector(".habit-gem-socket img.habit-gem") as HTMLImageElement
    expect(gem).toHaveClass("is-inverted")
    expect(gem).toHaveAttribute("data-inverted", "true")
    rerender(
      <TaskGrid
        tasks={tasks}
        weeklyData={{ "2026-06-16": { h1: { completed: false } } }}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    const restored = document.querySelector(".habit-gem-socket img.habit-gem") as HTMLImageElement
    expect(restored).not.toHaveClass("is-inverted")
    expect(restored).not.toHaveAttribute("data-inverted")
  })

  it("turns every cell into an exemption lamp and hides exempt rows with completed ones", async () => {
    const user = userEvent.setup()
    const onSetExempt = vi.fn()
    const goal = { id: "g1", name: "Pages", type: TaskType.GOAL, goal: 3, frequency: "daily" as const }
    const { rerender } = render(
      <TaskGrid
        tasks={[...tasks, goal]}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => null}
        exemptionWand
        exemptionKindFor={(task, key) => (task.id === "h1" && key === "2026-06-16" ? "waved" : "required")}
        onSetExempt={onSetExempt}
      />,
    )
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    const lamps = screen.getAllByRole("checkbox", { name: /exemption/i })
    expect(lamps.length).toBe(14)
    const waved = screen.getByRole("checkbox", { name: /Drink water 2026-06-16 exemption/i })
    expect(waved).toHaveAttribute("data-state", "unavailable")
    expect(waved).toHaveAttribute("aria-checked", "true")
    const required = lamps.find((lamp) => lamp !== waved)
    expect(required).toHaveAttribute("data-state", "off")
    await user.click(lamps[0])
    expect(onSetExempt).toHaveBeenCalled()

    rerender(
      <TaskGrid
        tasks={[...tasks, goal]}
        weeklyData={{ "2026-06-16": { h1: { completed: true } } }}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        exemptionKindFor={(task, key) => (task.id === "h1" && key === "2026-06-16" ? "waved" : "required")}
      />,
    )
    const grey = screen.getByRole("img", { name: /Drink water 2026-06-16 exempt/i })
    expect(grey).toHaveClass("habit-exempt")
    expect(grey.closest("td")).toHaveClass("is-exempt")
    expect(screen.queryByRole("checkbox", { name: "Drink water 2026-06-16" })).not.toBeInTheDocument()

    rerender(
      <TaskGrid
        tasks={[...tasks, goal]}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        hideCompleted
        viewMode="day"
        selectedDate={weekDates[0]}
        exemptionKindFor={(task) => (task.id === "h1" ? "waved" : "required")}
      />,
    )
    expect(screen.queryByText("Drink water")).not.toBeInTheDocument()
    expect(screen.getByText("Pages")).toBeInTheDocument()
  })
})
