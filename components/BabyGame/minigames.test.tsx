import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EchoFlower, FireflyGlade, MossfallHop, StairWeave } from "./minigames"
import { stairPuzzle } from "@/lib/baby-game/minigames"

describe("mini game plates", () => {
  it("starts Stair Weave, turns a stair, and counts the turn", () => {
    const onDone = vi.fn()
    render(<StairWeave seed={3} onDone={onDone} onLeave={() => {}} />)
    fireEvent.click(screen.getByText("Start"))
    expect(screen.getAllByRole("gridcell")).toHaveLength(9)
    expect(screen.getByText(/Turns: 0/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole("gridcell")[1]!)
    expect(screen.getByText(/Turns: 1/)).toBeTruthy()
    expect(stairPuzzle(3).par).toBeGreaterThan(0)
  })

  it("lets Echo Flower start and shows four petals", () => {
    render(<EchoFlower seed={3} onDone={() => {}} onLeave={() => {}} />)
    fireEvent.click(screen.getByText("Start"))
    expect(screen.getAllByLabelText(/petal/)).toHaveLength(4)
  })

  it("mounts the two canvas games after Start", () => {
    for (const View of [FireflyGlade, MossfallHop]) {
      const { container, unmount } = render(<View seed={5} onDone={() => {}} onLeave={() => {}} />)
      fireEvent.click(screen.getByText("Start"))
      expect(container.querySelector("canvas")).toBeTruthy()
      unmount()
    }
  })
})
