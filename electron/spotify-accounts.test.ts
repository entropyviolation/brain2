import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type Cipher = { available: () => boolean; encrypt: (t: string) => Buffer; decrypt: (b: Buffer) => string }
type Res = { status: number; json: () => Promise<unknown> }
type Fetch = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<Res>
type Store = {
  file: string
  clientId: () => string
  setClientId: (id: string) => string
  list: () => Array<Record<string, unknown>>
  find: (id: string) => Record<string, unknown> | null
  saveLogin: (o: { me: { id: string; display_name?: string }; tokens: Record<string, string>; label?: string }) => Record<string, unknown>
  remove: (id: string) => boolean
  refreshToken: (id: string) => string | null
}
const sp = nodeRequire("./spotify-accounts.js") as {
  REDIRECT_URI: string
  createPkce: (random?: (n: number) => Buffer) => { verifier: string; challenge: string; state: string }
  isPlausibleClientId: (id: string) => boolean
  authorizeUrl: (o: { clientId: string; challenge: string; state: string }) => string
  readRedirect: (url: string, state: string) => { code?: string; error?: string } | null
  hostAllowed: (url: string) => boolean
  createSpotifyStore: (o: { dir: string; cipher: Cipher }) => Store
  checkLogin: (o: { store: Store; account: Record<string, unknown>; fetchImpl: Fetch }) => Promise<{ state: string; note: string }>
}

const fakeCipher = (available = true): Cipher => ({
  available: () => available,
  encrypt: (t) => Buffer.from(Buffer.from(t, "utf8").map((b) => b ^ 0x33)),
  decrypt: (b) => Buffer.from(Buffer.from(b).map((x) => x ^ 0x33)).toString("utf8"),
})

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-sp-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("PKCE login", () => {
  it("uses a loopback IP redirect and read-only scopes", () => {
    expect(sp.REDIRECT_URI).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    const pkce = sp.createPkce()
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43)
    const url = new URL(sp.authorizeUrl({ clientId: "a".repeat(32), challenge: pkce.challenge, state: pkce.state }))
    expect(url.origin).toBe("https://accounts.spotify.com")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("redirect_uri")).toBe(sp.REDIRECT_URI)
    expect(url.searchParams.get("scope")).toContain("user-read-recently-played")
    expect(url.searchParams.get("scope")).not.toMatch(/modify|playlist/)
  })

  it("reads the redirect and checks state", () => {
    expect(sp.readRedirect("https://accounts.spotify.com/login", "s")).toBeNull()
    expect(sp.readRedirect(`${sp.REDIRECT_URI}?code=C&state=s`, "s")).toEqual({ code: "C" })
    expect(sp.readRedirect(`${sp.REDIRECT_URI}?code=C&state=other`, "s")?.error).toMatch(/did not match/)
    expect(sp.readRedirect(`${sp.REDIRECT_URI}?error=access_denied&state=s`, "s")?.error).toBe("Spotify access was declined.")
  })

  it("checks client ids and login hosts", () => {
    expect(sp.isPlausibleClientId("0123456789abcdef0123456789ABCDEF")).toBe(true)
    expect(sp.isPlausibleClientId("short")).toBe(false)
    expect(sp.hostAllowed("https://accounts.spotify.com/en/login")).toBe(true)
    expect(sp.hostAllowed("https://spotify.com.evil.example/")).toBe(false)
  })
})

describe("spotify store", () => {
  it("keeps several accounts with sealed refresh tokens", () => {
    const store = sp.createSpotifyStore({ dir, cipher: fakeCipher() })
    store.setClientId("0123456789abcdef0123456789abcdef")
    const a = store.saveLogin({ me: { id: "u1", display_name: "Ali" }, tokens: { refresh_token: "R-SECRET", scope: "user-top-read" }, label: "main" })
    store.saveLogin({ me: { id: "u2" }, tokens: { refresh_token: "R2" } })
    const again = store.saveLogin({ me: { id: "u1", display_name: "Ali" }, tokens: { refresh_token: "R-NEW" } })
    expect(again.id).toBe(a.id)
    expect(store.list().map((x) => x.displayName)).toEqual(["Ali", "u2"])
    expect(fs.readFileSync(store.file, "utf8")).not.toContain("R-")
    expect(JSON.stringify(store.list())).not.toContain("R-")
    expect(store.refreshToken(String(a.id))).toBe("R-NEW")
    expect(store.clientId()).toBe("0123456789abcdef0123456789abcdef")
    expect(store.remove(String(a.id))).toBe(true)
    expect(store.list()).toHaveLength(1)
  })

  it("refuses to store a login without OS encryption", () => {
    const store = sp.createSpotifyStore({ dir, cipher: fakeCipher(false) })
    expect(() => store.saveLogin({ me: { id: "u1" }, tokens: { refresh_token: "R" } })).toThrow(/keychain/)
  })
})

describe("checkLogin", () => {
  function setup() {
    const store = sp.createSpotifyStore({ dir, cipher: fakeCipher() })
    store.setClientId("0123456789abcdef0123456789abcdef")
    const account = store.saveLogin({ me: { id: "u1" }, tokens: { refresh_token: "R1" } })
    return { store, account }
  }

  it("refreshes, keeps a rotated refresh token, and reads /me", async () => {
    const { store, account } = setup()
    const fetchImpl: Fetch = async (url) =>
      url.includes("/api/token")
        ? { status: 200, json: async () => ({ access_token: "A", refresh_token: "R2" }) }
        : { status: 200, json: async () => ({ id: "u1" }) }
    expect((await sp.checkLogin({ store, account, fetchImpl })).state).toBe("ok")
    expect(store.refreshToken(String(account.id))).toBe("R2")
  })

  it("names a revoked login and a 403 from development mode", async () => {
    const { store, account } = setup()
    const revoked: Fetch = async () => ({ status: 400, json: async () => ({ error: "invalid_grant" }) })
    expect((await sp.checkLogin({ store, account, fetchImpl: revoked })).state).toBe("expired")
    const devMode: Fetch = async (url) =>
      url.includes("/api/token")
        ? { status: 200, json: async () => ({ access_token: "A" }) }
        : { status: 403, json: async () => ({}) }
    const res = await sp.checkLogin({ store, account, fetchImpl: devMode })
    expect(res.state).toBe("error")
    expect(res.note).toMatch(/Premium/)
  })
})
