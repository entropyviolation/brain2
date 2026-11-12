/**
 * lib/plan-bimby/day/run.ts — BIM chat's door to the day plan
 *
 * `tryDay` is called by `sendToBim` (`lib/ingest/bim-chat.ts`). A message that lists the day becomes a
 * `DayPlan` in `useDayPlanStore` and a chat line pointing at it (`dayId`); the chat draws the card. While
 * that plan is live, a line that changes it ("pack will take 2 hours", "drop shave legs", "done dye hair")
 * or answers BIM's open question is taken here; anything else goes on to the rest of the chat. The rules
 * build the plan at once. With LLM on, a model then adds time guesses and guessed reasons in the background.
 * Nothing is written to To Do or the ledger until the person files or starts the plan.
 */
"use client"

import { dreadLine, realismLine } from "@/lib/follow-through/learn"
import { followLedger } from "@/lib/follow-through/store"
import { looksLikeVerb } from "@/lib/ingest/parse-message"
import { useTaskStore } from "@/lib/task-store"
import { matchTasks } from "../links"
import { usePlanRunStore } from "../store"
import { fileDay, rejectDay, startDayRun } from "./apply"
import { nextAsk, readDayAnswer, type DayQuestion } from "./ask"
import { estimateFor, type PastRun } from "./estimate"
import { pastRuns } from "./history"
import { thinkWithModel } from "./llm"
import { looksLikeDayPlan, readDay, wantsDayPlan } from "./read"
import { defaultUntil, layout, orderDay } from "./schedule"
import { liveDayPlan, useDayPlanStore } from "./store"
import { finishDayItem } from "./track"
import { tweakDay } from "./tweak"
import { dayItemId, type DayItem, type DayPlan } from "./types"

export interface DayReply {
  text: string
  route: string
  dayId?: string
  choices?: { label: string; text: string }[]
}

/** BIM asked "tell me everything for today"; the next line is the list. In memory only. */
let awaitingList = false

export function buildDayPlan(text: string, now: Date, past: readonly PastRun[] = [], openTasks: Parameters<typeof matchTasks>[1] = []): DayPlan | null {
  const read = readDay(text)
  if (!read.items.length) return null
  const ids = read.items.map(() => dayItemId())
  const items: DayItem[] = read.items.map((r, i) => {
    const match = matchTasks({ title: r.title }, openTasks, 1)[0]
    return {
      id: ids[i]!,
      title: r.title,
      said: r.said,
      tier: r.tier,
      urgent: r.urgent,
      subtasks: r.subtasks,
      ...(r.note ? { note: r.note } : {}),
      estimate: estimateFor(r.title, r.minutes, past),
      why: "",
      ifNot: "",
      blocker: "",
      ...(r.after !== undefined ? { after: ids[r.after]! } : {}),
      reasons: r.reasons.length ? r.reasons : ["On your list, with no weight given."],
      ...(match ? { taskId: match.taskId, taskTitle: match.title, useTask: true } : {}),
    }
  })
  const fromHistory = items.filter((i) => i.estimate.source === "history").length
  const said = items.filter((i) => i.estimate.source === "said").length
  const trace = [...read.trace, `Estimates: ${fromHistory} from your own past tasks, ${said} from your words, ${items.length - fromHistory - said} rough guesses to check.`]
  const linked = items.filter((i) => i.taskId)
  if (linked.length) trace.push(`Already on your lists: ${linked.map((i) => `"${i.taskTitle}"`).join(", ")}. Filing moves those to today instead of making copies.`)
  return { id: `dayplan-${now.getTime().toString(36)}`, text, at: now.toISOString(), until: defaultUntil(now), items: orderDay(items), remarks: read.remarks, trace, asked: [], revisions: 0 }
}

