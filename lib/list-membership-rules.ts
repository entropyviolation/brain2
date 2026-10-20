/**
 * lib/list-membership-rules.ts — Lists that fill themselves
 *
 * A list can carry `membershipRules`: when an item matches any enabled rule
 * (type, on / not on other lists, a date within N days, an attribute value, a
 * tag, done or not), the item joins the list. Membership is written onto
 * `Task.lists` the same way connected lists write theirs (`lib/list-links.ts`),
 * so every view, count, and export already sees it.
 *
 * - A manual removal is respected: it lands in `Task.listMembershipExclusions`
 *   (the list-links step records it) and a rule never puts the item back.
 * - `List.membershipRulesSync` also takes an item off when it stops matching —
 *   but only items a rule added (`Task.listRuleAddedIds`). Items you added by
 *   hand stay.
 * - Date rules are relative to today, so the store re-applies on a clock
 *   (`hooks/use-list-membership-rules-tick.ts`).
 * - A rule with no conditions matches nothing, so an empty rule can never pull
 *   the whole vault into a list.
 *
 * See components/Lists/LIST_RULES.md.
 */
import type {
  List,
  ListMembershipRule,
  MembershipCondition,
  MembershipDateField,
  Task,
} from "@/lib/types"
import { isLinkableListId } from "@/lib/list-links"
import { linkIndexOf, type LinkIndex } from "@/lib/graph/link-index"
import { buildLattice, type RelationLattice } from "@/lib/graph/relation-lattice"
import { allRelations } from "@/lib/relation-registry"
import { relationLabel } from "@/lib/links"

/**
 * Set while `applyMembershipRulesToTasks` runs, so `link` conditions see
 * backlinks. A single-task apply reads the item's own links only.
 */
let linkScope: { links: LinkIndex; lattice: RelationLattice } | null = null

function matchLink(task: Task, c: Extract<MembershipCondition, { kind: "link" }>): boolean {
  if (!c.relation) return false
  const lattice = linkScope?.lattice ?? buildLattice(allRelations())
  const steps = linkScope
    ? linkScope.links.steps(task.id)
    : (task.links ?? []).map((l) => ({ from: task.id, relation: l.relation, to: l.targetId }))
  const typeOk = (id: string) => {
    if (!c.targetTypeIds?.length) return true
    const t = linkScope?.links.byId.get(id)?.type as string | undefined
    return !!t && c.targetTypeIds.includes(t)
  }
  const hit = steps.some((s) => lattice.isSubrelation(s.relation, c.relation) && (!c.targetId || s.to === c.targetId) && typeOk(s.to))
  return c.mode === "hasNot" ? !hit : hit
}

