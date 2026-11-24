/**
 * lib/dump-bimby/run.ts — BIM chat's door to the Dump BIMBY
 *
 * `tryDump` takes a brain dump (`looksLikeDump`) and answers with a plan card, written nowhere
 * until Accept. For each plan in it: when an open task is already about it, an `amend` to that
 * task (priority, today, deadline, a dated note), else a `line` that files a new To Do (urgent
 * or due today) or an Inbox item. Days you said the same plan before are the evidence, and a
 * plan said on two or more earlier days is a recurring intention. A dose, a thing on the way,
 * a note to BIM about BIM, and what is left are one filing each. Every thought pattern the
 * message shows is kept in the ledger as proposed and put at the end of the card to confirm.
 * Rules only, no model, so it answers at once with LLM on or off.
 */
"use client"

import { bimLogs } from "@/lib/habit-helper/logs"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useReportStore } from "@/lib/report-bimby/store"
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { Effect, ReportPlan } from "@/lib/report-bimby/types"
import { PATTERNS, readPatterns, type PatternHit } from "@/lib/thought-patterns/patterns"
import { useThoughtPatternStore, type PatternObservation } from "@/lib/thought-patterns/store"
import { matchTask, priorMentions, type Said } from "./match"
import { looksLikeDump, readDump, type Intention } from "./parse"

export interface DumpReply {
  text: string
  reportId: string
  route: string
}

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").toLowerCase().replace(/\s/g, "")

interface Stored {
  tasks: { id: string; name: string; createdAt?: string }[]
  logs: Said[]
}

function stored(): Stored {
  const tasks = useTaskStore
    .getState()
    .tasks.filter((t) => !t.completed && t.type !== "person" && t.type !== "log" && !!itemTitle(t))
    .map((t) => ({ id: t.id, name: itemTitle(t), createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined }))
  let logs: Said[] = []
  try {
    logs = bimLogs()
  } catch {}
  return { tasks, logs }
}

