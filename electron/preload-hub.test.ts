import Module from "node:module"
import { createRequire } from "node:module"
import { afterEach, describe, expect, it, vi } from "vitest"
import { hubRevArgument } from "./persist-hub-cache.js"

const nodeRequire = createRequire(import.meta.url)
const preloadPath = nodeRequire.resolve("./preload.js")
const originalRequire = Module.prototype.require
const argvSnapshot = process.argv.slice()

type PreloadApi = {
  HUB_SEED_MARKER: string
  hubRevFromArgv: (argv?: string[]) => string | null
  persistHubWaitLocation: (protocol: string, hostname: string) => boolean
  seedKeyNames: (items: Record<string, unknown>) => string[]
  hubSeedCovered: (raw: string | null, rev: string | null, getItem: (name: string) => string | null) => boolean
  knownSeedStillPresent: (raw: string | null, getItem: (name: string) => string | null) => boolean
  chooseHubSeedTransport: (opts: {
    vaultGuardLoaded: boolean
    rev: string | null
    waits: boolean
    raw: string | null
    getItem: (name: string) => string | null
  }) => "skip" | "invoke" | "sendSync"
  hydrateLocalStorageFromChromeHub: () => void
}

function setHubRev(rev: string | null) {
  process.argv = process.argv.filter((arg) => !arg.startsWith("--brain2-hub-rev="))
  if (rev !== null) process.argv.push(hubRevArgument(rev))
}

function loadPreload(snapshot: { items: Record<string, string>; source?: string | null; updatedAt?: string | null }, sandbox = true) {
  const sendSync = vi.fn(() => snapshot)
  const invoke = vi.fn(async () => snapshot)
  const electron = {
    contextBridge: { exposeInMainWorld: vi.fn() },
    ipcRenderer: {
      sendSync,
      invoke,
      send: vi.fn(),
      on: vi.fn(() => () => {}),
      removeListener: vi.fn(),
    },
  }
  Module.prototype.require = function patched(this: NodeJS.Module, id: string) {
    if (id === "electron") return electron
    if (sandbox && id.includes("vault-guard")) throw new Error("sandbox")
    return originalRequire.apply(this, [id])
  } as typeof Module.prototype.require
  try {
    delete nodeRequire.cache[preloadPath]
    const api = nodeRequire(preloadPath) as PreloadApi
    return { api, sendSync, invoke }
  } finally {
    Module.prototype.require = originalRequire
  }
}

afterEach(() => {
  process.argv = argvSnapshot.slice()
  localStorage.clear()
  Module.prototype.require = originalRequire
  delete nodeRequire.cache[preloadPath]
})

