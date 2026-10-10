import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ingestIncoming } from "./executor"
import { resetIphoneNoteContinuations } from "./apply-iphone-notes"
import { generatePairingCode, UNPAIRED_SUMMARY } from "./pairing"
import { useIngestStore } from "./ingest-store"
import { useTaskStore } from "@/lib/task-store"
import { parkedIphoneStoreItems } from "@/lib/apple-notes"
import { useHabitsStore, getDefaultHabits } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { formatLocalDateKey, sameCalendarDay, taskScheduledOnDay } from "@/lib/date-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { getPlanEntries } from "@/lib/plan-text"
import { useReviewsStore } from "@/lib/reviews-store"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { taskIsRequired } from "@/lib/todo-commitment"
import { TaskType } from "@/lib/types"
import { DEFAULT_DISCRETE_EVENT_TRIGGERS } from "./text-triggers"
import { resetIngestDedupeForTests } from "./dedupe"
import { resetActionHistory } from "@/lib/action-history"
import { resetPhoneUndoForTests, UNNAMED_UNDO } from "./phone-undo"
import { resetGpsIngestLogForTests, useGpsIngestLog } from "./gps-log"
import type { IncomingMessage } from "./types"

const NOW = new Date(2026, 8, 19, 17, 42, 0)

function sim(text: string): IncomingMessage {
  return {
    source: { channel: "simulate", chatId: "sim" },
    text,
    receivedAt: NOW.toISOString(),
  }
}

let telegramSeq = 100

function tg(text: string, chatId = "99"): IncomingMessage {
  telegramSeq += 1
  return {
    source: { channel: "telegram", chatId, userId: chatId },
    text,
    receivedAt: NOW.toISOString(),
    telegramMessageId: telegramSeq,
    telegramUpdateId: telegramSeq,
  }
}

