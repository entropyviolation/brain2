/**
 * components/Lab/NodeDetailLab/model.ts — One node, as data, plus every verb
 *
 * The four mockups are skins over this. It reads the same helpers as
 * `components/Home/ToDo/TaskCardSide.tsx` (points rule, needs kinds, locks,
 * notes) so behavior matches the real right bar. Node = a step, or the whole
 * task when no step is picked.
 */
"use client"

import { useMemo } from "react"
import type { StepTier, Subtask, Task } from "@/lib/types"
import { createListItem, itemTitleOrUntitled } from "@/lib/item-utils"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT, effectiveTierMap, stepsForTier } from "@/lib/step-tiers"
import { doneToView } from "@/lib/step-progress"
import { effectiveDurationMinutes, flattenSteps } from "@/lib/todo-steps"
import { isTaskBlocked, stepPrereqChoices, toggleStepPrereq } from "@/lib/prereqs"
import { LIST_REF, eventHappened, externalWaits, patchStep, toggleId } from "@/lib/node-needs"
import { leafTally, splitStats } from "@/lib/tree-math"
import { NOTICE_PROMPT, needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { noticeAnswers, taskPointsWithSource } from "@/lib/task-card"
import { isStepLocked } from "@/components/steps/step-tree-view"
import { useLab } from "./lab-store"

export type NeedKind = "first" | "resource" | "await"
export type ChipState = "done" | "open" | "wait" | "ref"
export interface Option {
  id: string
  label: string
  hint?: string
}
export interface Ref {
  /** Stable key; for in-tree steps it is `step:{id}`. */
  key: string
  id: string
  kind: NeedKind | "unlock"
  label: string
  state: ChipState
  hint: string
  canOpen: boolean
  canLog: boolean
}
export interface Rung {
  tier: StepTier
  label: string
  short: string
  value?: number
  inside: boolean
  reached: boolean
}

export const NEED_KINDS: { id: NeedKind; label: string; title: string }[] = [
  { id: "first", label: "Task first", title: "A step here, or any task, that comes first. Locks until done." },
  { id: "resource", label: "Resource", title: "An item or list holding the supplies, files or info. Never locks." },
  { id: "await", label: "Awaiting", title: "An event outside your hands: a reply, an approval, a delivery. Locks until logged or its date passes." },
]

const SOURCE_WORDS: Record<string, string> = { "tier formula": "from the list's tier formula", "list rule": "from the list's points", "item value": "from the item's value", default: "the house default", override: "set here" }

export const NOTE_PROMPT = NOTICE_PROMPT

function pathTo(steps: readonly Subtask[], id: string, trail: Subtask[] = []): Subtask[] {
  for (const s of steps) {
    if (s.id === id) return [...trail, s]
    const hit = s.subtasks?.length ? pathTo(s.subtasks, id, [...trail, s]) : []
    if (hit.length) return hit
  }
  return []
}

export function useNode(taskId: string | null, stepId: string | null) {
  const { tasks, lists, folders, spent, updateTask, addTask, addSpent, say } = useLab()
  return useMemo(() => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return null
    const steps = task.subtasks ?? []
    const flat = flattenSteps(steps)
    const step = stepId ? flat.find((s) => s.id === stepId) : undefined
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const tierOf = effectiveTierMap(steps)
    const extra = (s: Subtask) => externalWaits(s, (id) => byId.get(id)).length > 0
    const writeSteps = (label: string, next: Subtask[]) => (updateTask({ ...task, subtasks: next }), say(label))
    const put = (t: Task, label: string) => (updateTask(t), say(label))

    // ── Head ──
    const path = step ? [itemTitleOrUntitled(task), ...pathTo(steps, step.id).slice(0, -1).map((s) => s.description)] : ["whole task"]
    const name = step ? step.description : itemTitleOrUntitled(task)
    const root: Subtask = { id: "root", description: name, completed: !!task.completed, subtasks: steps }
    const node = step ?? root
    const kids = node.subtasks ?? []
    const state: "open" | "locked" | "done" = node.completed ? "done" : step ? (isStepLocked(steps, step, extra) ? "locked" : "open") : isTaskBlocked(task, tasks) || externalWaits(task, (id) => byId.get(id)).length ? "locked" : "open"
    const ends = kids.length ? leafTally(node) : null
    const est = effectiveDurationMinutes(node.estimatedDuration, kids)
    const spentMin = (spent[node.id === "root" ? task.id : node.id] ?? 0) + (step ? step.actualDuration ?? 0 : flat.reduce((n, s) => n + (s.actualDuration ?? 0), 0))
    const stats = kids.length ? splitStats(kids, tierOf) : null

    // ── Points ──
    const hasKids = kids.length > 0
    const rule = taskPointsWithSource({ ...task, pointsOverride: undefined }, lists, folders)
    const inherited = step ? pathTo(steps, step.id).slice(0, -1).reduceRight<number | undefined>((v, s) => v ?? s.stepPoints, undefined) ?? task.stepPoints : undefined
    const byLevel = !!step && hasKids && !!step.tierPoints
    const rungs: Rung[] = STEP_TIERS.map((t) => {
      const view = stepsForTier(steps, t)
      const inside = step ? view.ids.has(step.id) || flattenSteps(step.subtasks).some((s) => view.ids.has(s.id)) : false
      return { tier: t, label: STEP_TIER_LABEL[t], short: STEP_TIER_SHORT[t], value: step?.tierPoints?.[t], inside, reached: step ? doneToView(step, view) : false }
    })
    const onDone = step
      ? { value: step.points, fallback: inherited, caption: step.points == null ? (inherited != null ? "inherited from above" : "none yet") : inherited != null ? `set here · inherits ${inherited}` : "set here", resetTo: step.points != null && inherited != null ? inherited : undefined }
      : { value: task.pointsOverride, fallback: rule.points, caption: task.pointsOverride != null ? `set here · rule gives ${rule.points}` : SOURCE_WORDS[rule.source] ?? rule.source, resetTo: task.pointsOverride != null ? rule.points : undefined }
    const each = { show: hasKids, value: step ? step.stepPoints : task.stepPoints, fallback: step ? inherited : undefined, caption: (step ? step.stepPoints : task.stepPoints) != null ? "per step inside" : "optional" }
    const total = byLevel ? rungs.reduce((n, r) => n + (r.value ?? 0), 0) : onDone.value ?? onDone.fallback ?? 0

    // ── Needs ──
    const nameOf = (id: string) => (id.startsWith(LIST_REF) ? `☰ ${lists.find((l) => `${LIST_REF}${l.id}` === id)?.name ?? "list"}` : byId.get(id) ? itemTitleOrUntitled(byId.get(id)!) : "(gone)")
    const taskIds = (step ? step.needsTaskIds : task.dependencies) ?? []
    const resources = (step ? step.resourceIds : task.resourceIds) ?? []
    const awaits = (step ? step.awaitIds : task.awaitIds) ?? []
    const stepIds = step?.dependsOn ?? []
    const needs: Ref[] = [
      ...stepIds.map((id) => ({ key: `step:${id}`, id, kind: "first" as const, label: flat.find((s) => s.id === id)?.description ?? "?", state: (flat.find((s) => s.id === id)?.completed ? "done" : "open") as ChipState, hint: "step", canOpen: false, canLog: false })),
      ...taskIds.map((id) => ({ key: id, id, kind: "first" as const, label: nameOf(id), state: (byId.get(id)?.completed ? "done" : "open") as ChipState, hint: "task", canOpen: true, canLog: false })),
      ...resources.map((id) => ({ key: id, id, kind: "resource" as const, label: nameOf(id), state: "ref" as ChipState, hint: id.startsWith(LIST_REF) ? "list" : byId.get(id)?.type ?? "item", canOpen: !id.startsWith(LIST_REF), canLog: false })),
      ...awaits.map((id) => {
        const ev = byId.get(id)
        return { key: id, id, kind: "await" as const, label: nameOf(id), state: (eventHappened(ev) ? "done" : "wait") as ChipState, hint: "event", canOpen: true, canLog: !!ev && !ev.completed }
      }),
    ]
    const unlocks: Ref[] = step
      ? flat.filter((s) => (s.dependsOn ?? []).includes(step.id)).map((s) => ({ key: `step:${s.id}`, id: s.id, kind: "unlock" as const, label: s.description, state: (s.completed ? "done" : "open") as ChipState, hint: "step", canOpen: false, canLog: false }))
      : tasks.filter((t) => (t.dependencies ?? []).includes(task.id)).map((t) => ({ key: t.id, id: t.id, kind: "unlock" as const, label: itemTitleOrUntitled(t), state: (t.completed ? "done" : "open") as ChipState, hint: "task", canOpen: true, canLog: false }))

    const choices = step ? stepPrereqChoices(steps, step.id) : new Set<string>()
    const options: Record<NeedKind, Option[]> = {
      first: [
        ...(step ? flat.filter((s) => choices.has(s.id) && !stepIds.includes(s.id)).map((s) => ({ id: `step:${s.id}`, label: s.description, hint: "step" })) : []),
        ...tasks.filter((t) => t.id !== task.id && (t.type ?? "task") === "task" && !t.completed && !taskIds.includes(t.id)).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: "task" })),
      ],
      resource: [...lists.map((l) => ({ id: `${LIST_REF}${l.id}`, label: l.name, hint: "list" })), ...tasks.filter((t) => t.id !== task.id && t.type !== "event").map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: t.type ?? "item" }))].filter((o) => !resources.includes(o.id)),
      await: tasks.filter((t) => t.type === "event" && !awaits.includes(t.id)).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: t.completed ? "logged" : "event" })),
    }
    const unlockOptions: Option[] = step
      ? flat.filter((s) => s.id !== step.id && !unlocks.some((u) => u.id === s.id) && stepPrereqChoices(steps, s.id).has(step.id)).map((s) => ({ id: s.id, label: s.description, hint: "step" }))
      : tasks.filter((t) => t.id !== task.id && (t.type ?? "task") === "task" && !t.completed && !unlocks.some((u) => u.id === t.id)).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t), hint: "task" }))

    // ── Verbs ──
    const setField = (field: "tasks" | "resourceIds" | "awaitIds", next: string[] | undefined, label: string) => {
      if (step) writeSteps(label, patchStep(steps, step.id, { [field === "tasks" ? "needsTaskIds" : field]: next }))
      else {
        const key = field === "tasks" ? "dependencies" : field
        const t = { ...task, [key]: next } as Task & Record<string, unknown>
        if (next === undefined) delete t[key]
        put(t, label)
      }
    }
    const make = (name: string, type: string) => {
      const item = { ...createListItem(name), type } as Task
      addTask(item)
      return item.id
    }
    const fieldOf: Record<NeedKind, "tasks" | "resourceIds" | "awaitIds"> = { first: "tasks", resource: "resourceIds", await: "awaitIds" }
    const listOf: Record<NeedKind, string[]> = { first: taskIds, resource: resources, await: awaits }

    const act = {
      setOnDone: (v: number | undefined) =>
        step ? writeSteps("Step points", patchStep(steps, step.id, { points: v })) : put(v === undefined ? (({ pointsOverride: _, ...rest }) => rest as Task)(task) : { ...task, pointsOverride: v }, "Points"),
      setEach: (v: number | undefined) =>
        step ? writeSteps("Each step", patchStep(steps, step.id, { stepPoints: v })) : put(v === undefined ? (({ stepPoints: _, ...rest }) => rest as Task)(task) : { ...task, stepPoints: v }, "Each step"),
      setByLevel: (on: boolean) => step && writeSteps("Points mode", patchStep(steps, step.id, { tierPoints: on ? step.tierPoints ?? {} : undefined })),
      setRung: (t: StepTier, v: number | undefined) => step && writeSteps(`${STEP_TIER_LABEL[t]} points`, patchStep(steps, step.id, { tierPoints: { ...step.tierPoints, [t]: v } })),
      addNeed: (kind: NeedKind, id: string) => {
        if (id.startsWith("step:") && step) return writeSteps("Needs", toggleStepPrereq(steps, step.id, id.slice(5)))
        setField(fieldOf[kind], toggleId(listOf[kind], id), NEED_KINDS.find((k) => k.id === kind)!.label)
      },
      createNeed: (kind: NeedKind, name: string) => setField(fieldOf[kind], [...listOf[kind], make(name, kind === "first" ? "task" : kind === "await" ? "event" : "item")], `New ${name}`),
      removeNeed: (r: Ref) => {
        if (r.kind === "unlock") return act.removeUnlock(r)
        if (r.key.startsWith("step:") && step) return writeSteps("Needs", toggleStepPrereq(steps, step.id, r.id))
        setField(fieldOf[r.kind], toggleId(listOf[r.kind], r.id), "Removed")
      },
      log: (id: string) => {
        const ev = byId.get(id)
        if (ev) put({ ...ev, completed: true, completedDate: new Date() } as Task, `Logged ${itemTitleOrUntitled(ev)}`)
      },
      addUnlock: (id: string) => {
        if (step) return writeSteps("Unlocks", toggleStepPrereq(steps, id, step.id))
        const t = byId.get(id)
        if (t) put({ ...t, dependencies: toggleId(t.dependencies, task.id) ?? [] }, "Unlocks")
      },
      removeUnlock: (r: Ref) => act.addUnlock(r.id),
      addNote: (text: string) => text.trim() && put(withNoticeAnswer(task, text), "Note logged"),
      toggleDone: () => (step ? writeSteps(step.completed ? "Reopened" : "Done", patchStep(steps, step.id, { completed: !step.completed, completedAt: step.completed ? undefined : new Date() })) : put({ ...task, completed: !task.completed }, task.completed ? "Reopened" : "Done")),
      tick: (min = 1) => addSpent(node.id === "root" ? task.id : node.id, min),
      open: (r: Ref) => say(`Would open ${r.label} as an item`),
      openStepItem: () => say(`Would open “${name}” as a step item`),
    }

    return {
      task,
      step,
      isTask: !step,
      path,
      name,
      state,
      tier: step ? tierOf.get(step.id) ?? "goal" : undefined,
      est,
      spent: spentMin,
      ends,
      math: stats ? { rho: stats.raw, sigma: stats.split, parts: stats.parts, leaves: stats.leaves, done: stats.done } : null,
      points: { total, hasKids, byLevel, canByLevel: !!step && hasKids, onDone, each, rungs },
      needs,
      unlocks,
      options,
      unlockOptions,
      notes: noticeAnswers(task),
      due: needsNotice(task),
      act,
    }
  }, [tasks, lists, folders, spent, taskId, stepId, updateTask, addTask, addSpent, say])
}

export type NodeModel = NonNullable<ReturnType<typeof useNode>>

export const fmtPct = (p: number | null | undefined) => (p == null ? "—" : `${Math.round(p * 100)}%`)

/** "Tue, Oct 20". */
export function noteDate(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00`) : new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