describe("preload hub seed", () => {
  it("decodes the same revision token main puts on the window", () => {
    const token = "2026-10-06T00:00:00.000Z@10:42"
    setHubRev(token)
    const { api, sendSync } = loadPreload({ items: {}, updatedAt: null, source: null })
    expect(api.hubRevFromArgv(process.argv)).toBe(token)
    expect(api.persistHubWaitLocation("http:", "localhost")).toBe(true)
    expect(api.persistHubWaitLocation("http:", "127.0.0.1")).toBe(true)
    expect(api.persistHubWaitLocation("app:", "local")).toBe(false)
    expect(sendSync).toHaveBeenCalledTimes(1)
  })

  it("names only the keys a sandboxed preload would write", () => {
    setHubRev("rev")
    const { api } = loadPreload({ items: {}, updatedAt: "rev", source: null })
    expect(
      api.seedKeyNames({
        "brain2-task-storage": "live",
        "cogs-task-storage": "stale",
        "cogs-only": "keep",
        "brain2-friend-pic:p1": "data:",
        "brain2-telegram-hub-seed": "[\"skip\"]",
        "monthPlan-2026-09": "",
        "brain2-app-tab": "habits",
      }),
    ).toEqual(["brain2-task-storage", "cogs-only", "brain2-app-tab"])
  })

  it("skips IPC when this profile already has the keys for the current revision", () => {
    const rev = "2026-10-06T00:00:00.000Z@10:99"
    setHubRev(rev)
    localStorage.setItem("brain2-task-storage", "local-vault")
    localStorage.setItem("brain2-app-tab", "habits")
    localStorage.setItem(
      "brain2-telegram-hub-seed",
      JSON.stringify({ rev, keys: ["brain2-task-storage", "brain2-app-tab"] }),
    )
    const { sendSync, invoke } = loadPreload({
      items: { "brain2-task-storage": "hub-should-not-apply", "brain2-app-tab": "tracking" },
      updatedAt: "2026-10-06T00:00:00.000Z",
      source: "hub",
    })
    expect(sendSync).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
    expect(localStorage.getItem("brain2-task-storage")).toBe("local-vault")
    expect(localStorage.getItem("brain2-app-tab")).toBe("habits")
  })

  it("sendSync-seeds a first window before page scripts, from whatever the handler returns", () => {
    setHubRev("fresh@1:2")
    const { sendSync, invoke } = loadPreload({
      items: {
        "brain2-task-storage": "from-hub",
        "cogs-task-storage": "twin",
        "brain2-friend-pic:p1": "data:image/png,xx",
        "monthPlan-2026-09": "september",
      },
      updatedAt: "2026-10-06T00:00:00.000Z",
      source: "chrome",
    })
    expect(sendSync).toHaveBeenCalledTimes(1)
    expect(invoke).not.toHaveBeenCalled()
    expect(localStorage.getItem("brain2-task-storage")).toBe("from-hub")
    expect(localStorage.getItem("cogs-task-storage")).toBeNull()
    expect(localStorage.getItem("brain2-friend-pic:p1")).toBeNull()
    expect(localStorage.getItem("monthPlan-2026-09")).toBe("september")
    const marker = JSON.parse(localStorage.getItem("brain2-telegram-hub-seed") || "{}") as {
      rev: string
      keys: string[]
    }
    expect(marker.rev).toBe("fresh@1:2")
    expect(marker.keys).toEqual(["brain2-task-storage", "monthPlan-2026-09"])
  })

  it("keeps a present local value and fills only empty keys", () => {
    setHubRev("fresh@1:2")
    localStorage.setItem("brain2-task-storage", "already")
    const { sendSync } = loadPreload({
      items: { "brain2-task-storage": "hub", "brain2-app-tab": "habits" },
      updatedAt: "t",
      source: null,
    })
    expect(sendSync).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem("brain2-task-storage")).toBe("already")
    expect(localStorage.getItem("brain2-app-tab")).toBe("habits")
  })

  it("uses invoke on localhost when the revision changed but the previous keys are still present", async () => {
    setHubRev("next@2:3")
    localStorage.setItem("brain2-task-storage", "local-vault")
    localStorage.setItem(
      "brain2-telegram-hub-seed",
      JSON.stringify({ rev: "old@1:1", keys: ["brain2-task-storage"] }),
    )
    const { sendSync, invoke } = loadPreload({
      items: { "brain2-task-storage": "hub", "monthPlan-2026-09": "september" },
      updatedAt: "next",
      source: "hub",
    })
    expect(sendSync).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(localStorage.getItem("monthPlan-2026-09")).toBe("september")
    })
    expect(localStorage.getItem("brain2-task-storage")).toBe("local-vault")
    const marker = JSON.parse(localStorage.getItem("brain2-telegram-hub-seed") || "{}") as { rev: string }
    expect(marker.rev).toBe("next@2:3")
  })

  it("sendSyncs on app:// when the revision changed, because nothing waits", () => {
    setHubRev("next@2:3")
    const { api } = loadPreload({ items: {}, updatedAt: null, source: null })
    const raw = JSON.stringify({ rev: "old@1:1", keys: ["brain2-task-storage"] })
    const getItem = (name: string) => (name === "brain2-task-storage" ? "local-vault" : null)
    const opts = {
      vaultGuardLoaded: false,
      rev: "next@2:3",
      raw,
      getItem,
    }
    expect(api.chooseHubSeedTransport({ ...opts, waits: false })).toBe("sendSync")
    expect(api.chooseHubSeedTransport({ ...opts, waits: true })).toBe("invoke")
    expect(api.persistHubWaitLocation("app:", "local")).toBe(false)
    expect(api.persistHubWaitLocation("http:", "localhost")).toBe(true)
  })

  it("sendSyncs even when keys match if vault-guard loaded", () => {
    const rev = "same@1:1"
    setHubRev(rev)
    localStorage.setItem("brain2-task-storage", "local-vault")
    localStorage.setItem("brain2-telegram-hub-seed", JSON.stringify({ rev, keys: ["brain2-task-storage"] }))
    const { sendSync } = loadPreload(
      { items: { "brain2-task-storage": "hub" }, updatedAt: "t", source: null },
      false,
    )
    expect(sendSync).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem("brain2-task-storage")).toBe("local-vault")
  })
})
