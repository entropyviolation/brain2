import { EventEmitter } from "node:events"
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, statSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  shouldRejectVaultShrink,
  vaultRecordCount,
  listRecoveryBackupsFromDir,
  safeRecoveryBackupPath,
  journalVaultSnapshot,
  vaultDropReason,
  readSharedPersist,
  upsertSharedPersistItem,
  mergeSharedPersistItems,
  flushSharedPersist,
  flushSharedPersistSync,
  _resetSharedPersistForTests,
  handlePersistApi,
} from "@/scripts/persist-api.mjs"

const phonePatch = vi.hoisted(() => ({
  applyVaultPatch: vi.fn(() => ({ ok: false, reason: "patch refused" })),
}))

vi.mock("../lib/vault-guard.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const fromDefault =
    actual.default && typeof actual.default === "object" ? (actual.default as Record<string, unknown>) : {}
  const base = { ...fromDefault, ...actual }
  return { ...base, applyVaultPatch: phonePatch.applyVaultPatch }
})

function timegrid(n: number) {
  return JSON.stringify({
    state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) },
    version: 7,
  })
}

function sleep(n: number) {
  const nights: Record<string, { date: string }> = {}
  for (let i = 0; i < n; i++) nights[`2026-09-${String(i + 1).padStart(2, "0")}`] = { date: `d${i}` }
  return JSON.stringify({ state: { nights }, version: 1 })
}

function habits(tasks: number, days: number) {
  const weeklyData: Record<string, object> = {}
  for (let i = 0; i < days; i++) weeklyData[`2026-09-${String(i + 1).padStart(2, "0")}`] = {}
  return JSON.stringify({
    state: { tasks: Array.from({ length: tasks }, (_, i) => ({ id: `h${i}` })), weeklyData },
    version: 14,
  })
}

function lists(n: number) {
  return JSON.stringify({
    state: { tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) },
    version: 12,
  })
}

describe("persist hub vault shrink guard", () => {
  it("counts entries and nights", () => {
    expect(vaultRecordCount("cogs-timegrid-store", timegrid(12))).toBe(12)
    expect(vaultRecordCount("cogs-sleep-store", sleep(3))).toBe(3)
    expect(vaultRecordCount("cogs-task-storage", lists(12))).toBe(12)
    expect(vaultRecordCount("cogs-habits-store", habits(30, 47))).toBe(77)
  })

  it("lets ordinary edits through and rejects a much thinner vault", () => {
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(168), timegrid(169))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(63), timegrid(169))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-sleep-store", sleep(1), sleep(5))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(10), undefined)).toBe(false)
    expect(shouldRejectVaultShrink("cogs-ingest-store", timegrid(1), timegrid(100))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-task-storage", lists(15), lists(2455))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(15, 6), habits(30, 47))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(29, 47), habits(30, 47))).toBe(false)
  })
})

