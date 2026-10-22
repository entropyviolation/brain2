import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RitualStepper } from "./RitualSteps"

describe("RitualStepper lamps", () => {
  it("half-lights a started step and counts only finished ones", () => {
    render(
      <RitualStepper
        steps={[
          { id: "a", label: "Alpha", answered: true },
          { id: "b", label: "Beta", answered: "partial" },
          { id: "c", label: "Gamma", answered: false },
        ]}
        index={0}
        onStep={() => {}}
        finishLabel="Finish"
        onFinish={() => {}}
      >
        body
      </RitualStepper>,
    )
    expect(screen.getByRole("button", { name: "Go to Beta (started)" })).toHaveAttribute("data-answered", "partial")
    expect(screen.getByRole("button", { name: "Go to Alpha (answered)" })).toHaveAttribute("data-answered", "true")
    expect(screen.getByText("1/3")).toBeInTheDocument()
  })
})
