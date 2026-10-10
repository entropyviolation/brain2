import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  captureOriginView,
  keptCaptureOrigin,
  lineCaptureOrigin,
  notesCaptureOrigin,
  reminderCaptureOrigin,
  telegramCaptureOrigin,
} from "@/lib/capture-origin"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

function idea(extra: Partial<Task> = {}): Task {
  return {
    id: "idea",
    description: "pick up milk",
    stage: "inbox",
    createdAt: new Date("2026-09-22T08:00:00.000Z"),
    completed: false,
    lists: [],
    ...extra,
  }
}

describe("capture origin", () => {
  it("names a Telegram BIM capture with the chat, message, and line", () => {
    const origin = telegramCaptureOrigin(
      { source: { channel: "telegram", chatId: "99", username: "ada" }, telegramMessageId: 42 },
      "pick up milk",
    )
    expect(origin).toEqual({ kind: "telegram", detail: "@ada · message 42 · pick up milk" })
    expect(captureOriginView(idea({ captureOrigin: origin }))).toEqual({
      label: "BIM",
      detail: "@ada · message 42 · pick up milk",
    })
  })

  it("uses the chat id when Telegram sent no username", () => {
    expect(
      telegramCaptureOrigin(
        { source: { channel: "telegram", chatId: "99" }, telegramMessageId: 7 },
        "qa: oats",
      ).detail,
    ).toBe("chat 99 · message 7 · qa: oats")
  })

  it("does not invent a Telegram chat for a simulated line", () => {
    expect(
      telegramCaptureOrigin({ source: { channel: "simulate", chatId: "sim" } }, "pick up milk"),
    ).toEqual({ kind: "telegram", detail: "pick up milk" })
  })

  it("keeps the Quick Add line", () => {
    const origin = lineCaptureOrigin("quick-add", "Buy more coffee filters")
    expect(captureOriginView(idea({ captureOrigin: origin }))).toEqual({
      label: "Quick Add",
      detail: "Buy more coffee filters",
    })
  })

  it("reads a note that was stored before captureOrigin existed", () => {
    expect(
      captureOriginView(
        idea({
          attributes: { source: "apple-notes", appleNotesFolder: "Groceries", appleNoteId: "n1" },
        }),
      ),
    ).toEqual({ label: "From notes", detail: "Groceries" })
  })

  it("labels a due reminder as scheduled", () => {
    const origin = reminderCaptureOrigin("Call mom", "2026-10-09T15:00")
    expect(captureOriginView(idea({ captureOrigin: origin }))).toEqual({
      label: "Scheduled",
      detail: "Call mom · 2026-10-09T15:00",
    })
  })

  it("says nothing when no door was stored", () => {
    expect(captureOriginView(idea())).toBeNull()
    expect(captureOriginView(idea({ attributes: { source: "watchlist" } }))).toBeNull()
  })

  it("keeps the first origin", () => {
    const first = lineCaptureOrigin("quick-add", "oats")
    const second = notesCaptureOrigin({ kind: "notes", title: "Grocery" })
    expect(keptCaptureOrigin(first, second)).toEqual(first)
    expect(keptCaptureOrigin(undefined, second)).toEqual(second)
    expect(keptCaptureOrigin(first, undefined)).toEqual(first)
  })
})

describe("capture origin on the task store", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("does not let a later save replace the origin or move createdAt forward", () => {
    const arrived = new Date("2026-09-22T08:00:00.000Z")
    const origin = telegramCaptureOrigin(
      { source: { channel: "telegram", chatId: "99", username: "ada" }, telegramMessageId: 42 },
      "pick up milk",
    )
    useTaskStore.getState().addTask(idea({ createdAt: arrived, captureOrigin: origin }))
    const current = useTaskStore.getState().tasks.find((task) => task.id === "idea")!
    useTaskStore.getState().updateTask({
      ...current,
      description: "renamed",
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
      captureOrigin: undefined,
    })
    const saved = useTaskStore.getState().tasks.find((task) => task.id === "idea")!
    expect(saved.description).toBe("renamed")
    expect(saved.captureOrigin).toEqual(origin)
    expect(saved.createdAt.toISOString()).toBe(arrived.toISOString())
  })
})
