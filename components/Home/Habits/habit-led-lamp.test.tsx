import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { HabitLedLamp } from "./habit-led-lamp"
import "./habit-led-lamp.css"

describe("HabitLedLamp", () => {
  beforeEach(() => {
    resetAllStores()
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

  it("keeps a square plate with a recessed round lens, not a spherical nipple", () => {
    render(<HabitLedLamp checked={false} onCheckedChange={vi.fn()} label="shape" />)
    const lamp = screen.getByRole("checkbox", { name: "shape" })
    expect(lamp).toHaveAttribute("data-no95")
    expect(lamp).toHaveClass("hab-lamp")
    expect(lamp.querySelector(".hab-lamp-socket")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-die")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-bezel")).toBeTruthy()
    expect(lamp.querySelector(".hab-lamp-bloom")).toBeTruthy()
    expect(window.getComputedStyle(lamp).overflow).toBe("visible")
    expect(window.getComputedStyle(lamp).borderRadius).toBe("2px")
    expect(window.getComputedStyle(lamp).getPropertyValue("--hab-lamp-size").trim()).toBe("15px")
    const glass = lamp.querySelector(".hab-lamp-glass") as HTMLElement
    expect(window.getComputedStyle(glass).overflow).toBe("hidden")
    const spec = lamp.querySelector(".hab-lamp-spec") as HTMLElement
    expect(window.getComputedStyle(spec).borderRadius).toBe("1px")
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
