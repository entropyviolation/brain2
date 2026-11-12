import { beforeEach, describe, expect, it } from "vitest"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { useFollowStore } from "@/lib/follow-through/store"
import { allSteps, emptyLedger } from "@/lib/follow-through/types"
import { looksLikeVerb } from "@/lib/ingest/parse-message"
import { sendToBim, useBimChatStore } from "@/lib/ingest/bim-chat"
import { useTaskStore } from "@/lib/task-store"
import { taskIsRequired, todoPeriodKey } from "@/lib/todo-commitment"
import { usePlanRunStore } from "../store"
import { fileDay, startDayRun } from "./apply"
import { nextAsk, readDayAnswer } from "./ask"
import { estimateFor, fromHistory, type PastRun } from "./estimate"
import { notesFromModel } from "./llm"
import { looksLikeDayPlan, readDay, wantsDayPlan } from "./read"
import { buildDayPlan, tryDay } from "./run"
import { layout } from "./schedule"
import { useDayPlanStore } from "./store"
import { tweakDay } from "./tweak"

const MSG =
  "what I have to do for the rest of the day: order hairdye and anything else from walmart (tights comes to mind) asap, dye hair, bleach eyebrows, shave legs, pack (my stuff and elijahs) and plan outfits, finish foxtide stuff, and plan ny, and read shelby text and reply. MUST be done is dye hair (and thus order hairdye) bleach eyebrows and pack, and text shelby. and then foxtide stuff and planning ny is important as well. "

const at = (h: number, m = 0) => {
  const d = new Date(2026, 10, 11, h, m, 0, 0)
  return d
}

beforeEach(() => {
  useDayPlanStore.setState({ plans: {}, order: [] })
  useFollowStore.setState(emptyLedger())
  usePlanRunStore.setState({ run: null })
  useBimChatStore.setState({ lines: [], busy: false })
})

describe("reading the day", () => {
  it("is a day plan, not a command, and ordinary lines are not", () => {
    expect(looksLikeDayPlan(MSG)).toBe(true)
    expect(looksLikeVerb(MSG)).toBe(false)
    expect(looksLikeDayPlan("today I need to buy milk, eggs, and bread")).toBe(false)
    expect(looksLikeDayPlan("had a coffee and took a nap today")).toBe(false)
    expect(looksLikeDayPlan("to do today: call mom, pack, shave")).toBe(false)
    expect(wantsDayPlan("help me plan the rest of my day")).toBe(true)
  })

  it("splits the list in the person's words", () => {
    const { items } = readDay(MSG)
    expect(items.map((i) => i.title)).toEqual([
      "order hairdye and anything else from walmart",
      "dye hair",
      "bleach eyebrows",
      "shave legs",
      "pack",
      "plan outfits",
      "finish foxtide stuff",
      "plan ny",
      "read shelby text and reply",
    ])
    const order = items[0]!
    expect(order.urgent).toBe(true)
    expect(order.note).toBe("tights comes to mind")
    expect(items[4]!.subtasks).toEqual(["my stuff", "elijahs"])
  })

  it("weighs them from the later sentences and links order before dye", () => {
    const { items } = readDay(MSG)
    const tier = Object.fromEntries(items.map((i) => [i.title, i.tier]))
    expect(tier).toEqual({
      "order hairdye and anything else from walmart": "must",
      "dye hair": "must",
      "bleach eyebrows": "must",
      "shave legs": "rest",
      pack: "must",
      "plan outfits": "rest",
      "finish foxtide stuff": "important",
      "plan ny": "important",
      "read shelby text and reply": "must",
    })
    expect(items[1]!.after).toBe(0)
  })
})

describe("estimates", () => {
  const past: PastRun[] = [
    { title: "Dye hair", minutes: 100, from: "To Do" },
    { title: "dye my hair", minutes: 120, from: "Tracking" },
    { title: "Pack for Portland", minutes: 70, from: "To Do" },
  ]
  it("uses your own history first and says so", () => {
    const e = fromHistory("dye hair", past)!
    expect(e.source).toBe("history")
    expect(e.minutes).toBe(110)
    expect(e.basis).toMatch(/2 times/)
    expect(estimateFor("pack", undefined, past).minutes).toBe(70)
  })
  it("falls back to a labelled rule of thumb, and your words win", () => {
    expect(estimateFor("bleach eyebrows", undefined, past)).toMatchObject({ source: "rule", minutes: 25 })
    expect(estimateFor("order hairdye and anything else from walmart", undefined, []).minutes).toBe(15)
    expect(estimateFor("stare at wall", undefined, []).source).toBe("default")
    expect(estimateFor("clean", 15, past)).toMatchObject({ source: "said", minutes: 15 })
  })
})

