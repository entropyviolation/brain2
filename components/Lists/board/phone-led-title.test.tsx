import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { nextLedMode, PhoneLedTitle } from "./phone-led-title"

describe("nextLedMode", () => {
  it("plays, then opens, then closes a title that does not fit", () => {
    expect(nextLedMode("clip", true, false)).toBe("scroll")
    expect(nextLedMode("scroll", true, false)).toBe("expanded")
    expect(nextLedMode("expanded", true, false)).toBe("clip")
  })

  it("leaves a title that fits alone", () => {
    expect(nextLedMode("clip", false, false)).toBe("clip")
  })

  it("opens on the first tap when motion is reduced", () => {
    expect(nextLedMode("clip", true, true)).toBe("expanded")
    expect(nextLedMode("expanded", true, true)).toBe("clip")
  })
})

describe("PhoneLedTitle", () => {
  it("walks clip, scroll, and expanded from taps when the line overflows", () => {
    render(<PhoneLedTitle text="I follow on Instagram, no follow-back — Lists" />)
    const button = screen.getByRole("button", { name: "I follow on Instagram, no follow-back — Lists" })
    Object.defineProperty(button, "scrollWidth", { configurable: true, value: 480 })
    Object.defineProperty(button, "clientWidth", { configurable: true, value: 120 })

    fireEvent.click(button)
    expect(button).toHaveClass("is-scroll")
    expect(button.querySelectorAll(".fm-led-track span")).toHaveLength(2)

    fireEvent.click(button)
    expect(button).toHaveClass("is-expanded")
    expect(button).toHaveAttribute("aria-expanded", "true")
    expect(button.querySelector(".fm-led-track")).toBeNull()

    fireEvent.click(button)
    expect(button).toHaveClass("is-clip")
    expect(button).toHaveAttribute("aria-expanded", "false")
  })
})
