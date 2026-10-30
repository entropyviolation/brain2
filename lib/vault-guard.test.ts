import { beforeEach, describe, expect, it, vi } from "vitest"
import { formatAppendLog } from "./append-log"
import { applyAppearancePins, applyVaultPatch, pickPersistItem, mergePersistSnapshots, shouldRejectVaultShrink, vaultRecordCount, shouldRejectAppearanceDowngrade, shouldRejectContentDowngrade, shouldRejectIngestDowngrade, stampAppearancePins, shouldSkipHubAppearanceCopy, shouldRejectHubLogShrink, unionPersistSnapshots, unionPersistSnapshotsParsed, vaultNeedsParsedGuards, shouldRejectAppearanceDowngradeParsed, shouldRejectContentDowngradeParsed, shouldRejectIngestDowngradeParsed, overlayHabitCompletions, overlayHabitCompletionsParsed, overlayIngestAllowlist, overlayIngestAllowlistParsed, stampAppearancePinsParsed } from "./vault-guard.js"

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
    const stored = habits(30, 47, { percentLedTint: "#7d6bb8", appearanceRev: 1 })
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

  it("counts open sessions as well as history, but only history must grow on the hub", () => {
    const blob = (open: number, history: number) =>
      JSON.stringify({
        state: {
          open: Array.from({ length: open }, (_, i) => ({ id: `o${i}` })),
          history: Array.from({ length: history }, (_, i) => ({ id: `h${i}` })),
        },
        version: 2,
      })
    expect(vaultRecordCount("cogs-session-plans", blob(3, 2))).toBe(5)
    // Wiping every open session is refused even with no history yet.
    expect(shouldRejectVaultShrink("cogs-session-plans", blob(0, 0), blob(3, 0))).toBe(true)
    // Deleting a draft is an edit; closing one moves it into history.
    expect(shouldRejectVaultShrink("cogs-session-plans", blob(1, 0), blob(2, 0))).toBe(false)
    expect(shouldRejectHubLogShrink("cogs-session-plans", blob(1, 2), blob(2, 2))).toBe(false)
    expect(shouldRejectHubLogShrink("cogs-session-plans", blob(3, 1), blob(2, 2))).toBe(true)
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

  it("keeps a new pen when the other snapshot has the block but not the pen", () => {
    const fresh = JSON.stringify({
      state: {
        scopes: [
          {
            id: "activity",
            name: "Activity",
            pens: [
              { id: "act-work", name: "Work", color: "#2563eb" },
              { id: "pen-new", name: "Sketching", color: "#b72424", editedAt: 50 },
            ],
          },
        ],
        entries: [{ id: "block", penId: "pen-new" }],
      },
    })
    const stale = JSON.stringify({
      state: {
        scopes: [{ id: "activity", name: "Activity", pens: [{ id: "act-work", name: "Work", color: "#2563eb" }] }],
        entries: [{ id: "block", penId: "pen-new" }],
      },
    })
    const merged = JSON.parse(unionPersistSnapshots(stale, fresh, "brain2-timegrid-store") ?? "{}") as {
      state: { scopes: { pens: { id: string; color: string }[] }[] }
    }
    const sketching = merged.state.scopes[0].pens.find((pen) => pen.id === "pen-new")
    expect(sketching).toMatchObject({ name: "Sketching", color: "#b72424" })
  })

  it("keeps a newer pen color when a stale copy of the same pen arrives", () => {
    const fresh = JSON.stringify({
      state: {
        scopes: [{ id: "activity", name: "Activity", pens: [{ id: "pen-new", name: "Sketching", color: "#b72424", editedAt: 80 }] }],
        entries: [],
      },
    })
    const stale = JSON.stringify({
      state: {
        scopes: [{ id: "activity", name: "Activity", pens: [{ id: "pen-new", name: "Sketching", color: "#2563eb", editedAt: 10 }] }],
        entries: [],
      },
    })
    const merged = JSON.parse(unionPersistSnapshots(stale, fresh, "brain2-timegrid-store") ?? "{}") as {
      state: { scopes: { pens: { color: string }[] }[] }
    }
    expect(merged.state.scopes[0].pens[0].color).toBe("#b72424")
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

  it("drops gps tracking points so they cannot crowd the ingest log", () => {
    const gps = Array.from({ length: 200 }, (_, i) => ({
      id: `g${i}`,
      at: `2026-09-22T04:${String(i % 60).padStart(2, "0")}:00.000Z`,
      kind: "gps",
      status: i % 2 === 0 ? "applied" : "ignored",
      summary: i % 2 === 0 ? "GPS → Home" : "Still at Home",
    }))
    const saved = JSON.stringify({
      state: { events: gps, allowedChats: [{ chatId: "1" }], allowlistRev: 1 },
    })
    const note = JSON.stringify({
      state: {
        events: [
          { id: "note", at: "2026-09-22T03:00:00.000Z", kind: "capture", status: "applied" },
          { id: "bad", at: "2026-09-22T06:00:00.000Z", kind: "gps", status: "error", summary: "Where?" },
          {
            id: "unpaired",
            at: "2026-09-22T06:01:00.000Z",
            kind: "gps",
            status: "ignored",
            summary: "Unpaired sender",
          },
        ],
        allowedChats: [{ chatId: "1" }],
        allowlistRev: 1,
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(saved, note, "brain2-ingest-store") ?? "{}") as {
      state: { events: { id: string }[] }
    }
    expect(merged.state.events.map((event) => event.id)).toEqual(["unpaired", "bad", "note"])
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

  it("drops a tombstone when this write restored that task", () => {
    const disk = JSON.stringify({
      state: {
        tasks: [{ id: "keep", stage: "inbox" }],
        removedTaskIds: ["back"],
      },
    })
    const undo = JSON.stringify({
      state: {
        tasks: [
          { id: "keep", stage: "inbox" },
          { id: "back", stage: "inbox", description: "idea" },
        ],
        removedTaskIds: [],
        restoredTaskIds: ["back"],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(disk, undo, "brain2-task-storage") ?? "{}") as {
      state: { tasks: { id: string }[]; removedTaskIds?: string[]; restoredTaskIds?: string[] }
    }
    expect(merged.state.tasks.map((task) => task.id).sort()).toEqual(["back", "keep"])
    expect(merged.state.removedTaskIds ?? []).not.toContain("back")
    expect(merged.state.restoredTaskIds).toBeUndefined()
  })

  it("keeps a tombstone the same write still lists, even with a restore hint", () => {
    const disk = JSON.stringify({
      state: {
        tasks: [{ id: "keep", stage: "inbox" }],
        removedTaskIds: ["back"],
      },
    })
    const again = JSON.stringify({
      state: {
        tasks: [
          { id: "keep", stage: "inbox" },
          { id: "back", stage: "inbox" },
        ],
        removedTaskIds: ["back"],
        restoredTaskIds: ["back"],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(disk, again, "brain2-task-storage") ?? "{}") as {
      state: { tasks: { id: string }[]; removedTaskIds: string[] }
    }
    expect(merged.state.tasks.map((task) => task.id)).toEqual(["keep"])
    expect(merged.state.removedTaskIds).toContain("back")
  })

  it("honors removedListIds so a list merge discard is not resurrected by union", () => {
    const hub = JSON.stringify({
      state: {
        tasks: [{ id: "t1", stage: "list" }],
        lists: [
          { id: "keep", name: "Keep" },
          { id: "gone", name: "Gone" },
        ],
      },
    })
    const desktop = JSON.stringify({
      state: {
        tasks: [{ id: "t1", stage: "list" }],
        lists: [{ id: "keep", name: "Keep" }],
        removedListIds: ["gone"],
      },
    })
    const merged = JSON.parse(mergePersistSnapshots(hub, desktop, "cogs-task-storage") ?? "{}") as {
      state: { lists: { id: string }[]; removedListIds: string[] }
    }
    expect(merged.state.lists.map((list) => list.id)).toEqual(["keep"])
    expect(merged.state.removedListIds).toContain("gone")
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

  it("does not put a just-submitted plan back into the composer draft", () => {
    const filed = "Plan for september"
    const previous = JSON.stringify({
      v: 1,
      entries: [{ id: "al_a", createdAt: "2026-09-24T00:18:19.667Z", text: filed }],
      draft: `${filed} `,
    })
    const submitted = JSON.stringify({
      v: 1,
      entries: [
        { id: "al_a", createdAt: "2026-09-24T00:18:19.667Z", text: filed },
        { id: "al_b", createdAt: "2026-10-06T22:24:17.404Z", text: filed },
      ],
    })
    const merged = JSON.parse(pickPersistItem(submitted, previous, "monthPlan-2026-09")!)
    expect(merged.entries).toHaveLength(2)
    expect(merged.draft).toBeUndefined()
    const typing = JSON.stringify({
      v: 1,
      entries: [{ id: "al_a", createdAt: "2026-09-24T00:18:19.667Z", text: filed }],
      draft: "still writing",
    })
    const kept = JSON.parse(pickPersistItem(typing, submitted, "monthPlan-2026-09")!)
    expect(kept.draft).toBe("still writing")
    expect(kept.entries.map((entry: { id: string }) => entry.id).sort()).toEqual(["al_a", "al_b"])
  })

  it("drops a draft that is only the stamped list of submitted entries", () => {
    const entry = {
      id: "al_oct",
      createdAt: "2026-10-06T22:07:00.000Z",
      text: "ASTROLOGICAL MONTH PREDICTIONS AND NOTES:\n\nOctober body",
    }
    const older = JSON.stringify({ v: 1, entries: [entry] })
    const dumped = JSON.stringify({ v: 1, entries: [entry], draft: formatAppendLog([entry], "all") })
    const merged = JSON.parse(pickPersistItem(dumped, older, "monthPlan-2026-10")!)
    expect(merged.draft).toBeUndefined()
    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0].text).toContain("ASTROLOGICAL MONTH PREDICTIONS")
    const typing = JSON.stringify({
      v: 1,
      entries: [entry],
      draft: "9/21 4:14pm - plan for literally rn rn",
    })
    const kept = JSON.parse(pickPersistItem(typing, older, "monthPlan-2026-10")!)
    expect(kept.draft).toBe("9/21 4:14pm - plan for literally rn rn")
    expect(kept.entries).toHaveLength(1)
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
      percentLedTint: "#7d6bb8",
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
    const local = habits(15, 6, { percentLedTint: "#7d6bb8", gradeTubeColor: "#508b51" })
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
    const hub = habits(30, 47, { percentLedTint: "#7d6bb8" })
    const picked = JSON.parse(pickPersistItem(null, hub, "cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; tasks?: unknown[] }
    }
    expect(picked.state?.tasks).toHaveLength(30)
    expect(picked.state?.percentLedTint).toBe("#00cc88")
    localStorage.removeItem("cogs-habit-led-tint")
  })

  it("stamps a new LED tint onto the pin without keeping the old purple", () => {
    localStorage.setItem("cogs-habit-led-tint", "#7d6bb8")
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
        JSON.stringify({ state: { percentLedTint: "#7d6bb8" }, version: 15 }),
        "cogs-habits-store",
      ) ?? "{}",
    ) as { state?: { percentLedTint?: string } }
    expect(painted.state?.percentLedTint).toBe("#00cc88")
    localStorage.removeItem("cogs-habit-led-tint")
  })

  it("does not paint a stale LED pin over a blob the user just saved", () => {
    localStorage.setItem("cogs-habit-led-tint", "#7d6bb8")
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

describe("telegram feed vault", () => {
  const feed = (...ids: string[]) =>
    JSON.stringify({ state: { rows: ids.map((id, i) => ({ id, at: `2026-10-1${i}T00:00:00.000Z`, text: id })) }, version: 1 })

  it("refuses a hub write that drops a received text", () => {
    expect(shouldRejectHubLogShrink("brain2-telegram-feed", feed("a"), feed("a", "b"))).toBe(true)
    expect(shouldRejectHubLogShrink("brain2-telegram-feed", feed("a", "b", "c"), feed("a", "b"))).toBe(false)
  })

  it("unions two snapshots by id so neither side loses a text", () => {
    const merged = JSON.parse(unionPersistSnapshots(feed("a", "b"), feed("a", "c"), "brain2-telegram-feed") ?? "{}") as {
      state: { rows: { id: string }[] }
    }
    expect(merged.state.rows.map((r) => r.id).sort()).toEqual(["a", "b", "c"])
  })
})

describe("parsed guard variants match the string guards", () => {
  const blob = (state: object) => JSON.stringify({ state, version: 1 })

  it("unionPersistSnapshotsParsed equals unionPersistSnapshots and mutates the incoming object", () => {
    const incoming = blob({ tasks: [{ id: "a" }], lists: [], folders: [] })
    const existing = blob({ tasks: [{ id: "a" }, { id: "b" }], lists: [], folders: [] })
    const expected = unionPersistSnapshots(incoming, existing, "brain2-task-storage")
    const incObj = JSON.parse(incoming)
    const got = unionPersistSnapshotsParsed(incoming, existing, incObj, JSON.parse(existing), "brain2-task-storage")
    expect(got).toBe(expected)
    expect(JSON.parse(got as string)).toEqual(incObj)
  })

  it("overlayHabitCompletionsParsed equals overlayHabitCompletions", () => {
    const chosen = blob({ contentRev: 2, weeklyData: { d1: { h: 1 } } })
    const other = blob({ contentRev: 1, weeklyData: { d1: { h: 1 }, d2: { h: 2 } } })
    expect(overlayHabitCompletionsParsed(chosen, other, JSON.parse(chosen), JSON.parse(other), "brain2-habits-store")).toBe(
      overlayHabitCompletions(chosen, other, "brain2-habits-store"),
    )
  })

  it("downgrade guards agree on parsed roots", () => {
    const rich = blob({ appearanceRev: 3, pcbMode: "mint", contentRev: 4 })
    const seed = blob({ appearanceRev: 0, pcbMode: "teal", contentRev: 1 })
    expect(shouldRejectAppearanceDowngradeParsed("brain2-theme-store", JSON.parse(seed), JSON.parse(rich))).toBe(
      shouldRejectAppearanceDowngrade("brain2-theme-store", seed, rich),
    )
    expect(shouldRejectAppearanceDowngradeParsed("brain2-theme-store", JSON.parse(seed), JSON.parse(rich))).toBe(true)
    expect(shouldRejectContentDowngradeParsed("brain2-habits-store", JSON.parse(seed), JSON.parse(rich))).toBe(true)
    expect(shouldRejectContentDowngradeParsed("brain2-habits-store", JSON.parse(rich), JSON.parse(seed))).toBe(false)
    const paired = blob({ allowlistRev: 2, allowedChats: [{ chatId: "1" }], events: [] })
    const emptySeed = blob({ allowlistRev: 0, allowedChats: [], events: [] })
    expect(shouldRejectIngestDowngradeParsed("brain2-ingest-store", JSON.parse(emptySeed), JSON.parse(paired))).toBe(
      shouldRejectIngestDowngrade("brain2-ingest-store", emptySeed, paired),
    )
    expect(shouldRejectIngestDowngradeParsed("brain2-ingest-store", JSON.parse(emptySeed), JSON.parse(paired))).toBe(true)
  })

  it("overlayIngestAllowlistParsed equals overlayIngestAllowlist", () => {
    const chosen = blob({ allowlistRev: 1, allowedChats: [], events: [] })
    const other = blob({ allowlistRev: 1, allowedChats: [{ chatId: "9" }], events: [] })
    expect(overlayIngestAllowlistParsed(chosen, other, JSON.parse(chosen), JSON.parse(other), "brain2-ingest-store")).toBe(
      overlayIngestAllowlist(chosen, other, "brain2-ingest-store"),
    )
  })
})

describe("stampAppearancePins early return", () => {
  it("does not parse a vault that stamps nothing", () => {
    const spy = vi.spyOn(JSON, "parse")
    stampAppearancePins('{"state":{"pcbMode":"mint","appearanceRev":2}}', "brain2-task-storage")
    stampAppearancePins('{"state":{"pcbMode":"mint","appearanceRev":2}}', "brain2-sleep-store")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("still stamps theme and habits pins", () => {
    localStorage.clear()
    stampAppearancePins('{"state":{"pcbMode":"mint","appearanceRev":2}}', "brain2-theme-store")
    expect(localStorage.getItem("brain2-pcb-mode")).toBe("mint")
    stampAppearancePinsParsed({ state: { pcbMode: "xray", appearanceRev: 3 } }, "brain2-theme-store")
    expect(localStorage.getItem("brain2-pcb-mode")).toBe("xray")
  })

  it("flags which vaults need parsed guards", () => {
    expect(vaultNeedsParsedGuards("brain2-task-storage")).toBe(true)
    expect(vaultNeedsParsedGuards("brain2-habits-store")).toBe(true)
    expect(vaultNeedsParsedGuards("brain2-sleep-store")).toBe(false)
  })
})

describe("applyVaultPatch", () => {
  function taskVault(tasks: object[], extra: Record<string, unknown> = {}) {
    return JSON.stringify({
      state: { tasks, lists: [], folders: [], removedTaskIds: [], removedListIds: [], ...extra },
      version: 19,
    })
  }

  it("keeps notes and attributes when a slim task upsert shares createdAt", () => {
    const stored = taskVault([
      {
        id: "t1",
        title: "Old",
        createdAt: "2026-09-01T00:00:00.000Z",
        notes: "keep me",
        attributes: { photo: "idb:pic" },
        body: "full body",
        listIds: ["l1"],
      },
    ])
    const result = applyVaultPatch("brain2-task-storage", stored, {
      upserts: [{ id: "t1", title: "New", createdAt: "2026-09-01T00:00:00.000Z" }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const task = JSON.parse(result.value).state.tasks[0]
    expect(task.title).toBe("New")
    expect(task.createdAt).toBe("2026-09-01T00:00:00.000Z")
    expect(task.notes).toBe("keep me")
    expect(task.attributes).toEqual({ photo: "idb:pic" })
    expect(task.body).toBe("full body")
    expect(task.listIds).toEqual(["l1"])
    expect(JSON.parse(result.value).version).toBe(19)
  })

  it("refuses one patch that drops most lists, and keeps an ordinary delete", () => {
    const lists = Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, name: `List ${i}` }))
    const stored = taskVault([{ id: "t1", title: "Keep" }], { lists })
    const wipe = applyVaultPatch("brain2-task-storage", stored, {
      upserts: [{ id: "example", name: "Example List", color: "#EF4444" }],
      removedIds: lists.slice(1).map((list) => list.id),
    })
    expect(wipe).toEqual({ ok: false, reason: "mass removal" })

    const one = applyVaultPatch("brain2-task-storage", stored, { removedIds: ["l5"] })
    expect(one.ok).toBe(true)
  })

  it("refuses a habits patch that swaps the habit list for a seed", () => {
    const tasks = Array.from({ length: 50 }, (_, i) => ({ id: `h${i}`, name: `Habit ${i}`, frequency: "daily" }))
    const stored = JSON.stringify({ state: { tasks, weeklyData: {}, contentRev: 1 }, version: 26 })
    const seed = applyVaultPatch("brain2-habits-store", stored, {
      upserts: [{ id: "seed-1", name: "Weekly review", frequency: "weekly" }],
      removedIds: tasks.slice(0, 25).map((task) => task.id),
    })
    expect(seed).toEqual({ ok: false, reason: "mass removal" })
  })

  it("does not bring a tombstoned task back on a later upsert", () => {
    const stored = taskVault([
      { id: "keep", title: "Stay", notes: "n" },
      { id: "gone", title: "Bye", notes: "x" },
    ])
    const deleted = applyVaultPatch("cogs-task-storage", stored, {
      upserts: [{ id: "gone", title: "still here", notes: "no" }],
      removedIds: ["gone"],
    })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    const after = JSON.parse(deleted.value).state
    expect(after.tasks.map((task: { id: string }) => task.id)).toEqual(["keep"])
    expect(after.tasks[0].notes).toBe("n")
    expect(after.removedTaskIds).toContain("gone")

    const resurrect = applyVaultPatch("brain2-task-storage", deleted.value, {
      upserts: [{ id: "gone", title: "I am back", notes: "nope", createdAt: "2026-10-30T00:00:00.000Z" }],
    })
    expect(resurrect.ok).toBe(true)
    if (!resurrect.ok) return
    const back = JSON.parse(resurrect.value).state
    expect(back.tasks.map((task: { id: string }) => task.id)).toEqual(["keep"])
    expect(back.removedTaskIds).toContain("gone")
  })

  it("lands one time-grid block and keeps older days", () => {
    const stored = JSON.stringify({
      state: {
        entries: [
          { id: "old-day", start: "2026-09-01T10:00:00.000Z", title: "older", notes: "zoo" },
          { id: "yesterday", start: "2026-10-28T10:00:00.000Z", title: "yesterday" },
        ],
        dayNotes: { "2026-09-01": "zoo" },
        scopes: [{ id: "scope-1", name: "Life" }],
        removedEntryIds: [],
      },
      version: 4,
    })
    const result = applyVaultPatch("brain2-timegrid-store", stored, {
      upserts: [{ id: "today", start: "2026-10-30T15:00:00.000Z", title: "painted" }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const grid = JSON.parse(result.value).state
    expect(grid.entries.map((entry: { id: string }) => entry.id)).toEqual(["old-day", "yesterday", "today"])
    expect(grid.entries[0].notes).toBe("zoo")
    expect(grid.entries[2]).toMatchObject({ id: "today", title: "painted", start: "2026-10-30T15:00:00.000Z" })
    expect(grid.dayNotes).toEqual({ "2026-09-01": "zoo" })
    expect(grid.scopes).toEqual([{ id: "scope-1", name: "Life" }])
  })

  it("rejects a patch that would wipe the task vault", () => {
    const stored = taskVault(Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, notes: "n" })))
    const result = applyVaultPatch("brain2-task-storage", stored, {
      removedIds: Array.from({ length: 8 }, (_, i) => `t${i}`),
    })
    expect(result).toEqual({ ok: false, reason: "vault shrink" })
  })

  it("refuses a patch for stores whose merge is not implemented yet", () => {
    const stored = '{"state":{"tasks":[{"id":"h0"}]}}'
    for (const name of ["cogs-event-storage", "brain2-kitchen", "cogs-modules-store"]) {
      expect(applyVaultPatch(name, stored, { upserts: [{ id: "h0", title: "x" }] })).toEqual({
        ok: false,
        reason: "patch not implemented",
      })
    }
  })

  it("keeps habit fields the patch did not send and does not roll contentRev", () => {
    const stored = JSON.stringify({
      state: {
        tasks: [
          {
            id: "h1",
            title: "Water",
            schedule: "daily",
            completions: { "2026-09-01": { completed: true } },
            notes: "keep",
          },
        ],
        weeklyData: { "2026-09-01": { h1: { completed: true, text: "note" } } },
        contentRev: 80,
        percentLedTint: "#7d6bb8",
      },
      version: 19,
    })
    const result = applyVaultPatch("brain2-habits-store", stored, {
      upserts: [{ id: "h1", title: "Tea" }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const state = JSON.parse(result.value).state
    expect(state.tasks[0].title).toBe("Tea")
    expect(state.tasks[0].schedule).toBe("daily")
    expect(state.tasks[0].completions).toEqual({ "2026-09-01": { completed: true } })
    expect(state.tasks[0].notes).toBe("keep")
    expect(state.contentRev).toBeGreaterThan(80)
    expect(shouldRejectContentDowngrade("brain2-habits-store", result.value, stored)).toBe(false)
    expect(state.percentLedTint).toBe("#7d6bb8")
    expect(state.weeklyData["2026-09-01"].h1).toEqual({ completed: true, text: "note" })

    const cell = applyVaultPatch("cogs-habits-store", result.value, {
      upserts: [{ id: "cell:weeklyData:2026-09-01:h1", completed: false }],
    })
    expect(cell.ok).toBe(true)
    if (!cell.ok) return
    const after = JSON.parse(cell.value).state
    expect(after.weeklyData["2026-09-01"].h1).toEqual({ completed: false, text: "note" })
    expect(after.tasks[0].notes).toBe("keep")
    expect(after.contentRev).toBeGreaterThan(state.contentRev)
  })

  it("lands Health days from the phone without dropping the rest", () => {
    const stored = JSON.stringify({ state: { days: { "2026-10-28": { steps: 100 } }, nights: { x: 1 } } })
    const out = applyVaultPatch("brain2-health-import", stored, {
      upserts: [{ id: "2026-10-29", steps: 8000, flights: 3 }],
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const state = JSON.parse(out.value).state
    expect(state.days).toEqual({ "2026-10-28": { steps: 100 }, "2026-10-29": { steps: 8000, flights: 3 } })
    expect(state.nights).toEqual({ x: 1 })
  })

  it("creates the Health store on the Mac when the first import patch arrives", () => {
    const out = applyVaultPatch("brain2-health-import", undefined, { upserts: [{ id: "2026-10-29", steps: 8000 }] })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(JSON.parse(out.value).state.days["2026-10-29"]).toEqual({ steps: 8000 })
  })

  it("lands one sleep night and one goal field without dropping the rest", () => {
    const sleep = JSON.stringify({
      state: {
        nights: {
          "2026-09-01": { date: "2026-09-01", sleptMin: -30, note: "older" },
          "2026-10-29": { date: "2026-10-29", wokeMin: 420, note: "keep" },
        },
        targetMinutes: 480,
      },
    })
    const night = applyVaultPatch("cogs-sleep-store", sleep, {
      upserts: [{ id: "2026-10-29", note: "edited" }],
    })
    expect(night.ok).toBe(true)
    if (!night.ok) return
    const nights = JSON.parse(night.value).state.nights
    expect(nights["2026-09-01"]).toEqual({ date: "2026-09-01", sleptMin: -30, note: "older" })
    expect(nights["2026-10-29"]).toEqual({ date: "2026-10-29", wokeMin: 420, note: "edited" })
    expect(JSON.parse(night.value).state.targetMinutes).toBe(480)
    expect(
      applyVaultPatch("brain2-sleep-store", sleep, { removedIds: ["2026-09-01"] }),
    ).toEqual({ ok: false, reason: "hub log shrink" })

    const goals = JSON.stringify({
      state: {
        objectives: [{ id: "o1", title: "Health", description: "stay" }],
        goals: [
          { id: "g1", title: "Books", current: 1, target: 4, notes: "keep" },
          { id: "g2", title: "Run", current: 0, target: 3 },
        ],
      },
    })
    const goal = applyVaultPatch("brain2-goals-store", goals, {
      upserts: [{ id: "g1", current: 2 }],
    })
    expect(goal.ok).toBe(true)
    if (!goal.ok) return
    const rows = JSON.parse(goal.value).state
    expect(rows.goals[0]).toEqual({ id: "g1", title: "Books", current: 2, target: 4, notes: "keep" })
    expect(rows.goals[1].title).toBe("Run")
    expect(rows.objectives[0]).toEqual({ id: "o1", title: "Health", description: "stay" })
  })

  it("rejects a patch that is not the upsert shape without throwing", () => {
    const stored = taskVault([{ id: "t1", title: "A" }])
    expect(() => applyVaultPatch("brain2-task-storage", stored, null)).not.toThrow()
    expect(applyVaultPatch("brain2-task-storage", stored, null)).toEqual({ ok: false, reason: "invalid patch" })
    expect(applyVaultPatch("brain2-task-storage", stored, { upserts: [{ title: "no id" }] })).toEqual({
      ok: false,
      reason: "invalid patch",
    })
    expect(applyVaultPatch("brain2-task-storage", stored, { removedIds: [1] })).toEqual({
      ok: false,
      reason: "invalid patch",
    })
    expect(applyVaultPatch("nope", stored, { upserts: [] })).toEqual({ ok: false, reason: "patch not implemented" })
  })

  it("field-merges plan text, planned actions, ingest events, and telegram rows", () => {
    const plan = JSON.stringify({
      v: 1,
      entries: [
        { id: "al_old", createdAt: "2026-09-01T00:00:00.000Z", text: "older day" },
        { id: "al_today", createdAt: "2026-10-30T00:00:00.000Z", text: "today", stampSuffix: "phone" },
      ],
      draft: "still",
    })
    const planResult = applyVaultPatch("dayPlan-2026-10-30", plan, {
      upserts: [{ id: "al_today", text: "today plus" }],
    })
    expect(planResult.ok).toBe(true)
    if (!planResult.ok) return
    const log = JSON.parse(planResult.value)
    expect(log.entries.map((entry: { id: string }) => entry.id)).toEqual(["al_old", "al_today"])
    expect(log.entries[0].text).toBe("older day")
    expect(log.entries[1]).toMatchObject({ text: "today plus", stampSuffix: "phone" })
    expect(log.draft).toBe("still")
    expect(applyVaultPatch("weekPlan-2026-W44", plan, {}).ok).toBe(true)
    expect(applyVaultPatch("cogs-monthPlan-2026-10", plan, {}).ok).toBe(true)

    const actions = JSON.stringify({
      state: {
        actions: [
          { id: "a1", title: "Block", notes: "keep" },
          { id: "a2", title: "Other" },
        ],
      },
    })
    const actionResult = applyVaultPatch("brain2-planned-actions", actions, {
      upserts: [{ id: "a1", title: "Renamed" }],
    })
    expect(actionResult.ok).toBe(true)
    if (!actionResult.ok) return
    const rows = JSON.parse(actionResult.value).state.actions
    expect(rows[0]).toEqual({ id: "a1", title: "Renamed", notes: "keep" })
    expect(rows[1].id).toBe("a2")

    const ingest = JSON.stringify({
      state: {
        allowedChats: [{ chatId: "9" }],
        allowlistRev: 2,
        events: [{ id: "e1", summary: "ate", at: "2026-10-01T00:00:00.000Z" }],
      },
    })
    const ingestResult = applyVaultPatch("cogs-ingest-store", ingest, {
      upserts: [{ id: "e1", summary: "ate lunch" }],
    })
    expect(ingestResult.ok).toBe(true)
    if (!ingestResult.ok) return
    const ingestState = JSON.parse(ingestResult.value).state
    expect(ingestState.events[0]).toEqual({ id: "e1", summary: "ate lunch", at: "2026-10-01T00:00:00.000Z" })
    expect(ingestState.allowedChats).toEqual([{ chatId: "9" }])

    const feed = JSON.stringify({
      state: {
        rows: [{ id: "m1", text: "hi", at: "2026-10-01T00:00:00.000Z", outcome: { status: "applied" } }],
      },
    })
    const feedResult = applyVaultPatch("brain2-telegram-feed", feed, {
      upserts: [{ id: "m1", text: "hi there" }],
    })
    expect(feedResult.ok).toBe(true)
    if (!feedResult.ok) return
    expect(JSON.parse(feedResult.value).state.rows[0]).toEqual({
      id: "m1",
      text: "hi there",
      at: "2026-10-01T00:00:00.000Z",
      outcome: { status: "applied" },
    })
  })

  it("tombstones a list id on removedListIds and a time-grid block on removedEntryIds", () => {
    const stored = JSON.stringify({
      state: {
        tasks: [{ id: "t1", title: "Item" }],
        lists: [
          { id: "keep", name: "Keep" },
          { id: "gone", name: "Gone" },
        ],
        removedListIds: [],
      },
      version: 19,
    })
    const deleted = applyVaultPatch("brain2-task-storage", stored, { removedIds: ["gone"] })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    const state = JSON.parse(deleted.value).state
    expect(state.lists.map((list: { id: string }) => list.id)).toEqual(["keep"])
    expect(state.removedListIds).toContain("gone")
    expect(state.tasks.map((task: { id: string }) => task.id)).toEqual(["t1"])
    const back = applyVaultPatch("cogs-task-storage", deleted.value, {
      upserts: [{ id: "gone", name: "Gone again" }],
    })
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const backState = JSON.parse(back.value).state
    expect(backState.lists.map((list: { id: string }) => list.id)).toEqual(["keep"])
    expect(backState.tasks.map((task: { id: string }) => task.id)).toEqual(["t1"])

    const grid = JSON.stringify({
      state: {
        entries: [
          { id: "old-day", start: "2026-09-01T10:00:00.000Z" },
          { id: "d2", start: "2026-09-02T10:00:00.000Z" },
          { id: "d3", start: "2026-09-03T10:00:00.000Z" },
          { id: "manual", start: "2026-10-30T10:00:00.000Z" },
        ],
        removedEntryIds: [],
      },
    })
    const painted = applyVaultPatch("cogs-timegrid-store", grid, { removedIds: ["manual"] })
    expect(painted.ok).toBe(true)
    if (!painted.ok) return
    const entries = JSON.parse(painted.value).state
    expect(entries.entries.map((entry: { id: string }) => entry.id)).toEqual(["old-day", "d2", "d3"])
    expect(entries.removedEntryIds).toContain("manual")
    const again = applyVaultPatch("brain2-timegrid-store", painted.value, {
      upserts: [{ id: "manual", title: "resurrected" }],
    })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(JSON.parse(again.value).state.entries.map((entry: { id: string }) => entry.id)).toEqual(["old-day", "d2", "d3"])
  })
})
