import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  copyLegacyPersistKeys,
  isPlanTextStorageKey,
  persistKey,
  readAliasedLocal,
  resetLegacyPersistCopyFlag,
  twinPersistKey,
  wipeDemoPhysicalKeys,
  writeAliasedLocal,
  writeDataProfile,
  releaseDuplicateLegacyTwins,
  releaseCopiedUnprefixedKeys,
  releaseFriendPicLocalKeys,
} from "./storage-keys"

describe("storage keys", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetLegacyPersistCopyFlag()
  })

  it("canonicalizes friend-worn onto brain2- without dropping the cogs- alias", () => {
    expect(persistKey("friend-worn")).toBe("brain2-friend-worn")
    expect(persistKey("cogs-friend-worn")).toBe("brain2-friend-worn")
    expect(twinPersistKey("brain2-friend-worn")).toBe("cogs-friend-worn")
    writeAliasedLocal("brain2-friend-worn", '{"photoId":"bunny"}')
    expect(localStorage.getItem("brain2-friend-worn")).toMatch(/bunny/)
    expect(localStorage.getItem("cogs-friend-worn")).toMatch(/bunny/)
  })

  it("reads a leftover cogs- vault and copies it onto brain2- without deleting cogs-", () => {
    localStorage.setItem("cogs-friend-pic:p1", "data:image/png;base64,ZmFrZQ==")
    expect(copyLegacyPersistKeys()).toBe(1)
    expect(localStorage.getItem("brain2-friend-pic:p1")).toBe("data:image/png;base64,ZmFrZQ==")
    expect(localStorage.getItem("cogs-friend-pic:p1")).toBe("data:image/png;base64,ZmFrZQ==")
    expect(readAliasedLocal("brain2-friend-pic:p1")).toMatch(/^data:image/)
  })

  it("skips empty tombstones when reading aliases", () => {
    localStorage.setItem("monthPlan-2026-09", "")
    localStorage.setItem("brain2-monthPlan-2026-09", '{"v":1,"entries":[],"draft":"kept"}')
    expect(readAliasedLocal("brain2-monthPlan-2026-09")).toMatch(/kept/)
    expect(isPlanTextStorageKey("monthPlan-2026-09")).toBe(true)
    expect(isPlanTextStorageKey("brain2-weekPlan-2026-W38")).toBe(true)
    expect(isPlanTextStorageKey("cogs-habits-store")).toBe(false)
  })

  it("Demo writes never land on Live brain2- or cogs- keys", () => {
    localStorage.setItem("brain2-habits-store", "LIVE_VAULT")
    localStorage.setItem("cogs-habits-store", "LIVE_VAULT")
    localStorage.setItem("points-store", "LIVE_POINTS")
    writeDataProfile("demo")
    writeAliasedLocal("brain2-habits-store", "DEMO_ONLY")
    writeAliasedLocal("points-store", "DEMO_POINTS")
    expect(localStorage.getItem("brain2-habits-store")).toBe("LIVE_VAULT")
    expect(localStorage.getItem("cogs-habits-store")).toBe("LIVE_VAULT")
    expect(localStorage.getItem("points-store")).toBe("LIVE_POINTS")
    expect(localStorage.getItem("brain2-demo-habits-store")).toBe("DEMO_ONLY")
    expect(localStorage.getItem("brain2-demo-points-store")).toBe("DEMO_POINTS")
    expect(readAliasedLocal("brain2-habits-store")).toBe("DEMO_ONLY")
  })

  it("copyLegacyPersistKeys is a no-op on Demo so cogs- Live is not copied into Demo", () => {
    localStorage.setItem("cogs-friend-pic:p1", "secret")
    writeDataProfile("demo")
    expect(copyLegacyPersistKeys()).toBe(0)
    expect(localStorage.getItem("brain2-friend-pic:p1")).toBeNull()
    expect(localStorage.getItem("brain2-demo-friend-pic:p1")).toBeNull()
  })

  it("wipeDemoPhysicalKeys leaves Live keys", () => {
    localStorage.setItem("brain2-task-storage", "LIVE")
    writeDataProfile("demo")
    writeAliasedLocal("brain2-task-storage", "DEMO")
    expect(wipeDemoPhysicalKeys()).toBeGreaterThan(0)
    expect(localStorage.getItem("brain2-task-storage")).toBe("LIVE")
    expect(localStorage.getItem("brain2-demo-task-storage")).toBeNull()
  })

  it("writes a large lists vault only to brain2- and can drop the cogs- twin", () => {
    const blob = `{"state":{"pad":"${"x".repeat(9000)}"}}`
    writeAliasedLocal("brain2-task-storage", blob)
    expect(localStorage.getItem("brain2-task-storage")).toBe(blob)
    expect(localStorage.getItem("cogs-task-storage")).toBeNull()
    localStorage.setItem("cogs-task-storage", blob)
    expect(releaseDuplicateLegacyTwins(8192)).toBeGreaterThan(0)
    expect(localStorage.getItem("cogs-task-storage")).toBeNull()
    expect(localStorage.getItem("brain2-task-storage")).toBe(blob)
  })

  it("releases pre-prefix relics that a brain2- copy replaced, and keeps the rest", () => {
    localStorage.setItem("task-storage", "RELIC")
    localStorage.setItem("brain2-task-storage", "LIVE")
    localStorage.setItem("weekly-habits-tasks", "ONLY_COPY")
    localStorage.setItem("dayPlan-2026-09-21", "PLAN_ALIAS")
    localStorage.setItem("brain2-dayPlan-2026-09-21", "PLAN_ALIAS")
    localStorage.setItem("points-store", "UNPREFIXED_VAULT")
    expect(releaseCopiedUnprefixedKeys()).toBe(1)
    expect(localStorage.getItem("task-storage")).toBeNull()
    expect(localStorage.getItem("brain2-task-storage")).toBe("LIVE")
    expect(localStorage.getItem("weekly-habits-tasks")).toBe("ONLY_COPY")
    expect(localStorage.getItem("dayPlan-2026-09-21")).toBe("PLAN_ALIAS")
    expect(localStorage.getItem("points-store")).toBe("UNPREFIXED_VAULT")
  })

  it("never writes the cogs- twin ahead of the key reads prefer", () => {
    localStorage.setItem("brain2-tracking-day-notes", '{"2026-09-21":"one entry"}')
    localStorage.setItem("cogs-tracking-day-notes", '{"2026-09-21":"one entry"}')
    const full = Object.defineProperty(new Error("full"), "name", { value: "QuotaExceededError" })
    const real = localStorage.setItem.bind(localStorage)
    let calls = 0
    localStorage.setItem = (key: string, value: string) => {
      calls += 1
      if (key.startsWith("brain2-tracking-day-notes")) throw full
      real(key, value)
    }
    try {
      expect(() => writeAliasedLocal("brain2-tracking-day-notes", '{"2026-09-21":"two entries"}')).toThrow(/full/)
    } finally {
      localStorage.setItem = real
    }
    expect(calls).toBe(2) // canonical, then one retry after reclaiming space
    expect(localStorage.getItem("cogs-tracking-day-notes")).not.toBe('{"2026-09-21":"two entries"}')
  })

  it("keeps a cogs- twin that drifted from brain2- instead of calling it a duplicate", () => {
    localStorage.setItem("brain2-tracking-day-notes", '{"2026-09-21":"one entry"}')
    localStorage.setItem("cogs-tracking-day-notes", '{"2026-09-21":"two entries"}')
    releaseDuplicateLegacyTwins()
    expect(localStorage.getItem("cogs-tracking-day-notes")).toBe('{"2026-09-21":"two entries"}')
  })

  it("drops oversized friend-pic data URLs so lists and theme can save", () => {
    localStorage.setItem("brain2-friend-pic:p1", `data:image/png;base64,${"A".repeat(9000)}`)
    localStorage.setItem("brain2-friend-pic:tiny", "data:image/png;base64,xx")
    expect(releaseFriendPicLocalKeys()).toBe(1)
    expect(localStorage.getItem("brain2-friend-pic:p1")).toBeNull()
    expect(localStorage.getItem("brain2-friend-pic:tiny")).toBe("data:image/png;base64,xx")
  })
})