describe("auto recovery journal (isolated tmp dir)", () => {
  it("keeps the copy a shrinking or refused write would have cost", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cogs-journal-"))
    try {
      // 3% fewer entries slips under the shrink guard — that is how a day of
      // tracking went missing. Journal it so the old copy is still restorable.
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(173), false)).toBe("shrunk")
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(178), false)).toBeNull()
      // A curated vault loses rows on purpose; only a real bite is journaled.
      expect(vaultDropReason("cogs-task-storage", lists(100), lists(99), false)).toBeNull()
      expect(vaultDropReason("cogs-task-storage", lists(100), lists(80), false)).toBe("shrunk")
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(2), true)).toBe("refused")
      expect(vaultDropReason("cogs-theme-store", '{"state":{}}', '{"state":{}}', true)).toBeNull()

      const file = journalVaultSnapshot("brain2-timegrid-store", timegrid(178), "shrunk", dir)
      expect(file).toBeTruthy()
      const listing = listRecoveryBackupsFromDir(dir)
      expect(listing.exists).toBe(true)
      expect(listing.backups[0].storeKeys).toEqual(["brain2-timegrid-store"])
      // One file per vault per hour: the first copy of the hour is pre-damage.
      const again = journalVaultSnapshot("brain2-timegrid-store", timegrid(2), "shrunk", dir)
      expect(again).toBe(file)
      expect(listRecoveryBackupsFromDir(dir).backups).toHaveLength(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("recovery-backups listing (isolated tmp dir)", () => {
  it("does not invent a folder and rejects path-like names", () => {
    const missing = path.join(tmpdir(), `cogs-recovery-missing-${Date.now()}`)
    expect(listRecoveryBackupsFromDir(missing)).toEqual({ exists: false, backups: [] })
    expect(safeRecoveryBackupPath("../x.json", "/tmp/safe")).toBeNull()
    expect(safeRecoveryBackupPath("nested/path.json", "/tmp/safe")).toBeNull()
  })

  it("lists valid snapshots from a temp folder, not the live vault", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cogs-recovery-"))
    try {
      writeFileSync(
        path.join(dir, "ok-file.json"),
        JSON.stringify({
          app: "brain2",
          version: 1,
          exportedAt: "2026-09-21T00:00:00.000Z",
          stores: { "cogs-task-storage": { state: {} } },
          planText: { "dayPlan-2026-09-21": "x" },
        }),
      )
      writeFileSync(path.join(dir, "not-a-backup.json"), JSON.stringify({ nope: true }))
      const listing = listRecoveryBackupsFromDir(dir)
      expect(listing.exists).toBe(true)
      expect(listing.backups).toHaveLength(1)
      expect(listing.backups[0]?.name).toBe("ok-file.json")
      expect(listing.backups[0]?.storeKeys).toEqual(["cogs-task-storage"])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("hub in-memory copy (isolated tmp file)", () => {
  const dirs: string[] = []
  function setup(initial?: object, flushMs = 20) {
    const dir = mkdtempSync(path.join(tmpdir(), "brain2-hub-"))
    dirs.push(dir)
    const file = path.join(dir, "shared-persist.json")
    if (initial) writeFileSync(file, JSON.stringify(initial), "utf8")
    _resetSharedPersistForTests(file, { flushMs })
    return file
  }
  const disk = (f: string) => JSON.parse(readFileSync(f, "utf8"))
  const readItems = () => readSharedPersist().items as Record<string, string>
  afterEach(() => {
    _resetSharedPersistForTests()
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it("reads an old double-aliased file once and answers either alias", () => {
    const file = setup({ updatedAt: "x", source: "old", items: { "brain2-a": "1", "cogs-a": "1", "friend-pic:z": "img", legacy: "L" } })
    const items = readItems()
    expect(items["brain2-a"]).toBe("1")
    expect(items["cogs-a"]).toBe("1")
    expect(items.legacy).toBe("L")
    expect(items["friend-pic:z"]).toBeUndefined()
    // Second read does not touch the file: change it behind our back with an identical sig is impossible, so just check memory stays.
    expect(readItems()["cogs-a"]).toBe("1")
    expect(existsSync(file)).toBe(true)
  })

  it("keeps brain2-* when a twin pair disagrees", () => {
    setup({ items: { "cogs-a": "old", "brain2-a": "new" } })
    expect(readItems()["cogs-a"]).toBe("new")
  })

  it("does not write per POST; debounces one atomic write that keeps both aliases", async () => {
    const file = setup({ items: { "brain2-a": "1", "cogs-a": "1" } })
    const before = statSync(file).mtimeMs
    upsertSharedPersistItem("cogs-a", "2", "t")
    upsertSharedPersistItem("brain2-b", "3", "t")
    upsertSharedPersistItem("brain2-b", "4", "t")
    expect(disk(file).items["brain2-a"]).toBe("1") // not yet
    expect(statSync(file).mtimeMs).toBe(before)
    expect(readItems()["brain2-a"]).toBe("2") // memory is current, either alias
    await flushSharedPersist()
    const d = disk(file)
    expect(d.items).toMatchObject({ "brain2-a": "2", "cogs-a": "2", "brain2-b": "4", "cogs-b": "4" })
    expect(d.source).toBe("t")
    expect(readdirSync(path.dirname(file)).filter((n) => n.endsWith(".tmp"))).toEqual([])
  })

  it("debounce timer writes on its own", async () => {
    const file = setup(undefined, 20)
    upsertSharedPersistItem("brain2-x", "1")
    await new Promise((r) => setTimeout(r, 150))
    expect(disk(file).items["cogs-x"]).toBe("1")
  })

  it("sync flush writes pending changes (exit path)", () => {
    const file = setup()
    upsertSharedPersistItem("brain2-x", "1")
    expect(existsSync(file)).toBe(false)
    expect(flushSharedPersistSync()).toBe(true)
    expect(disk(file).items["brain2-x"]).toBe("1")
  })

  it("identical values stay clean, no write", async () => {
    const file = setup({ items: { "brain2-a": "1", "cogs-a": "1" } })
    const before = statSync(file).mtimeMs
    upsertSharedPersistItem("brain2-a", "1")
    await flushSharedPersist()
    expect(statSync(file).mtimeMs).toBe(before)
  })

  it("drops friend-pic", async () => {
    const file = setup({ items: { "brain2-x": "1", "friend-pic:1": "old" } })
    expect(upsertSharedPersistItem("friend-pic:1", "data:").skipped).toBe("friend-pic")
    upsertSharedPersistItem("brain2-y", "2")
    await flushSharedPersist()
    expect(Object.keys(disk(file).items).sort()).toEqual(["brain2-x", "brain2-y", "cogs-x", "cogs-y"])
  })

  it("merge keeps counts and skip tally", () => {
    setup()
    const r = mergeSharedPersistItems({ "brain2-a": "1", "friend-pic:q": "z", bad: 5 as unknown as string }, "dump")
    expect(r.skipped).toBe(1)
    expect(r.keyCount).toBe(2)
    expect(Object.keys(r.items).sort()).toEqual(["brain2-a", "cogs-a"])
  })

  it("picks up another process's write when clean, and merges when dirty", async () => {
    const file = setup({ items: { "brain2-a": "1", "cogs-a": "1" } })
    readSharedPersist()
    writeFileSync(file, JSON.stringify({ items: { "brain2-a": "1", "brain2-tg": "phone" }, source: "phone-hub" }) + " ", "utf8")
    expect(readItems()["brain2-tg"]).toBe("phone")
    upsertSharedPersistItem("brain2-mine", "m")
    writeFileSync(file, JSON.stringify({ items: { "brain2-a": "1", "brain2-tg": "phone", "brain2-late": "L" }, source: "phone-hub" }) + "  ", "utf8")
    await flushSharedPersist()
    expect(disk(file).items).toMatchObject({ "brain2-mine": "m", "brain2-late": "L", "cogs-late": "L", "brain2-tg": "phone" })
  })
})

describe("hub flush ordering", () => {
  it("an edit made during a write is written by the next flush", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "brain2-hub-"))
    const file = path.join(dir, "shared-persist.json")
    try {
      _resetSharedPersistForTests(file, { flushMs: 10 })
      upsertSharedPersistItem("brain2-a", "1")
      const p = flushSharedPersist()
      upsertSharedPersistItem("brain2-b", "2")
      await p
      await new Promise((r) => setTimeout(r, 120))
      const items = JSON.parse(readFileSync(file, "utf8")).items
      expect(items["cogs-b"]).toBe("2")
      expect(items["cogs-a"]).toBe("1")
    } finally {
      _resetSharedPersistForTests()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("persist HTTP canon and phone patch", () => {
  const dirs: string[] = []
  function setup(initial?: object) {
    const dir = mkdtempSync(path.join(tmpdir(), "brain2-persist-http-"))
    dirs.push(dir)
    const file = path.join(dir, "shared-persist.json")
    if (initial) writeFileSync(file, JSON.stringify(initial), "utf8")
    _resetSharedPersistForTests(file, { flushMs: 60_000 })
    return file
  }
  afterEach(() => {
    phonePatch.applyVaultPatch.mockReset()
    phonePatch.applyVaultPatch.mockImplementation(() => ({ ok: false, reason: "patch refused" }))
    _resetSharedPersistForTests()
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  async function persistHttp(
    method: string,
    url: string,
    jsonBody?: unknown,
    headers: Record<string, string> = {},
  ) {
    const req = new EventEmitter() as EventEmitter & {
      method: string
      url: string
      headers: Record<string, string>
    }
    req.method = method
    req.url = url
    req.headers = headers
    const res = {
      statusCode: 0,
      headers: {} as Record<string, unknown>,
      raw: "",
      writeHead(status: number, h?: Record<string, unknown>) {
        this.statusCode = status
        if (h && typeof h === "object" && !Array.isArray(h)) Object.assign(this.headers, h)
      },
      end(chunk?: string) {
        this.raw = chunk ?? ""
      },
    }
    const pathname = new URL(url, "http://127.0.0.1").pathname
    const pending = handlePersistApi(req, res, pathname)
    const raw = jsonBody === undefined ? null : Buffer.from(JSON.stringify(jsonBody))
    process.nextTick(() => {
      if (raw) req.emit("data", raw)
      req.emit("end")
    })
    await pending
    let body: unknown = res.raw
    if (res.raw) {
      try {
        body = JSON.parse(res.raw)
      } catch {
        body = res.raw
      }
    } else body = null
    return { status: res.statusCode, body }
  }

  const stored = JSON.stringify({
    state: { tasks: [{ id: "a", title: "Old", notes: "keep" }] },
    version: 12,
  })
  const patched = JSON.stringify({
    state: { tasks: [{ id: "a", title: "New", notes: "keep" }] },
    version: 12,
  })
  const patch = { upserts: [{ id: "a", title: "New" }], removedIds: [] as string[] }

  it("GET ?canon=1 omits cogs twins and leaves the file unchanged", async () => {
    const file = setup({
      updatedAt: "t0",
      source: "desk",
      items: {
        "brain2-task-storage": stored,
        "cogs-task-storage": stored,
        legacy: "L",
        "friend-pic:z": "img",
      },
    })
    const before = readFileSync(file, "utf8")
    const full = await persistHttp("GET", "/api/persist")
    const canon = await persistHttp("GET", "/api/persist?canon=1")
    const fullBody = full.body as { items: Record<string, string>; source: string }
    const canonBody = canon.body as { items: Record<string, string>; source: string; updatedAt: string }
    expect(full.status).toBe(200)
    expect(fullBody.items["brain2-task-storage"]).toBe(stored)
    expect(fullBody.items["cogs-task-storage"]).toBe(stored)
    expect(fullBody.items.legacy).toBe("L")
    expect(fullBody.items["friend-pic:z"]).toBeUndefined()
    expect(canon.status).toBe(200)
    expect(canonBody.source).toBe("desk")
    expect(canonBody.updatedAt).toBe("t0")
    expect(Object.keys(canonBody.items).sort()).toEqual(["brain2-task-storage", "legacy"])
    expect(canonBody.items["brain2-task-storage"]).toBe(stored)
    expect(canonBody.items["cogs-task-storage"]).toBeUndefined()
    expect(readFileSync(file, "utf8")).toBe(before)
  })

  it("allows a capacitor origin and refuses a public website origin", async () => {
    const file = setup({ items: { "brain2-a": "1", "cogs-a": "1" } })
    const before = readFileSync(file, "utf8")
    const phone = await persistHttp("GET", "/api/persist?canon=1", undefined, {
      origin: "capacitor://localhost",
      host: "192.168.1.20:3000",
    })
    const phoneBody = phone.body as { items: Record<string, string> }
    expect(phone.status).toBe(200)
    expect(phoneBody.items["brain2-a"]).toBe("1")
    expect(phoneBody.items["cogs-a"]).toBeUndefined()
    const web = await persistHttp("POST", "/api/persist", { name: "brain2-a", value: "wiped" }, {
      origin: "https://evil.example",
      host: "192.168.1.20:3000",
    })
    expect(web.status).toBe(403)
    expect(web.body).toBe("forbidden origin")
    expect(readFileSync(file, "utf8")).toBe(before)
    expect(phonePatch.applyVaultPatch).not.toHaveBeenCalled()
  })

  it("applies a phone patch through the hub merge and refuses a phone whole store", async () => {
    const file = setup({
      updatedAt: "t0",
      source: "desk",
      items: { "brain2-task-storage": stored, "cogs-task-storage": stored },
    })
    phonePatch.applyVaultPatch.mockReturnValueOnce({ ok: true, value: patched })
    const ok = await persistHttp("POST", "/api/persist", {
      name: "brain2-task-storage",
      source: "phone",
      patch,
    })
    expect(ok.status).toBe(200)
    expect((ok.body as { ok: boolean; skipped: boolean }).ok).toBe(true)
    expect((ok.body as { skipped: boolean }).skipped).toBe(false)
    expect(phonePatch.applyVaultPatch).toHaveBeenCalledWith("brain2-task-storage", stored, patch)
    await flushSharedPersist()
    const disk = JSON.parse(readFileSync(file, "utf8"))
    expect(disk.items["brain2-task-storage"]).toBe(patched)
    expect(disk.items["cogs-task-storage"]).toBe(patched)
    const row = JSON.parse(disk.items["brain2-task-storage"]).state.tasks[0]
    expect(row).toMatchObject({ id: "a", title: "New", notes: "keep" })

    const refused = await persistHttp("POST", "/api/persist", {
      name: "brain2-task-storage",
      source: "phone",
      patch: { upserts: [{ id: "a", title: "Nope" }], removedIds: [] },
    })
    expect(phonePatch.applyVaultPatch).toHaveBeenCalledTimes(2)
    expect(refused.status).toBe(409)
    expect(refused.body).toMatchObject({ ok: false, reason: "patch refused" })
    expect(JSON.parse(readFileSync(file, "utf8")).items["brain2-task-storage"]).toBe(patched)

    phonePatch.applyVaultPatch.mockClear()
    const before = readFileSync(file, "utf8")
    const whole = await persistHttp("POST", "/api/persist", {
      name: "brain2-task-storage",
      value: stored,
      source: "phone",
    })
    expect(whole.status).toBe(409)
    expect(whole.body).toMatchObject({ ok: false, reason: "phone whole-store write refused" })
    expect(phonePatch.applyVaultPatch).not.toHaveBeenCalled()
    expect(readFileSync(file, "utf8")).toBe(before)
  })

  it("still accepts a desktop whole-store post, including phone-hub", async () => {
    setup({ items: { "brain2-a": "1", "cogs-a": "1" }, source: "desk" })
    const electron = await persistHttp("POST", "/api/persist", { name: "brain2-a", value: "2" })
    expect(electron.status).toBe(200)
    expect(readSharedPersist().items["brain2-a"]).toBe("2")
    expect(readSharedPersist().items["cogs-a"]).toBe("2")
    const chrome = await persistHttp("POST", "/api/persist", {
      name: "brain2-b",
      value: "chrome",
      source: "chrome",
    })
    expect(chrome.status).toBe(200)
    expect(readSharedPersist().items["cogs-b"]).toBe("chrome")
    const hub = await persistHttp("POST", "/api/persist", {
      name: "brain2-tg",
      value: "from-hub",
      source: "phone-hub",
    })
    expect(hub.status).toBe(200)
    expect(readSharedPersist().items["brain2-tg"]).toBe("from-hub")
    expect(phonePatch.applyVaultPatch).not.toHaveBeenCalled()
  })
})
