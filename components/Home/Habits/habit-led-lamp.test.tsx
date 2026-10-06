import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { undoLastAction } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import { habitDayPointTaskId } from "@/lib/habit-points"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { TaskType } from "@/lib/types"
import { HabitLedLamp } from "./habit-led-lamp"
import "./habit-led-lamp.css"

async function flushLampWrite() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("HabitLedLamp", () => {
  beforeEach(() => {
    resetAllStores()
  })
  it("flips the lamp before the completion handler runs", async () => {
    let ariaWhenHandlerRan: string | null = null
    const onCheckedChange = vi.fn(() => {
      ariaWhenHandlerRan = screen.getByRole("checkbox", { name: "water" }).getAttribute("aria-checked")
    })
    render(<HabitLedLamp checked={false} onCheckedChange={onCheckedChange} label="water" />)
    const lamp = screen.getByRole("checkbox", { name: "water" })
    let callsDuringClick = -1
    const onWindowClick = () => {
      callsDuringClick = onCheckedChange.mock.calls.length
    }
    window.addEventListener("click", onWindowClick)
    try {
      fireEvent.click(lamp)
    } finally {
      window.removeEventListener("click", onWindowClick)
    }
    expect(callsDuringClick).toBe(0)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(lamp).toHaveAttribute("aria-checked", "true")
    expect(lamp).toHaveAttribute("data-state", "on")
    await flushLampWrite()
    expect(ariaWhenHandlerRan).toBe("true")
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("shows the saved check when the write keeps the lamp off", async () => {
    const first = { completed: false }
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <HabitLedLamp checked={false} saved={first} onCheckedChange={onCheckedChange} label="water" />,
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "water" }))
    expect(screen.getByRole("checkbox", { name: "water" })).toHaveAttribute("data-state", "on")
    expect(onCheckedChange).not.toHaveBeenCalled()
    await flushLampWrite()
    rerender(<HabitLedLamp checked={false} saved={{ completed: false }} onCheckedChange={onCheckedChange} label="water" />)
    const lamp = screen.getByRole("checkbox", { name: "water" })
    expect(lamp).toHaveAttribute("aria-checked", "false")
    expect(lamp).toHaveAttribute("data-state", "off")
  })

  it("keeps the lit lamp when the saved completion agrees", () => {
    const { rerender } = render(
      <HabitLedLamp checked={false} saved={0} onCheckedChange={vi.fn()} label="water" />,
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "water" }))
    rerender(<HabitLedLamp checked saved={1} onCheckedChange={vi.fn()} label="water" />)
    expect(screen.getByRole("checkbox", { name: "water" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("checkbox", { name: "water" })).toHaveAttribute("data-state", "on")
  })

  it("still completes, scores, and undoes after the lamp has flipped", async () => {
    const date = new Date(2026, 5, 20)
    const dateKey = formatLocalDateKey(date)
    useHabitsStore.getState().setTasks([
      { id: "h-water", name: "Water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])

    function Harness() {
      const cell = useHabitsStore((s) => s.weeklyData[dateKey]?.["h-water"])
      const update = useHabitsStore((s) => s.updateCompletion)
      return (
        <HabitLedLamp
          checked={!!cell?.completed}
          saved={cell}
          label="Water"
          onCheckedChange={(next) => update("h-water", date, { completed: next })}
        />
      )
    }

    render(<Harness />)
    const lamp = screen.getByRole("checkbox", { name: "Water" })
    let completedDuringClick = true
    const onWindowClick = () => {
      completedDuringClick = !!useHabitsStore.getState().weeklyData[dateKey]?.["h-water"]?.completed
    }
    window.addEventListener("click", onWindowClick)
    try {
      fireEvent.click(lamp)
    } finally {
      window.removeEventListener("click", onWindowClick)
    }

    expect(completedDuringClick).toBe(false)
    expect(lamp).toHaveAttribute("data-state", "on")
    expect(useHabitsStore.getState().weeklyData[dateKey]?.["h-water"]?.completed).toBeUndefined()
    await flushLampWrite()
    expect(useHabitsStore.getState().weeklyData[dateKey]?.["h-water"]?.completed).toBe(true)
    const pointId = habitDayPointTaskId("h-water", dateKey)
    expect(usePointsStore.getState().pointsHistory.some((entry) => entry.taskId === pointId && entry.points > 0)).toBe(
      true,
    )

    act(() => {
      undoLastAction()
    })
    expect(useHabitsStore.getState().weeklyData[dateKey]?.["h-water"]).toBeUndefined()
    expect(usePointsStore.getState().pointsHistory.some((entry) => entry.taskId === pointId)).toBe(false)
    expect(lamp).toHaveAttribute("aria-checked", "false")
    expect(lamp).toHaveAttribute("data-state", "off")
  })

  it("toggles like a checkbox with the same write callback", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<HabitLedLamp checked={false} onCheckedChange={onCheckedChange} label="Drink water 2026-06-20" />)
    const lamp = screen.getByRole("checkbox", { name: "Drink water 2026-06-20" })
    expect(lamp).toHaveAttribute("aria-checked", "false")
    expect(lamp).toHaveAttribute("data-state", "off")
    await user.click(lamp)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("glows when checked and dims for a partial ratio", () => {
    const { rerender } = render(
      <HabitLedLamp checked={true} onCheckedChange={vi.fn()} label="on" />,
    )
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "on")
    rerender(<HabitLedLamp checked={false} ratio={0.4} onCheckedChange={vi.fn()} label="partial" />)
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "partial")
  })

  it("keeps a chrome-rimmed round lamp with glass, die, and specular", () => {
    render(<HabitLedLamp checked={false} onCheckedChange={vi.fn()} label="shape" />)
    const lamp = screen.getByRole("checkbox", { name: "shape" })
    expect(lamp).toHaveAttribute("data-no95")
    expect(lamp).toHaveClass("hab-lamp")
    expect(lamp.querySelector(".hab-lamp-socket")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-die")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-bezel")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-bloom")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-core")).toBeTruthy()
    expect(window.getComputedStyle(lamp).overflow).toBe("visible")
    expect(window.getComputedStyle(lamp).getPropertyValue("--hab-lamp-size").trim()).toBe("15px")
    const glass = lamp.querySelector(".hab-lamp-glass") as HTMLElement
    expect(window.getComputedStyle(glass).overflow).toBe("hidden")
    const socket = lamp.querySelector(".hab-lamp-socket") as HTMLElement
    expect(window.getComputedStyle(socket).borderRadius).toBe("50%")
    const spec = lamp.querySelector(".hab-lamp-spec") as HTMLElement
    expect(window.getComputedStyle(spec).display).not.toBe("none")
  })

  it("uses the given tint as the on-color, not a white default", () => {
    render(
      <HabitLedLamp checked tint="#c47a3a" onCheckedChange={vi.fn()} label="tint" />,
    )
    expect(screen.getByRole("checkbox", { name: "tint" })).toHaveStyle({
      "--hab-lamp-tint": "#c47a3a",
    })
  })

  it("stays 15px when Small LEDs is on and fills the cell when off", () => {
    const { rerender } = render(
      <HabitLedLamp checked={false} onCheckedChange={vi.fn()} label="size" />,
    )
    const lamp = screen.getByRole("checkbox", { name: "size" })
    expect(lamp).not.toHaveAttribute("data-fill")
    expect(window.getComputedStyle(lamp).getPropertyValue("--hab-lamp-size").trim()).toBe("15px")
    act(() => {
      useHabitsStore.getState().setHabitSmallLeds(false)
    })
    rerender(<HabitLedLamp checked={false} onCheckedChange={vi.fn()} label="size" />)
    expect(screen.getByRole("checkbox", { name: "size" })).toHaveAttribute("data-fill", "true")
    expect(window.getComputedStyle(screen.getByRole("checkbox", { name: "size" })).minHeight).toBe("0px")
    expect(window.getComputedStyle(screen.getByRole("checkbox", { name: "size" })).maxHeight).toBe("100%")
  })

  it("uses a rectangular consult window when Small LEDs is off, not a 50% oval", () => {
    useHabitsStore.getState().setHabitSmallLeds(false)
    render(<HabitLedLamp checked onCheckedChange={vi.fn()} label="window" />)
    const lamp = screen.getByRole("checkbox", { name: "window" })
    const bezel = lamp.querySelector(".hab-lamp-bezel") as HTMLElement
    const glass = lamp.querySelector(".hab-lamp-glass") as HTMLElement
    const bloom = lamp.querySelector(".hab-lamp-bloom") as HTMLElement
    expect(lamp).toHaveAttribute("data-fill", "true")
    expect(window.getComputedStyle(bezel).borderRadius).toBe("2px")
    expect(window.getComputedStyle(glass).borderRadius).toBe("1px")
    expect(window.getComputedStyle(bloom).borderRadius).toBe("1px")
    expect(window.getComputedStyle(bezel).borderRadius).not.toBe("50%")
    expect(window.getComputedStyle(glass).borderRadius).not.toBe("50%")
  })
})
