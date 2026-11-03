/**
 * components/Mobile/MobilePullCard.test.tsx — Refresh pins the hub token and reloads the Mac window once
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { readPhoneHubTokenPin, resetPhoneWindowForTests } from "@/lib/phone-window"
import { PHONE_UA, hubFetch } from "@/tests/phone-builders"
import { MobilePullCard } from "./MobilePullCard"

describe("MobilePullCard on the phone", () => {
  beforeEach(() => {
    localStorage.clear()
    resetPhoneWindowForTests()
    vi.stubGlobal("navigator", { userAgent: PHONE_UA, language: "en-US" })
  })

  it("saves the typed token on Refresh and sends it to the Mac", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    render(<MobilePullCard />)
    fireEvent.change(screen.getByPlaceholderText("BRAIN2_PHONE_HUB_TOKEN"), { target: { value: "  s3cret " } })
    fireEvent.click(screen.getByRole("button", { name: "Refresh from Mac" }))
    await screen.findByText("Mac answered.")
    expect(readPhoneHubTokenPin()).toBe("s3cret")
    const canon = hub.fn.mock.calls.find(([url]) => String(url).includes("canon=1"))
    expect((canon?.[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer s3cret" })
  })

  it("a double tap on Refresh asks the Mac once", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    render(<MobilePullCard />)
    const button = screen.getByRole("button", { name: "Refresh from Mac" })
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByText("Mac answered.")
    expect(hub.canonCalls).toHaveLength(1)
  })

  it("names a refused token", async () => {
    vi.stubGlobal("fetch", hubFetch({ canon: () => ({ status: 401 }) }).fn)
    render(<MobilePullCard />)
    fireEvent.click(screen.getByRole("button", { name: "Refresh from Mac" }))
    await waitFor(() => expect(screen.getByText(/answered 401 \(hub token\)/)).toBeInTheDocument())
  })
})
