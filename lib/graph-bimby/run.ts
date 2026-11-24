/**
 * lib/graph-bimby/run.ts — BIM chat's door to the Graph BIMBY
 *
 * Lane `graph-tell`. "Tell BIM about Linda Gibbins Croft: …" (what the GRAPH tab's **Tell BIM about this** key
 * writes) becomes a plan card of proposed changes to that item and the items around it. Nothing is written until
 * Accept, on the card in CHAT or on the proposed node in GRAPH. The rules read first; with LLM on, a model reads
 * only the sentences the rules left, and every read it gives must quote that sentence.
 */
"use client"

import { itemTitle } from "@/lib/item-utils"
import { kindOfItem } from "@/lib/memory-graph/build"
import { personRecords } from "@/lib/people-i-know"
import { useReportStore } from "@/lib/report-bimby/store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { readWithModel } from "./llm"
import { parseTellLead, type Subject } from "./parse"
import { buildGraphPlan, type PlanData } from "./plan"
import { useGraphTellTarget } from "./target"

export interface GraphTellReply {
  text: string
  reportId?: string
  route: string
}

const SAYS: Record<string, string> = {
  "item-note": "the note",
  consider: "a consideration",
  fact: "a fact",
  place: "an address",
  kin: "a relation",
  relation: "how they are to you",
  seen: "a day you saw them",
  todo: "a To Do",
  step: "a part",
  amend: "an amend to an open task",
  birthday: "a birthday",
  contact: "contact details",
  group: "a group list",
}

/** The item a name means: a kept GRAPH target first, else an exact title (people, then open items). */
function resolve(name: string, all: readonly Task[]): Task | undefined {
  const key = name.trim().toLowerCase()
  const kept = useGraphTellTarget.getState().targets.find((t) => t.name.trim().toLowerCase() === key)
  if (kept) {
    const hit = all.find((t) => t.id === kept.id)
    if (hit) return hit
  }
  const same = all.filter((t) => itemTitle(t).trim().toLowerCase() === key)
  return same.sort((a, b) => (b.personProfile || b.type === "person" ? 1 : 0) - (a.personProfile || a.type === "person" ? 1 : 0) || Number(a.completed) - Number(b.completed))[0]
}

function subjectOf(t: Task, all: readonly Task[]): Subject {
  const kind = kindOfItem(t, all)
  return { id: t.id, name: itemTitle(t) || "Untitled", person: kind === "person", project: kind === "project" }
}

export async function tryGraphTell(text: string, now: Date, opts: { llm: boolean }): Promise<GraphTellReply | null> {
  const lead = parseTellLead(text)
  if (!lead) return null
  const started = Date.now()
  const { tasks, lists } = useTaskStore.getState()
  const found = lead.names.map((n) => ({ n, t: resolve(n, tasks) }))
  const missing = found.filter((f) => !f.t).map((f) => f.n)
  if (missing.length)
    return { text: `I can't find ${missing.map((m) => `“${m}”`).join(" or ")} in Brain2. Search it on the GRAPH tab ("Graph any item…") and use Tell BIM about this, so I know which item you mean.`, route: "GRAPH · not found · code" }
  const items = [...new Map(found.map((f) => [f.t!.id, f.t!])).values()]
  const group = items.length > 1 ? items.map((t) => subjectOf(t, tasks)) : undefined
  const subject = subjectOf(items[0], tasks)
  const center = items[0]
  const linkedIds = [...(center.links ?? []).map((l) => l.targetId), ...tasks.filter((t) => (t.links ?? []).some((l) => l.targetId === center.id)).map((t) => t.id)]
  const data: PlanData = {
    subject,
    group,
    people: personRecords(tasks, lists).map((p) => ({ id: p.id, name: itemTitle(p) })).filter((p) => p.name),
    tasks: tasks.filter((t) => !t.completed && t.type !== "person" && t.type !== "log" && !t.personProfile && !!itemTitle(t)).map((t) => ({ id: t.id, name: itemTitle(t) })),
    known: { address: center.personProfile?.address?.text, relation: center.personProfile?.relation, linkedIds },
  }
  let { plan, unread } = buildGraphPlan(lead.body, now, data)
  let by = "code"
  if (opts.llm && unread.length && !group) {
    const model = await readWithModel(unread, subject, now)
    if (model.reads.length) {
      plan = buildGraphPlan(lead.body, now, data, model.reads).plan
      by = model.model ?? "model"
    }
  }
  useReportStore.getState().put(plan)
  useGraphTellTarget.getState().clear()
  const kinds = [...new Set(plan.effects.map((e) => e.kind))].map((k) => SAYS[k] ?? k)
  const who = group ? group.map((g) => g.name).join(" + ") : subject.name
  return {
    text: `Read what you told me about ${who}. ${plan.effects.length} change${plan.effects.length === 1 ? "" : "s"} proposed: ${kinds.join(", ")}. Nothing is saved until you accept, here or on the GRAPH, where they wait as dashed nodes.`,
    reportId: plan.id,
    route: `GRAPH · tell · ${by} · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