describe("the plan", () => {
  it("orders urgent and must first, keeps the wait, and says whether it fits", () => {
    const plan = buildDayPlan(MSG, at(15))!
    expect(plan.items[0]!.title).toMatch(/^order hairdye/)
    expect(plan.items[1]!.title).toBe("dye hair")
    expect(plan.items.slice(0, 5).every((i) => i.tier === "must")).toBe(true)
    expect(plan.items.at(-1)!.tier).toBe("rest")
    const lay = layout(plan, at(15))
    expect(lay.left).toBe(8 * 60)
    expect(lay.lines.join(" ")).toMatch(/It fits/)
    const late = layout(plan, at(20))
    expect(late.lines.join(" ")).toMatch(/does not all fit|do not fit/)
    expect(late.overflow).toContain("plan outfits")
  })

  it("takes changes in words", () => {
    let plan = buildDayPlan(MSG, at(15))!
    const step = (line: string) => {
      const tw = tweakDay(plan, line)
      expect(tw, line).not.toBeNull()
      plan = tw!.plan
      return tw!
    }
    step("pack will take 2 hours")
    expect(plan.items.find((i) => i.title === "pack")!.estimate).toMatchObject({ minutes: 120, source: "you" })
    step("drop shave legs")
    expect(plan.items.some((i) => i.title === "shave legs")).toBe(false)
    step("plan outfits is a must")
    expect(plan.items.find((i) => i.title === "plan outfits")!.tier).toBe("must")
    step("foxtide first")
    expect(plan.items[0]!.title).toBe("finish foxtide stuff")
    step("why dye hair: I want it fresh for New York")
    expect(plan.items.find((i) => i.title === "dye hair")!.why).toBe("I want it fresh for New York")
    step("also call mom")
    expect(plan.items.at(-1)!.title).toBe("call mom")
    step("until 11:30pm")
    expect(plan.until).toBe("23:30")
    expect(tweakDay(plan, "had a coffee")).toBeNull()
    expect(tweakDay(plan, "also I am hungry")).toBeNull()
    expect(tweakDay(plan, "done with work")).toBeNull()
    expect(tweakDay(plan, "done dye hair")?.act).toMatchObject({ kind: "done" })
  })

  it("asks for the reasons one at a time and keeps your words", () => {
    let plan = buildDayPlan(MSG, at(15))!
    const q1 = nextAsk(plan)!
    expect(q1.key).toBe("why")
    plan = { ...plan, asking: { itemId: q1.itemId, key: q1.key } }
    plan = readDayAnswer(plan, "so the color is set before the trip")!.plan
    expect(plan.items.find((i) => i.id === q1.itemId)!.why).toBe("so the color is set before the trip")
    const q2 = nextAsk(plan)!
    expect(q2).toMatchObject({ itemId: q1.itemId, key: "resistance" })
    plan = readDayAnswer({ ...plan, asking: { itemId: q2.itemId, key: q2.key } }, "resistance 3")!.plan
    expect(nextAsk(plan)!.key).toBe("blocker")
    const quiet = readDayAnswer({ ...plan, asking: { itemId: q2.itemId, key: "blocker" } }, "stop asking")!.plan
    expect(nextAsk(quiet)).toBeNull()
  })

  it("checks a model's answer before using it", () => {
    const plan = buildDayPlan(MSG, at(15), [{ title: "dye hair", minutes: 100, from: "To Do" }])!
    const dye = plan.items.findIndex((i) => i.title === "dye hair") + 1
    const brows = plan.items.findIndex((i) => i.title === "bleach eyebrows") + 1
    const notes = notesFromModel(
      {
        items: [
          { n: dye, minutes: 45, minutesWhy: "quick", why: "wants it done before New York", ifNot: "" },
          { n: brows, minutes: 20, minutesWhy: "apply and wait", why: "", ifNot: "" },
          { n: 99, minutes: 10, minutesWhy: "", why: "", ifNot: "" },
          { n: 3, minutes: 9000, minutesWhy: "", why: "", ifNot: "" },
        ],
        missed: [{ title: "buy tights", source: "tights comes to mind" }, { title: "wash car", source: "wash the car" }],
      },
      plan,
    )
    // History outranks the model; a rule of thumb does not.
    expect(notes.items[dye - 1]!.estimate).toMatchObject({ source: "history", minutes: 100 })
    expect(notes.items[dye - 1]!.guess?.why).toMatch(/New York/)
    expect(notes.items[brows - 1]!.estimate).toMatchObject({ source: "model", minutes: 20 })
    expect(notes.added).toEqual(["buy tights"])
    expect(notes.dropped.length).toBe(3)
  })
})

