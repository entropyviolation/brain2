import { describe, expect, it } from "vitest"
import { validateIncomingBackup, pullBackupView, requestWantsFullPull } from "@/scripts/sync-api.mjs"

function tasks(n: number, key = "brain2-task-storage") {
  return {
    app: key.startsWith("cogs-") ? "cogs" : "brain2",
    stores: {
      [key]: { state: { tasks: Array.from({ length: n }, (_, i) => ({ id: String(i) })), lists: [] } },
    },
  }
}

describe("sync push", () => {
  it("accepts a brain2 snapshot over an older cogs hub", () => {
    const verdict = validateIncomingBackup(tasks(100, "cogs-task-storage"), tasks(120))
    expect(verdict).toEqual({ ok: true })
  })

  it("still accepts a cogs snapshot", () => {
    const verdict = validateIncomingBackup(null, tasks(3, "cogs-task-storage"))
    expect(verdict.ok).toBe(true)
  })

  it("rejects an unknown app id", () => {
    const verdict = validateIncomingBackup(null, { app: "other", stores: { "brain2-task-storage": { state: { tasks: [{}] } } } })
    expect(verdict).toMatchObject({ ok: false, status: 400 })
  })

  it("rejects an empty snapshot", () => {
    const verdict = validateIncomingBackup(null, { app: "brain2", stores: {} })
    expect(verdict).toMatchObject({ ok: false, status: 400, error: "Empty snapshot — nothing to store" })
  })

  it("refuses a push that would shrink a full hub", () => {
    const verdict = validateIncomingBackup(tasks(100), tasks(10))
    expect(verdict).toMatchObject({ ok: false, status: 409 })
  })

  it("gives an iPhone the phone copy even when the app asks for the full snapshot", () => {
    expect(requestWantsFullPull("/api/sync/pull?full=1", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(false)
    expect(requestWantsFullPull("/api/sync/pull?full=1", "Mozilla/5.0 (Macintosh)")).toBe(true)
    expect(requestWantsFullPull("/api/sync/pull", "Mozilla/5.0 (Macintosh)")).toBe(false)
  })

  it("leaves photos and docs off the phone pull", () => {
    const backup = {
      ...tasks(2),
      attachments: { a: { name: "a.png", mime: "image/png", dataUrl: "data:image/png,xx" } },
      docs: [{ id: "d" }],
    }
    const phone = pullBackupView(backup, false)
    expect(phone.attachments).toBeUndefined()
    expect(phone.docs).toBeUndefined()
    expect(phone.planText).toEqual({})
    expect(phone.stores["brain2-task-storage"].state.tasks[0].id).toBe("0")
    expect(pullBackupView(backup, true).attachments).toBe(backup.attachments)
  })

  it("drops item attributes and old time-grid rows on the phone pull", () => {
    const backup = {
      app: "brain2",
      stores: {
        "brain2-task-storage": {
          state: {
            tasks: [
              {
                id: "a",
                title: "Same",
                description: "A long note that stays on the Mac",
                attributes: { note: "long" },
                lists: [],
                createdAt: "2026-10-01T00:00:00.000Z",
              },
            ],
            lists: [{ id: "g", name: "Groceries", itemAttributes: [{ id: "n" }], color: "#fff" }],
          },
        },
        "brain2-timegrid-store": {
          state: {
            entries: [
              { id: "old", date: "2026-09-01", notes: "x" },
              { id: "new", date: "2026-10-27", notes: "y", title: "Block" },
            ],
          },
        },
        "brain2-telegram-feed": { state: { posts: [1] } },
      },
      planText: { "dayPlan-1": "hello" },
    }
    const phone = pullBackupView(backup, false, new Date(2026, 9, 28))
    const task = phone.stores["brain2-task-storage"].state.tasks[0]
    expect(task.attributes).toBeUndefined()
    expect(task.title).toBe("Same")
    expect(task.description).toBe("Same")
    expect(task.createdAt).toBe("2026-10-01T00:00:00.000Z")
    expect(task.lists).toBeUndefined()
    expect(task.completed).toBe(false)
    expect(phone.stores["brain2-task-storage"].state.lists[0].name).toBe("Groceries")
    expect(phone.stores["brain2-task-storage"].state.lists[0].itemAttributes).toBeUndefined()
    const entries = phone.stores["brain2-timegrid-store"].state.entries
    expect(entries.map((entry) => entry.id)).toEqual(["new"])
    expect(entries[0].notes).toBeUndefined()
    expect(phone.stores["brain2-telegram-feed"]).toBeUndefined()
    expect(backup.stores["brain2-task-storage"].state.tasks[0].attributes).toEqual({ note: "long" })
  })
})
