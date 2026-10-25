import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import {
  INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY,
  findInstagramExportReminder,
  firstInstagramExportReminder,
  instagramExportReminderOn,
  nextInstagramExportReminder,
  seedInstagramExportReminderOnce,
  setInstagramExportReminder,
} from "@/lib/instagram-export-reminder"
import { INSTAGRAM_EXPORT_REMINDER_NAME, INSTAGRAM_EXPORT_URL } from "@/lib/instagram-export-steps"
import { deliverDueReminders, findRemindersList } from "@/lib/reminders"

const NOW = new Date(2026, 9, 23, 15, 0, 0, 0)

describe("Instagram export reminder", () => {
  beforeEach(() => {
    resetAllStores()
    window.localStorage.removeItem(INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY)
  })

  it("fires a month after the last export, else the next 10:00", () => {
    expect(firstInstagramExportReminder(NOW, new Date(2026, 9, 22))).toEqual(new Date(2026, 10, 22, 10, 0))
    expect(firstInstagramExportReminder(NOW, new Date(2026, 0, 31))).toEqual(new Date(2026, 9, 24, 10, 0))
    expect(firstInstagramExportReminder(NOW)).toEqual(new Date(2026, 9, 24, 10, 0))
    expect(firstInstagramExportReminder(new Date(2026, 9, 23, 8, 0))).toEqual(new Date(2026, 9, 23, 10, 0))
    // Jan 31 + 1 month clamps to the last day of February.
    expect(firstInstagramExportReminder(new Date(2027, 1, 1), new Date(2027, 0, 31))).toEqual(new Date(2027, 1, 28, 10, 0))
  })

  it("adds one monthly row on the Reminders list with the link and steps", () => {
    expect(setInstagramExportReminder(true, NOW, new Date(2026, 9, 22))).toBe(true)
    expect(setInstagramExportReminder(true, NOW)).toBe(true)
    const state = useTaskStore.getState()
    const rows = state.tasks.filter((task) => task.title === INSTAGRAM_EXPORT_REMINDER_NAME)
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.lists).toContain(findRemindersList(state.lists)?.id)
    expect(row.reminder?.repeat).toBe("monthly")
    expect(row.scheduledTime).toBe("10:00")
    expect(row.taskDescription).toContain(INSTAGRAM_EXPORT_URL)
    expect(row.taskDescription).toContain("JSON")
    expect(row.taskDescription).toContain("All time")
    expect(nextInstagramExportReminder()).toEqual(new Date(2026, 10, 22, 10, 0))
  })

  it("off deletes the row; on again makes a new one", () => {
    setInstagramExportReminder(true, NOW)
    const first = findInstagramExportReminder(useTaskStore.getState().tasks)!.id
    expect(setInstagramExportReminder(false, NOW)).toBe(false)
    expect(instagramExportReminderOn()).toBe(false)
    setInstagramExportReminder(true, new Date(NOW.getTime() + 1000))
    const second = findInstagramExportReminder(useTaskStore.getState().tasks)!.id
    expect(second).not.toBe(first)
  })

  it("seeds once per device and leaves a deleted row deleted", () => {
    expect(seedInstagramExportReminderOnce(NOW)).toBe(true)
    setInstagramExportReminder(false, NOW)
    expect(seedInstagramExportReminderOnce(NOW)).toBe(false)
    expect(instagramExportReminderOn()).toBe(false)
  })

  it("texts the title and the export link when due", async () => {
    setInstagramExportReminder(true, NOW)
    const send = vi.fn(async () => ({ ok: true }))
    await deliverDueReminders(new Date(2026, 9, 24, 10, 1), { send, chatId: "42" })
    expect(send).toHaveBeenCalledWith("42", `Reminder: ${INSTAGRAM_EXPORT_REMINDER_NAME}\n${INSTAGRAM_EXPORT_URL}`)
  })
})
