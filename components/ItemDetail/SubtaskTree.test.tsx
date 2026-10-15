import { render, screen } from "@testing-library/react"
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

    await user.type(screen.getByLabelText("New subtask"), "hang art")
    await user.type(screen.getAllByLabelText("Estimated minutes")[0], "10")
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(read()).toMatchObject([{ description: "hang art", estimatedDuration: 10 }])

    // Nested add row stays open for repeat adds.
    await user.click(screen.getByRole("button", { name: "Add step inside hang art" }))
    const nested = screen.getByLabelText("New nested step")
    await user.type(nested, "find nails")
    await user.type(screen.getAllByLabelText("Estimated minutes")[1], "5")
    await user.click(screen.getAllByRole("button", { name: "Add" })[1])
    // user-event keeps its own copy of a field's text across form.reset(); clear it first.
    await user.clear(screen.getByLabelText("New nested step"))
    await user.type(screen.getByLabelText("New nested step"), "measure wall")
    await user.clear(screen.getAllByLabelText("Estimated minutes")[1])
    await user.type(screen.getAllByLabelText("Estimated minutes")[1], "15")
    await user.click(screen.getAllByRole("button", { name: "Add" })[1])
    expect(read()[0].subtasks?.map((s) => s.description)).toEqual(["find nails", "measure wall"])
    expect(screen.getByText("=20m")).toBeInTheDocument()

    // A third level.
    await user.click(screen.getByRole("button", { name: "Done" }))
    await user.click(screen.getByRole("button", { name: "Add step inside find nails" }))
    await user.type(screen.getByLabelText("New nested step"), "check drawer{Enter}")
    expect(read()[0].subtasks?.[0].subtasks?.[0].description).toBe("check drawer")
    expect(screen.getByText("0 / 4 done")).toBeInTheDocument()
    expect(screen.getByText("20m est")).toBeInTheDocument()
  })
})