/** Open the next question on the plan and return it. */
function ask(planId: string): DayQuestion | null {
  const plan = useDayPlanStore.getState().plans[planId]
  const q = plan ? nextAsk(plan) : null
  useDayPlanStore.getState().patch(planId, (p) => ({ ...p, asking: q ? { itemId: q.itemId, key: q.key } : undefined }))
  return q
}

/** The model's notes, merged by item id so an edit or a reorder made meanwhile is kept. */
async function think(planId: string, past: readonly PastRun[], now: Date): Promise<void> {
  const store = useDayPlanStore.getState()
  const snapshot = store.plans[planId]
  if (!snapshot) return
  let line = "No model answered, so the rough guesses stand."
  try {
    const thought = await thinkWithModel(snapshot, past, now)
    if (thought) {
      const byId = new Map(thought.items.map((i) => [i.id, i]))
      const known = new Set(snapshot.items.map((i) => i.id))
      useDayPlanStore.getState().patch(planId, (p) => ({
        ...p,
        model: thought.model,
        items: [
          ...p.items.map((i) => {
            const m = byId.get(i.id)
            if (!m) return i
            const rough = i.estimate.source === "rule" || i.estimate.source === "default"
            return { ...i, ...(rough && m.estimate.source === "model" ? { estimate: m.estimate } : {}), ...(m.guess && !i.guess ? { guess: m.guess } : {}) }
          }),
          ...thought.items.filter((i) => !known.has(i.id)),
        ],
      }))
      line = `Model ${thought.model}: ${thought.timed} time guess${thought.timed === 1 ? "" : "es"}${thought.added.length ? `, noticed ${thought.added.join(", ")}` : ""}${thought.dropped.length ? `; dropped ${thought.dropped.length} answer${thought.dropped.length === 1 ? "" : "s"} that failed the checks` : ""}. Its reasons are guesses until you keep them.`
    }
  } catch (error) {
    line = `The model step failed (${error instanceof Error ? error.message : String(error)}); the rough guesses stand.`
  }
  useDayPlanStore.getState().patch(planId, (p) => ({ ...p, thinking: false, trace: [...p.trace, line] }))
}

function fitLines(plan: DayPlan, now: Date): string {
  return layout(plan, now).lines.join(" ")
}

function start(text: string, now: Date, llm: boolean): DayReply | null {
  const t0 = Date.now()
  const past = pastRuns()
  const open = useTaskStore.getState().tasks.filter((t) => !t.completed)
  const plan = buildDayPlan(text, now, past, open)
  if (!plan) return null
  useDayPlanStore.getState().put({ ...plan, thinking: llm })
  if (llm) void think(plan.id, past, now)
  const count = (tier: DayItem["tier"]) => plan.items.filter((i) => i.tier === tier).length
  const weights = [`${count("must")} must`, `${count("important")} important`, `${count("rest")} if there is time`].join(", ")
  const realism = realismLine(followLedger(), plan.items.length)
  const q = ask(plan.id)
  const text2 = [
    `I read that as ${plan.items.length} things for the rest of today: ${weights}. ${fitLines(plan, now)}`,
    realism ?? "",
    `Every row is editable: the time, the weight, the order, and the reasons. Nothing is on To Do until you file it.${llm ? " A model is still working on better time guesses." : ""}`,
    q?.text ?? "",
  ].filter(Boolean).join("\n\n")
  return { text: text2, route: `DAY · rules · ${((Date.now() - t0) / 1000).toFixed(1)}s`, dayId: plan.id, ...(q ? { choices: q.choices } : {}) }
}

