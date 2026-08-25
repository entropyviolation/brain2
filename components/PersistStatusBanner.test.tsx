import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PersistStatusBanner } from "@/components/PersistStatusBanner"
import { recordPersistFailure, resetPersistStatus } from "@/lib/persist-storage"

describe("PersistStatusBanner", () => {
  beforeEach(() => {
    resetPersistStatus()
  })

  it("is hidden while persist is healthy", () => {
    render(<PersistStatusBanner />)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("surfaces a quota failure and an export nudge", () => {
    recordPersistFailure(new DOMException("The quota has been exceeded.", "QuotaExceededError"))
    render(<PersistStatusBanner />)
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn’t save/)
    expect(screen.getByRole("button", { name: /Download backup/i })).toBeInTheDocument()
    expect(screen.getByText(/Storage is full/)).toBeInTheDocument()
  })
})
