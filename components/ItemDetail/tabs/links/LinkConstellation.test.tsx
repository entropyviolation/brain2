import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { LinkConstellation } from "@/components/ItemDetail/links/LinkConstellation"
import { layoutPlate } from "@/lib/link-constellation-layout"
import type { EgoEdge } from "@/lib/link-graph"

const EDGES: EgoEdge[] = [
  { key: "lio|sibling-of", otherId: "lio", relation: "sibling-of", direction: "mutual", family: "family" },
  { key: "sam|friends-with", otherId: "sam", relation: "friends-with", direction: "in", family: "friend" },
  { key: "fox|member-of", otherId: "fox", relation: "member-of", direction: "out", family: "group" },
]
const TITLES: Record<string, string> = { lio: "Lio", sam: "Sam", fox: "Foxtide" }
const facts = (id: string) => ({ id, title: TITLES[id] ?? id, typeIds: [] })

function reduceMotion(on: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: on && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  )
}

function plate(extra: Partial<Parameters<typeof LinkConstellation>[0]> = {}) {
  return (
    <LinkConstellation
      center={{ id: "oey", title: "Oey" }}
      edges={EDGES}
      factsFor={facts}
      allTasks={[]}
      {...extra}
    />
  )
}

describe("LinkConstellation (radial plate)", () => {
  beforeEach(() => reduceMotion(true))
  afterEach(() => vi.unstubAllGlobals())

  it("renders final layout positions at once under reduced motion", () => {
    render(plate())
    const well = screen.getByTestId("radial-plate")
    expect(well).toHaveAttribute("data-entered", "true")
    expect(well).toHaveAttribute("data-reduced", "true")
    const layout = layoutPlate(EDGES, { width: 480, height: 260 })
    const lio = layout.nodes.find((n) => n.otherId === "lio")!
    const button = screen.getByRole("button", { name: "Lio, is the sibling of, mutual" })
    expect(button.style.transform).toBe(`translate(${lio.x - 14}px, ${lio.y - 14}px)`)
  })

  it("names each orb by title, relation, and direction, and labels cords when there are few", () => {
    const { container } = render(plate())
    expect(screen.getByRole("button", { name: "Sam, is friends with, incoming" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Foxtide, is a member of, outgoing" })).toBeInTheDocument()
    expect(container.querySelectorAll(".rl-cord-label")).toHaveLength(3)
    expect(container.querySelector("title")?.textContent).toMatch(/^Oey — /)
    // Mutual is a twin strand; out carries an arrow, derived would be dotted.
    expect(container.querySelectorAll('[data-direction="mutual"] .rl-cord')).toHaveLength(2)
    expect(container.querySelector('[data-direction="out"] .rl-cord')?.getAttribute("marker-end")).toContain("rl-arrow-group")
  })

  it("walks the ring with arrow keys, selects on click, and opens on double-click", () => {
    const onSelect = vi.fn()
    const onOpen = vi.fn()
    render(plate({ onSelect, onOpen }))
    const buttons = screen.getAllByRole("button", { name: /, (mutual|incoming|outgoing)$/ })
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    buttons[0]!.focus()
    fireEvent.keyDown(buttons[0]!, { key: "ArrowRight" })
    expect(document.activeElement).toBe(buttons[1])
    fireEvent.click(buttons[1]!)
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("|"))
    fireEvent.doubleClick(buttons[1]!)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it("starts orbs at the center when motion is allowed", () => {
    reduceMotion(false)
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    render(plate())
    expect(screen.getByTestId("radial-plate")).toHaveAttribute("data-entered", "false")
    const button = screen.getByRole("button", { name: "Lio, is the sibling of, mutual" })
    expect(button.style.transform).toBe(`translate(${240 - 14}px, ${130 - 14}px)`)
  })
})