export async function tryDay(text: string, now = new Date(), opts: { llm?: boolean; lastBim?: string } = {}): Promise<DayReply | null> {
  const t = text.trim()
  if (!t) return null
  if (awaitingList) {
    awaitingList = false
    if (!/\?\s*$/.test(t) && !looksLikeVerb(t, now) && readDay(t).items.length) return start(t, now, !!opts.llm)
  }
  if (looksLikeDayPlan(t)) return start(t, now, !!opts.llm)

  const live = liveDayPlan(now)
  if (live) {
    const store = useDayPlanStore.getState()
    // A change to the plan, said in chat.
    const tw = tweakDay(live, t, pastRuns())
    if (tw) {
      const reply = (said: string, extra: Partial<DayReply> = {}): DayReply => ({ text: said, route: "DAY · tweak · code", dayId: live.id, ...extra })
      if (tw.act?.kind === "file") return reply(fileDay(live.id, now).message)
      if (tw.act?.kind === "start") return reply(startDayRun(live.id, now).message)
      if (tw.act?.kind === "reject") {
        rejectDay(live.id)
        return { text: "Okay, that plan is set aside. Nothing was filed from it that was not already filed.", route: "DAY · tweak · code" }
      }
      if (tw.act?.kind === "done" || tw.act?.kind === "play") {
        const item = live.items.find((i) => i.id === (tw.act as { itemId: string }).itemId)!
        const run = usePlanRunStore.getState().run
        const row = run && run.id === live.runId ? run.items.find((i) => i.id === item.id) : undefined
        if (tw.act.kind === "play") {
          if (!row) return reply("Start the plan first, then I can put a row on the clock.")
          usePlanRunStore.getState().play(item.id, now)
          return reply(`"${item.title}" is on the clock.`)
        }
        if (row) {
          usePlanRunStore.getState().complete(item.id, now)
          const effects = usePlanRunStore.getState().run?.items.find((i) => i.id === item.id)?.effects ?? []
          return reply(`Done: "${item.title}". ${effects.at(-1) ?? ""}`.trim())
        }
        if (!live.filed) return reply("File or start the plan first, so there is a task to check off.")
        return reply(`Done: "${item.title}". ${finishDayItem(live, item, 0, now) ?? "It was already done."}`)
      }
      store.put(tw.plan)
      return reply(`${tw.said} ${fitLines(tw.plan, now)}`)
    }
    // The answer to BIM's open question. Only right after BIM asked it; a command is never an answer.
    if (live.asking) {
      const fresh = !opts.lastBim || /\?\s*(?:My guess:[\s\S]*)?$/.test(opts.lastBim.trim())
      if (!fresh) store.patch(live.id, (p) => ({ ...p, asking: undefined }))
      else if (!looksLikeVerb(t, now)) {
        const ans = readDayAnswer(live, t)
        if (ans) {
          store.put(ans.plan)
          const item = ans.plan.items.find((i) => i.id === live.asking!.itemId)
          const dread = live.asking.key === "resistance" && item?.resistance !== undefined ? dreadLine(followLedger(), item.resistance) : null
          const q = ask(live.id)
          const done = !q && !ans.plan.quiet ? "That is every reason I wanted to ask about. File the plan when it looks right, or start it." : ""
          return { text: [ans.noted, dread ?? "", q?.text ?? done].filter(Boolean).join("\n\n") || "Skipped.", route: "DAY · answer · code", ...(q ? { choices: q.choices } : {}) }
        }
      }
    }
  }
  if (wantsDayPlan(t)) {
    awaitingList = true
    return { text: "Tell me everything on your mind for the rest of today, in one breath. Say which things must happen and which are important, and I will lay it out with time estimates for you to edit.", route: "DAY · ask · code" }
  }
  return null
}

/** The card's tweak box: the same rules as a chat line. False when the words changed nothing. */
export function reviseDay(planId: string, instruction: string, now = new Date()): string | null {
  const plan = useDayPlanStore.getState().plans[planId]
  if (!plan) return null
  const tw = tweakDay(plan, instruction, pastRuns())
  if (!tw) return null
  if (tw.act?.kind === "file") return fileDay(planId, now).message
  if (tw.act?.kind === "start") return startDayRun(planId, now).message
  if (tw.act) return null
  useDayPlanStore.getState().put(tw.plan)
  return tw.said
}
