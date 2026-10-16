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
  it("adds steps with minutes, nests them as deep as you like, and sums minutes", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // The shared step tree: no blank line until asked.
    expect(screen.queryByLabelText("Add step")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Add the first step" }))
    await user.type(screen.getByLabelText("Add step"), "hang art")
    await user.type(screen.getByLabelText("Minutes for the new step"), "10{Enter}")
    expect(read()).toMatchObject([{ description: "hang art", estimatedDuration: 10 }])

    // Enter went one level deeper; Shift+Enter stays there.
    await user.type(screen.getByLabelText("Add step under hang art"), "find nails")
    await user.type(screen.getByLabelText("Minutes for the new step"), "5{Shift>}{Enter}{/Shift}")
    await user.type(screen.getByLabelText("Add step under hang art"), "measure wall")
    await user.type(screen.getByLabelText("Minutes for the new step"), "15{Shift>}{Enter}{/Shift}")
    expect(read()[0].subtasks?.map((s) => s.description)).toEqual(["find nails", "measure wall"])
    expect(screen.getByText("=20m")).toBeInTheDocument()

    // A third level through the hover +.
    fireEvent.keyDown(screen.getByLabelText("Add step under hang art"), { key: "Escape" })
    await user.click(screen.getByRole("button", { name: "Add step inside find nails" }))
    await user.type(screen.getByLabelText("Add step under find nails"), "check drawer{Enter}")
    expect(read()[0].subtasks?.[0].subtasks?.[0].description).toBe("check drawer")
    expect(screen.getByText("0 / 4 done")).toBeInTheDocument()
    expect(screen.getByText("20m est")).toBeInTheDocument()
    expect(screen.getByRole("tree", { name: "Subtasks" })).toBeInTheDocument()
  })
})
