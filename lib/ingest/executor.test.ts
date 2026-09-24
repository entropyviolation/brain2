import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ingestIncoming } from "./executor"
import { resetIphoneNoteContinuations } from "./apply-iphone-notes"
import { generatePairingCode } from "./pairing"
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
import { TaskType } from "@/lib/types"
import { DEFAULT_DISCRETE_EVENT_TRIGGERS } from "./text-triggers"
import { resetIngestDedupeForTests } from "./dedupe"
import type { IncomingMessage } from "./types"

const NOW = new Date(2026, 8, 19, 17, 42, 0)

function sim(text: string): IncomingMessage {
  return {
    source: { channel: "simulate", chatId: "sim" },
    text,
    receivedAt: NOW.toISOString(),
  }
}

function tg(text: string, chatId = "99"): IncomingMessage {
  return {
    source: { channel: "telegram", chatId, userId: chatId },
    text,
    receivedAt: NOW.toISOString(),
  }
}

describe("ingestIncoming", () => {
  beforeEach(() => {
    resetAllStores()
    resetIphoneNoteContinuations()
    resetIngestDedupeForTests()
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

  it("notes the live activity block", () => {
    ingestIncoming(sim("track: work"), NOW)
    const result = ingestIncoming(sim("n stuck in aisle 4"), NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/stuck in aisle 4/)
    const notes = useTimeTrackingStore
      .getState()
      .entries.some((entry) => entry.notes?.includes("stuck in aisle 4"))
    expect(notes).toBe(true)
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
    const hemi = ingestIncoming(sim("hemisync"), NOW)
    expect(hemi.status).toBe("ok")
    expect(hemi.kind).toBe("habit-trigger")
    const buried = ingestIncoming(sim("remember hemisync tonight"), NOW)
    expect(buried.kind).toBe("capture")
    const pages = ingestIncoming(sim("read 30 pages"), NOW)
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
})
