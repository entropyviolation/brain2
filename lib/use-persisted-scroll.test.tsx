/**
 * lib/use-persisted-scroll.test.tsx — scroll slot restore after remount
 */
import { useRef } from "react"
import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { docsHomeScrollSlot, readScrollOffset, writeScrollOffset } from "@/lib/app-navigation"
import { usePersistedScroll } from "@/lib/use-persisted-scroll"
import { resetLocalStorage } from "@/tests/test-utils"

function Probe({ slot }: { slot: string }) {
  const ref = useRef<HTMLDivElement>(null)
  usePersistedScroll(slot, ref)
  return (
    <div data-testid="scroller" ref={ref} style={{ height: 40, overflow: "auto" }}>
      <div style={{ height: 400 }}>tall</div>
    </div>
  )
}

describe("usePersistedScroll", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("writes scrollTop for the slot and restores it on remount", () => {
    const slot = docsHomeScrollSlot("__all__")
    writeScrollOffset(slot, 120)
    const { unmount } = render(<Probe slot={slot} />)
    const el = screen.getByTestId("scroller")
    Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: 120 })
    act(() => {
      el.dispatchEvent(new Event("scroll"))
    })
    expect(readScrollOffset(slot)).toBe(120)
    unmount()
    render(<Probe slot={slot} />)
    expect(readScrollOffset(slot)).toBe(120)
  })

  it("does not wipe a stored offset when the tab panel hides", () => {
    const slot = docsHomeScrollSlot("__all__")
    writeScrollOffset(slot, 120)
    const { unmount } = render(<Probe slot={slot} />)
    const el = screen.getByTestId("scroller")
    Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: 120 })
    Object.defineProperty(el, "clientHeight", { configurable: true, value: 40 })
    act(() => {
      el.dispatchEvent(new Event("scroll"))
    })
    expect(readScrollOffset(slot)).toBe(120)
    el.setAttribute("hidden", "")
    Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: 0 })
    Object.defineProperty(el, "clientHeight", { configurable: true, value: 0 })
    act(() => {
      el.dispatchEvent(new Event("scroll"))
    })
    expect(readScrollOffset(slot)).toBe(120)
    unmount()
    expect(readScrollOffset(slot)).toBe(120)
  })
})
