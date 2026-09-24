import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PenChainVisual } from "./pen-chain-visual"
import type { TrackPen } from "@/lib/time-tracking-store"

function pen(id: string, name: string, parentId?: string): TrackPen {
  return { id, name, color: "#2563eb", parentId }
}

/** San Diego ← Ocean Beach ← Home, plus a sibling beach. */
const pens: TrackPen[] = [
  pen("sd", "San Diego"),
  pen("ob", "Ocean Beach", "sd"),
  pen("home", "Home", "ob"),
  pen("mb", "mission beach", "sd"),
]

describe("PenChainVisual", () => {
  it("draws the chain from the root down to the pen being edited", () => {
    render(<PenChainVisual pens={pens} penId="home" onOpenPen={() => {}} />)

    expect(screen.getByRole("button", { name: /San Diego/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ocean Beach/ })).toBeInTheDocument()
    expect(screen.getByTitle("Home (this pen)")).toBeInTheDocument()
  })

  it("opens another pen's settings from a node in the chain", () => {
    const onOpenPen = vi.fn()
    render(<PenChainVisual pens={pens} penId="home" onOpenPen={onOpenPen} />)

    fireEvent.click(screen.getByTitle("Open San Diego settings"))

    expect(onOpenPen).toHaveBeenCalledWith("sd")
  })

  it("branches out every pen that counts as this one", () => {
    render(<PenChainVisual pens={pens} penId="sd" onOpenPen={() => {}} />)

    // Both direct children and the grandchild through Ocean Beach.
    expect(screen.getByTitle("Open Ocean Beach settings")).toBeInTheDocument()
    expect(screen.getByTitle("Open mission beach settings")).toBeInTheDocument()
    expect(screen.getByTitle("Open Home settings")).toBeInTheDocument()
  })

  it("says so plainly when a pen is neither nested nor a parent", () => {
    render(<PenChainVisual pens={[pen("solo", "Alone")]} penId="solo" onOpenPen={() => {}} />)

    expect(screen.getByText(/No nest yet/)).toBeInTheDocument()
  })

  it("survives a cyclic parentId instead of recursing forever", () => {
    // `wouldCycle` blocks this on write, but an import or a half-finished
    // migration can still land it in a vault, and `ancestorChain` is written to
    // tolerate exactly this. Walking the tree downward has to agree.
    const looped: TrackPen[] = [pen("a", "A", "b"), pen("b", "B", "a")]

    expect(() => render(<PenChainVisual pens={looped} penId="a" onOpenPen={() => {}} />)).not.toThrow()
    expect(screen.getAllByTitle(/A|B/).length).toBeGreaterThan(0)
  })
})
