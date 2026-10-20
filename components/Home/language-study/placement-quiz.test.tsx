import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PlacementQuiz } from "./placement-quiz"

vi.mock("@/lib/vocab-speech", () => ({ speak: vi.fn() }))

describe("PlacementQuiz", () => {
  it("runs from the intro to a scored result", async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<PlacementQuiz lang="fr" onResult={onResult} onCancel={() => {}} />)

    expect(screen.getByText("DELF / DALF")).toBeTruthy()
    const begin = await screen.findByRole("button", { name: "Begin" })
    await user.click(begin)

    // Answer the first question, see feedback, then stop and score.
    const choices = screen.getAllByRole("radio")
    expect(choices).toHaveLength(4)
    await user.click(choices[0]!)
    expect(screen.getByText(/Right\.|Not quite\./)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Stop and score" }))

    await user.click(screen.getByRole("button", { name: "Use A1" }))
    expect(onResult).toHaveBeenCalledWith("A1", expect.objectContaining({ total: 1 }))
  })

  it("cancels from the intro", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<PlacementQuiz lang="ja" onResult={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalled()
  })
})