const DAY = 86_400_000

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function toTime(v: unknown): number | null {
  if (v == null || v === "") return null
  const d = v instanceof Date ? v : new Date(v as string | number)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

export function membershipDateValue(task: Task, field: MembershipDateField): number | null {
  if (field.startsWith("attr:")) return toTime(task.attributes?.[field.slice(5)])
  switch (field) {
    case "deadline":
      return toTime(task.deadline)
    case "scheduledDate":
      return toTime(task.scheduledDate)
    case "createdAt":
      return toTime(task.createdAt)
    case "completedDate":
      return toTime(task.completedDate)
    default:
      return null
  }
}

function asStrings(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
  if (v instanceof Date) return [v.toISOString().toLowerCase()]
  const s = String(v).trim().toLowerCase()
  return s ? [s] : []
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.length === 0
  return false
}

function matchCondition(task: Task, membership: Set<string>, c: MembershipCondition, now: Date, selfId: string): boolean {
  switch (c.kind) {
    case "type": {
      if (!c.typeIds.length) return false
      const t = (task.type as string | undefined) ?? "item"
      return c.typeIds.includes(t)
    }
    case "onLists": {
      const ids = c.listIds.filter((id) => id && id !== selfId)
      if (!ids.length) return false
      if (c.mode === "all") return ids.every((id) => membership.has(id))
      if (c.mode === "none") return ids.every((id) => !membership.has(id))
      return ids.some((id) => membership.has(id))
    }
    case "dateWithin": {
      const t = membershipDateValue(task, c.field)
      if (t == null) return false
      const today = startOfDay(now)
      const days = Math.max(0, Math.floor(c.days))
      if (c.direction === "past") return t >= today - days * DAY && t < today + DAY
      if (t < today) return c.includeOverdue === true
      return t < today + (days + 1) * DAY
    }
    case "attribute": {
      const raw = task.attributes?.[c.attributeId]
      if (c.op === "isSet") return !isEmptyValue(raw)
      if (c.op === "isEmpty") return isEmptyValue(raw)
      const want = String(c.value ?? "").trim().toLowerCase()
      if (c.op === "gt" || c.op === "lt") {
        const n = typeof raw === "number" ? raw : Number(raw)
        const w = Number(c.value)
        if (Number.isNaN(n) || Number.isNaN(w) || isEmptyValue(raw)) return false
        return c.op === "gt" ? n > w : n < w
      }
      const have = asStrings(raw)
      if (c.op === "contains") return want !== "" && have.some((h) => h.includes(want))
      const equal = have.includes(want)
      return c.op === "isNot" ? !equal : equal
    }
    case "tag": {
      const tags = new Set((task.tags ?? []).map((t) => t.trim().toLowerCase()))
      const want = c.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      if (!want.length) return false
      if (c.mode === "all") return want.every((t) => tags.has(t))
      if (c.mode === "none") return want.every((t) => !tags.has(t))
      return want.some((t) => tags.has(t))
    }
    case "done":
      return task.completed === c.done
    case "link":
      return matchLink(task, c)
    default:
      return false
  }
}

export function ruleMatches(task: Task, rule: ListMembershipRule, now: Date, selfId: string, membership?: Set<string>): boolean {
  if (rule.enabled === false || !rule.conditions.length) return false
  const m = membership ?? new Set(task.lists ?? [])
  const results = rule.conditions.map((c) => matchCondition(task, m, c, now, selfId))
  return rule.match === "any" ? results.some(Boolean) : results.every(Boolean)
}

export function activeMembershipRules(list: List | undefined | null): ListMembershipRule[] {
  if (!list || !isLinkableListId(list.id)) return []
  return (list.membershipRules ?? []).filter((r) => r.enabled !== false && r.conditions.length > 0)
}

export function listMatches(task: Task, list: List, now: Date, membership?: Set<string>): boolean {
  return activeMembershipRules(list).some((r) => ruleMatches(task, r, now, list.id, membership))
}

/**
 * Join (and, with sync, leave) rule lists. Never touches lists without rules,
 * never re-adds an excluded list, never removes an item a person added.
 */
export function applyMembershipRulesToTask(task: Task, lists: List[], now: Date): Task {
  const ruleLists = lists.filter((l) => activeMembershipRules(l).length > 0)
  const prevAdded = task.listRuleAddedIds ?? []
  if (!ruleLists.length && !prevAdded.length) return task

  const original = task.lists ?? []
  const membership = new Set(original)
  const ruleListIds = new Set(ruleLists.map((l) => l.id))
  // Forget "added by rule" for lists the item left, or that no longer have rules.
  const added = new Set(prevAdded.filter((id) => membership.has(id) && ruleListIds.has(id)))
  const excluded = new Set(task.listMembershipExclusions ?? [])

  // A few passes so "on list B" rules see lists other rules just added.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const list of ruleLists) {
      const match = listMatches(task, list, now, membership)
      if (match && !membership.has(list.id) && !excluded.has(list.id)) {
        membership.add(list.id)
        added.add(list.id)
        changed = true
      } else if (!match && list.membershipRulesSync && membership.has(list.id) && added.has(list.id)) {
        membership.delete(list.id)
        added.delete(list.id)
        changed = true
      }
    }
    if (!changed) break
  }

  const nextLists = [...original.filter((id) => membership.has(id)), ...[...membership].filter((id) => !original.includes(id))]
  const nextAdded = [...added]
  const listsSame = nextLists.length === original.length && nextLists.every((id, i) => id === original[i])
  const addedSame = nextAdded.length === prevAdded.length && nextAdded.every((id) => prevAdded.includes(id))
  if (listsSame && addedSame) return task
  const next: Task = { ...task, lists: nextLists }
  if (nextAdded.length) next.listRuleAddedIds = nextAdded
  else delete next.listRuleAddedIds
  return next
}