/** The whole card, from the read and what is stored. Pure apart from ids from `now`. */
export function buildDumpPlan(text: string, now: Date, data: Stored): { plan: ReportPlan; hits: PatternHit[]; counts: { amend: number; fresh: number } } {
  const id = `dump_${now.getTime().toString(36)}`
  const read = readDump(text, now)
  const hits = readPatterns(text)
  const trace = [
    `Read a brain dump: ${read.intentions.length} plan${read.intentions.length === 1 ? "" : "s"}, ${hits.length} thought pattern${hits.length === 1 ? "" : "s"}.`,
    `Checked ${data.tasks.length} open tasks and ${data.logs.length} earlier lines for the same plans.`,
  ]
  const effects: Effect[] = []
  const counts = { amend: 0, fresh: 0 }
  const push = (e: Omit<Effect, "id" | "status">) => effects.push({ ...e, id: `${id}-${effects.length}`, status: "pending" })

  for (const it of read.intentions) {
    const before = priorMentions(it.title, data.logs, now)
    const told = before.length ? [`You said this before on ${before.map(day).join(", ")}.`] : []
    if (before.length >= 2) hits.push({ pattern: "recurring-intention", quote: `${it.title}: said on ${before.length} earlier days (${before.slice(-3).map(day).join(", ")}).` })
    const task = matchTask(it.title, data.tasks)
    if (task) {
      counts.amend++
      const since = data.tasks.find((t) => t.id === task.id)?.createdAt
      push({
        kind: "amend",
        ref: task.id,
        title: `${task.name}: said again${it.urgency === 5 ? ", now" : it.urgency === 4 ? ", ASAP" : ""}`,
        reasoning: [
          `You already have this open: “${task.name}”${since ? ` (on your list since ${day(since.slice(0, 10))})` : ""}. Amending it instead of making a twin.`,
          ...told,
          it.gate ? `It waits on: ${it.gate}.` : "",
        ].filter(Boolean),
        evidence: [`“${it.source}”`],
        fields: amendFields(it, now),
      })
      continue
    }
    counts.fresh++
    const today = it.urgency > 0 || !!it.by || !!it.before
    const line = `${today ? "to do today" : "inbox"}: ${it.title}${it.by ? ` by ${clock(it.by)}` : ""}${it.before ? ` (before ${it.before}${it.required === false ? ", if time" : ""})` : ""}${it.gate ? ` (needs ${it.gate} first)` : ""}`
    push({
      kind: "line",
      title: `${today ? "To Do today" : "Inbox"}: ${it.title}`,
      reasoning: [
        it.before ? `To do before ${it.before}${it.by ? `, around ${clock(it.by)}` : ""}${it.required === false ? ". Said as best case, so only if time." : "."}` : today ? (it.by ? `Due by ${clock(it.by)} today.` : it.urgency === 5 ? "Said as right now." : "Said as ASAP, so today.") : "No day said, so it waits in Inbox.",
        ...told,
        "No open task is about this yet.",
      ],
      evidence: [`“${it.source}”`],
      fields: [{ key: "line", label: "Line BIM files", type: "text", value: line }],
    })
  }
  if (read.intake) {
    push({
      kind: "line",
      title: `Intake: ${read.intake.drug}`,
      reasoning: [`A dose said in passing, logged at send time.${read.intake.last ? " You called it one of your last: say “only N left” to set the count." : ""}`],
      evidence: [`“${read.intake.source}”`],
      fields: [{ key: "line", label: "Line BIM files", type: "text", value: `intake drug: ${read.intake.drug}` }],
    })
  }
  for (const w of read.waiting) {
    push({ kind: "line", title: `On the way: ${w}`, reasoning: ["Something you are waiting on, kept as a note so it can be asked about."], evidence: [`“${w}”`], fields: [{ key: "line", label: "Line BIM files", type: "text", value: `note: waiting on: ${w}` }] })
  }
  for (const f of read.feedback) {
    push({ kind: "line", title: "Note to BIM", reasoning: ["This is about how BIM works, so it goes to the brain2 list, not your log."], evidence: [`“${f}”`], fields: [{ key: "line", label: "Line BIM files", type: "text", value: `brain2: BIM feedback: ${f}` }] })
  }
  if (read.rest.length) {
    const rest = read.rest.join(". ")
    push({ kind: "line", title: "Log the rest", reasoning: ["What is left after the plans, kept as one log line. Reject it to keep only the plans."], evidence: [`“${rest.length > 140 ? `${rest.slice(0, 137)}…` : rest}”`], fields: [{ key: "line", label: "Line BIM files", type: "text", value: `log: ${rest}` }] })
  }
  hits.forEach((h, i) => {
    const def = PATTERNS[h.pattern]
    push({
      kind: "pattern",
      ref: `${id}-p${i}`,
      title: `${def.name}: ${h.quote.length > 60 ? `${h.quote.slice(0, 57)}…` : h.quote}`,
      reasoning: [def.means, "Accept if this is a fair read. It is kept in your thought-pattern ledger either way, and a Reject marks it wrong."],
      evidence: [`“${h.quote}”`],
      fields: [{ key: "note", label: "Your note (optional)", type: "text", value: "" }],
    })
  })
  return { plan: { id, text, at: now.toISOString(), trace, effects }, hits, counts }
}

function amendFields(it: Intention, now: Date): Effect["fields"] {
  return [
    { key: "urgency", label: "Priority (1–5)", type: "select", value: it.urgency ? String(it.urgency) : "keep", options: ["keep", "3", "4", "5"] },
    { key: "today", label: "On today's to do", type: "select", value: it.urgency || it.by ? "yes" : "no", options: ["yes", "no"] },
    { key: "by", label: "Due by", type: "datetime", value: it.by ? fmtDateTime(it.by, true) : "" },
    { key: "note", label: "Note on the task", type: "text", value: `Said again ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${it.source}` },
  ]
}

export function tryDump(text: string, now = new Date()): DumpReply | null {
  if (!looksLikeDump(text)) return null
  const started = Date.now()
  const { plan, hits, counts } = buildDumpPlan(text, now, stored())
  if (!plan.effects.length) return null
  const obs: PatternObservation[] = hits.map((h, i) => ({ ...h, id: `${plan.id}-p${i}`, at: now.toISOString(), source: "bim-dump", planId: plan.id, status: "proposed" }))
  if (obs.length) useThoughtPatternStore.getState().add(obs)
  useReportStore.getState().put(plan)
  const parts = [
    counts.fresh ? `${counts.fresh} new` : "",
    counts.amend ? `${counts.amend} already on your list (amend, not add)` : "",
  ].filter(Boolean)
  const urgent = plan.effects.filter((e) => e.kind !== "pattern" && /: said again, now|^To Do today/.test(e.title)).length
  return {
    text: `That was a brain dump. ${parts.join(", ") || "No plans"}${urgent ? `, ${urgent} for today` : ""}${hits.length ? `, and ${hits.length} thought pattern${hits.length === 1 ? "" : "s"} at the end` : ""}. Nothing is filed until you accept.`,
    reportId: plan.id,
    route: `DUMP · code · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
