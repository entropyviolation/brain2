import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import {
  FULL_MOON_REMINDER_ID,
  FULL_MOON_TONIGHT_NAME,
  NEW_MOON_REMINDER_ID,
  NEW_MOON_TONIGHT_NAME,
  REMINDER_SKIP_NO_CHAT,
  REMINDER_SKIP_TEXT_OFF,
  addReminder,
  currentReminders,
  deliverDueReminders,
  dismissReminder,
  ensureMoonNightReminders,
  ensureRemindersList,
  findRemindersList,
  reminderOccurrenceKey,
} from "@/lib/reminders"
import { lunarPhaseInstant, nextMoonReminderEvening } from "@/lib/lunar"

const NOW = new Date(2026, 9, 9, 15, 30, 0, 0)

function inboxCopies() {
  return useTaskStore.getState().tasks.filter((task) => task.stage === "inbox" && task.id.startsWith("reminder-inbox-"))
}

function bell(now = NOW) {
  const state = useTaskStore.getState()
  return currentReminders(state.tasks, state.lists, now)
}

describe("timed reminders", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("seeds a protected Reminders list", () => {
    const id = ensureRemindersList()
    const list = findRemindersList(useTaskStore.getState().lists)
    expect(list?.id).toBe(id)
    expect(list?.name).toBe("Reminders")
    expect(list?.reminderList).toBe(true)
    expect(list?.scheduleable).toBe(false)
    useTaskStore.getState().deleteList(id)
    expect(findRemindersList(useTaskStore.getState().lists)?.id).toBe(id)
  })

  it("fires a one-time reminder once", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0, 0, 0), "once")
    const first = await deliverDueReminders(NOW, { send, chatId: "42" })
    const second = await deliverDueReminders(NOW, { send, chatId: "42" })

    expect(first).toHaveLength(1)
    expect(first[0]?.occurrenceKey).toBe("2026-10-09T15:00")
    expect(second).toHaveLength(0)
    expect(inboxCopies()).toHaveLength(1)
    expect(inboxCopies()[0]?.captureOrigin).toEqual({
      kind: "reminder",
      detail: "Call mom · 2026-10-09T15:00",
    })
    expect(send).toHaveBeenCalledTimes(1)

    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder)
    expect(reminder?.reminder?.deliveredKey).toBe("2026-10-09T15:00")
    expect(reminder?.scheduledTime).toBe("15:00")
    expect(reminderOccurrenceKey(new Date(2026, 9, 9, 15, 0))).toBe(reminder?.reminder?.deliveredKey)
    expect(reminder?.scheduledDate?.getDate()).toBe(9)
  })

  it("advances a daily reminder to the next future day", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Water plants", new Date(2026, 9, 7, 15, 0, 0, 0), "daily")
    const first = await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(first).toHaveLength(1)

    const reminder = useTaskStore.getState().tasks.find((task) => task.id === first[0]?.reminderId)
    expect(reminder?.scheduledDate?.getFullYear()).toBe(2026)
    expect(reminder?.scheduledDate?.getMonth()).toBe(9)
    expect(reminder?.scheduledDate?.getDate()).toBe(10)
    expect(reminder?.scheduledTime).toBe("15:00")
    expect(reminder?.reminder?.repeat).toBe("daily")
    expect(reminder?.reminder?.deliveredKey).toBe("2026-10-07T15:00")

    const again = await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(again).toHaveLength(0)
    expect(inboxCopies()).toHaveLength(1)

    const nextDay = new Date(2026, 9, 10, 15, 0, 0, 0)
    const second = await deliverDueReminders(nextDay, { send, chatId: "42" })
    expect(second).toHaveLength(1)
    expect(inboxCopies()).toHaveLength(2)
    const moved = useTaskStore.getState().tasks.find((task) => task.id === first[0]?.reminderId)
    expect(moved?.scheduledDate?.getDate()).toBe(11)
  })

  it("advances a weekly reminder by a week", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Trash", new Date(2026, 9, 9, 15, 0, 0, 0), "weekly")
    await deliverDueReminders(NOW, { send, chatId: "42" })
    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder?.repeat === "weekly")
    expect(reminder?.scheduledDate?.getDate()).toBe(16)
    expect(reminder?.scheduledDate?.getMonth()).toBe(9)
  })

  it("attempts inbox and telegram together", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0, 0, 0), "once")
    const delivered = await deliverDueReminders(NOW, { send, chatId: "99" })

    expect(send).toHaveBeenCalledWith("99", "Reminder: Call mom")
    const notice = useTaskStore.getState().tasks.find((task) => task.id === delivered[0]?.inboxItemId)
    expect(notice?.stage).toBe("inbox")
    expect(notice?.description).toBe("Reminder: Call mom")
    expect(notice?.lists).toEqual([])
    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder)
    expect(reminder?.reminder?.telegramNote).toBeUndefined()
    expect(reminder?.lists).toContain(ensureRemindersList())
  })

  it("still inboxes when telegram fails and records why", async () => {
    const send = vi.fn(async () => {
      throw new Error("network down")
    })
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0, 0, 0), "once")
    const delivered = await deliverDueReminders(NOW, { send, chatId: "99" })

    expect(inboxCopies()).toHaveLength(1)
    expect(delivered[0]?.telegramOk).toBe(false)
    expect(delivered[0]?.telegramNote).toBe("network down")
    const reminder = useTaskStore.getState().tasks.find((task) => task.reminder)
    expect(reminder?.reminder?.telegramNote).toBe("network down")
    expect(reminder?.reminder?.deliveredKey).toBe("2026-10-09T15:00")

    await deliverDueReminders(NOW, { send, chatId: "99" })
    expect(inboxCopies()).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("records a skip when no chat is paired", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0, 0, 0), "once")
    const delivered = await deliverDueReminders(NOW, { send })

    expect(inboxCopies()).toHaveLength(1)
    expect(send).not.toHaveBeenCalled()
    expect(delivered[0]?.telegramNote).toBe(REMINDER_SKIP_NO_CHAT)
    expect(useTaskStore.getState().tasks.find((task) => task.reminder)?.reminder?.telegramNote).toBe(
      REMINDER_SKIP_NO_CHAT,
    )
  })

  it("does not double-send when two ticks overlap", async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const send = vi.fn(async () => {
      await gate
      return { ok: true }
    })
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0, 0, 0), "once")
    const first = deliverDueReminders(NOW, { send, chatId: "42" })
    const second = deliverDueReminders(NOW, { send, chatId: "42" })
    release()
    const [a, b] = await Promise.all([first, second])

    expect(a).toHaveLength(1)
    expect(b).toHaveLength(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(inboxCopies()).toHaveLength(1)
  })

  it("counts only undismissed persistent current reminders", () => {
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0), "once")
    addReminder("Quiet", new Date(2026, 9, 9, 14, 0), "once", { persistent: false })
    addReminder("Later", new Date(2026, 9, 9, 18, 0), "once")
    const daily = addReminder("Water", new Date(2026, 9, 9, 9, 0), "daily")
    dismissReminder(daily, NOW)
    addReminder("Stretch", new Date(2026, 9, 9, 8, 0), "once")

    const rows = bell()
    expect(rows.map((row) => row.name)).toEqual(["Stretch", "Call mom"])
    expect(rows[0]?.source).toBe("Reminders")
    expect(rows[0]?.whenLabel).toBe("Oct 9 · 8:00 AM")
    expect(useTaskStore.getState().tasks.some((task) => task.id === daily)).toBe(true)
  })

  it("dismisses a one-time reminder for good", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const id = addReminder("Call mom", new Date(2026, 9, 9, 15, 0), "once")
    expect(bell()).toHaveLength(1)

    expect(dismissReminder(id, NOW)).toBe(true)
    expect(bell()).toHaveLength(0)
    expect(useTaskStore.getState().tasks.some((task) => task.id === id)).toBe(true)

    const delivered = await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(delivered).toHaveLength(0)
    expect(send).not.toHaveBeenCalled()
    expect(inboxCopies()).toHaveLength(0)
    expect(bell()).toHaveLength(0)
  })

  it("keeps a sent one-time off the bell after dismiss", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const id = addReminder("Call mom", new Date(2026, 9, 9, 15, 0), "once")
    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(bell().map((row) => row.id)).toEqual([id])

    dismissReminder(id, NOW)
    expect(bell()).toHaveLength(0)
    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(inboxCopies()).toHaveLength(1)
    expect(bell()).toHaveLength(0)
  })

  it("hides a daily reminder until the next cycle", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const id = addReminder("Water plants", new Date(2026, 9, 9, 15, 0), "daily")
    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(bell()).toHaveLength(1)

    expect(dismissReminder(id, NOW)).toBe(true)
    expect(bell()).toHaveLength(0)
    expect(bell(new Date(2026, 9, 10, 14, 59))).toHaveLength(0)

    const next = new Date(2026, 9, 10, 15, 0)
    expect(bell(next).map((row) => row.occurrenceKey)).toEqual(["2026-10-10T15:00"])
    const second = await deliverDueReminders(next, { send, chatId: "42" })
    expect(second).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(bell(next)).toHaveLength(1)
    expect(useTaskStore.getState().tasks.find((task) => task.id === id)?.lists).toContain(ensureRemindersList())
  })

  it("hides a weekly reminder until the next week", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const id = addReminder("Trash", new Date(2026, 9, 9, 15, 0), "weekly")
    await deliverDueReminders(NOW, { send, chatId: "42" })
    dismissReminder(id, NOW)

    expect(bell()).toHaveLength(0)
    expect(bell(new Date(2026, 9, 16, 14, 59))).toHaveLength(0)
    expect(bell(new Date(2026, 9, 16, 15, 0)).map((row) => row.occurrenceKey)).toEqual(["2026-10-16T15:00"])
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("does not text when Text me is off, and still files the Inbox", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0), "once", { textMe: false })
    const delivered = await deliverDueReminders(NOW, { send, chatId: "42" })

    expect(send).not.toHaveBeenCalled()
    expect(inboxCopies()).toHaveLength(1)
    expect(delivered[0]?.telegramOk).toBe(false)
    expect(delivered[0]?.telegramNote).toBe(REMINDER_SKIP_TEXT_OFF)
    expect(useTaskStore.getState().tasks.find((task) => task.reminder)?.reminder?.telegramNote).toBe(
      REMINDER_SKIP_TEXT_OFF,
    )

    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(inboxCopies()).toHaveLength(1)
    expect(send).not.toHaveBeenCalled()
  })

  it("texts when Text me is on", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Call mom", new Date(2026, 9, 9, 15, 0), "once", { textMe: true })
    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith("42", "Reminder: Call mom")
    expect(inboxCopies()).toHaveLength(1)
  })

  it("leaves a non-persistent reminder out of the bell", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    addReminder("Quiet", new Date(2026, 9, 9, 15, 0), "once", { persistent: false })
    addReminder("Nag", new Date(2026, 9, 9, 15, 0), "once", { persistent: true })
    expect(bell().map((row) => row.name)).toEqual(["Nag"])

    await deliverDueReminders(NOW, { send, chatId: "42" })
    expect(inboxCopies()).toHaveLength(2)
    expect(send).toHaveBeenCalledTimes(2)
    expect(bell().map((row) => row.name)).toEqual(["Nag"])
  })
})