export function applyMembershipRulesToTasks(tasks: Task[], lists: List[], now: Date): Task[] {
  if (!lists.some((l) => activeMembershipRules(l).length > 0) && !tasks.some((t) => t.listRuleAddedIds?.length)) {
    return tasks
  }
  const needsLinks = lists.some((l) => activeMembershipRules(l).some((r) => r.conditions.some((c) => c.kind === "link")))
  linkScope = needsLinks ? { links: linkIndexOf(tasks), lattice: buildLattice(allRelations()) } : null
  let changed = false
  try {
    const next = tasks.map((t) => {
      const applied = applyMembershipRulesToTask(t, lists, now)
      if (applied !== t) changed = true
      return applied
    })
    return changed ? next : tasks
  } finally {
    linkScope = null
  }
}

export function rulesChanged(a: List | undefined, b: List | undefined): boolean {
  return (
    JSON.stringify(a?.membershipRules ?? []) !== JSON.stringify(b?.membershipRules ?? []) ||
    Boolean(a?.membershipRulesSync) !== Boolean(b?.membershipRulesSync)
  )
}

/** Live preview for the settings sheet: what the draft rules would pick up now. */
export function previewMembershipRules(draft: List, tasks: Task[], now: Date) {
  const matching: Task[] = []
  let alreadyOn = 0
  let excluded = 0
  for (const t of tasks) {
    if (!listMatches(t, draft, now)) continue
    matching.push(t)
    if (t.lists?.includes(draft.id)) alreadyOn++
    else if (t.listMembershipExclusions?.includes(draft.id)) excluded++
  }
  return { matching, alreadyOn, excluded, willJoin: matching.length - alreadyOn - excluded }
}

export function newMembershipRule(): ListMembershipRule {
  return { id: `rule-${Date.now().toString(36)}`, match: "all", conditions: [] }
}

/** One-line reading of a rule for summaries ("type is Book and due within 7 days"). */
export function describeCondition(
  c: MembershipCondition,
  names: { list: (id: string) => string; type: (id: string) => string; attr: (id: string) => string },
): string {
  switch (c.kind) {
    case "type":
      return `type is ${c.typeIds.map(names.type).join(" or ") || "…"}`
    case "onLists": {
      const ls = c.listIds.map(names.list).join(c.mode === "all" ? " and " : " or ") || "…"
      return c.mode === "none" ? `not on ${ls}` : `on ${ls}`
    }
    case "dateWithin": {
      const f = c.field.startsWith("attr:") ? names.attr(c.field.slice(5)) : DATE_FIELD_LABELS[c.field as keyof typeof DATE_FIELD_LABELS] ?? c.field
      return c.direction === "past"
        ? `${f} in the past ${c.days} days`
        : `${f} within ${c.days} days${c.includeOverdue ? " (or overdue)" : ""}`
    }
    case "attribute": {
      const a = names.attr(c.attributeId)
      if (c.op === "isSet") return `${a} is set`
      if (c.op === "isEmpty") return `${a} is empty`
      const op = { is: "is", isNot: "is not", contains: "contains", gt: ">", lt: "<" }[c.op]
      return `${a} ${op} ${String(c.value ?? "")}`
    }
    case "tag":
      return `${c.mode === "none" ? "no tag" : "tag"} ${c.tags.join(c.mode === "all" ? " and " : " or ") || "…"}`
    case "done":
      return c.done ? "is done" : "is not done"
    case "link": {
      const to = c.targetId ? ` ${c.targetId}` : c.targetTypeIds?.length ? ` any ${c.targetTypeIds.map(names.type).join(" or ")}` : ""
      return `${c.mode === "hasNot" ? "has no" : "has"} ${relationLabel(c.relation || "…")}${to}`
    }
  }
}

export const DATE_FIELD_LABELS = {
  deadline: "Due date",
  scheduledDate: "Scheduled date",
  createdAt: "Created",
  completedDate: "Completed date",
} as const
