import { afterEach, describe, expect, it } from "vitest"
import {
  clearGravityNodeChrome,
  paintGravityNodeChrome,
} from "@/components/Lists/lib/list-icon-gravity-paint"
import type { GravityBody } from "@/components/Lists/lib/list-icon-gravity"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("list-icon-gravity-paint node chrome", () => {
  it("stamps glow and held chrome on icon nodes", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div data-icon-entry data-id="hub"></div>
      <div data-icon-entry data-id="lone"></div>
    `
    document.body.appendChild(root)
    const bodies: GravityBody[] = [
      { id: "hub", x: 0, y: 0, vx: 0, vy: 0, mass: 3.5, held: true },
      { id: "lone", x: 1, y: 1, vx: 0, vy: 0, mass: 1 },
    ]
    paintGravityNodeChrome(root, bodies, "lone", "hub")
    const hub = root.querySelector('[data-id="hub"]')!
    const lone = root.querySelector('[data-id="lone"]')!
    expect(hub.getAttribute("data-gravity-mass")).toBe("3")
    expect(hub.getAttribute("data-gravity-held")).toBe("on")
    expect(lone.getAttribute("data-gravity-hot")).toBe("on")
    clearGravityNodeChrome(root)
    expect(hub.hasAttribute("data-gravity-mass")).toBe(false)
  })
})
