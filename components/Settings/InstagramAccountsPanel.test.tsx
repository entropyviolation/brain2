/**
 * components/Settings/InstagramAccountsPanel.test.tsx — Login list over a fake desktop bridge
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InstagramAccountsPanel } from "@/components/Settings/InstagramAccountsPanel"
import type { InstagramAccountView } from "@/lib/instagram-accounts"

const view = (patch: Partial<InstagramAccountView>): InstagramAccountView => ({
  id: "a1",
  username: "alitza",
  userId: "123",
  label: "",
  addedAt: "2026-10-01T00:00:00.000Z",
  loggedInAt: "2026-10-01T00:00:00.000Z",
  sessionExpiresAt: null,
  hasSession: true,
  hasPassword: false,
  lastCheck: null,
  ...patch,
})

function installBridge(accounts: InstagramAccountView[], encryption = true) {
  const bridge = {
    status: vi.fn(async () => ({ ok: true, encryption, loggingIn: false })),
    list: vi.fn(async () => ({ ok: true as const, accounts })),
    login: vi.fn(async (req: { username: string; label?: string }) => ({
      ok: true as const,
      account: view({ id: "a2", username: req.username, userId: "456", label: req.label ?? "" }),
    })),
    update: vi.fn(),
    remove: vi.fn(async () => ({ ok: true })),
    setPassword: vi.fn(),
    check: vi.fn(),
  }
  ;(window as unknown as { desktop?: unknown }).desktop = { instagram: bridge }
  return bridge
}

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop
})

describe("InstagramAccountsPanel", () => {
  it("says login is desktop-only in the web build", () => {
    render(<InstagramAccountsPanel />)
    expect(screen.getByRole("heading", { name: "Instagram accounts" })).toBeInTheDocument()
    expect(screen.getByTestId("instagram-accounts-web").textContent).toBe("Logging in works in the desktop app only.")
    expect(screen.getByTestId("instagram-accounts-settings").textContent).toContain("break Instagram’s terms")
  })

  it("lists saved accounts and adds another through the login window", async () => {
    const user = userEvent.setup()
    const bridge = installBridge([view({ label: "main" })])
    render(<InstagramAccountsPanel />)
    expect(await screen.findByTestId("instagram-account-alitza")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Username"), "@Second.Acct")
    await user.click(screen.getByRole("button", { name: "Log into Instagram" }))
    await waitFor(() => expect(bridge.login).toHaveBeenCalledWith({ username: "second.acct", label: "" }))
    expect(await screen.findByTestId("instagram-account-second.acct")).toBeInTheDocument()
    expect(screen.getByTestId("instagram-accounts-note").textContent).toBe("Saved @second.acct.")
  })

  it("asks before removing an account", async () => {
    const user = userEvent.setup()
    const bridge = installBridge([view({})])
    render(<InstagramAccountsPanel />)
    await user.click(await screen.findByRole("button", { name: "Remove" }))
    expect(bridge.remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "OK, remove @alitza" }))
    await waitFor(() => expect(screen.queryByTestId("instagram-account-alitza")).toBeNull())
    expect(bridge.remove).toHaveBeenCalledWith("a1")
  })

  it("will not offer a login without an OS keychain", async () => {
    installBridge([], false)
    render(<InstagramAccountsPanel />)
    expect(await screen.findByTestId("instagram-accounts-no-keychain")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log into Instagram" })).toBeDisabled()
  })
})
