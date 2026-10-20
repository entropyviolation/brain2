import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import type { Subtask } from "@/lib/types"
import { SubtaskTree } from "./SubtaskTree"

function Harness() {
  const [steps, setSteps] = useState<Subtask[]>([])
  return (
    <>
      <SubtaskTree steps={steps} onChange={setSteps} />
      <output data-testid="json">{JSON.stringify(steps)}</output>
    </>
  )
}

const read = () => JSON.parse(screen.getByTestId("json").textContent || "[]") as Subtask[]

describe("SubtaskTree", () => {
  it("adds, nests, times and opens steps in its own outline", async () => {
    const user = userEvent.setup()
    const opened: string[] = []
    function Opening() {
      const [steps, setSteps] = useState<Subtask[]>([])
      return (
        <>
          <SubtaskTree steps={steps} onChange={setSteps} onOpenStep={(s) => opened.push(s.description)} />
          <output data-testid="json">{JSON.stringify(steps)}</output>
        </>
      )
    }
    render(<Opening />)

    await user.click(screen.getByRole("button", { name: "+ Add step" }))
    await user.type(screen.getByLabelText("New step name"), "hang art{Enter}")
    await user.click(screen.getByRole("button", { name: "Add a step inside hang art" }))
    await user.type(screen.getByLabelText("New step name"), "find nails{Enter}")
    expect(read()[0].subtasks?.map((s) => s.description)).toEqual(["find nails"])

    const min = screen.getByLabelText("Minutes for find nails")
    await user.type(min, "5{Enter}")
    expect(read()[0].subtasks?.[0].estimatedDuration).toBe(5)
    expect(screen.getByText("=5m")).toBeInTheDocument()

    await user.click(screen.getByLabelText("Done: find nails"))
    expect(read()[0].subtasks?.[0].completed).toBe(true)
    await user.click(screen.getByRole("button", { name: "Open find nails" }))
    expect(opened).toEqual(["find nails"])
  })
})