describe("ingestIncoming", () => {
  beforeEach(() => {
    resetAllStores()
    resetIphoneNoteContinuations()
    resetIngestDedupeForTests()
    resetGpsIngestLogForTests()
    resetActionHistory()
    resetPhoneUndoForTests()
    telegramSeq = 100
    useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
    useIngestStore.setState({
      enabled: true,
      allowGroups: false,
      pairing: null,
      allowedChats: [],
      revokedChatIds: [],
      allowlistRev: 0,
      pendingByChat: {},
      events: [],
      lastPollAt: null,
      lastPollError: null,
      lastPollSource: null,
      shortcuts: {},
      groceryListId: null,
      discreteEventTriggers: DEFAULT_DISCRETE_EVENT_TRIGGERS.map((t) => ({ ...t })),
      seenIngestKeys: [],
      phoneHubUrl: "",
      livePins: {},
    })
  })

  it("captures prefix-less text into the inbox", () => {
    const result = ingestIncoming(sim("pick up milk"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Inbox: pick up milk/)
    const task = useTaskStore.getState().tasks.find((t) => t.description === "pick up milk")
    expect(task?.stage).toBe("inbox")
    expect(task?.monkeyBrain).toBeUndefined()
    expect(task?.captureOrigin).toEqual({ kind: "telegram", detail: "pick up milk" })
  })

  it("records the Telegram chat and message on a BIM capture", () => {
    useIngestStore.getState().allowChat({ chatId: "99", username: "ada", pairedAt: NOW.toISOString() })
    const message = {
      ...tg("pick up milk"),
      source: { channel: "telegram" as const, chatId: "99", username: "ada" },
    }
    const result = ingestIncoming(message, NOW)
    expect(result.status).toBe("ok")
    const task = useTaskStore.getState().tasks.find((t) => t.description === "pick up milk")
    expect(task?.captureOrigin).toEqual({
      kind: "telegram",
      detail: `@ada · message ${message.telegramMessageId} · pick up milk`,
    })
    expect(task?.createdAt).toEqual(NOW)
  })

  it("files folder: all: item on that folder's All Items list", () => {
    const result = ingestIncoming(sim("next actions: all: buy milk"), NOW)
    expect(result.status).toBe("ok")
    const task = useTaskStore.getState().tasks.find((row) => row.description === "buy milk")
    const folder = useTaskStore.getState().folders.find((row) => /next actions/i.test(row.name))
    expect(folder).toBeTruthy()
    expect(task?.lists).toEqual([`__all-items__${folder!.id}`])
    expect(task?.stage).toBe("inbox")
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "all" && !isFolderAllItemsCategoryId(list.id))).toBe(false)
  })

  it("files a bulk folder: all: header onto that folder's All Items list", () => {
    const result = ingestIncoming(sim("Next Actions: all:\nbuy milk"), NOW)
    expect(result.status).toBe("ok")
    const task = useTaskStore.getState().tasks.find((row) => row.description === "buy milk")
    const folder = useTaskStore.getState().folders.find((row) => /next actions/i.test(row.name))
    expect(folder).toBeTruthy()
    expect(task?.lists).toContain(`__all-items__${folder!.id}`)
    expect(task?.stage).not.toBe("inbox")
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "all" && !isFolderAllItemsCategoryId(list.id))).toBe(false)
  })

  it("files a bulk line on its list and keeps the clock in the title", () => {
    const result = ingestIncoming(sim("Chores:\ngo home tomorrow at 3pm"), NOW)
    expect(result.status).toBe("ok")
    const task = useTaskStore.getState().tasks.find((row) => row.description === "go home tomorrow at 3pm")
    expect(task?.scheduledTime).toBe("15:00")
    const list = useTaskStore.getState().lists.find((row) => row.name.toLowerCase() === "chores")
    expect(list).toBeTruthy()
    expect(task?.lists).toContain(list!.id)
  })

  it("keeps a detected day and clock in the captured title", () => {
    const result = ingestIncoming(sim("go home tomorrow at 3pm"), NOW)
    expect(result.status).toBe("ok")
    const task = useTaskStore.getState().tasks.find((row) => row.description === "go home tomorrow at 3pm")
    expect(task?.stage).toBe("inbox")
    expect(task?.scheduledTime).toBe("15:00")
    expect(task?.scheduledDate).toBeInstanceOf(Date)
  })

  it("stores -p and -plain as written with no list or clock", () => {
    const flagged = ingestIncoming(sim("-p next actions: blah at 3pm"), NOW)
    expect(flagged.status).toBe("ok")
    if (flagged.status !== "ok") return
    expect(flagged.reply).toMatch(/Inbox: next actions: blah at 3pm/)
    const task = useTaskStore.getState().tasks.find((row) => row.description === "next actions: blah at 3pm")
    expect(task?.scheduledTime).toBeUndefined()
    expect(task?.lists ?? []).toHaveLength(0)
    expect(useTaskStore.getState().lists.some((list) => /next actions/i.test(list.name))).toBe(false)

    const checked = ingestIncoming(sim("wash the dog tomorrow -plain"), NOW)
    expect(checked.status).toBe("ok")
    const literal = useTaskStore.getState().tasks.find((row) => row.description === "wash the dog tomorrow")
    expect(literal?.scheduledDate).toBeUndefined()
  })

  it("sends -mb and -monkey captures to monkey brain", () => {
    const result = ingestIncoming(sim("looping thought -monkey"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Monkey brain: looping thought/)
    const task = useTaskStore.getState().tasks.find((t) => t.monkeyBrain)
    expect(task?.stage).toBe("inbox")
    expect(task?.description).toBe("looping thought")
  })

  it("bulk-adds list items", () => {
    const result = ingestIncoming(sim("bulk:\nGroceries:\nmilk\neggs"), NOW)
    expect(result.status).toBe("ok")
    const titles = useTaskStore.getState().tasks.map((t) => t.description)
    expect(titles).toEqual(expect.arrayContaining(["milk", "eggs"]))
  })

  it("logs a goal habit by distinctive name", () => {
    const result = ingestIncoming(sim("habit: exercise 30"), NOW)
    expect(result.status).toBe("ok")
    const dateKey = formatLocalDateKey(NOW)
    const cell = useHabitsStore.getState().weeklyData[dateKey]?.["task-2"]
    expect(cell?.value).toBe(30)
  })

  it("checks a boolean habit", () => {
    const result = ingestIncoming(sim("did: stretch"), NOW)
    expect(result.status).toBe("ok")
    const dateKey = formatLocalDateKey(NOW)
    expect(useHabitsStore.getState().weeklyData[dateKey]?.["task-11"]?.completed).toBe(true)
  })

  it("asks when chess is ambiguous", () => {
    const result = ingestIncoming(sim("habit: chess"), NOW)
    expect(result.status).toBe("needs_clarify")
  })

  it("paints location from now until end of day", () => {
    const result = ingestIncoming(sim("at: home"), NOW)
    expect(result.status).toBe("ok")
    const date = formatLocalDateKey(NOW)
    const entries = useTimeTrackingStore.getState().entriesFor(date, "location")
    expect(entries.some((e) => e.penId === "loc-home" && e.startMin === 17 * 60 + 42)).toBe(true)
  })

  it("paints an activity duration ending now", () => {
    ingestIncoming(sim("track: exercise 30m"), NOW)
    const date = formatLocalDateKey(NOW)
    const entries = useTimeTrackingStore.getState().entriesFor(date, "activity")
    expect(entries.some((e) => e.penId === "act-exercise")).toBe(true)
  })

  it("paints iPhone Screen Time from screen: and leaves Activity / Mac Screen Time empty", () => {
    const result = ingestIncoming(sim("screen: Instagram 30m"), NOW)
    expect(result.status).toBe("ok")
    const date = formatLocalDateKey(NOW)
    const phone = useTimeTrackingStore.getState().entriesFor(date, "iphone-screentime")
    expect(phone.some((e) => e.penId === "iphone-st-app-instagram" && e.precision === "estimated")).toBe(true)
    expect(useTimeTrackingStore.getState().entriesFor(date, "screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(date, "activity")).toEqual([])
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("paints iPhone Calls and iPhone Texts onto their own views", () => {
    expect(ingestIncoming(sim("call: Jane 12m"), NOW).status).toBe("ok")
    expect(ingestIncoming(sim("text: Jane on my way"), NOW).status).toBe("ok")
    const date = formatLocalDateKey(NOW)
    expect(useTimeTrackingStore.getState().entriesFor(date, "iphone-calls").some((e) => e.penId === "iphone-call-jane")).toBe(true)
    expect(useTimeTrackingStore.getState().entriesFor(date, "iphone-texts").some((e) => e.kind === "instant" && e.title === "on my way")).toBe(true)
    expect(useTimeTrackingStore.getState().entriesFor(date, "screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(date, "activity")).toEqual([])
  })

  it("logs sleep", () => {
    const result = ingestIncoming(sim("sleep: 11:30-7:00"), NOW)
    expect(result.status).toBe("ok")
    const nights = Object.values(useSleepStore.getState().nights)
    expect(nights.length).toBeGreaterThan(0)
    expect(nights[0]?.sleptMin).toBe(-30)
    expect(nights[0]?.wokeMin).toBe(420)
  })

  it("replies with help", () => {
    const result = ingestIncoming(sim("help"), NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/groc/)
  })

  it("ignores unpaired telegram senders", () => {
    const result = ingestIncoming(tg("pick up milk"), NOW)
    expect(result.status).toBe("ignored")
    expect(useTaskStore.getState().tasks.some((t) => t.description === "pick up milk")).toBe(false)
  })

  it("pairs with a valid code then captures", () => {
    const { code, expiresAt } = generatePairingCode(NOW.getTime())
    useIngestStore.getState().setPairing({ code, expiresAt })
    const paired = ingestIncoming(tg(`/start ${code}`), NOW)
    expect(paired.status).toBe("ok")
    const captured = ingestIncoming(tg("qa: pick up milk"), NOW)
    expect(captured.status).toBe("ok")
    expect(useTaskStore.getState().tasks.some((t) => t.description === "pick up milk")).toBe(true)
  })

  it("does not pair with a wrong code", () => {
    const { code, expiresAt } = generatePairingCode(NOW.getTime())
    useIngestStore.getState().setPairing({ code, expiresAt })
    const result = ingestIncoming(tg("/start 000000"), NOW)
    expect(result.status).toBe("ignored")
  })

  it("writes an ingest log event", () => {
    ingestIncoming(sim("pick up milk"), NOW)
    expect(useIngestStore.getState().events[0]?.kind).toBe("capture")
    expect(useIngestStore.getState().events[0]?.status).toBe("applied")
  })

  it("dumps a named list even when folders are named Lists", () => {
    useTaskStore.getState().addFolder({
      id: "cleaning-lists",
      name: "Cleaning Lists",
      createdAt: new Date(),
      listIds: [],
    })
    ingestIncoming(sim("bulk:\nGrocery list:\nmilk\neggs"), NOW)
    const result = ingestIncoming(sim("read: grocery list"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Grocery list/)
    expect(result.reply).toMatch(/milk/)
    expect(result.reply).not.toMatch(/Which list or folder/)
  })

  it("parks prose that names nothing instead of offering near-misses", () => {
    ingestIncoming(sim("bulk:\nbooks i want to own:\nDune\n\nflights to book:\nLisbon"), NOW)
    const result = ingestIncoming(sim("Dump iphone notes to brain2"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).not.toMatch(/Which list or folder/)
    expect(result.reply).toMatch(/iPhone Notes Store/i)
    const parked = parkedIphoneStoreItems(useTaskStore.getState().tasks)
    expect(parked.some((t) => `${t.title} ${t.body}`.includes("iphone notes to brain2"))).toBe(true)
  })

  it("dumps a named list in plain text", () => {
    ingestIncoming(sim("bulk:\nGrocery list:\nmilk\neggs"), NOW)
    const result = ingestIncoming(sim("read: grocery list"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Grocery list/)
    expect(result.reply).toMatch(/milk/)
    expect(result.reply).toMatch(/eggs/)
  })

  it("lists lists and folders", () => {
    ingestIncoming(sim("bulk:\nHome: Groceries:\noat milk"), NOW)
    const lists = ingestIncoming(sim("lists"), NOW)
    expect(lists.status).toBe("ok")
    if (lists.status === "ok") {
      expect(lists.reply).toMatch(/Groceries/)
      expect(lists.reply).toMatch(/Home/)
    }
    const folders = ingestIncoming(sim("folders"), NOW)
    expect(folders.status).toBe("ok")
    if (folders.status === "ok") expect(folders.reply).toMatch(/Home/)
  })

  it("replies with the long info manual", () => {
    const result = ingestIncoming(sim("info"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/BIM/)
    expect(result.reply).toMatch(/Brain2 Ingestion Messenger/)
    expect(result.reply).toMatch(/\{prefix\} info/)
    expect(result.reply).toMatch(/all commands/)
    expect(result.reply).toMatch(/groc/)
  })

  it("serves all commands and prefix manuals", () => {
    const all = ingestIncoming(sim("all commands"), NOW)
    expect(all.status).toBe("ok")
    if (all.status === "ok") {
      expect(all.reply).toMatch(/log:/)
      expect(all.reply).toMatch(/currently/)
    }
    const groc = ingestIncoming(sim("groc info"), NOW)
    expect(groc.status).toBe("ok")
    if (groc.status === "ok") expect(groc.reply).toMatch(/Grocery/i)
  })

  it("dumps the inbox and today's habits", () => {
    ingestIncoming(sim("qa: call dentist"), NOW)
    const inbox = ingestIncoming(sim("read inbox"), NOW)
    expect(inbox.status).toBe("ok")
    if (inbox.status === "ok") expect(inbox.reply).toMatch(/call dentist/)
    const habits = ingestIncoming(sim("habits"), NOW)
    expect(habits.status).toBe("ok")
    if (habits.status === "ok") expect(habits.reply).toMatch(/Stretch/)
  })

  it("dumps the inbox newest first", () => {
    ingestIncoming(sim("qa: older note"), NOW)
    const older = useTaskStore.getState().tasks.find((t) => t.description === "older note")
    expect(older).toBeTruthy()
    if (!older) return
    useTaskStore.getState().updateTask({ ...older, createdAt: new Date("2020-01-01T00:00:00Z") })
    ingestIncoming(sim("qa: newer note"), NOW)
    const inbox = ingestIncoming(sim("read inbox"), NOW)
    expect(inbox.status).toBe("ok")
    if (inbox.status !== "ok") return
    const newerAt = inbox.reply.indexOf("newer note")
    const olderAt = inbox.reply.indexOf("older note")
    expect(newerAt).toBeGreaterThan(-1)
    expect(olderAt).toBeGreaterThan(newerAt)
  })

  it("dumps a folder's lists", () => {
    ingestIncoming(sim("bulk:\nHome: Groceries:\noat milk"), NOW)
    const result = ingestIncoming(sim("read folder: Home"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Home/)
    expect(result.reply).toMatch(/Groceries/)
  })

  it("searches items", () => {
    ingestIncoming(sim("bulk:\nGroceries:\noat milk"), NOW)
    const result = ingestIncoming(sim("search: oat"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/oat milk/)
  })

  it("dumps grocery with groc and pins the dump", () => {
    ingestIncoming(sim("bulk:\nGrocery list:\nmilk\neggs"), NOW)
    const result = ingestIncoming(sim("groc"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.kind).toBe("grocery")
    expect(result.reply).toMatch(/milk/)
    expect(result.pinText).toMatch(/Grocery list/)
  })

  it("does not treat bare g as grocery", () => {
    const result = ingestIncoming(sim("g"), NOW)
    expect(result.kind).toBe("capture")
  })

  it("adds grocery lines and checks them off", () => {
    ingestIncoming(sim("groc bread"), NOW)
    const added = useTaskStore.getState().tasks.find((t) => t.description === "bread")
    expect(added?.completed).toBeFalsy()
    const got = ingestIncoming(sim("got bread"), NOW)
    expect(got.status).toBe("ok")
    expect(useTaskStore.getState().tasks.find((t) => t.id === added?.id)?.completed).toBe(true)
  })

  it("adds needed items with sent from text notes", () => {
    const result = ingestIncoming(sim("needed: batteries"), NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("needed")
    const item = useTaskStore.getState().tasks.find((t) => t.description === "batteries")
    expect(item?.notes).toMatch(/sent from text/i)
    expect(item?.lists?.length).toBeGreaterThan(0)
  })

  it("adds multiline get: items onto needed (colon required)", () => {
    const result = ingestIncoming(sim("get:\nbatteries\nmilk\nstamps"), NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("needed")
    const needed = useTaskStore.getState().lists.find((l) => l.name.trim().toLowerCase() === "needed")
    expect(needed).toBeTruthy()
    const titles = ["batteries", "milk", "stamps"].map((title) =>
      useTaskStore.getState().tasks.find((t) => t.description === title),
    )
    for (const item of titles) {
      expect(item?.notes).toMatch(/sent from text/i)
      expect(item?.lists).toContain(needed!.id)
      expect(item?.stage).not.toBe("inbox")
    }
    const bare = ingestIncoming(sim("get milk tomorrow"), NOW)
    expect(bare.kind).toBe("capture")
    const empty = ingestIncoming(sim("get:\n\n"), NOW)
    expect(empty.status).toBe("error")
    expect(empty.reply).toMatch(/nothing added/i)
  })

  it("notes the live activity block and keeps a discrete tick", () => {
    ingestIncoming(sim("track: work"), NOW)
    const result = ingestIncoming(sim("n stuck in aisle 4"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/stuck in aisle 4/)
    const entries = useTimeTrackingStore.getState().entries
    expect(entries.some((entry) => entry.kind !== "instant" && entry.notes?.includes("stuck in aisle 4"))).toBe(true)
    expect(entries.some((entry) => entry.kind === "instant" && entry.title === "stuck in aisle 4")).toBe(true)
  })

  it("expands a custom shortcut into grocery dump", () => {
    useIngestStore.getState().setShortcut("store", "groc")
    ingestIncoming(sim("bulk:\nGrocery list:\nmilk"), NOW)
    const result = ingestIncoming(sim("store"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/milk/)
  })

  it("stamps plan for rn entries as from text", () => {
    const wrote = ingestIncoming(sim("plan for rn:\nwrite\nwalk"), NOW)
    expect(wrote.status).toBe("ok")
    const day = formatLocalDateKey(NOW)
    const entry = getPlanEntries("day", day).find((e) => e.text === "write\nwalk")
    expect(entry?.stampSuffix).toBe("from text")
  })

  it("dedupes telegram message ids", () => {
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
    const first = ingestIncoming(
      { ...tg("needed: tape"), telegramMessageId: 42, telegramUpdateId: 1001 },
      NOW,
    )
    const second = ingestIncoming(
      { ...tg("needed: tape"), telegramMessageId: 42, telegramUpdateId: 1001 },
      NOW,
    )
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ignored")
    expect(second.summary).toMatch(/Duplicate/i)
    const tapes = useTaskStore.getState().tasks.filter((t) => t.description === "tape")
    expect(tapes).toHaveLength(1)
    const applied = useIngestStore.getState().events.find((event) => event.status === "applied")
    expect(applied?.telegramMessageId).toBe(42)
  })

  it("logs a null dedupe key and does not apply a telegram message with no ids", () => {
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
    const bare = {
      source: { channel: "telegram" as const, chatId: "99", userId: "99" },
      text: "Damn 1 o carried away",
      receivedAt: NOW.toISOString(),
    }
    for (let i = 0; i < 4; i += 1) ingestIncoming(bare, NOW)
    expect(useTaskStore.getState().tasks.filter((t) => /carried away/i.test(t.description ?? ""))).toHaveLength(0)
    const events = useIngestStore.getState().events
    expect(events).toHaveLength(4)
    expect(events.every((event) => event.summary === "Null dedupe key" && event.dedupeKey === null)).toBe(true)
  })

  it("undoes the last named text write and refuses when it cannot name one", () => {
    const wrote = ingestIncoming(sim("needed: tape"), NOW)
    expect(wrote.status).toBe("ok")
    expect(useTaskStore.getState().tasks.some((t) => t.description === "tape")).toBe(true)
    const undone = ingestIncoming(sim("undo"), NOW)
    expect(undone.status).toBe("ok")
    expect(undone.reply).toMatch(/Undid needed: tape/)
    expect(useTaskStore.getState().tasks.some((t) => t.description === "tape")).toBe(false)
    const again = ingestIncoming(sim("undo"), NOW)
    expect(again.reply).toBe(UNNAMED_UNDO)
    const prose = ingestIncoming(sim("undo the laundry"), NOW)
    expect(prose.kind).toBe("capture")
  })

  it("does not rewind an open ritual with undo", () => {
    ingestIncoming(sim("needed: tape"), NOW)
    const opened = ingestIncoming(sim("gm"), NOW)
    expect(opened.status).toBe("needs_clarify")
    const undone = ingestIncoming(sim("undo"), NOW)
    expect(undone.reply).toMatch(/ritual is open/i)
    expect(useTaskStore.getState().tasks.some((t) => t.description === "tape")).toBe(true)
    expect(useIngestStore.getState().getPending("simulate", "sim")?.kind).toBe("ritual")
  })

  it("treats a text edit as the same message", () => {
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
    const first = ingestIncoming(
      { ...tg("needed: tape"), telegramMessageId: 42, telegramUpdateId: 1001 },
      NOW,
    )
    const edited = ingestIncoming(
      { ...tg("needed: tape two"), telegramMessageId: 42, telegramUpdateId: 1002 },
      NOW,
    )
    expect(first.status).toBe("ok")
    expect(edited.status).toBe("ignored")
    expect(edited.summary).toMatch(/Duplicate/i)
    expect(useTaskStore.getState().tasks.filter((t) => t.description === "tape")).toHaveLength(1)
    expect(useTaskStore.getState().tasks.filter((t) => t.description === "tape two")).toHaveLength(0)
  })

  it("re-applies a Live Location edit on the same message", () => {
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
    const first = ingestIncoming(
      { ...tg("gps: Home\n37.77,-122.42"), telegramMessageId: 9, telegramUpdateId: 501, locationUpdate: true },
      NOW,
    )
    const moved = ingestIncoming(
      { ...tg("gps: Park\n37.80,-122.50"), telegramMessageId: 9, telegramUpdateId: 502, locationUpdate: true },
      NOW,
    )
    expect(first.status).toBe("ok")
    expect(moved.status).toBe("ok")
  })

  it("dedupes a repeat that only has a telegram message id", () => {
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
    const first = ingestIncoming({ ...tg("needed: tape"), telegramUpdateId: undefined, telegramMessageId: 77 }, NOW)
    const second = ingestIncoming({ ...tg("needed: tape"), telegramUpdateId: undefined, telegramMessageId: 77 }, NOW)
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ignored")
    expect(useTaskStore.getState().tasks.filter((t) => t.description === "tape")).toHaveLength(1)
    expect(useIngestStore.getState().events.find((event) => event.status === "applied")?.telegramMessageId).toBe(77)
  })

  it("logs discrete events and habit keywords", () => {
    useHabitsStore.setState({
      tasks: [
        { id: "h-hemi", name: "Hemisync", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
        {
          id: "h-read",
          name: "Read",
          type: TaskType.GOAL,
          goal: 30,
          unit: "pages",
          rewardValue: 10,
          frequency: "daily",
        },
      ],
      weeklyData: {},
    })
    const bare = ingestIncoming(sim("hemisync"), NOW)
    expect(bare.kind).toBe("capture")
    const hemi = ingestIncoming(sim("dh: hemisync"), NOW)
    expect(hemi.status).toBe("ok")
    expect(hemi.kind).toBe("habit-trigger")
    const buried = ingestIncoming(sim("remember hemisync tonight"), NOW)
    expect(buried.kind).toBe("capture")
    const pages = ingestIncoming(sim("dh: read 30 pages"), NOW)
    expect(pages.status).toBe("ok")
    expect(pages.kind).toBe("habit-trigger")
    const smoked = ingestIncoming(sim("smoked weed"), NOW)
    expect(smoked.status).toBe("ok")
    expect(smoked.kind).toBe("event-trigger")
    const logged = ingestIncoming(sim("log: drink water"), NOW)
    expect(logged.status).toBe("ok")
    expect(logged.kind).toBe("event-log")
    const bareO = ingestIncoming(sim("o"), NOW)
    expect(bareO.kind).toBe("capture")
  })

  it("parks an iphone-notes dump on the dedicated store list", () => {
    const result = ingestIncoming(
      sim("iphone-notes:\nid: sim-1\ntitle: Grocery\n---\nmilk\neggs"),
      NOW,
    )
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.kind).toBe("iphone-notes")
    expect(result.reply).toMatch(/Parked in iPhone Notes Store: Grocery/)
    const task = useTaskStore.getState().tasks.find((t) => t.attributes?.appleNoteId === "iphone:sim-1")
    expect(task?.body).toContain("milk")
    expect(task?.lists).toContain("list-iphone-notes-store")
  })

  it("appends plan for rn onto today's plan log and reads it back", () => {
    const wrote = ingestIncoming(sim("plan for rn:\nwrite\nwalk"), NOW)
    expect(wrote.status).toBe("ok")
    const day = formatLocalDateKey(NOW)
    expect(getPlanEntries("day", day).some((entry) => entry.text === "write\nwalk")).toBe(true)
    const latest = ingestIncoming(sim("read plan for today"), NOW)
    const all = ingestIncoming(sim("read plans for today"), NOW)
    expect(latest.status).toBe("ok")
    expect(all.status).toBe("ok")
    if (latest.status !== "ok" || all.status !== "ok") return
    expect(latest.reply).toMatch(/write/)
    expect(all.reply).toMatch(/write/)
    expect(all.reply).toMatch(/walk/)
  })

  it("files do: on Next Actions General and to do today on today's list", () => {
    expect(ingestIncoming(sim("do: call dentist"), NOW).status).toBe("ok")
    expect(ingestIncoming(sim("to do today: mail the form"), NOW).status).toBe("ok")
    const tasks = useTaskStore.getState().tasks
    const general = tasks.find((task) => task.description === "call dentist")
    const today = tasks.find((task) => task.description === "mail the form")
    expect(general).toBeTruthy()
    expect(taskScheduledOnDay(general!, NOW)).toBe(false)
    expect(today && taskScheduledOnDay(today, NOW)).toBe(true)
    const listed = ingestIncoming(sim("read to do today"), NOW)
    expect(listed.status).toBe("ok")
    if (listed.status !== "ok") return
    expect(listed.reply).toMatch(/mail the form/)
    expect(listed.reply).not.toMatch(/call dentist/)
  })

  it("walks a morning review and saves a skipped thread", () => {
    let step = ingestIncoming(sim("gm"), NOW)
    expect(step.status).toBe("needs_clarify")
    // bed, wake, dream, 5 affirmations, todos, priorities, habits, todo-walk/day-plan, circumstances, best-day, gratitude
    for (let i = 0; i < 20 && step.status === "needs_clarify"; i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.status).toBe("ok")
    const morning = useReviewsStore.getState().getMorningReview(formatLocalDateKey(NOW))
    expect(morning).toBeTruthy()
    expect(morning?.source).toBe("telegram")
  })

  it("adds and removes today's to-dos, then marks required tasks", () => {
    const alpha = createScheduledTodoTask({ description: "alpha", period: "day", date: NOW })
    alpha.id = "todo-alpha"
    const beta = createScheduledTodoTask({ description: "beta", period: "day", date: NOW })
    beta.id = "todo-beta"
    useTaskStore.getState().addTask(alpha)
    useTaskStore.getState().addTask(beta)

    let step = ingestIncoming(sim("gm"), NOW)
    for (let i = 0; i < 20 && step.status === "needs_clarify" && !/rm 1 3/i.test(step.reply ?? ""); i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.status).toBe("needs_clarify")
    if (step.status !== "needs_clarify") return
    expect(step.reply).toMatch(/alpha/)
    expect(step.reply).toMatch(/beta/)

    step = ingestIncoming(sim("rm 1\ncall mom"), NOW)
    expect(step.status).toBe("needs_clarify")
    if (step.status !== "needs_clarify") return
    expect(step.reply).toMatch(/required/i)
    expect(step.reply).toMatch(/Nothing is required yet/)
    expect(taskScheduledOnDay(useTaskStore.getState().tasks.find((t) => t.id === "todo-alpha")!, NOW)).toBe(false)
    expect(useTaskStore.getState().tasks.some((t) => t.description === "call mom" && taskScheduledOnDay(t, NOW))).toBe(true)

    step = ingestIncoming(sim("1\npay rent"), NOW)
    expect(step.status).toBe("needs_clarify")
    if (step.status !== "needs_clarify") return
    expect(step.reply).toMatch(/highest priorities/i)
    const dayKey = formatLocalDateKey(NOW)
    const open = useTaskStore.getState().tasks.filter((t) => taskScheduledOnDay(t, NOW) && !t.completed)
    const first = open[0]
    const rent = useTaskStore.getState().tasks.find((t) => t.description === "pay rent")
    expect(first && taskIsRequired(first, "day", dayKey)).toBe(true)
    expect(rent && taskIsRequired(rent, "day", dayKey)).toBe(true)
    expect(rent && taskScheduledOnDay(rent, NOW)).toBe(true)
  })

  it("treats morning-review replies as answers until STOP", () => {
    let step = ingestIncoming(sim("gm"), NOW)
    expect(step.status).toBe("needs_clarify")
    step = ingestIncoming(sim("M"), NOW)
    expect(step.status).toBe("needs_clarify")
    if (step.status !== "needs_clarify") return
    expect(step.reply).not.toMatch(/Which mood/)
    expect(step.reply).toMatch(/Bedtime/)
    expect(step.reply).toMatch(/STOP/)

    step = ingestIncoming(sim("all nighter"), NOW)
    expect(step.reply).toMatch(/Affirmation 1/)
    step = ingestIncoming(sim("Next"), NOW)
    expect(step.reply).toMatch(/Affirmation 2/)
    expect(step.reply ?? "").not.toMatch(/Inbox/)
    step = ingestIncoming(sim("mood: good"), NOW)
    expect(step.reply).toMatch(/Affirmation 3/)
    expect(step.reply ?? "").not.toMatch(/Which mood/)
    step = ingestIncoming(sim("Why isnt it working"), NOW)
    expect(step.reply).toMatch(/Affirmation 4/)
    expect(step.reply ?? "").not.toMatch(/Inbox/)

    step = ingestIncoming(sim("stop"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Affirmation 5/)

    step = ingestIncoming(sim("STOP"), NOW)
    expect(step.status).toBe("ok")
    if (step.status !== "ok") return
    expect(step.reply).toMatch(/saved/i)
    const morning = useReviewsStore.getState().getMorningReview(formatLocalDateKey(NOW))
    expect(morning?.allNighter).toBe(true)
    expect(morning?.completed).toBe(false)
    expect(morning?.affirmations?.length).toBe(4)
    expect(morning?.resumeStep).toBe("affirmation")
    expect(morning?.bedTime).toBeUndefined()

    const again = ingestIncoming(sim("gm"), NOW)
    expect(again.status).toBe("needs_clarify")
    if (again.status !== "needs_clarify") return
    expect(again.reply).toMatch(/start over/)
    expect(again.reply).toMatch(/continue/)
    expect(again.reply).toMatch(/jump/)
  })

  it("keeps the bot ritual card id across a morning step", () => {
    const opened = ingestIncoming(sim("gm"), NOW)
    expect(opened.status).toBe("needs_clarify")
    const pending = useIngestStore.getState().getPending("simulate", "sim")
    expect(pending?.kind).toBe("ritual")
    if (!pending) return
    useIngestStore.getState().setPending("simulate", "sim", { ...pending, ritualCardMessageId: 15 })
    const next = ingestIncoming(sim("skip"), NOW)
    expect(next.ritualCardMessageId).toBe(15)
    expect(useIngestStore.getState().getPending("simulate", "sim")?.ritualCardMessageId).toBe(15)
  })

  it("does not advance morning review on a live location pin or a blank message", () => {
    const step = ingestIncoming(sim("gm"), NOW)
    expect(step.status).toBe("needs_clarify")
    const pin = ingestIncoming(sim("gps:\n37.77,-122.42\n±8m"), NOW)
    expect(pin.status).toBe("ignored")
    expect(pin.reply ?? "").toBe("")
    const again = ingestIncoming(sim("gps:\n37.771,-122.421\n±8m"), NOW)
    expect(again.status).toBe("ignored")
    expect(useIngestStore.getState().getPending("simulate", "sim")?.ritual?.step).toBe("bed")
    expect(useTimeTrackingStore.getState().entriesFor(formatLocalDateKey(NOW), "location")).toHaveLength(0)

    const blank = ingestIncoming(sim("   "), NOW)
    expect(blank.status).toBe("ignored")
    expect(blank.reply ?? "").toBe("")
    expect(useIngestStore.getState().getPending("simulate", "sim")?.ritual?.step).toBe("bed")

    const moved = ingestIncoming(sim("next"), NOW)
    expect(moved.status).toBe("needs_clarify")
    if (moved.status !== "needs_clarify") return
    expect(moved.reply).toMatch(/Wake time/i)
  })

  it("resumes live location after the morning review ends", () => {
    ingestIncoming(sim("gm"), NOW)
    ingestIncoming(sim("gps:\n37.77,-122.42\n±8m"), NOW)
    expect(useTimeTrackingStore.getState().entriesFor(formatLocalDateKey(NOW), "location")).toHaveLength(0)
    const stopped = ingestIncoming(sim("STOP"), NOW)
    expect(stopped.status).toBe("ok")
    const resumed = ingestIncoming(sim("gps:\n37.77,-122.42\n±8m"), NOW)
    expect(resumed.status === "ok" || resumed.status === "ignored").toBe(true)
    expect(useTimeTrackingStore.getState().entriesFor(formatLocalDateKey(NOW), "location").length).toBeGreaterThan(0)
  })

  it("files a grocery header onto the store list and skips identical open items", () => {
    useTaskStore.getState().addList({
      id: "list-groceries",
      name: "Groceries",
      color: "#10B981",
      description: "store",
      createdAt: NOW,
    })
    const first = ingestIncoming(sim("Grocery list: grocery list:\neggs \nrice \nbutter"), NOW)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    expect(first.reply).toMatch(/Groceries: eggs, rice, and butter/)
    expect(first.pinText).toMatch(/eggs/)
    const lists = useTaskStore.getState().lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
    expect(lists.map((list) => list.name)).toEqual(["Groceries"])
    expect(useTaskStore.getState().folders.some((folder) => /grocery/i.test(folder.name))).toBe(false)
    const onStore = useTaskStore.getState().tasks.filter((task) => task.lists?.includes("list-groceries"))
    expect(onStore.map((task) => task.description).sort()).toEqual(["butter", "eggs", "rice"])

    const second = ingestIncoming(sim("Grocery list:\neggs\nmilk"), NOW)
    expect(second.status).toBe("needs_clarify")
    if (second.status !== "needs_clarify") return
    expect(second.reply).toMatch(/Groceries: milk/)
    expect(second.reply).toMatch(/duplicate item/)
    expect(second.reply).toMatch(/• eggs/)
    expect(second.reply).toMatch(/see —/)
    expect(second.reply).toMatch(/dismiss —/)
    expect(useTaskStore.getState().tasks.filter((task) => task.description === "eggs")).toHaveLength(1)
    expect(useTaskStore.getState().tasks.some((task) => task.description === "milk")).toBe(true)

    const peeked = ingestIncoming(sim("see"), NOW)
    expect(peeked.status).toBe("needs_clarify")
    if (peeked.status !== "needs_clarify") return
    expect(peeked.reply).toMatch(/Already there/)
    expect(peeked.reply).toMatch(/eggs/)
    expect(useTaskStore.getState().tasks.filter((task) => task.description === "eggs")).toHaveLength(1)

    const left = ingestIncoming(sim("dismiss"), NOW)
    expect(left.status).toBe("ok")
    if (left.status !== "ok") return
    expect(left.reply).toMatch(/Left the duplicates/)
    expect(useTaskStore.getState().tasks.filter((task) => task.description === "eggs")).toHaveLength(1)

    ingestIncoming(sim("Grocery list:\neggs"), NOW)
    const again = ingestIncoming(sim("again"), NOW)
    expect(again.status).toBe("ok")
    if (again.status !== "ok") return
    expect(again.reply).toMatch(/Added again: eggs/)
    expect(useTaskStore.getState().tasks.filter((task) => task.description === "eggs" && !task.completed)).toHaveLength(2)
  })

  it("finds or creates a named list, and dates a before-day onto those items", () => {
    const created = ingestIncoming(sim("before elijah gets home:\nclean house\nclean couch"), NOW)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") return
    expect(created.reply).toMatch(/before elijah gets home: clean house and clean couch/)
    const list = useTaskStore.getState().lists.find((item) => item.name === "before elijah gets home")
    expect(list).toBeTruthy()
    const first = useTaskStore.getState().tasks.filter((task) => task.lists?.includes(list!.id))
    expect(first.map((task) => task.description).sort()).toEqual(["clean couch", "clean house"])

    const more = ingestIncoming(sim("before 9/30:\nbefore elijah gets home:\nset the table"), NOW)
    expect(more.status).toBe("ok")
    const table = useTaskStore.getState().tasks.find((task) => task.description === "set the table")
    expect(table?.lists).toContain(list!.id)
    expect(sameCalendarDay(table?.deadline, new Date(2026, 8, 30))).toBe(true)
    expect(sameCalendarDay(table?.schedulingConstraints?.mustBeDoneBefore, new Date(2026, 8, 30))).toBe(true)
    expect(useTaskStore.getState().lists.filter((item) => item.name === "before elijah gets home")).toHaveLength(1)

    const rolled = ingestIncoming(sim("before 9/12:\nbefore elijah gets home:\nwrap the gift"), NOW)
    const gift = useTaskStore.getState().tasks.find((task) => task.description === "wrap the gift")
    expect(sameCalendarDay(gift?.deadline, new Date(2027, 8, 12))).toBe(true)
    expect(rolled.status).toBe("ok")
    if (rolled.status === "ok") expect(rolled.reply).toMatch(/due 9\/12\/2027/)
  })

  it("leaves a header-less note in the inbox", () => {
    const result = ingestIncoming(sim("clean house\nclean couch"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.kind).toBe("capture")
    const task = useTaskStore.getState().tasks.find((item) => item.stage === "inbox")
    expect(task?.description).toMatch(/clean house/)
  })

  it("paints gps: onto the location grid and stays quiet when still there", () => {
    const first = ingestIncoming(sim("gps: Home\n37.77,-122.42"), NOW)
    expect(first.status).toBe("ok")
    const date = formatLocalDateKey(NOW)
    expect(useTimeTrackingStore.getState().entriesFor(date, "location").length).toBeGreaterThan(0)
    const again = ingestIncoming(sim("gps: Home\n37.77,-122.42"), NOW)
    expect(again.status).toBe("ignored")
  })

  it("keeps gps tracking points off the message ingest log", () => {
    ingestIncoming(sim("gps: Home\n37.77,-122.42"), NOW)
    ingestIncoming(sim("gps: Home\n37.77,-122.42"), NOW)
    expect(useIngestStore.getState().events.some((event) => event.kind === "gps")).toBe(false)
    expect(useGpsIngestLog.getState().events).toHaveLength(2)
    ingestIncoming(sim("pick up milk"), NOW)
    expect(useIngestStore.getState().events[0]?.kind).toBe("capture")
    expect(useIngestStore.getState().events[0]?.raw).toMatch(/pick up milk/)
  })

  it("still logs a gps message that failed", () => {
    const result = ingestIncoming(sim("gps:"), NOW)
    expect(result.status).toBe("error")
    expect(useIngestStore.getState().events[0]?.kind).toBe("gps")
    expect(useIngestStore.getState().events[0]?.status).toBe("error")
    expect(useGpsIngestLog.getState().events).toHaveLength(0)
  })

  it("keeps Now prose as Now capture and leaves bare now as status", () => {
    const prose = ingestIncoming(sim("Now been putting laundry away…"), NOW)
    expect(prose.kind).toBe("now-capture")
    expect(prose.status).toBe("ok")
    if (prose.status === "ok") expect(prose.reply).toMatch(/been putting laundry away/)
    const pen = useTimeTrackingStore
      .getState()
      .scopes.find((scope) => scope.id === "activity")
      ?.pens.find((row) => /laundry/i.test(row.name))
    expect(pen).toBeTruthy()
    const bare = ingestIncoming(sim("now"), NOW)
    expect(bare.kind).toBe("status")
    expect(ingestIncoming(sim("status"), NOW).kind).toBe("status")
    expect(ingestIncoming(sim("where"), NOW).kind).toBe("status")
  })

  it("does not log Start outfit store as the grocery store activity", () => {
    useTimeTrackingStore.getState().addPen("activity", { name: "grocery store", color: "#888888" })
    const result = ingestIncoming(sim("Start outfit store?"), NOW)
    expect(result.status).toBe("needs_clarify")
    expect(result.reply ?? "").not.toMatch(/Started|Working on grocery store/i)
    const painted = useTimeTrackingStore.getState().entries.some((entry) => {
      const pen = useTimeTrackingStore
        .getState()
        .scopes.find((scope) => scope.id === entry.scopeId)
        ?.pens.find((row) => row.id === entry.penId)
      return pen?.name === "grocery store" && entry.date === formatLocalDateKey(NOW)
    })
    expect(painted).toBe(false)
  })

  it("leaves Got back from walk alone and still checks off a real line", () => {
    const prose = ingestIncoming(sim("Got back from walk"), NOW)
    expect(prose.kind).toBe("capture")
    expect(prose.status).toBe("ok")
    if (prose.status === "ok") {
      expect(prose.reply).toMatch(/Got back from walk/)
      expect(prose.summary).not.toMatch(/Missed/)
    }
    ingestIncoming(sim("groc milk"), NOW)
    const colon = ingestIncoming(sim("got: milk"), NOW)
    expect(colon.kind).toBe("bought")
    expect(useTaskStore.getState().tasks.find((t) => t.description === "milk")?.completed).toBe(true)
    ingestIncoming(sim("groc oats"), NOW)
    const loose = ingestIncoming(sim("got oats"), NOW)
    expect(loose.kind).toBe("bought")
    expect(useTaskStore.getState().tasks.find((t) => t.description === "oats")?.completed).toBe(true)
    const bought = ingestIncoming(sim("bought: eggs"), NOW)
    expect(bought.kind).toBe("bought")
  })

  it("uses the Settings grocery list, counts other shopping lists, and dumps store", () => {
    useIngestStore.setState({ shortcuts: {} })
    ingestIncoming(sim("bulk:\nGrocery list:\nmilk"), NOW)
    ingestIncoming(sim("bulk:\nShopping list:\napples\npears"), NOW)
    const grocery = useTaskStore.getState().lists.find((list) => list.name === "Grocery list")
    const shopping = useTaskStore.getState().lists.find((list) => list.name === "Shopping list")
    expect(grocery?.id).toBeTruthy()
    useIngestStore.getState().setGroceryListId(grocery!.id)
    const dumped = ingestIncoming(sim("groc"), NOW)
    expect(dumped.status).toBe("ok")
    if (dumped.status === "ok") {
      expect(dumped.reply).toMatch(/milk/)
      expect(dumped.reply).toMatch(/Shopping list/)
      expect(dumped.pinText).toBe(dumped.reply)
    }
    const viaStore = ingestIncoming(sim("store"), NOW)
    expect(viaStore.kind).toBe("grocery")
    expect(viaStore.status).toBe("ok")
    if (viaStore.status === "ok") {
      expect(viaStore.pinText).toBe(viaStore.reply)
      expect(viaStore.pinText).toMatch(/milk/)
    }
    useIngestStore.getState().setGroceryListId(shopping!.id)
    const switched = ingestIncoming(sim("groc"), NOW)
    expect(switched.status).toBe("ok")
    if (switched.status === "ok") expect(switched.reply).toMatch(/apples/)
  })

  it("checks off a reply to the grocery pin and leaves other replies as inbox", () => {
    ingestIncoming(sim("groc milk"), NOW)
    ingestIncoming(sim("groc oats"), NOW)
    useIngestStore.getState().setLivePin("grocery", {
      chatId: "sim",
      messageId: 42,
      kind: "grocery",
      at: NOW.toISOString(),
    })
    const checked = ingestIncoming({ ...sim("milk"), replyToMessageId: 42 }, NOW)
    expect(checked.kind).toBe("bought")
    expect(useTaskStore.getState().tasks.find((task) => task.description === "milk")?.completed).toBe(true)
    const other = ingestIncoming({ ...sim("oats"), replyToMessageId: 7 }, NOW)
    expect(other.kind).toBe("capture")
    expect(useTaskStore.getState().tasks.find((task) => task.description === "oats")?.completed).toBeFalsy()
    const sentence = ingestIncoming(sim("Got back from walk"), NOW)
    expect(sentence.kind).toBe("capture")
    const verb = ingestIncoming({ ...sim("help"), replyToMessageId: 42 }, NOW)
    expect(verb.kind).toBe("help")
  })

  it("routes a reply to the to-do pin and leaves other sentences alone", () => {
    const pinned = ingestIncoming(sim("pin todo"), NOW)
    expect(pinned.kind).toBe("pin")
    if (pinned.status === "ok") {
      expect(pinned.pinKind).toBe("todo")
      expect(pinned.pinText).toBe(pinned.reply)
    }
    ingestIncoming(sim("to do today: mail the form"), NOW)
    useIngestStore.getState().setLivePin("todo", {
      chatId: "sim",
      messageId: 77,
      kind: "todo",
      at: NOW.toISOString(),
    })
    const added = ingestIncoming({ ...sim("file taxes"), replyToMessageId: 77 }, NOW)
    expect(added.kind).toBe("todo-today")
    expect(useTaskStore.getState().tasks.some((task) => task.description === "file taxes")).toBe(true)
    const sentence = ingestIncoming(sim("file taxes later"), NOW)
    expect(sentence.kind).toBe("capture")
    const otherPin = ingestIncoming({ ...sim("call the bank"), replyToMessageId: 42 }, NOW)
    expect(otherPin.kind).toBe("capture")
    const bank = useTaskStore.getState().tasks.find((task) => task.description === "call the bank")
    expect(bank?.stage).toBe("inbox")
    expect(bank?.completed).toBeFalsy()
    const bareNumber = ingestIncoming(sim("2"), NOW)
    expect(bareNumber.kind).toBe("quicklists")
  })

  it("opens quicklists and a bare number, and does not steal list phrases", () => {
    ingestIncoming(sim("groc milk"), NOW)
    const menu = ingestIncoming(sim("/quicklists"), NOW)
    expect(menu.kind).toBe("quicklists")
    expect(menu.status).toBe("ok")
    if (menu.status === "ok") {
      expect(menu.reply).toMatch(/1\. To do today/)
      expect(menu.reply).toMatch(/2\. To do this week/)
      expect(menu.reply).toMatch(/3\. To do this month/)
      expect(menu.reply).toMatch(/4\. Next actions/)
      expect(menu.reply).toMatch(/5\. Grocery/)
      expect(menu.reply).toMatch(/7\. ISO/)
      expect(menu.reply).toMatch(/8\. Undone habits/)
    }
    const today = ingestIncoming(sim("1"), NOW)
    expect(today.kind).toBe("quicklists")
    if (today.status === "ok") expect(today.reply).toMatch(/To do today/)
    const grocery = ingestIncoming(sim("5"), NOW)
    expect(grocery.status).toBe("ok")
    if (grocery.status === "ok") expect(grocery.reply).toMatch(/milk/)
    const habits = ingestIncoming(sim("8"), NOW)
    expect(habits.status).toBe("ok")
    if (habits.status === "ok") expect(habits.reply).toMatch(/Drink water/)
    for (const phrase of ["grocery list", "grocery store", "to do list", "to-do list"]) {
      const result = ingestIncoming(sim(phrase), NOW)
      expect(result.kind).toBe("capture")
      if (result.status === "ok") expect(result.reply).toMatch(new RegExp(phrase.replace("-", "\\-"), "i"))
    }
  })

  it("leaves bare text, call, did, and add as inbox and keeps the colon forms", () => {
    const text = ingestIncoming(sim("Text shelby back"), NOW)
    expect(text.kind).toBe("capture")
    if (text.status === "ok") expect(text.reply).toMatch(/Text shelby back/)
    const call = ingestIncoming(sim("call gran points-100"), NOW)
    expect(call.kind).toBe("capture")
    if (call.status === "ok") expect(call.reply).toMatch(/call gran points-100/)
    const did = ingestIncoming(sim("did finally get into colder room (took 30 min)"), NOW)
    expect(did.kind).toBe("capture")
    expect(did.status).not.toBe("needs_clarify")
    const add = ingestIncoming(sim("Add more backslash cmds?…"), NOW)
    expect(add.kind).toBe("capture")
    if (add.status === "ok") expect(add.reply).toMatch(/Add more backslash cmds/)
    expect(ingestIncoming(sim("text: Jane on my way"), NOW).kind).toBe("iphone-text")
    expect(ingestIncoming(sim("call: Jane 12m"), NOW).kind).toBe("iphone-call")
    expect(ingestIncoming(sim("sent: Jane hi"), NOW).kind).toBe("iphone-text")
    expect(ingestIncoming(sim("called: Mom 3m"), NOW).kind).toBe("iphone-call")
    expect(ingestIncoming(sim("did: Drink water"), NOW).kind).toBe("habit")
    expect(ingestIncoming(sim("add: pick up milk"), NOW).kind).toBe("capture")
    const added = useTaskStore.getState().tasks.find((t) => t.description === "pick up milk")
    expect(added?.description).toBe("pick up milk")
  })

  it("keeps an unpaired gps refusal on the ingest log", () => {
    const result = ingestIncoming(tg("gps: Home\n37.77,-122.42"), NOW)
    expect(result.status).toBe("ignored")
    expect(useIngestStore.getState().events[0]?.summary).toBe(UNPAIRED_SUMMARY)
    expect(useGpsIngestLog.getState().events).toHaveLength(0)
  })
})