describe("moon-night reminders", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("puts a new-moon reminder on the bell from local midnight of the phase day", async () => {
    const morning = new Date(2026, 9, 10, 5, 43, 0, 0)
    ensureMoonNightReminders(morning)
    expect(bell(morning).some((row) => row.id === NEW_MOON_REMINDER_ID)).toBe(true)
    expect(bell(new Date(2026, 9, 9, 23, 0, 0, 0)).some((row) => row.id === NEW_MOON_REMINDER_ID)).toBe(
      false,
    )

    const send = vi.fn(async () => ({ ok: true }))
    const early = await deliverDueReminders(morning, { send, chatId: "42" })
    expect(early.some((row) => row.reminderId === NEW_MOON_REMINDER_ID)).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it("seeds both moon reminders once and keeps the next evenings", () => {
    const asOf = new Date(2026, 9, 10, 12, 0, 0, 0)
    const first = ensureMoonNightReminders(asOf)
    const second = ensureMoonNightReminders(asOf)
    expect(first).toEqual(second)

    const tasks = useTaskStore.getState().tasks.filter((task) =>
      [NEW_MOON_REMINDER_ID, FULL_MOON_REMINDER_ID].includes(task.id),
    )
    expect(tasks).toHaveLength(2)
    expect(tasks.map((task) => task.title).sort()).toEqual([FULL_MOON_TONIGHT_NAME, NEW_MOON_TONIGHT_NAME].sort())

    const newMoon = tasks.find((task) => task.id === NEW_MOON_REMINDER_ID)!
    const fullMoon = tasks.find((task) => task.id === FULL_MOON_REMINDER_ID)!
    expect(newMoon.reminder?.repeat).toBe("new-moon")
    expect(fullMoon.reminder?.repeat).toBe("full-moon")
    expect(newMoon.scheduledTime).toBe("18:00")
    expect(fullMoon.scheduledTime).toBe("18:00")
    expect(newMoon.reminder?.textMe).not.toBe(false)
    expect(newMoon.reminder?.persistent).not.toBe(false)

    const expectedNew = nextMoonReminderEvening("new", asOf)
    const expectedFull = nextMoonReminderEvening("full", asOf)
    expect(newMoon.scheduledDate?.getFullYear()).toBe(expectedNew.getFullYear())
    expect(newMoon.scheduledDate?.getMonth()).toBe(expectedNew.getMonth())
    expect(newMoon.scheduledDate?.getDate()).toBe(expectedNew.getDate())
    expect(fullMoon.scheduledDate?.getDate()).toBe(expectedFull.getDate())
  })

  it("places a known new-moon evening within a day of the published UTC date", () => {
    // New moon 8 April 2024 ~18:21 UTC (NASA eclipse bulletin / USNO).
    const asOf = new Date(2024, 3, 1, 12, 0, 0, 0)
    const evening = nextMoonReminderEvening("new", asOf)
    expect(evening.getFullYear()).toBe(2024)
    expect(evening.getMonth()).toBe(3)
    expect(Math.abs(evening.getDate() - 8)).toBeLessThanOrEqual(1)
    expect(evening.getHours()).toBe(18)

    const instant = lunarPhaseInstant(Math.round((2024 + 3 / 12 - 2000) * 12.3685))
    expect(Math.abs(evening.getTime() - instant.getTime())).toBeLessThan(2 * 86_400_000)
  })

  it("advances a new-moon reminder after deliver", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const asOf = new Date(2026, 9, 10, 12, 0, 0, 0)
    ensureMoonNightReminders(asOf)
    const reminder = useTaskStore.getState().tasks.find((task) => task.id === NEW_MOON_REMINDER_ID)!
    const fireAt = new Date(
      reminder.scheduledDate!.getFullYear(),
      reminder.scheduledDate!.getMonth(),
      reminder.scheduledDate!.getDate(),
      18,
      0,
      0,
      0,
    )
    const beforeNext = nextMoonReminderEvening("new", fireAt)

    const delivered = await deliverDueReminders(fireAt, { send, chatId: "42" })
    expect(delivered.some((row) => row.reminderId === NEW_MOON_REMINDER_ID)).toBe(true)

    const moved = useTaskStore.getState().tasks.find((task) => task.id === NEW_MOON_REMINDER_ID)!
    expect(moved.scheduledDate?.getTime()).toBe(
      new Date(beforeNext.getFullYear(), beforeNext.getMonth(), beforeNext.getDate()).getTime(),
    )
    expect(moved.scheduledTime).toBe("18:00")
    expect(moved.reminder?.repeat).toBe("new-moon")
  })

  it("advances a full-moon reminder on dismiss", () => {
    const asOf = new Date(2026, 9, 10, 12, 0, 0, 0)
    ensureMoonNightReminders(asOf)
    const reminder = useTaskStore.getState().tasks.find((task) => task.id === FULL_MOON_REMINDER_ID)!
    const fireAt = new Date(
      reminder.scheduledDate!.getFullYear(),
      reminder.scheduledDate!.getMonth(),
      reminder.scheduledDate!.getDate(),
      18,
      0,
      0,
      0,
    )

    expect(dismissReminder(FULL_MOON_REMINDER_ID, fireAt)).toBe(true)
    const afterDismiss = useTaskStore.getState().tasks.find((task) => task.id === FULL_MOON_REMINDER_ID)!
    const expected = nextMoonReminderEvening("full", fireAt)
    expect(afterDismiss.scheduledDate?.getFullYear()).toBe(expected.getFullYear())
    expect(afterDismiss.scheduledDate?.getMonth()).toBe(expected.getMonth())
    expect(afterDismiss.scheduledDate?.getDate()).toBe(expected.getDate())
    expect(afterDismiss.scheduledTime).toBe("18:00")
    expect(bell(fireAt).some((row) => row.id === FULL_MOON_REMINDER_ID)).toBe(false)
  })

  it("does not text a moon reminder when Text me is off", async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const asOf = new Date(2026, 9, 10, 12, 0, 0, 0)
    ensureMoonNightReminders(asOf)
    const reminder = useTaskStore.getState().tasks.find((task) => task.id === FULL_MOON_REMINDER_ID)!
    useTaskStore.getState().updateTask({
      ...reminder,
      reminder: { ...reminder.reminder!, textMe: false },
    })
    const due = new Date(
      reminder.scheduledDate!.getFullYear(),
      reminder.scheduledDate!.getMonth(),
      reminder.scheduledDate!.getDate(),
      18,
      0,
      0,
      0,
    )
    // Keep the sibling new-moon row from texting in this assertion.
    useTaskStore.getState().updateTask({
      ...useTaskStore.getState().tasks.find((task) => task.id === NEW_MOON_REMINDER_ID)!,
      reminder: {
        ...useTaskStore.getState().tasks.find((task) => task.id === NEW_MOON_REMINDER_ID)!.reminder!,
        textMe: false,
      },
    })

    const sent = await deliverDueReminders(due, { send, chatId: "42" })
    const moonRow = sent.find((row) => row.reminderId === FULL_MOON_REMINDER_ID)
    expect(moonRow?.telegramNote).toBe(REMINDER_SKIP_TEXT_OFF)
    expect(send).not.toHaveBeenCalled()
    expect(inboxCopies().some((task) => task.description.includes(FULL_MOON_TONIGHT_NAME))).toBe(true)
  })
})
