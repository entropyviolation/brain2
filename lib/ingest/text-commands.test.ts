/**
 * lib/ingest/text-commands.test.ts — Send time, dh:, log, intake, switches
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore, getDefaultHabits } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType } from "@/lib/types"
import { clearOpenLogStarts } from "./apply-discrete-event"
import { resetIngestDedupeForTests } from "./dedupe"
import { ingestIncoming } from "./executor"
import { isIndexListLine, parseIndexListLine } from "./index-list"
import { compareSentOrder, messageSentAt } from "./message-time"
import { getDayNoteEntries } from "@/lib/day-notes-persist"
import { isInstant } from "@/lib/time-entries"
import { readCycleMarks } from "@/lib/cycle-marks"
import { parseIntakePayload, parseLogPayload, parseSwitchPayload } from "./parse-tracking-note"
import { parseMessage } from "./parse-message"
import type { IncomingMessage } from "./types"

const SENT = new Date(2026, 8, 23, 15, 0, 0)
const PROCESSED = new Date(2026, 8, 23, 18, 45, 0)

function sim(text: string, receivedAt = SENT): IncomingMessage {
  return {
    text,
    source: { channel: "simulate", chatId: "sim", isGroup: false },
    receivedAt: receivedAt.toISOString(),
  }
}

beforeEach(() => {
  resetAllStores()
  resetIngestDedupeForTests()
  clearOpenLogStarts()
  useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
})

describe("send time", () => {
  it("prefers message.date over the clock when the poller runs", () => {
    expect(messageSentAt(sim("hi", SENT), PROCESSED).getTime()).toBe(SENT.getTime())
    expect(messageSentAt({ receivedAt: "" }, PROCESSED).getTime()).toBe(PROCESSED.getTime())
  })

  it("orders a backlog by send time, then message id", () => {
    const later = { receivedAt: PROCESSED.toISOString(), telegramMessageId: 1 }
    const earlier = { receivedAt: SENT.toISOString(), telegramMessageId: 9 }
    expect(compareSentOrder(earlier, later)).toBeLessThan(0)
    expect(compareSentOrder({ receivedAt: SENT.toISOString(), telegramMessageId: 2 }, { receivedAt: SENT.toISOString(), telegramMessageId: 8 })).toBeLessThan(0)
  })

  it("stamps an inbox capture and a log with the send time", () => {
    ingestIncoming(sim("buy oats"), PROCESSED)
    const task = useTaskStore.getState().tasks.find((row) => row.description === "buy oats")
    expect(task?.createdAt).toEqual(SENT)

    ingestIncoming(sim("log: left home"), PROCESSED)
    const entry = useTimeTrackingStore.getState().entries.find((row) => row.title === "left home")
    expect(entry?.kind).toBe("instant")
    expect(entry?.date).toBe(formatLocalDateKey(SENT))
    expect(entry?.startMin).toBe(15 * 60)
    expect(entry?.startMin).not.toBe(18 * 60 + 45)
  })
})

describe("index lines", () => {
  it("splits only a line that is numbers and commas", () => {
    expect(isIndexListLine("1,8")).toBe(true)
    expect(isIndexListLine("1, 8")).toBe(true)
    expect(parseIndexListLine("1, 8", 10)).toEqual([1, 8])
    expect(isIndexListLine("1")).toBe(true)
    expect(isIndexListLine("buy milk, eggs")).toBe(false)
    expect(isIndexListLine("1 8")).toBe(false)
    expect(parseIndexListLine("buy milk, eggs", 10)).toEqual([])
  })
})

describe("log intake switch transit", () => {
  it("parses the log examples", () => {
    const at = parseLogPayload("left home at 3:30", SENT)
    expect(at).toMatchObject({ shape: "point", title: "left home" })
    if (at?.shape === "point") expect(at.at.getHours()).toBe(3)
    expect(at && at.shape === "point" && at.at.getMinutes()).toBe(30)

    const note = parseLogPayload("left home / leaving home", SENT)
    expect(note).toMatchObject({ shape: "point", title: "left home / leaving home" })
    if (note?.shape === "point") expect(note.at.getTime()).toBe(SENT.getTime())

    const withNote = parseLogPayload("left home at 3:30\nforgot keys", SENT)
    expect(withNote).toMatchObject({ shape: "point", title: "left home", note: "forgot keys" })
    if (withNote?.shape === "point") expect(withNote.at.getHours()).toBe(3)

    const ranged = parseLogPayload("shower 7:30 - 7:45\ncold", SENT)
    expect(ranged).toMatchObject({ shape: "range", title: "shower", note: "cold" })

    const range = parseLogPayload("shower 7:30 - 7:45", SENT)
    expect(range).toMatchObject({ shape: "range", title: "shower" })
    if (range?.shape === "range") {
      expect(range.start.getHours()).toBe(7)
      expect(range.start.getMinutes()).toBe(30)
      expect(range.end.getMinutes()).toBe(45)
    }

    const finished = parseLogPayload("shower 10m", SENT)
    expect(finished?.shape).toBe("range")
    if (finished?.shape === "range") {
      expect(finished.end.getTime()).toBe(SENT.getTime())
      expect(finished.start.getTime()).toBe(SENT.getTime() - 10 * 60_000)
    }

    expect(parseLogPayload("START walk", SENT)).toMatchObject({ shape: "start", title: "walk" })
    const started = parseLogPayload("START walk 3:00", SENT)
    expect(started).toMatchObject({ shape: "start", title: "walk" })
    if (started?.shape === "start") expect(started.at.getHours()).toBe(3)
    const ended = parseLogPayload("END walk 5:00", SENT)
    expect(ended).toMatchObject({ shape: "end", title: "walk" })
    if (ended?.shape === "end") expect(ended.at.getHours()).toBe(5)
  })

  it("parses intake as a point and does not invent a duration", () => {
    const dab = parseIntakePayload("1 dab dab pen", SENT)
    expect(dab).toMatchObject({ shape: "point", title: "1 dab dab pen" })
    if (dab) expect(dab.at.getTime()).toBe(SENT.getTime())
    const dinner = parseIntakePayload("a delicious dinner from anime i got chicken so good", SENT)
    expect(dinner?.title).toMatch(/delicious dinner/)
    expect(dinner?.shape).toBe("point")
    const timed = parseIntakePayload("coffee at 8:15", SENT)
    if (timed) expect(timed.at.getHours()).toBe(8)
    const withUnit = parseIntakePayload("tea 10m", SENT)
    expect(withUnit?.title).toBe("tea 10m")
    expect(withUnit?.shape).toBe("point")
  })

  it("parses switch and transit from/to", () => {
    const task = parseSwitchPayload("from: talking to elijah to: cleaning up the living room a bit", SENT)
    expect(task).toEqual({
      from: "talking to elijah",
      to: "cleaning up the living room a bit",
      at: SENT,
    })
    const objective = parseSwitchPayload("get living room into a decent state", SENT)
    expect(objective).toMatchObject({ to: "get living room into a decent state" })
    expect(objective?.from).toBeUndefined()
    const transit = parseSwitchPayload("the store", SENT)
    expect(transit).toMatchObject({ to: "the store" })
  })

  it("saves log, intake, and switches on the activity scope", () => {
    expect(parseMessage("Log: left home at 3:30").kind).toBe("event-log")
    expect(parseMessage("INTAKE: coffee").kind).toBe("intake")
    expect(parseMessage("ST: cleaning").kind).toBe("switch-task")
    expect(parseMessage("Dh: hemisync").kind).toBe("habit-trigger")

    const logged = ingestIncoming(sim("log: shower 7:30 - 7:45"), PROCESSED)
    expect(logged.status).toBe("ok")
    const shower = useTimeTrackingStore.getState().entries.find((row) => row.title === "shower")
    expect(shower?.kind).not.toBe("instant")
    expect(shower?.startMin).toBe(7 * 60 + 30)
    expect(shower?.endMin).toBe(7 * 60 + 45)

    const intake = ingestIncoming(sim("intake: 1 dab dab pen"), PROCESSED)
    expect(intake.status).toBe("ok")
    const dab = useTimeTrackingStore.getState().entries.find((row) => row.title === "1 dab dab pen")
    expect(dab?.kind).toBe("instant")
    expect(dab?.startMin).toBe(15 * 60)

    ingestIncoming(sim("log: START walk 3:00"), PROCESSED)
    const ended = ingestIncoming(sim("log: END walk 5:00"), PROCESSED)
    expect(ended.status).toBe("ok")
    if (ended.status === "ok") expect(ended.reply).toMatch(/3:00 AM.+5:00 AM/)
    const walk = useTimeTrackingStore.getState().entries.find((row) => row.title === "walk")
    expect(walk?.startMin).toBe(3 * 60)
    expect(walk?.endMin).toBe(5 * 60)
    expect(useTimeTrackingStore.getState().entries.some((row) => row.title === "START walk")).toBe(false)

    const switched = ingestIncoming(
      sim("st: from: talking to elijah to: cleaning up the living room a bit"),
      PROCESSED,
    )
    expect(switched.status).toBe("ok")
    if (switched.status === "ok") expect(switched.reply).toMatch(/stopped talking to elijah/)
    expect(switched.reply).toMatch(/started cleaning up the living room a bit/)

    const objective = ingestIncoming(sim("so: get living room into a decent state"), PROCESSED)
    expect(objective.status).toBe("ok")
    const goal = useTimeTrackingStore.getState().entries.find((row) => /objective get living room/i.test(row.title || ""))
    expect(goal?.kind).toBe("instant")

    const moved = ingestIncoming(sim("transit: from: home to: the store"), PROCESSED)
    expect(moved.status).toBe("ok")
    expect(useTimeTrackingStore.getState().entries.some((row) => /arrived the store/i.test(row.title || ""))).toBe(true)
  })

  it("keeps the clock and stores a following note line", () => {
    const logged = ingestIncoming(sim("log: left home at 3:30\nforgot keys"), PROCESSED)
    expect(logged.status).toBe("ok")
    const left = useTimeTrackingStore.getState().entries.find((row) => row.title === "left home")
    expect(left?.kind).toBe("instant")
    expect(left?.startMin).toBe(3 * 60 + 30)
    expect(left?.notes).toMatch(/forgot keys/)
    expect(left?.notes).toMatch(/from text pipeline/)

    const ranged = ingestIncoming(sim("log: shower 7:30 - 7:45\ncold"), PROCESSED)
    expect(ranged.status).toBe("ok")
    const shower = useTimeTrackingStore.getState().entries.find((row) => row.title === "shower")
    expect(shower?.kind).not.toBe("instant")
    expect(shower?.startMin).toBe(7 * 60 + 30)
    expect(shower?.endMin).toBe(7 * 60 + 45)
    expect(shower?.notes).toMatch(/cold/)

    const intake = ingestIncoming(sim("intake: coffee at 8:15\noat milk"), PROCESSED)
    expect(intake.status).toBe("ok")
    const coffee = useTimeTrackingStore.getState().entries.find((row) => row.title === "coffee")
    expect(coffee?.kind).toBe("instant")
    expect(coffee?.startMin).toBe(8 * 60 + 15)
    expect(coffee?.notes).toMatch(/oat milk/)

    expect(ingestIncoming(sim("log:"), PROCESSED).status).toBe("error")
    expect(ingestIncoming(sim("log:\n\n"), PROCESSED).status).toBe("error")
    expect(useTimeTrackingStore.getState().entries.some((row) => !row.title)).toBe(false)
  })

  it("keeps a logged point when a duration block is painted over that minute", () => {
    ingestIncoming(sim("log: drink water"), PROCESSED)
    const date = formatLocalDateKey(SENT)
    const tick = useTimeTrackingStore.getState().entries.find((row) => row.title === "drink water")
    expect(tick?.kind).toBe("instant")
    expect(tick?.startMin).toBe(15 * 60)
    useTimeTrackingStore.getState().paintMinutes(date, "activity", 14 * 60, 16 * 60, "act-work")
    const entries = useTimeTrackingStore.getState().entries.filter((row) => row.date === date && row.scopeId === "activity")
    const still = entries.find((row) => row.id === tick?.id)
    expect(still && isInstant(still)).toBe(true)
    expect(entries.some((row) => !isInstant(row) && row.startMin === 14 * 60 && row.endMin === 16 * 60)).toBe(true)
  })

  it("saves a telegram note as a discrete event, and a day jot as a day note", () => {
    const noted = ingestIncoming(sim("n stuck\nin aisle 4"), PROCESSED)
    expect(noted.status).toBe("ok")
    const tick = useTimeTrackingStore.getState().entries.find((row) => row.kind === "instant" && row.title === "stuck")
    expect(tick?.startMin).toBe(15 * 60)
    expect(tick?.notes).toMatch(/in aisle 4/)
    expect(getDayNoteEntries(formatLocalDateKey(SENT))).toHaveLength(0)

    const day = ingestIncoming(sim("day: tired"), PROCESSED)
    expect(day.status).toBe("ok")
    expect(getDayNoteEntries(formatLocalDateKey(SENT)).some((row) => /tired/.test(row.text))).toBe(true)
    expect(useTimeTrackingStore.getState().entries.filter((row) => row.title === "tired")).toHaveLength(0)
  })

  it("requires dh: before a habit keyword", () => {
    useHabitsStore.setState({
      tasks: [{ id: "h-hemi", name: "Hemisync", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }],
      weeklyData: {},
    })
    expect(ingestIncoming(sim("hemisync"), PROCESSED).kind).toBe("capture")
    expect(ingestIncoming(sim("dh: hemisync"), PROCESSED).kind).toBe("habit-trigger")
    expect(ingestIncoming(sim("DH: hemisync"), PROCESSED).kind).toBe("habit-trigger")
  })

  it("does not treat a walkthrough answer as a log", () => {
    const opened = ingestIncoming(sim("gn"), PROCESSED)
    expect(opened.status).toBe("needs_clarify")
    const answer = ingestIncoming(sim("log: shower"), PROCESSED)
    expect(answer.kind).not.toBe("event-log")
    expect(useTimeTrackingStore.getState().entries.some((row) => /shower/i.test(row.title || ""))).toBe(false)
    expect(answer.reply ?? "").not.toMatch(/^Logged:/)
  })

  it("stores intake class, event kind, and clock certainty without changing pens", () => {
    const bare = ingestIncoming(sim("intake: coffee"), PROCESSED)
    expect(bare.status).toBe("ok")
    const coffee = useTimeTrackingStore.getState().entries.find((row) => row.title === "coffee")
    expect(coffee?.eventKind).toBe("intake")
    expect(coffee?.intakeClass).toBeUndefined()
    expect(coffee?.clockCertainty).toBeUndefined()
    expect(penName(coffee?.penId)).toBe("Intake")

    const drink = ingestIncoming(sim("intake drink: coffee at 8:15 est"), PROCESSED)
    expect(drink.status).toBe("ok")
    const timed = useTimeTrackingStore.getState().entries.find((row) => row.title === "coffee" && row.startMin === 8 * 60 + 15)
    expect(timed).toMatchObject({
      intakeClass: "drink",
      eventKind: "intake.drink",
      clockCertainty: "estimated",
      precision: "estimated",
      kind: "instant",
    })
    expect(penName(timed?.penId)).toBe("Intake")

    const unknown = ingestIncoming(sim("intake food: egg salad unknown"), PROCESSED)
    expect(unknown.status).toBe("ok")
    const eggs = useTimeTrackingStore.getState().entries.find((row) => row.title === "egg salad")
    expect(eggs).toMatchObject({
      intakeClass: "food",
      eventKind: "intake.food",
      clockCertainty: "unknown",
      startMin: 15 * 60,
    })
    expect(eggs?.precision).toBeUndefined()

    const logged = ingestIncoming(sim("log: Left  Room! at ~3:30"), PROCESSED)
    expect(logged.status).toBe("ok")
    const left = useTimeTrackingStore.getState().entries.find((row) => row.title === "Left  Room!")
    expect(left).toMatchObject({
      eventKind: "left room",
      clockCertainty: "estimated",
      precision: "estimated",
      startMin: 3 * 60 + 30,
      kind: "instant",
    })
    expect(penName(left?.penId)).toBe("Text log")

    const placed = ingestIncoming(sim("log: left room at 4:00 unknown"), PROCESSED)
    expect(placed.status).toBe("ok")
    const unknownLog = useTimeTrackingStore.getState().entries.find((row) => row.title === "left room")
    expect(unknownLog).toMatchObject({ eventKind: "left room", clockCertainty: "unknown", startMin: 4 * 60 })
    expect(unknownLog?.precision).toBeUndefined()
  })

  it("round-trips each composer mode onto the same stored fields", () => {
    expect(parseLogPayload("left room at 3:30 est loc: home", SENT)).toMatchObject({
      shape: "point",
      title: "left room",
      location: "home",
      clockCertainty: "estimated",
    })
    expect(parseLogPayload("left room at 3:30 loc: home est", SENT)).toMatchObject({
      title: "left room",
      location: "home",
      clockCertainty: "estimated",
    })
    expect(parseSwitchPayload("cleaning at 4:00 est", SENT)).toMatchObject({
      to: "cleaning",
      clockCertainty: "estimated",
    })

    const logged = ingestIncoming(sim("log: left room at 3:30 est loc: home"), PROCESSED)
    expect(logged.status).toBe("ok")
    const left = useTimeTrackingStore.getState().entries.find((row) => row.title === "left room" && row.startMin === 3 * 60 + 30)
    expect(left).toMatchObject({
      eventKind: "left room",
      clockCertainty: "estimated",
      precision: "estimated",
      kind: "instant",
    })
    expect(penName(left?.penId)).toBe("Text log")
    const place = useTimeTrackingStore
      .getState()
      .entries.find((row) => row.scopeId === "location" && row.kind === "instant" && row.penId === "loc-home" && row.startMin === 3 * 60 + 30)
    expect(place).toMatchObject({ clockCertainty: "estimated", precision: "estimated" })

    const named = ingestIncoming(sim("log: left room loc: kitchen"), PROCESSED)
    expect(named.status).toBe("ok")
    const location = useTimeTrackingStore.getState().scopes.find((row) => row.id === "location")
    const kitchen = location?.pens.find((pen) => pen.name === "kitchen")
    expect(kitchen).toBeTruthy()
    const kitchenTick = useTimeTrackingStore
      .getState()
      .entries.find((row) => row.scopeId === "location" && row.penId === kitchen?.id && row.kind === "instant")
    expect(kitchenTick?.startMin).toBe(15 * 60)

    const task = ingestIncoming(sim("switch task: cleaning at 4:00 est"), PROCESSED)
    expect(task.status).toBe("ok")
    const started = useTimeTrackingStore.getState().entries.find((row) => row.title === "started cleaning")
    expect(started).toMatchObject({
      clockCertainty: "estimated",
      precision: "estimated",
      startMin: 4 * 60,
      kind: "instant",
    })
    expect(started?.eventKind).toBeUndefined()
    expect(penName(started?.penId)).toBe("Switch")

    const goal = ingestIncoming(sim("switch goal: read at 8:00 unknown"), PROCESSED)
    expect(goal.status).toBe("ok")
    const objective = useTimeTrackingStore.getState().entries.find((row) => row.title === "objective read")
    expect(objective).toMatchObject({ clockCertainty: "unknown", startMin: 8 * 60, kind: "instant" })
    expect(objective?.precision).toBeUndefined()
    expect(objective?.eventKind).toBeUndefined()
    expect(penName(objective?.penId)).toBe("Objective")

    const noted = ingestIncoming(sim("note: left room at 8:15 est"), PROCESSED)
    expect(noted.status).toBe("ok")
    const note = useTimeTrackingStore.getState().entries.find((row) => row.title === "left room" && row.startMin === 8 * 60 + 15)
    expect(note).toMatchObject({ clockCertainty: "estimated", precision: "estimated", kind: "instant" })
    expect(note?.eventKind).toBeUndefined()
    expect(penName(note?.penId)).toBe("Text log")
    expect(getDayNoteEntries(formatLocalDateKey(SENT))).toEqual([])

    expect(parseMessage("switch goal read").kind).toBe("capture")
    expect(parseMessage("so: read").kind).toBe("switch-objective")
  })

  it("maps ate, drank, and took onto intake class and keeps the text log pen", () => {
    ingestIncoming(sim("ate egg salad"), PROCESSED)
    ingestIncoming(sim("drank water"), PROCESSED)
    ingestIncoming(sim("took tablet"), PROCESSED)
    ingestIncoming(sim("smoked weed"), PROCESSED)
    const rows = useTimeTrackingStore.getState().entries
    const ate = rows.find((row) => row.title === "ate egg salad")
    const drank = rows.find((row) => row.title === "drank water")
    const took = rows.find((row) => row.title === "took tablet")
    const smoked = rows.find((row) => row.title === "smoked weed")
    expect(ate).toMatchObject({ intakeClass: "food", eventKind: "intake.food" })
    expect(drank).toMatchObject({ intakeClass: "drink", eventKind: "intake.drink" })
    expect(took).toMatchObject({ intakeClass: "drug", eventKind: "intake.drug" })
    expect(penName(ate?.penId)).toBe("Text log")
    expect(penName(drank?.penId)).toBe("Text log")
    expect(penName(took?.penId)).toBe("Text log")
    expect(smoked?.intakeClass).toBeUndefined()
    expect(penName(smoked?.penId)).toBe("Text log")
  })

  it("sets and clears a cycle flag on the send date", () => {
    const on = ingestIncoming(sim("cycle: bleeding"), PROCESSED)
    expect(on.status).toBe("ok")
    const date = formatLocalDateKey(SENT)
    expect(readCycleMarks()[date]).toEqual({ date, bleeding: true })
    const off = ingestIncoming(sim("cycle: bleeding off"), PROCESSED)
    expect(off.status).toBe("ok")
    expect(readCycleMarks()[date]).toBeUndefined()
    expect(ingestIncoming(sim("cycle: spotting"), PROCESSED).status).toBe("ok")
    expect(readCycleMarks()[date]).toEqual({ date, spotting: true })
    expect(ingestIncoming(sim("cycle: nope"), PROCESSED).status).toBe("error")
    expect(parseMessage("cycle bleeding").kind).toBe("capture")
  })
})

function penName(penId: string | undefined): string | undefined {
  if (!penId) return undefined
  for (const scope of useTimeTrackingStore.getState().scopes) {
    const pen = scope.pens.find((row) => row.id === penId)
    if (pen) return pen.name
  }
  return undefined
}
