/**
 * Reviews — end-of-period review entry point.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { Reviews } from "./reviews"

describe("Reviews", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("renders the Review trigger button", () => {
    render(<Reviews />)
    const trigger = screen.getByRole("button", { name: /Review/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute("title", expect.stringMatching(/end-of-period review/))
  })

  it("opens the review menu with period options", async () => {
    const user = userEvent.setup()
    render(<Reviews />)
    await user.click(screen.getByRole("button", { name: /Review/i }))
    expect(screen.getByText("End-of-period reviews")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /day review/i })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /week review/i })).toBeInTheDocument()
  })

  it("opens the review dialog when a period is chosen", async () => {
    const user = userEvent.setup()
    render(<Reviews />)
    await user.click(screen.getByRole("button", { name: /Review/i }))
    await user.click(screen.getByRole("menuitem", { name: /day review/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Save Review/i })).toBeInTheDocument()
  })
})
