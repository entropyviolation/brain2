/**
 * components/Settings/imports/SpotifyAccountsPanel.test.tsx — Setup steps and login over a fake desktop bridge
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SpotifyAccountsPanel } from "@/components/Settings/imports/SpotifyAccountsPanel"
import { SPOTIFY_REDIRECT_URI, type SpotifyAccountView } from "@/lib/spotify-accounts"

const CLIENT = "0123456789abcdef0123456789abcdef"

function installBridge(clientId = "") {
  let saved = clientId
  const bridge = {
    status: vi.fn(async () => ({ ok: true, encryption: true, clientId: saved, redirectUri: SPOTIFY_REDIRECT_URI, scopes: [] })),
    list: vi.fn(async () => ({ ok: true as const, accounts: [] as SpotifyAccountView[] })),
    setClientId: vi.fn(async (id: string) => {
      saved = id
      return { ok: true as const, clientId: id }
    }),
    login: vi.fn(async () => ({
      ok: true as const,
      account: {
        id: "s1",
        spotifyId: "u1",
        displayName: "Ali",
        label: "",
        addedAt: "",
        loggedInAt: "2026-10-23T00:00:00.000Z",
        scopes: [],
        hasSession: true,
        lastCheck: null,
      },
    })),
    update: vi.fn(),
    remove: vi.fn(),
    check: vi.fn(),
  }
  ;(window as unknown as { desktop?: unknown }).desktop = { spotify: bridge }
  return bridge
}

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop
})

describe("SpotifyAccountsPanel", () => {
  it("states the setup steps and the API limits in the web build", () => {
    render(<SpotifyAccountsPanel />)
    const text = screen.getByTestId("spotify-accounts-settings").textContent ?? ""
    expect(screen.getByTestId("spotify-redirect-uri").textContent).toBe(SPOTIFY_REDIRECT_URI)
    expect(text).toContain("Premium")
    expect(text).toContain("last 50 plays")
    expect(text).toContain("Extended streaming history")
    expect(screen.getByTestId("spotify-accounts-web").textContent).toBe("Logging in works in the desktop app only.")
  })

  it("needs a saved Client ID before logging in", async () => {
    const user = userEvent.setup()
    const bridge = installBridge()
    render(<SpotifyAccountsPanel />)
    const login = await screen.findByRole("button", { name: "Log into Spotify" })
    expect(login).toBeDisabled()
    await user.type(screen.getByLabelText("Client ID"), CLIENT)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(bridge.setClientId).toHaveBeenCalledWith(CLIENT))
    await waitFor(() => expect(login).toBeEnabled())
    await user.click(login)
    expect(await screen.findByTestId("spotify-account-u1")).toBeInTheDocument()
    expect(screen.getByTestId("spotify-accounts-note").textContent).toBe("Saved Ali.")
  })
})
