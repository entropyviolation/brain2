import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type Cipher = { available: () => boolean; encrypt: (t: string) => Buffer; decrypt: (b: Buffer) => string }
type Picked = { cookies: Record<string, string>; userId: string; expiresAt: string | null }
type Store = {
  file: string
  list: () => Array<Record<string, unknown>>
  saveLogin: (req: { username?: string; label?: string; picked: Picked }) => Record<string, unknown>
  update: (id: string, patch: Record<string, unknown>) => Record<string, unknown> | null
  remove: (id: string) => boolean
  setPassword: (id: string, pw: string) => Record<string, unknown> | null
  sessionCookies: (id: string) => Record<string, string> | null
  password: (id: string) => string | null
}
const ig = nodeRequire("./instagram-accounts.js") as {
  normalizeUsername: (s: string) => string
  hostAllowed: (u: string) => boolean
  pickSessionCookies: (list: unknown[]) => Picked | null
  createAccountStore: (o: { dir: string; cipher: Cipher }) => Store
  checkSession: (o: {
    account: { username: string; userId: string }
    cookies: Record<string, string> | null
    fetchImpl: (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number; json: () => Promise<unknown> }>
  }) => Promise<{ state: string; note: string }>
  safeStorageCipher: (s: unknown) => Cipher
}

// Reversible stand-in for safeStorage, so the test can see nothing is stored in clear.
const fakeCipher = (available = true): Cipher => ({
  available: () => available,
  encrypt: (t) => Buffer.from(Buffer.from(t, "utf8").map((b) => b ^ 0x5a)),
  decrypt: (b) => Buffer.from(Buffer.from(b).map((x) => x ^ 0x5a)).toString("utf8"),
})

const cookie = (name: string, value: string, extra: Record<string, unknown> = {}) => ({
  name,
  value,
  domain: ".instagram.com",
  ...extra,
})

const LOGGED_IN = [
  cookie("sessionid", "SECRET-SESSION", { expirationDate: 1_900_000_000 }),
  cookie("csrftoken", "csrf"),
  cookie("ds_user_id", "123"),
  cookie("shbid", "drop-me"),
  { name: "sessionid", value: "other-site", domain: "evil.example" },
]

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-ig-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("pickSessionCookies", () => {
  it("waits until sessionid and ds_user_id are both set", () => {
    expect(ig.pickSessionCookies([cookie("csrftoken", "x")])).toBeNull()
    expect(ig.pickSessionCookies([cookie("sessionid", "s")])).toBeNull()
  })

  it("keeps only Instagram session cookies and reads the expiry", () => {
    const picked = ig.pickSessionCookies(LOGGED_IN)!
    expect(picked.userId).toBe("123")
    expect(picked.cookies).toEqual({ sessionid: "SECRET-SESSION", csrftoken: "csrf", ds_user_id: "123" })
    expect(picked.expiresAt).toBe(new Date(1_900_000_000 * 1000).toISOString())
  })
})

describe("login window hosts", () => {
  it("allows Instagram and Facebook login hosts only", () => {
    expect(ig.hostAllowed("https://www.instagram.com/challenge/")).toBe(true)
    expect(ig.hostAllowed("https://m.facebook.com/login")).toBe(true)
    expect(ig.hostAllowed("https://instagram.com.evil.example/")).toBe(false)
    expect(ig.hostAllowed("not a url")).toBe(false)
  })
})