describe("in BIM chat, end to end", () => {
  it("writes nothing until filed, then files tasks, weights, reasons and the intention", async () => {
    const now = at(15)
    const before = useTaskStore.getState().tasks.length
    const reply = await tryDay(MSG, now, { llm: false })
    expect(reply?.dayId).toBeTruthy()
    expect(reply!.text).toMatch(/9 things/)
    expect(reply!.choices?.length).toBeGreaterThan(0)
    expect(useTaskStore.getState().tasks.length).toBe(before)
    expect(allSteps(useFollowStore.getState()).length).toBe(0)

    // The open question is answered in chat; a tweak is taken in chat.
    const answered = await tryDay("so it is fresh for the trip", now, { llm: false, lastBim: reply!.text })
    expect(answered?.text).toMatch(/Why .* matters: so it is fresh for the trip/)
    const tweaked = await tryDay("pack will take 90 min", now, { llm: false })
    expect(tweaked?.text).toMatch(/"pack" is now 1h 30m/)
    expect(await tryDay("had a coffee", now, { llm: false, lastBim: "something else." })).toBeNull()

    const id = reply!.dayId!
    const filed = fileDay(id, now)
    expect(filed.ok).toBe(true)
    const plan = useDayPlanStore.getState().plans[id]!
    const tasks = useTaskStore.getState().tasks
    expect(tasks.length).toBe(before + 9)
    const pack = tasks.find((t) => t.id === plan.items.find((i) => i.title === "pack")!.filedTaskId)!
    expect(pack.estimatedDuration).toBe(90)
    expect(pack.subtasks?.map((s) => s.description)).toEqual(["my stuff", "elijahs"])
    expect(taskScheduledOnDay(pack, now)).toBe(true)
    expect(taskIsRequired(pack, "day", todoPeriodKey("day", now))).toBe(true)
    const first = tasks.find((t) => t.id === plan.items[0]!.filedTaskId)!
    expect(first.why).toBe("so it is fresh for the trip")
    const shave = tasks.find((t) => t.id === plan.items.find((i) => i.title === "shave legs")!.filedTaskId)!
    expect(taskIsRequired(shave, "day", todoPeriodKey("day", now))).toBe(false)
    const steps = allSteps(useFollowStore.getState())
    expect(steps.length).toBe(9)
    expect(steps.filter((s) => s.hedge === "must").length).toBe(5)

    // Filing again makes no copies.
    fileDay(id, now)
    expect(useTaskStore.getState().tasks.length).toBe(before + 9)
    expect(allSteps(useFollowStore.getState()).length).toBe(9)
  })

  it("runs in the Plan BIMBY and writes back what happened", async () => {
    const now = at(15)
    const reply = await tryDay(MSG, now, { llm: false })
    const id = reply!.dayId!
    expect(startDayRun(id, now).ok).toBe(true)
    const run = usePlanRunStore.getState().run!
    expect(run.items.length).toBe(9)
    const item = useDayPlanStore.getState().plans[id]!.items.find((i) => i.title === "bleach eyebrows")!
    usePlanRunStore.getState().play(item.id, at(15, 10))
    usePlanRunStore.getState().complete(item.id, at(15, 40))
    const after = useDayPlanStore.getState().plans[id]!.items.find((i) => i.id === item.id)!
    expect(after.actualMin).toBe(30)
    const task = useTaskStore.getState().tasks.find((t) => t.id === item.filedTaskId)!
    expect(task.completed).toBe(true)
    expect(task.actualDuration).toBe(30)
    expect(task.timeLogs?.reduce((n, l) => n + l.durationMinutes, 0)).toBe(30)
    const step = allSteps(useFollowStore.getState()).find((s) => s.id === after.stepId)!
    expect(step).toMatchObject({ verdict: "done", standing: "confirmed" })
    expect(usePlanRunStore.getState().run!.items.find((i) => i.id === item.id)!.effects.join(" ")).toMatch(/Took 30 min \(planned 25\)/)

    // "done dye hair" in chat finishes that row too.
    const said = await tryDay("done dye hair", at(16), { llm: false })
    expect(said?.text).toMatch(/Done: "dye hair"/)
    expect(useDayPlanStore.getState().plans[id]!.items.find((i) => i.title === "dye hair")!.doneAt).toBeTruthy()
  })

  it("goes through sendToBim as a card line", async () => {
    const line = await sendToBim(MSG, at(15), { llm: false })
    expect(line.dayId).toBeTruthy()
    expect(line.route).toMatch(/^DAY/)
  })
})
