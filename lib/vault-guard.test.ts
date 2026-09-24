import { beforeEach, describe, expect, it } from "vitest"
import { applyAppearancePins, pickPersistItem, mergePersistSnapshots, shouldRejectVaultShrink, vaultRecordCount, shouldRejectAppearanceDowngrade, shouldRejectContentDowngrade, shouldRejectIngestDowngrade, stampAppearancePins, shouldSkipHubAppearanceCopy, shouldRejectHubLogShrink, unionPersistSnapshots } from "./vault-guard.js"

function tasks(n: number) {
  return JSON.stringify({
    state: { tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) },
    version: 12,
  })
}

function habits(
  taskCount: number,
  days: number,
  extra: Record<string, unknown> = {},
) {
  const weeklyData: Record<string, object> = {}
  for (let i = 0; i < days; i++) weeklyData[`2026-09-${String(i + 1).padStart(2, "0")}`] = {}
  return JSON.stringify({
    state: { tasks: Array.from({ length: taskCount }, (_, i) => ({ id: `h${i}` })), weeklyData, ...extra },
    version: 14,
  })
}

describe("vault-guard", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("counts lists items and habit rows", () => {
    expect(vaultRecordCount("cogs-task-storage", tasks(2455))).toBe(2455)
    expect(vaultRecordCount("cogs-habits-store", habits(30, 47))).toBe(77)
  })

  it("counts tracking entries plus day notes", () => {
    const painted = JSON.stringify({
      state: { entries: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}` })), dayNotes: {} },
    })
    expect(vaultRecordCount("cogs-timegrid-store", painted)).toBe(12)
    const notes = JSON.stringify({
      state: { entries: [], dayNotes: { "2026-09-21": "zoo 4-5", "2026-09-20": "ate at 1" } },
    })
    expect(vaultRecordCount("cogs-timegrid-store", notes)).toBe(2)
  })

  it("keeps this profile's day notes when a richer hub vault of entries wins", () => {
    const local = JSON.stringify({
      state: {
        entries: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}` })),
        dayNotes: { "2026-09-21": "went to the zoo from 4-5" },
      },
      version: 9,
    })
    const hub = JSON.stringify({
      state: {
        entries: Array.from({ length: 80 }, (_, i) => ({ id: `e${i}` })),
        dayNotes: {},
      },
      version: 9,
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-timegrid-store") ?? "{}") as {
      state?: { entries?: unknown[]; dayNotes?: Record<string, string> }
    }
    expect(picked.state?.entries).toHaveLength(80)
    expect(picked.state?.dayNotes?.["2026-09-21"]).toBe("went to the zoo from 4-5")
  })

  it("keeps dedicated-key day notes when the timegrid blob itself has none", () => {
    localStorage.setItem(
      "cogs-tracking-day-notes",
      JSON.stringify({ "2026-09-21": "river otter pup notes 2026-09-21 — stayed after refresh" }),
    )
    const local = JSON.stringify({
      state: { entries: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}` })), dayNotes: {} },
      version: 10,
    })
    const hub = JSON.stringify({
      state: { entries: Array.from({ length: 80 }, (_, i) => ({ id: `e${i}` })), dayNotes: {} },
      version: 10,
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-timegrid-store") ?? "{}") as {
      state?: { dayNotes?: Record<string, string> }
    }
    expect(picked.state?.dayNotes?.["2026-09-21"]).toBe(
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
    localStorage.removeItem("cogs-tracking-day-notes")
  })

  it("keeps this profile's dedicated notes when the hub has more historical days", () => {
    const local = JSON.stringify({ "2026-09-21": "typed just now" })
    const hub = JSON.stringify({
      "2026-09-20": "ate at 1",
      "2026-09-19": "zoo",
      "2026-09-18": "walk",
    })
    expect(pickPersistItem(local, hub, "cogs-tracking-day-notes")).toBe(local)
    expect(pickPersistItem(local, hub, "brain2-tracking-day-notes")).toBe(local)
    expect(JSON.parse(pickPersistItem(null, hub, "cogs-tracking-day-notes") ?? "{}")["2026-09-20"]).toBe("ate at 1")
  })

  it("counts dedicated tracking day notes and rejects an empty hub wipe", () => {
    const rich = JSON.stringify({ "2026-09-21": "zoo 4-5", "2026-09-20": "ate at 1" })
    const empty = JSON.stringify({})
    expect(vaultRecordCount("cogs-tracking-day-notes", rich)).toBe(2)
    expect(shouldRejectVaultShrink("cogs-tracking-day-notes", empty, rich)).toBe(true)
  })

  it("lets a one-item edit through and rejects a seed wipe", () => {
    expect(shouldRejectVaultShrink("cogs-task-storage", tasks(2454), tasks(2455))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-task-storage", tasks(15), tasks(2455))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(15, 6), habits(30, 47))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(29, 47), habits(30, 47))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-ingest-store", tasks(1), tasks(100))).toBe(false)
  })

  it("refuses a pre-hydration ingest seed that would unpair Telegram", () => {
    const paired = JSON.stringify({
      state: {
        allowedChats: [{ chatId: "99", userId: "99", pairedAt: "2026-09-21T00:00:00.000Z" }],
        revokedChatIds: [],
        allowlistRev: 2,
        events: [{ id: "e1" }],
        shortcuts: { shop: "groc" },
      },
      version: 2,
    })
    const seed = JSON.stringify({
      state: { allowedChats: [], revokedChatIds: [], allowlistRev: 0, events: [], shortcuts: {} },
      version: 2,
    })
    expect(shouldRejectIngestDowngrade("brain2-ingest-store", seed, paired)).toBe(true)
    expect(shouldRejectIngestDowngrade("cogs-ingest-store", seed, paired)).toBe(true)
    const kept = JSON.parse(mergePersistSnapshots(paired, seed, "brain2-ingest-store") ?? "{}") as {
      state: { allowedChats: { chatId: string }[] }
    }
    expect(kept.state.allowedChats.map((c) => c.chatId)).toEqual(["99"])
    const picked = JSON.parse(pickPersistItem(seed, paired, "brain2-ingest-store") ?? "{}") as {
      state: { allowedChats: { chatId: string }[] }
    }
    expect(picked.state.allowedChats.map((c) => c.chatId)).toEqual(["99"])
  })

  it("keeps a revoke tombstone when an older snapshot still lists the chat", () => {
    const stale = JSON.stringify({
      state: {
        allowedChats: [{ chatId: "99", pairedAt: "2026-09-21T00:00:00.000Z" }],
        revokedChatIds: [],
        allowlistRev: 1,
        events: [{ id: "e1" }],
      },
      version: 2,
    })
    const revoked = JSON.stringify({
      state: {
        allowedChats: [],
        revokedChatIds: ["99"],
        allowlistRev: 2,
        events: [{ id: "e1" }, { id: "e2" }],
      },
      version: 2,
    })
    const merged = JSON.parse(mergePersistSnapshots(stale, revoked, "cogs-ingest-store") ?? "{}") as {
      state: { allowedChats: { chatId: string }[]; revokedChatIds: string[] }
    }
    expect(merged.state.allowedChats).toEqual([])
    expect(merged.state.revokedChatIds).toEqual(["99"])
  })

  it("rejects a same-sized lists dump that puts 50 items back in Inbox", () => {
    const clarified = JSON.stringify({
      state: {
        tasks: Array.from({ length: 80 }, (_, i) => ({
          id: `t${i}`,
          stage: i < 10 ? "inbox" : "next",
        })),
      },
      version: 12,
    })
    const resurrected = JSON.stringify({
      state: {
        tasks: Array.from({ length: 80 }, (_, i) => ({
          id: `t${i}`,
          stage: i < 60 ? "inbox" : "next",
        })),
      },
      version: 12,
    })
    expect(shouldRejectVaultShrink("brain2-task-storage", resurrected, clarified)).toBe(true)
    expect(pickPersistItem(clarified, resurrected, "brain2-task-storage")).toBe(clarified)
  })

  it("keeps local Inbox clarifications when a richer hub still has those rows in Inbox", () => {
    const local = JSON.stringify({
      state: {
        tasks: [
          { id: "a", stage: "next" },
          { id: "b", stage: "inbox" },
        ],
      },
    })
    const hub = JSON.stringify({
      state: {
        tasks: Array.from({ length: 40 }, (_, i) => ({
          id: i === 0 ? "a" : i === 1 ? "b" : `x${i}`,
          stage: "inbox",
        })),
      },
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-task-storage") ?? "{}") as {
      state?: { tasks?: { id: string; stage: string }[] }
    }
    expect(picked.state?.tasks).toHaveLength(40)
    expect(picked.state?.tasks?.find((t) => t.id === "a")?.stage).toBe("next")
    expect(picked.state?.tasks?.find((t) => t.id === "b")?.stage).toBe("inbox")
  })

  it("hub merge keeps Inbox clarifications and plate picks from the stored vault", () => {
    const stored = JSON.stringify({
      state: {
        tasks: [
          { id: "a", stage: "clarified" },
          { id: "b", stage: "inbox" },
        ],
      },
    })
    const phone = JSON.stringify({
      state: {
        tasks: [
          { id: "a", stage: "inbox" },
          { id: "b", stage: "inbox" },
        ],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(stored, phone, "brain2-task-storage") ?? "{}") as {
      state?: { tasks?: { id: string; stage: string }[] }
    }
    expect(merged.state?.tasks?.find((t) => t.id === "a")?.stage).toBe("clarified")
    const savedTheme = JSON.stringify({
      state: { pcbMode: "xray", chromeFace: 40, appearanceRev: 3 },
      version: 4,
    })
    const seedTheme = JSON.stringify({
      state: { pcbMode: "teal", chromeFace: 50, appearanceRev: 0 },
      version: 4,
    })
    const kept = JSON.parse(mergePersistSnapshots(savedTheme, seedTheme, "cogs-theme-store") ?? "{}") as {
      state?: { pcbMode?: string; appearanceRev?: number }
    }
    expect(kept.state?.pcbMode).toBe("xray")
    expect(kept.state?.appearanceRev).toBe(3)

    const newerTheme = JSON.stringify({
      state: { pcbMode: "mint", chromeFace: 40, appearanceRev: 5 },
      version: 4,
    })
    const posted = JSON.parse(mergePersistSnapshots(savedTheme, newerTheme, "cogs-theme-store") ?? "{}") as {
      state?: { pcbMode?: string; appearanceRev?: number }
    }
    expect(posted.state?.pcbMode).toBe("mint")
    expect(posted.state?.appearanceRev).toBe(5)
  })

  it("hub merge keeps a newer LED tint from the incoming write", () => {
    const stored = habits(30, 47, { percentLedTint: "#7e14ff", appearanceRev: 1 })
    const incoming = habits(30, 47, { percentLedTint: "#00cc88", appearanceRev: 4 })
    const merged = JSON.parse(mergePersistSnapshots(stored, incoming, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; appearanceRev?: number }
    }
    expect(merged.state?.percentLedTint).toBe("#00cc88")
    expect(merged.state?.appearanceRev).toBe(4)
  })

  it("guards every content vault, not a hand-picked five", () => {
    const gallery = (photos: number) =>
      JSON.stringify({
        state: { photos: Array.from({ length: photos }, (_, i) => ({ id: `p${i}` })) },
        version: 7,
      })
    // The friend gallery had no record guard at all: a thin dump replaced it.
    expect(shouldRejectVaultShrink("cogs-baby-animals-store", gallery(1), gallery(12))).toBe(true)
    expect(vaultRecordCount("cogs-baby-animals-store", gallery(12))).toBe(12)

    const goals = (n: number) =>
      JSON.stringify({ state: { objectives: [], goals: Array.from({ length: n }, (_, i) => ({ id: `g${i}` })) } })
    expect(shouldRejectVaultShrink("cogs-goals-store", goals(2), goals(20))).toBe(true)
    expect(shouldRejectVaultShrink("brain2-goals-store", goals(19), goals(20))).toBe(false)

    const points = (n: number) =>
      JSON.stringify({ state: { pointsHistory: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) } })
    expect(shouldRejectVaultShrink("points-store", points(3), points(400))).toBe(true)
  })

  it("keeps the shared file growing for append-only logs", () => {
    const grid = (n: number) =>
      JSON.stringify({ state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) }, version: 12 })
    // The launch POST that cost a day of tracking: 173 rows over 216 is 80%,
    // nowhere near the shrink guard, and the next profile inherits the loss.
    expect(shouldRejectHubLogShrink("brain2-timegrid-store", grid(173), grid(216))).toBe(true)
    expect(shouldRejectHubLogShrink("cogs-timegrid-store", grid(217), grid(216))).toBe(false)
    expect(shouldRejectHubLogShrink("cogs-sleep-store", '{"state":{"nights":{}}}', '{"state":{"nights":{"a":1}}}')).toBe(
      true,
    )
    // Curated vaults still lose rows on purpose, and reads are never affected.
    expect(shouldRejectHubLogShrink("cogs-task-storage", grid(10), grid(11))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", grid(173), grid(216))).toBe(false)
  })

  it("keeps a hand-painted block when Screen Time replaces its own rows", () => {
    const painted = JSON.stringify({
      state: {
        entries: [
          { id: "manual", date: "2026-09-21", penId: "act-work" },
          { id: "st-old", generatedBy: { kind: "screentime", id: "2026-09-21" } },
        ],
      },
    })
    const synced = JSON.stringify({
      state: {
        entries: [
          { id: "manual", date: "2026-09-21", penId: "act-work" },
          { id: "st-new", generatedBy: { kind: "screentime", id: "2026-09-21" } },
        ],
      },
    })
    const stale = JSON.stringify({
      state: {
        entries: [{ id: "st-new", generatedBy: { kind: "screentime", id: "2026-09-21" } }],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(painted, stale, "brain2-timegrid-store") ?? "{}") as {
      state: { entries: { id: string }[] }
    }
    expect(merged.state.entries.map((entry) => entry.id).sort()).toEqual(["manual", "st-new"])
    expect(shouldRejectHubLogShrink("brain2-timegrid-store", synced, painted)).toBe(false)
    const removed = JSON.stringify({
      state: {
        entries: [{ id: "st-new", generatedBy: { kind: "screentime", id: "2026-09-21" } }],
        removedEntryIds: ["manual"],
      },
    })
    const afterDelete = JSON.parse(
      unionPersistSnapshots(removed, painted, "brain2-timegrid-store") ?? removed,
    ) as {
      state: { entries: { id: string }[] }
    }
    expect(afterDelete.state.entries.map((entry) => entry.id)).toEqual(["st-new"])
  })

  it("keeps a habit check a stale snapshot does not have", () => {
    const saved = JSON.stringify({
      state: {
        tasks: [{ id: "h1" }],
        contentRev: 200,
        weeklyData: { "2026-09-21": { h1: { completed: true, updatedAt: 200 } } },
      },
    })
    const stale = JSON.stringify({
      state: {
        tasks: [{ id: "h1", name: "laundry" }],
        contentRev: 999,
        weeklyData: { "2026-09-21": { h1: { completed: false } } },
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(saved, stale, "brain2-habits-store") ?? "{}") as {
      state: { weeklyData: Record<string, Record<string, { completed?: boolean }>>; contentRev: number }
    }
    expect(merged.state.weeklyData["2026-09-21"].h1.completed).toBe(true)
  })

  it("keeps a telegram event a shorter log left out", () => {
    const saved = JSON.stringify({
      state: { events: [{ id: "a", at: "2026-09-22T04:00:00.000Z" }], allowedChats: [{ chatId: "1" }], allowlistRev: 1 },
    })
    const shorter = JSON.stringify({
      state: { events: [{ id: "b", at: "2026-09-22T05:00:00.000Z" }], allowedChats: [{ chatId: "1" }], allowlistRev: 1 },
    })
    const merged = JSON.parse(mergePersistSnapshots(saved, shorter, "brain2-ingest-store") ?? "{}") as {
      state: { events: { id: string }[] }
    }
    expect(merged.state.events.map((event) => event.id).sort()).toEqual(["a", "b"])
  })

  it("keeps a Telegram Inbox capture a stale desktop push left out", () => {
    const hub = JSON.stringify({
      state: {
        tasks: [
          { id: "old", stage: "next", createdAt: "2026-09-01T00:00:00.000Z" },
          { id: "tg-inbox", stage: "inbox", createdAt: "2026-09-22T08:00:00.000Z" },
        ],
        lists: [{ id: "example" }],
        folders: [],
      },
    })
    const desktop = JSON.stringify({
      state: {
        tasks: [{ id: "old", stage: "next", createdAt: "2026-09-01T00:00:00.000Z" }],
        lists: [{ id: "example" }],
        folders: [],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(hub, desktop, "brain2-task-storage") ?? "{}") as {
      state: { tasks: { id: string }[] }
    }
    expect(merged.state.tasks.map((task) => task.id).sort()).toEqual(["old", "tg-inbox"])
    expect(shouldRejectVaultShrink("brain2-task-storage", tasks(15), tasks(2455))).toBe(true)
  })

  it("honors removedTaskIds so a real delete is not resurrected by union", () => {
    const hub = JSON.stringify({
      state: {
        tasks: [
          { id: "keep", stage: "inbox" },
          { id: "gone", stage: "inbox" },
        ],
      },
    })
    const desktop = JSON.stringify({
      state: {
        tasks: [{ id: "keep", stage: "inbox" }],
        removedTaskIds: ["gone"],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(hub, desktop, "cogs-task-storage") ?? "{}") as {
      state: { tasks: { id: string }[]; removedTaskIds: string[] }
    }
    expect(merged.state.tasks.map((task) => task.id)).toEqual(["keep"])
    expect(merged.state.removedTaskIds).toContain("gone")
  })

  it("keeps a Telegram plan entry a thinner dayPlan left out", () => {
    const hub = JSON.stringify({
      v: 1,
      entries: [
        { id: "al_desk", createdAt: "2026-09-22T07:00:00.000Z", text: "desk plan" },
        { id: "al_tg", createdAt: "2026-09-22T08:00:00.000Z", text: "write\nwalk" },
      ],
    })
    const desktop = JSON.stringify({
      v: 1,
      entries: [{ id: "al_desk", createdAt: "2026-09-22T07:00:00.000Z", text: "desk plan" }],
    })
    const merged = JSON.parse(mergePersistSnapshots(hub, desktop, "dayPlan-2026-09-22") ?? "{}") as {
      entries: { id: string }[]
    }
    expect(merged.entries.map((entry) => entry.id).sort()).toEqual(["al_desk", "al_tg"])
  })

  it("does not call an ordinary delete a wipe in a small vault", () => {
    const gallery = (photos: number) =>
      JSON.stringify({
        state: { photos: Array.from({ length: photos }, (_, i) => ({ id: `p${i}` })) },
        version: 7,
      })
    // Removing 1 of 2 cards halves the vault. Refusing it would also hand the
    // old copy back on the next read, resurrecting the card that was removed.
    expect(shouldRejectVaultShrink("cogs-baby-animals-store", gallery(1), gallery(2))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-baby-animals-store", gallery(3), gallery(7))).toBe(false)
    // Emptying the last card by hand is allowed; emptying a stocked gallery is not.
    expect(shouldRejectVaultShrink("cogs-baby-animals-store", gallery(0), gallery(1))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-baby-animals-store", gallery(0), gallery(4))).toBe(true)
  })

  it("leaves pref-only vaults to the appearance overlay", () => {
    const listsUi = (hidden: number) =>
      JSON.stringify({ state: { hiddenGalleryOrbs: Array.from({ length: hidden }, (_, i) => `o${i}`) } })
    // Deselect all empties a filter on purpose; that is not a vault wipe.
    expect(shouldRejectVaultShrink("cogs-lists-ui", listsUi(0), listsUi(30))).toBe(false)
    expect(vaultRecordCount("cogs-theme-store", '{"state":{"pcbMode":"xray"}}')).toBeNull()
  })

  it("keeps this profile's vault when the hub is thinner", () => {
    expect(pickPersistItem(tasks(2455), tasks(15), "cogs-task-storage")).toBe(tasks(2455))
  })

  it("heals a seed profile from a richer hub", () => {
    expect(pickPersistItem(tasks(15), tasks(2455), "cogs-task-storage")).toBe(tasks(2455))
  })

  it("does not treat an empty monthPlan hub string as a vault", () => {
    const draft = JSON.stringify({ v: 1, entries: [], draft: "September shipping" })
    expect(pickPersistItem(draft, "", "monthPlan-2026-09")).toBe(draft)
    expect(pickPersistItem(null, "", "monthPlan-2026-09")).toBeNull()
    expect(pickPersistItem("", "earlier September notes", "monthPlan-2026-09")).toBe("earlier September notes")
  })

  it("without a store name, local still wins (legacy callers)", () => {
    expect(pickPersistItem(tasks(15), tasks(2455))).toBe(tasks(15))
    expect(pickPersistItem(null, tasks(2455))).toBe(tasks(2455))
  })

  it("keeps local habit colors when a richer hub blob omits them", () => {
    const local = habits(15, 6, {
      percentLedTint: "#ff00aa",
      gradeTubeColor: "#112233",
      outputGradeTubeColor: "#abcdef",
    })
    const hub = habits(30, 47)
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-habits-store") ?? "{}") as {
      state?: { tasks?: unknown[]; percentLedTint?: string; gradeTubeColor?: string; outputGradeTubeColor?: string }
    }
    expect(picked.state?.tasks).toHaveLength(30)
    expect(picked.state?.percentLedTint).toBe("#ff00aa")
    expect(picked.state?.gradeTubeColor).toBe("#112233")
    expect(picked.state?.outputGradeTubeColor).toBe("#abcdef")
  })

  it("keeps local habit colors when the hub posted seed defaults", () => {
    const local = habits(15, 6, {
      percentLedTint: "#c0ffee",
      gradeTubeColor: "#aa11bb",
      outputGradeTubeColor: "#11ccdd",
    })
    const hub = habits(30, 47, {
      percentLedTint: "#7e14ff",
      gradeTubeColor: "#508b51",
      outputGradeTubeColor: "#25366a",
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; gradeTubeColor?: string }
    }
    expect(picked.state?.percentLedTint).toBe("#c0ffee")
    expect(picked.state?.gradeTubeColor).toBe("#aa11bb")
  })

  it("does not stamp seed LED defaults over a customized hub vault", () => {
    const local = habits(15, 6, { percentLedTint: "#7e14ff", gradeTubeColor: "#508b51" })
    const hub = habits(30, 47, { percentLedTint: "#ff00aa", gradeTubeColor: "#112233" })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; gradeTubeColor?: string; tasks?: unknown[] }
    }
    expect(picked.state?.tasks).toHaveLength(30)
    expect(picked.state?.percentLedTint).toBe("#ff00aa")
    expect(picked.state?.gradeTubeColor).toBe("#112233")
  })

  it("keeps a local PCB plate when the hub snapshot has no pcbMode", () => {
    const local = JSON.stringify({
      state: { colors: { pointsToday: "#111111" }, chromeFace: 80, pcbMode: "xray" },
      version: 3,
    })
    const hub = JSON.stringify({
      state: { colors: { pointsToday: "#16a34a" }, chromeFace: 50 },
      version: 2,
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-theme-store") ?? "{}") as {
      state?: { pcbMode?: string; chromeFace?: number; colors?: { pointsToday?: string } }
    }
    expect(picked.state?.pcbMode).toBe("xray")
    expect(picked.state?.chromeFace).toBe(80)
    expect(picked.state?.colors?.pointsToday).toBe("#111111")
  })

  it("keeps a newer local plate even when it looks like the ceramic default", () => {
    const local = JSON.stringify({
      state: { colors: { pointsToday: "#16a34a" }, chromeFace: 50, pcbMode: "ceramic", appearanceRev: 4 },
      version: 3,
    })
    const hub = JSON.stringify({
      state: { colors: { pointsToday: "#111111" }, chromeFace: 80, pcbMode: "xray", appearanceRev: 1 },
      version: 3,
    })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-theme-store") ?? "{}") as {
      state?: { pcbMode?: string; chromeFace?: number; appearanceRev?: number }
    }
    expect(picked.state?.pcbMode).toBe("ceramic")
    expect(picked.state?.chromeFace).toBe(50)
    expect(picked.state?.appearanceRev).toBe(4)
  })

  it("rejects a ceramic default write over a saved plate", () => {
    const saved = JSON.stringify({
      state: { colors: { pointsToday: "#111111" }, chromeFace: 80, pcbMode: "xray", appearanceRev: 2 },
      version: 3,
    })
    const seed = JSON.stringify({
      state: { colors: { pointsToday: "#16a34a" }, chromeFace: 50, pcbMode: "ceramic", appearanceRev: 0 },
      version: 3,
    })
    expect(shouldRejectAppearanceDowngrade("cogs-theme-store", seed, saved)).toBe(true)
    expect(shouldRejectAppearanceDowngrade("cogs-theme-store", saved, seed)).toBe(false)
  })

  it("paints the LED pin onto a richer hub blob that still has the old purple", () => {
    localStorage.setItem("cogs-habit-led-tint", "#00cc88")
    const hub = habits(30, 47, { percentLedTint: "#7e14ff" })
    const picked = JSON.parse(pickPersistItem(null, hub, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; tasks?: unknown[] }
    }
    expect(picked.state?.tasks).toHaveLength(30)
    expect(picked.state?.percentLedTint).toBe("#00cc88")
    localStorage.removeItem("cogs-habit-led-tint")
  })

  it("stamps a new LED tint onto the pin without keeping the old purple", () => {
    localStorage.setItem("cogs-habit-led-tint", "#7e14ff")
    stampAppearancePins(
      JSON.stringify({
        state: { percentLedTint: "#00cc88", appearanceRev: 4 },
        version: 15,
      }),
      "cogs-habits-store",
    )
    expect(localStorage.getItem("cogs-habit-led-tint")).toBe("#00cc88")
    const painted = JSON.parse(
      applyAppearancePins(
        JSON.stringify({ state: { percentLedTint: "#7e14ff" }, version: 15 }),
        "cogs-habits-store",
      ) ?? "{}",
    ) as { state?: { percentLedTint?: string } }
    expect(painted.state?.percentLedTint).toBe("#00cc88")
    localStorage.removeItem("cogs-habit-led-tint")
  })

  it("does not paint a stale LED pin over a blob the user just saved", () => {
    localStorage.setItem("cogs-habit-led-tint", "#7e14ff")
    const saved = JSON.stringify({
      state: { percentLedTint: "#00cc88", appearanceRev: 4 },
      version: 15,
    })
    const painted = JSON.parse(applyAppearancePins(saved, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string }
    }
    expect(painted.state?.percentLedTint).toBe("#00cc88")
    expect(localStorage.getItem("cogs-habit-led-tint")).toBe("#00cc88")
    localStorage.removeItem("cogs-habit-led-tint")
  })

  it("does not paint a stale PCB pin over a saved plate", () => {
    localStorage.setItem("cogs-pcb-mode", "xray")
    const saved = JSON.stringify({
      state: { pcbMode: "mint", chromeFace: 40, appearanceRev: 5 },
      version: 4,
    })
    const painted = JSON.parse(applyAppearancePins(saved, "cogs-theme-store") ?? "{}") as {
      state?: { pcbMode?: string }
    }
    expect(painted.state?.pcbMode).toBe("mint")
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("mint")
    localStorage.removeItem("cogs-pcb-mode")
  })

  it("does not copy a present theme blob or appearance pin from the hub", () => {
    expect(shouldSkipHubAppearanceCopy("cogs-theme-store", '{"state":{"pcbMode":"mint"}}')).toBe(true)
    expect(shouldSkipHubAppearanceCopy("brain2-theme-store", '{"state":{"pcbMode":"ice"}}')).toBe(true)
    expect(shouldSkipHubAppearanceCopy("brain2-pcb-mode", "xray")).toBe(true)
    expect(shouldSkipHubAppearanceCopy("cogs-habit-led-tint", "#00cc88")).toBe(true)
    expect(shouldSkipHubAppearanceCopy("cogs-habits-store", '{"state":{"tasks":[]}}')).toBe(false)
    expect(shouldSkipHubAppearanceCopy("cogs-theme-store", null)).toBe(false)
    expect(shouldSkipHubAppearanceCopy("cogs-theme-store", "")).toBe(false)
  })

  it("does not resurrect a dismissed foal from a hub gallery snapshot", () => {
    localStorage.setItem("cogs-friend-dismissed", JSON.stringify(["foal", "small-foal"]))
    const hub = JSON.stringify({
      state: {
        photos: [
          {
            id: "foal-1",
            animalId: "foal",
            displayName: "small foal",
            uri: "https://cdn.example/foal.jpg",
          },
        ],
        currentPhotoId: "foal-1",
        dismissedAnimalIds: [],
      },
      version: 4,
    })
    const picked = JSON.parse(pickPersistItem(null, hub, "cogs-baby-animals-store") ?? "{}") as {
      state?: { photos?: unknown[]; dismissedAnimalIds?: string[] }
    }
    expect(picked.state?.photos).toEqual([])
    expect(picked.state?.dismissedAnimalIds).toEqual(expect.arrayContaining(["small-foal"]))
  })

  it("keeps local friend names when a hub snapshot is unnamed", () => {
    const local = JSON.stringify({
      state: {
        photos: [
          {
            id: "pack-a",
            animalId: "pack-a",
            displayName: "Little Rock Hyrax",
            uri: "/friend-pack/a.png",
            sourceUrl: "/friend-pack/a.png",
            via: "pack",
          },
        ],
        currentPhotoId: "pack-a",
        dismissedAnimalIds: [],
      },
      version: 7,
    })
    const hub = JSON.stringify({
      state: {
        photos: [
          {
            id: "pack-a",
            animalId: "pack-a",
            displayName: "",
            uri: "/friend-pack/a.png",
            sourceUrl: "/friend-pack/a.png",
            via: "pack",
          },
        ],
        currentPhotoId: "pack-a",
        dismissedAnimalIds: [],
      },
      version: 7,
    })
    const picked = JSON.parse(mergePersistSnapshots(local, hub, "cogs-baby-animals-store") ?? "{}") as {
      state?: { photos?: Array<{ displayName?: string; id?: string }>; displayName?: string }
    }
    expect(picked.state?.photos?.[0]?.displayName).toBe("Little Rock Hyrax")
    expect(picked.state?.displayName).toBe("Little Rock Hyrax")
  })

  it("does not strip a catalog fox because a pack card was named bunny", () => {
    localStorage.setItem("cogs-friend-dismissed", JSON.stringify(["pack-named"]))
    const hub = JSON.stringify({
      state: {
        photos: [
          {
            id: "pack-named",
            animalId: "pack-named",
            displayName: "sweet hopping little bunny",
            uri: "/friend-pack/n.png",
            sourceUrl: "/friend-pack/n.png",
            via: "pack",
          },
          {
            id: "fox-1",
            animalId: "fox",
            displayName: "tiny baby fox kit",
            uri: "https://cdn.example/fox.jpg",
            sourceUrl: "https://cdn.example/fox.jpg",
          },
        ],
        currentPhotoId: "fox-1",
        dismissedAnimalIds: ["pack-named"],
      },
      version: 7,
    })
    const picked = JSON.parse(pickPersistItem(null, hub, "cogs-baby-animals-store") ?? "{}") as {
      state?: { photos?: Array<{ id?: string }> }
    }
    expect(picked.state?.photos?.map((row) => row.id)).toEqual(["fox-1"])
  })

  it("refuses a habits snapshot that would roll titles and completions backward", () => {
    const newer = JSON.stringify({
      state: {
        tasks: [{ id: "h1", name: "fold shirts" }],
        weeklyData: { "2026-09-02": { h1: { completed: true, value: 4 } } },
        contentRev: 50,
      },
      version: 19,
    })
    const older = JSON.stringify({
      state: {
        tasks: [{ id: "h1", name: "laundry" }],
        weeklyData: { "2026-09-01": { h1: { completed: true } } },
        contentRev: 3,
      },
      version: 19,
    })
    expect(shouldRejectContentDowngrade("cogs-habits-store", older, newer)).toBe(true)
    expect(shouldRejectContentDowngrade("cogs-habits-store", newer, older)).toBe(false)
    const kept = JSON.parse(mergePersistSnapshots(newer, older, "cogs-habits-store") ?? "{}") as {
      state?: { tasks?: { name?: string }[]; contentRev?: number }
    }
    expect(kept.state?.tasks?.[0]?.name).toBe("fold shirts")
    expect(kept.state?.contentRev).toBe(50)
    const posted = JSON.parse(mergePersistSnapshots(older, newer, "cogs-habits-store") ?? "{}") as {
      state?: { tasks?: { name?: string }[]; weeklyData?: Record<string, { h1?: { value?: number } }> }
    }
    expect(posted.state?.tasks?.[0]?.name).toBe("fold shirts")
    expect(posted.state?.weeklyData?.["2026-09-02"]?.h1?.value).toBe(4)
    const picked = JSON.parse(pickPersistItem(older, newer, "cogs-habits-store") ?? "{}") as {
      state?: { tasks?: { name?: string }[] }
    }
    expect(picked.state?.tasks?.[0]?.name).toBe("fold shirts")
  })

  it("still heals a seed habit profile from the hub when the seed stamp is newer", () => {
    const local = habits(15, 6, { contentRev: Date.now() })
    const hub = habits(30, 47, { contentRev: 1 })
    const picked = JSON.parse(pickPersistItem(local, hub, "cogs-habits-store") ?? "{}") as {
      state?: { tasks?: unknown[] }
    }
    expect(picked.state?.tasks).toHaveLength(30)
  })
})