describe("account store", () => {
  it("keeps several accounts, seals secrets and lists no secret", () => {
    const store = ig.createAccountStore({ dir, cipher: fakeCipher() })
    const a = store.saveLogin({ username: "@Alitza", label: "main", picked: ig.pickSessionCookies(LOGGED_IN)! })
    const b = store.saveLogin({
      username: "https://www.instagram.com/second.acct/",
      picked: { cookies: { sessionid: "S2", ds_user_id: "456" }, userId: "456", expiresAt: null },
    })
    expect(store.list().map((x) => x.username)).toEqual(["alitza", "second.acct"])
    const disk = fs.readFileSync(store.file, "utf8")
    expect(disk).not.toContain("SECRET-SESSION")
    expect(JSON.stringify(store.list())).not.toContain("SECRET-SESSION")
    expect(store.list()[0]).toMatchObject({ label: "main", hasSession: true, hasPassword: false })
    expect(store.sessionCookies(String(a.id))?.sessionid).toBe("SECRET-SESSION")
    expect(store.sessionCookies(String(b.id))?.sessionid).toBe("S2")
  })

  it("replaces the session when the same Instagram user logs in again", () => {
    const store = ig.createAccountStore({ dir, cipher: fakeCipher() })
    const first = store.saveLogin({ username: "alitza", picked: ig.pickSessionCookies(LOGGED_IN)! })
    const again = store.saveLogin({
      username: "",
      picked: { cookies: { sessionid: "NEW", ds_user_id: "123" }, userId: "123", expiresAt: null },
    })
    expect(again.id).toBe(first.id)
    expect(again.username).toBe("alitza")
    expect(store.list()).toHaveLength(1)
    expect(store.sessionCookies(String(first.id))?.sessionid).toBe("NEW")
  })

  it("stores an opt-in password sealed, forgets it, and removes an account", () => {
    const store = ig.createAccountStore({ dir, cipher: fakeCipher() })
    const a = store.saveLogin({ username: "alitza", picked: ig.pickSessionCookies(LOGGED_IN)! })
    expect(store.setPassword(String(a.id), "hunter2")?.hasPassword).toBe(true)
    expect(fs.readFileSync(store.file, "utf8")).not.toContain("hunter2")
    expect(store.password(String(a.id))).toBe("hunter2")
    expect(store.setPassword(String(a.id), "")?.hasPassword).toBe(false)
    expect(store.remove(String(a.id))).toBe(true)
    expect(store.list()).toEqual([])
  })

  it("refuses to store a login without OS encryption", () => {
    const store = ig.createAccountStore({ dir, cipher: fakeCipher(false) })
    expect(() => store.saveLogin({ username: "a", picked: ig.pickSessionCookies(LOGGED_IN)! })).toThrow(/keychain/)
    expect(fs.existsSync(store.file)).toBe(false)
  })

  it("treats Linux basic_text storage as no encryption", () => {
    const cipher = ig.safeStorageCipher({
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "basic_text",
    })
    expect(cipher.available()).toBe(false)
  })
})

describe("checkSession", () => {
  const account = { username: "alitza", userId: "123" }
  const reply = (status: number, body: unknown) => async () => ({ status, json: async () => body })

  it("sends the session and reads a working one", async () => {
    let sent: Record<string, string> = {}
    const result = await ig.checkSession({
      account,
      cookies: { sessionid: "S", csrftoken: "c", ds_user_id: "123" },
      fetchImpl: async (_url, init) => {
        sent = init.headers
        return { status: 200, json: async () => ({ data: { user: { id: "123" } } }) }
      },
    })
    expect(result.state).toBe("ok")
    expect(sent.Cookie).toContain("sessionid=S")
    expect(sent["X-CSRFToken"]).toBe("c")
  })

  it("names an expired session, a checkpoint, a limit and a different account", async () => {
    const cookies = { sessionid: "S", ds_user_id: "123" }
    expect((await ig.checkSession({ account, cookies, fetchImpl: reply(401, {}) })).state).toBe("expired")
    expect(
      (await ig.checkSession({ account, cookies, fetchImpl: reply(400, { message: "checkpoint_required" }) })).state,
    ).toBe("checkpoint")
    expect((await ig.checkSession({ account, cookies, fetchImpl: reply(429, {}) })).state).toBe("limited")
    expect(
      (await ig.checkSession({ account, cookies, fetchImpl: reply(200, { data: { user: { id: "999" } } }) })).state,
    ).toBe("mismatch")
    expect((await ig.checkSession({ account, cookies: null, fetchImpl: reply(200, {}) })).state).toBe("no-session")
  })
})
