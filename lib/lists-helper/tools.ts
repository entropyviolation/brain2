/**
 * lib/lists-helper/tools.ts — The Lists BIMBY's tool set (pure: read a World, return an answer or a Plan)
 *
 * Each tool is one small, closed job over lists and items. A tool never writes and never calls a model. It
 * resolves its scope, works out every edit, and returns a `Plan` that says how many items it touches and in what
 * way. `apply.ts` writes a plan after approval. Anything quick to automate lives here, so the chat (or a model
 * later) only has to pick a tool and fill its parameters.
 */

import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { applyItemMerge, defaultItemMergePlan, isHeldValue } from "@/lib/item-merge"
import {
  composeListAttributes,
  descendantTypeIds,
  itemsOfType,
  resolveItemSchema,
} from "@/lib/item-types"
import { createListItem, itemTitle, withListMembership } from "@/lib/item-utils"
import { listAllowedTypeIds } from "@/lib/list-item-types"
import { combineLists, combineSteps } from "@/lib/list-sets"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"
import type { AttributeDefinition, AttributeValue, Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import { dayKey, prettyDay } from "./dates"
import { findDuplicateGroups, normalizeTitle } from "./duplicates"
import { closest, titleOf } from "./resolve"
import { shoppingList } from "./shopping"
import { CONFIRM_COUNT_ABOVE, type Candidate, type ItemChange, type Plan, type ToolCall, type ToolName, type ToolResult, type World } from "./types"

export interface ToolSpec {
  name: ToolName
  label: string
  /** One sentence for the lab and the Blueprint. */
  does: string
  /** True when it can change data (always behind approval). */
  writes: boolean
  /** Parameter names, for display. */
  params: string[]
}

export const TOOLS: ToolSpec[] = [
  { name: "find-items", label: "Find items", does: "Counts and lists items by type, list, words, or a missing attribute.", writes: false, params: ["type", "list", "text", "lacks attribute"] },
  { name: "find-duplicates", label: "Find duplicates", does: "Groups items whose names match, ignoring case, punctuation, and one typo.", writes: false, params: ["type", "list"] },
  { name: "merge-items", label: "Merge items", does: "Folds items into one survivor, keeping every held value (the Lists merge).", writes: true, params: ["item ids", "survivor"] },
  { name: "exclusive-type", label: "Make one type primary", does: "Items of one type stop being another type; the first becomes primary.", writes: true, params: ["keep type", "drop type"] },
  { name: "copy-attributes", label: "Copy attributes", does: "Gives items every attribute a model item has, empty unless they already hold a value.", writes: true, params: ["from item id", "type or list"] },
  { name: "retype-items", label: "Change type", does: "Sets the primary type of items in a type or list.", writes: true, params: ["to type", "from type", "list"] },
  { name: "add-items", label: "Add items", does: "Adds items to a list with attribute values, skipping names already there.", writes: true, params: ["list", "titles", "attributes"] },
  { name: "merge-lists", label: "Merge lists", does: "Folds several lists into one: every item is kept and moves to the list that stays, the others are taken away, and the items can all be given one item type.", writes: true, params: ["lists", "list to keep", "item type"] },
  { name: "lookup-id", label: "Look up an id", does: "Finds the id of a list (optionally in a folder), item, folder or item type, and offers clickable candidates when more than one fits.", writes: false, params: ["kind", "name", "folder", "type"] },
  { name: "shopping-list", label: "Shopping list", does: "Finds every list of things to get (shopping, wanted, to order, a store, a shopping folder), folds same-name items, leaves out what is bought, and puts them on one list with your must-haves.", writes: true, params: ["list name", "must-haves", "skip lists"] },
  { name: "collect-items", label: "Collect items", does: "Puts items that match (a type, a list, not on another list, due between two days) on a list, or on a new list with its own folder and item type.", writes: true, params: ["type", "in list", "not in list", "due", "to list or new list", "folder", "item type"] },
]

export const toolSpec = (name: ToolName) => TOOLS.find((t) => t.name === name)!

const sample = (rows: string[], n = 8) => rows.slice(0, n)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const typeName = (w: World, id: string) => w.types.find((t) => String(t.id) === id)?.name ?? id
const listName = (w: World, id: string) => w.lists.find((l) => l.id === id)?.name ?? id

function signatureOf(parts: unknown): string {
  return JSON.stringify(parts)
}

/** Items of a type: primary type or a list that pins it, subtypes included (the Lists rule). */
export function itemsInScope(w: World, scope: { typeId?: string; listId?: string }): Task[] {
  let rows = w.tasks
  if (scope.typeId) rows = itemsOfType(scope.typeId, rows, w.lists, w.types)
  if (scope.listId) rows = rows.filter((t) => (t.lists ?? []).includes(scope.listId!))
  return rows
}

function scopeLabel(w: World, s: { typeId?: string; listId?: string }): string {
  const parts = [s.typeId ? `${typeName(w, s.typeId)} items` : "items"]
  if (s.listId) parts.push(`in "${listName(w, s.listId)}"`)
  return parts.join(" ")
}

// ---------------------------------------------------------------- find-items

function findItems(w: World, c: Extract<ToolCall, { tool: "find-items" }>): ToolResult {
  let rows = itemsInScope(w, c)
  if (c.text) {
    const q = normalizeTitle(c.text)
    rows = rows.filter((t) => normalizeTitle(itemTitle(t) ?? "").includes(q))
  }
  if (c.lacksAttribute) {
    const want = c.lacksAttribute.trim().toLowerCase()
    const defsOf = (t: Task) => [...resolveItemSchema(t, w.lists, w.types), ...(t.itemAttributeDefinitions ?? [])]
    const match = (d: AttributeDefinition) => d.id.toLowerCase() === want || d.name.toLowerCase() === want
    // An attribute nothing in scope has is a misread, not "everything lacks it": say what exists instead.
    if (rows.length && !rows.some((t) => defsOf(t).some(match))) {
      const known = [...new Set(rows.slice(0, 500).flatMap((t) => defsOf(t).map((d) => d.name)))].slice(0, 12)
      return { kind: "error", text: `No ${scopeLabel(w, c)} have an attribute called "${c.lacksAttribute}".${known.length ? ` Attributes I see: ${known.join(", ")}.` : ""}` }
    }
    rows = rows.filter((t) => {
      const def = defsOf(t).find(match)
      return !def || !isHeldValue(t.attributes?.[def.id])
    })
  }
  const what = scopeLabel(w, c) + (c.text ? ` named like "${c.text}"` : "") + (c.lacksAttribute ? ` with no ${c.lacksAttribute}` : "")
  if (!rows.length) return { kind: "answer", text: `No ${what}.` }
  return { kind: "answer", text: `${plural(rows.length, "match", "matches")}: ${what}.`, rows: sample(rows.map(titleOf), 12) }
}

// ---------------------------------------------------------------- find-duplicates

export function duplicates(w: World, c: Extract<ToolCall, { tool: "find-duplicates" }>, isDismissed: (k: string) => boolean): ToolResult {
  const ids = new Set(itemsInScope(w, c).map((t) => t.id))
  const groups = findDuplicateGroups(w.tasks.filter((t) => ids.has(t.id)), isDismissed)
  return { kind: "groups", groups, scope: scopeLabel(w, c) }
}

// ---------------------------------------------------------------- merge-items

function mergeScore(t: Task): number {
  return Object.values(t.attributes ?? {}).filter((v) => isHeldValue(v)).length + (t.notes ? 2 : 0) + (t.links?.length ?? 0) + (t.tags?.length ?? 0)
}

function mergeItems(w: World, c: Extract<ToolCall, { tool: "merge-items" }>): ToolResult {
  const ids = [...new Set(c.ids)]
  const items = ids.map((id) => w.tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  if (items.length < 2) return { kind: "error", text: "I need at least two items that still exist to merge." }
  const ordered = [...items].sort((a, b) => {
    if (c.survivorId) return a.id === c.survivorId ? -1 : b.id === c.survivorId ? 1 : 0
    return mergeScore(b) - mergeScore(a) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const merge = defaultItemMergePlan(ordered, w.lists)
  if (!merge) return { kind: "error", text: "I couldn't build a merge for those." }
  const survivor = ordered[0]!
  const plan: Plan = {
    tool: "merge-items",
    working: "Merging items",
    title: `Merge ${items.length} items into "${titleOf(survivor)}"`,
    summary: [
      `"${titleOf(survivor)}" stays. ${plural(items.length - 1, "other")} fold into it and ${items.length - 1 === 1 ? "is" : "are"} removed.`,
      "Every held value is kept: tags, notes, links, lists, and attributes are combined, never dropped.",
    ],
    impacts: [
      { count: 1, label: "kept, with combined details" },
      { count: items.length - 1, label: "folded in and removed" },
    ],
    samples: sample(items.map(titleOf)),
    warnings: [],
    oneTime: true,
    changes: [],
    merge,
    total: items.length,
    signature: signatureOf({ m: merge.survivorId, d: merge.discardedIds }),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- exclusive-type

const GENERIC_IDS = new Set(["", "item", "task"])

function exclusiveType(w: World, c: Extract<ToolCall, { tool: "exclusive-type" }>): ToolResult {
  if (c.keep === c.drop) return { kind: "error", text: "Those are the same type." }
  const keepIds = descendantTypeIds(c.keep, w.types)
  const dropIds = new Set([...descendantTypeIds(c.drop, w.types)].filter((id) => !keepIds.has(id)))
  const keepName = typeName(w, c.keep)
  const dropName = typeName(w, c.drop)
  const targets = itemsOfType(c.keep, w.tasks, w.lists, w.types)

  // A list "carries" the dropped type when it allows it and none of the kept ones. Those memberships are what make
  // an item read as both. Smart and aggregate lists are derived, so they are never edited.
  const carries = new Map<string, boolean>()
  for (const l of w.lists) {
    const allowed = listAllowedTypeIds(l).map(String)
    carries.set(l.id, allowed.some((id) => dropIds.has(id)) && !allowed.some((id) => keepIds.has(id)) && !isNaSmartCategoryId(l.id) && !isFolderAllItemsCategoryId(l.id))
  }

  const changes: ItemChange[] = []
  const left = new Map<string, number>()
  let retyped = 0
  let orphanSkips = 0
  let otherPrimary = 0
  for (const t of targets) {
    const patch: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const notes: string[] = []
    const own = String(t.type ?? "")
    const dropAsOwn = dropIds.has(own)
    if (own !== c.keep && !keepIds.has(own)) {
      if (dropAsOwn || GENERIC_IDS.has(own)) {
        patch.type = c.keep
        before.type = t.type
        notes.push(`primary ${own || "item"} → ${keepName}`)
        retyped++
      } else {
        otherPrimary++
      }
    }
    const leaving = (t.lists ?? []).filter((id) => carries.get(id))
    const staying = (t.lists ?? []).filter((id) => !carries.get(id))
    if (leaving.length && !staying.length) {
      orphanSkips++
    } else if (leaving.length) {
      patch.lists = staying
      patch.listMembershipExclusions = [...new Set([...(t.listMembershipExclusions ?? []), ...leaving])]
      before.lists = t.lists
      before.listMembershipExclusions = t.listMembershipExclusions
      for (const id of leaving) left.set(id, (left.get(id) ?? 0) + 1)
      notes.push(`leaves ${leaving.map((id) => `"${listName(w, id)}"`).join(", ")}`)
    }
    if (Object.keys(patch).length) changes.push({ id: t.id, title: titleOf(t), patch, before, note: notes.join("; ") })
  }

  if (!changes.length) {
    return { kind: "answer", text: `Nothing to change: no ${keepName} item reads as ${dropName} as well (${plural(targets.length, "item")} checked).` }
  }
  const impacts = [
    { count: changes.length, label: `of ${targets.length} ${keepName} items change` },
    ...(retyped ? [{ count: retyped, label: `primary type ${dropName} → ${keepName}` }] : []),
    ...[...left.entries()].map(([id, n]) => ({ count: n, label: `leave the "${listName(w, id)}" list (it pins ${dropName})` })),
  ]
  const warnings = [
    ...(orphanSkips ? [`${plural(orphanSkips, "item")} left alone: their only list is a ${dropName} list, and removing it would hide them.`] : []),
    ...(otherPrimary ? [`${plural(otherPrimary, "item")} keep their own specific primary type; only their ${dropName} lists change.`] : []),
  ]
  const plan: Plan = {
    tool: "exclusive-type",
    working: `Rewriting ${keepName} items`,
    title: `${keepName} items stop being ${dropName}`,
    summary: [
      `${keepName} becomes the primary type of every ${keepName} item that was also ${dropName}.`,
      `They are taken off lists that exist only for ${dropName}, and those lists will not take them back.`,
      "One time only: it does not change the lists, and new items are not affected.",
    ],
    impacts,
    samples: sample(changes.map((x) => x.title)),
    warnings,
    oneTime: true,
    changes,
    total: changes.length,
    signature: signatureOf(changes.map((x) => [x.id, x.patch])),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- copy-attributes

function inferType(value: AttributeValue): AttributeDefinition["type"] {
  return typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string"
}

export function modelAttributes(w: World, source: Task): AttributeDefinition[] {
  const byId = new Map<string, AttributeDefinition>()
  for (const d of resolveItemSchema(source, w.lists, w.types)) byId.set(d.id, d)
  for (const d of source.itemAttributeDefinitions ?? []) byId.set(d.id, d)
  for (const [key, value] of Object.entries(source.attributes ?? {})) {
    if (!byId.has(key) && isHeldValue(value)) byId.set(key, { id: key, name: key, type: inferType(value) })
  }
  return [...byId.values()]
}

function copyAttributes(w: World, c: Extract<ToolCall, { tool: "copy-attributes" }>): ToolResult {
  const source = w.tasks.find((t) => t.id === c.fromItemId)
  if (!source) return { kind: "error", text: `I can't find item ${c.fromItemId}.` }
  const defs = modelAttributes(w, source)
  if (!defs.length) return { kind: "answer", text: `"${titleOf(source)}" has no attributes to copy.` }
  const targets = itemsInScope(w, c).filter((t) => t.id !== source.id)
  if (!c.typeId && !c.listId) return { kind: "error", text: "Copy to which items? Name a type (\"all Book items\") or a list." }

  const changes: ItemChange[] = []
  const gained = new Map<string, number>()
  for (const t of targets) {
    const have = [...resolveItemSchema(t, w.lists, w.types), ...(t.itemAttributeDefinitions ?? [])]
    const haveIds = new Set([...have.map((d) => d.id), ...Object.keys(t.attributes ?? {})])
    const haveNames = new Set(have.map((d) => d.name.trim().toLowerCase()))
    const missing = defs.filter((d) => !haveIds.has(d.id) && !haveNames.has(d.name.trim().toLowerCase()))
    if (!missing.length) continue
    for (const d of missing) gained.set(d.name, (gained.get(d.name) ?? 0) + 1)
    changes.push({
      id: t.id,
      title: titleOf(t),
      patch: { itemAttributeDefinitions: [...(t.itemAttributeDefinitions ?? []), ...missing] },
      before: { itemAttributeDefinitions: t.itemAttributeDefinitions },
      note: `gains ${missing.map((m) => m.name).join(", ")}`,
    })
  }
  const scope = scopeLabel(w, c)
  if (!changes.length) {
    return { kind: "answer", text: `Nothing to change: all ${plural(targets.length, scope === "items" ? "item" : scope.replace(/ items/, " item"))} already have every attribute "${titleOf(source)}" has (${defs.map((d) => d.name).join(", ")}).` }
  }
  const plan: Plan = {
    tool: "copy-attributes",
    working: "Adding attributes",
    title: `Give ${scope} the attributes of "${titleOf(source)}"`,
    summary: [
      `"${titleOf(source)}" has ${plural(defs.length, "attribute")}: ${defs.map((d) => d.name).join(", ")}.`,
      "Each item below gets the ones it lacks, empty. A value an item already holds is never touched.",
    ],
    impacts: [
      { count: changes.length, label: `of ${targets.length} items gain attributes` },
      ...[...gained.entries()].map(([name, n]) => ({ count: n, label: `gain "${name}"` })),
    ],
    samples: sample(changes.map((x) => `${x.title} — ${x.note}`)),
    warnings: [],
    oneTime: true,
    changes,
    total: changes.length,
    signature: signatureOf(changes.map((x) => [x.id, (x.patch.itemAttributeDefinitions as AttributeDefinition[]).map((d) => d.id)])),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- retype-items

function retypeItems(w: World, c: Extract<ToolCall, { tool: "retype-items" }>): ToolResult {
  if (!c.from && !c.listId) return { kind: "error", text: "Change the type of which items? Name a type or a list." }
  // "apply new item type X": the type is made on approval (undo takes it away), unless one by that name exists.
  let to = c.to
  let made: ItemTypeDefinition | undefined
  const warnings = ["Lists that pin another type still make these items read as that type too."]
  if (c.newTypeName?.trim()) {
    const existing = w.types.find((t) => sameName(t.name, c.newTypeName!))
    if (existing) {
      to = String(existing.id)
      warnings.unshift(`An item type "${existing.name}" already exists, so I use that one.`)
    } else {
      made = newType(w, c.newTypeName)
      to = String(made.id)
    }
  }
  const pool = c.from
    ? w.tasks.filter((t) => descendantTypeIds(c.from!, w.types).has(String(t.type ?? "")))
    : itemsInScope(w, { listId: c.listId })
  const rows = (c.listId ? pool.filter((t) => (t.lists ?? []).includes(c.listId!)) : pool).filter((t) => String(t.type ?? "") !== to)
  const toName = made ? made.name : typeName(w, to)
  if (!rows.length) return { kind: "answer", text: `Nothing to change: no matching item is not already ${toName}.` }
  const changes: ItemChange[] = rows.map((t) => ({
    id: t.id,
    title: titleOf(t),
    patch: { type: to },
    before: { type: t.type },
    note: `${String(t.type ?? "item")} → ${toName}`,
  }))
  const plan: Plan = {
    tool: "retype-items",
    working: `Changing types to ${toName}`,
    title: `Make ${plural(rows.length, "item")} ${toName}`,
    summary: [`Their primary type becomes ${toName}. Lists and values are not touched.`],
    impacts: [...(made ? [{ count: 1, label: `new item type "${made.name}"` }] : []), { count: rows.length, label: `primary type → ${toName}` }],
    samples: sample(changes.map((x) => x.title)),
    warnings,
    oneTime: true,
    changes,
    ...(made ? { setup: { type: made } } : {}),
    total: rows.length,
    signature: signatureOf({ c: changes.map((x) => [x.id, x.patch]), made: made?.name }),
  }
  return { kind: "plan", plan }
}

/** A bare item type, as the collect tool makes for "new item type X". */
function newType(w: World, name: string): ItemTypeDefinition {
  const label = name.trim()
  const id = uniqueId(new Set(w.types.map((t) => String(t.id))), slug(label))
  return { id, name: label, pluralName: label.endsWith("s") ? label : `${label}s`, itemLabel: label.toLowerCase(), description: "Made by the Lists BIMBY.", detailPanels: ["details"], attributes: [], capabilities: {} }
}

// ---------------------------------------------------------------- add-items

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "field"
}

function coerce(def: AttributeDefinition, raw: string): { ok: true; value: AttributeValue } | { ok: false; why: string } {
  const v = raw.trim()
  switch (def.type) {
    case "number": {
      const n = Number(v.replace(/,/g, ""))
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, why: `"${v}" is not a number` }
    }
    case "boolean":
      if (/^(yes|y|true|on|1)$/i.test(v)) return { ok: true, value: true }
      if (/^(no|n|false|off|0)$/i.test(v)) return { ok: true, value: false }
      return { ok: false, why: `"${v}" is not yes or no` }
    case "selection": {
      const opt = (def.options ?? []).find((o) => o.toLowerCase() === v.toLowerCase())
      return opt ? { ok: true, value: opt } : { ok: false, why: `"${v}" is not one of ${(def.options ?? []).join(", ")}` }
    }
    default:
      return { ok: true, value: v }
  }
}

function addItems(w: World, c: Extract<ToolCall, { tool: "add-items" }>, now: Date): ToolResult {
  const list = w.lists.find((l) => l.id === c.listId)
  if (!list) return { kind: "error", text: `I can't find list ${c.listId}.` }
  if (isNaSmartCategoryId(list.id) || isFolderAllItemsCategoryId(list.id)) return { kind: "error", text: `"${list.name}" fills itself, so I can't add to it directly.` }
  const titles = [...new Set(c.titles.map((t) => t.trim()).filter(Boolean))]
  if (!titles.length) return { kind: "error", text: "Add which items? Give me at least one name." }

  const schema = composeListAttributes(list, w.types)
  const warnings: string[] = []
  const attrs: { def: AttributeDefinition; value: AttributeValue; fresh: boolean }[] = []
  for (const [name, raw] of Object.entries(c.attributes)) {
    const def = schema.find((d) => d.id.toLowerCase() === name.toLowerCase() || d.name.toLowerCase() === name.toLowerCase())
    if (def) {
      const got = coerce(def, raw)
      if (got.ok) attrs.push({ def, value: got.value, fresh: false })
      else warnings.push(`${def.name}: ${got.why}, so I left it out.`)
    } else {
      attrs.push({ def: { id: slug(name), name: name.trim(), type: "string" }, value: raw.trim(), fresh: true })
      warnings.push(`"${list.name}" has no "${name}" attribute, so it becomes a text field on these items only.`)
    }
  }

  const existing = new Set(w.tasks.filter((t) => (t.lists ?? []).includes(list.id)).map((t) => normalizeTitle(itemTitle(t) ?? "")))
  const creates: Task[] = []
  const skipped: string[] = []
  for (const title of titles) {
    if (existing.has(normalizeTitle(title))) {
      skipped.push(title)
      continue
    }
    let item = withListMembership(createListItem(title, [list.id]), list, w.types) as Task
    const values: Record<string, AttributeValue> = { ...(item.attributes ?? {}) }
    for (const a of attrs) values[a.def.id] = a.value
    const fresh = attrs.filter((a) => a.fresh).map((a) => a.def)
    item = {
      ...item,
      createdAt: now,
      attributes: Object.keys(values).length ? values : item.attributes,
      ...(fresh.length ? { itemAttributeDefinitions: fresh } : {}),
    }
    creates.push(item)
  }
  if (skipped.length) warnings.push(`Already in "${list.name}", so skipped: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}.`)
  if (!creates.length) return { kind: "answer", text: `Nothing to add: everything you named is already in "${list.name}".` }

  const plan: Plan = {
    tool: "add-items",
    working: "Adding items",
    title: `Add ${plural(creates.length, "item")} to "${list.name}"`,
    summary: [
      attrs.length
        ? `Each new item gets ${attrs.map((a) => `${a.def.name} = ${String(a.value)}`).join(", ")}.`
        : "Each new item is added with the list's defaults.",
    ],
    impacts: [{ count: creates.length, label: `new in "${list.name}"` }],
    samples: sample(creates.map(titleOf)),
    warnings,
    oneTime: true,
    changes: [],
    creates,
    total: creates.length,
    signature: signatureOf({ l: list.id, t: creates.map(titleOf), a: attrs.map((a) => [a.def.id, a.value]) }),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- collect-items

/** The day an item is due: its deadline, else a must-be-done-before constraint, else its scheduled day. */
function dueKey(t: Task): string | null {
  const v = t.deadline ?? t.schedulingConstraints?.mustBeDoneBefore ?? t.scheduledDate
  if (!v) return null
  const d = new Date(v as string | Date)
  return Number.isNaN(d.getTime()) ? null : dayKey(d)
}

const sameName = (a: string, b: string) => normalizeTitle(a) === normalizeTitle(b)

function uniqueId(taken: Set<string>, base: string): string {
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

function describeFilter(w: World, f: Extract<ToolCall, { tool: "collect-items" }>["filter"]): string {
  const parts = [f.typeId ? `${typeName(w, f.typeId)} items` : "items"]
  for (const id of f.inListIds ?? []) parts.push(`in "${listName(w, id)}"`)
  if (f.inAnyListIds?.length) parts.push(`in ${f.inAnyListIds.map((id) => `"${listName(w, id)}"`).join(" or ")}`)
  for (const id of f.notInListIds ?? []) parts.push(`not in "${listName(w, id)}"`)
  if (f.due) parts.push(`due ${f.due.from && f.due.to ? (f.due.from === f.due.to ? `on ${prettyDay(f.due.from)}` : `${prettyDay(f.due.from)} to ${prettyDay(f.due.to)}`) : f.due.to ? (f.due.label === "overdue" ? "before today (overdue)" : `by ${prettyDay(f.due.to)}`) : `from ${prettyDay(f.due.from!)}`}`)
  return parts.join(", ")
}

function collectItems(w: World, c: Extract<ToolCall, { tool: "collect-items" }>, now: Date): ToolResult {
  const f = c.filter
  if (!f.typeId && !f.inListIds?.length && !f.inAnyListIds?.length && !f.notInListIds?.length && !f.due) {
    return { kind: "error", text: "Collect which items? Name a type, a list they are in (or not in), or a due date. I won't gather everything." }
  }

  // Destination first: an existing list, or the pieces of a new one.
  let dest: List
  let setup: Plan["setup"]
  const impacts: Plan["impacts"] = []
  const warnings: string[] = []
  if ("listId" in c.dest) {
    const destId = c.dest.listId
    const found = w.lists.find((l) => l.id === destId)
    if (!found) return { kind: "error", text: `I can't find list ${destId}.` }
    if (isNaSmartCategoryId(found.id) || isFolderAllItemsCategoryId(found.id)) return { kind: "error", text: `"${found.name}" fills itself, so I can't add to it directly.` }
    dest = found
  } else {
    const nl = c.dest.newList
    const name = nl.name.trim()
    if (!name) return { kind: "error", text: "What should the new list be called?" }
    const clash = w.lists.find((l) => sameName(l.name, name))
    if (clash) return { kind: "error", text: `A list called "${clash.name}" already exists. Say it as "to list ${clash.name}" to add to that one, or pick another name.` }

    let typeId = nl.typeId
    let type: ItemTypeDefinition | undefined
    if (nl.newTypeName?.trim()) {
      const existing = w.types.find((t) => sameName(t.name, nl.newTypeName!))
      if (existing) {
        typeId = String(existing.id)
        warnings.push(`An item type "${existing.name}" already exists, so the new list uses that one.`)
      } else {
        type = newType(w, nl.newTypeName)
        typeId = String(type.id)
      }
    }
    let folder: Folder | undefined
    let fileIn = nl.folderId
    if (fileIn && !(w.folders ?? []).some((f2) => f2.id === fileIn)) return { kind: "error", text: `I can't find that folder.` }
    if (nl.newFolderName?.trim()) {
      const existing = (w.folders ?? []).find((f2) => sameName(f2.name, nl.newFolderName!))
      if (existing) fileIn = existing.id
      else folder = { id: uniqueId(new Set((w.folders ?? []).map((f2) => f2.id)), `${now.getTime()}-f`), name: nl.newFolderName.trim(), createdAt: now, listIds: [] }
    }
    const listId = uniqueId(new Set(w.lists.map((l) => l.id)), String(now.getTime()))
    dest = {
      id: listId,
      name,
      color: "#3B82F6",
      createdAt: now,
      order: w.lists.length,
      ...(typeId ? { itemTypeId: typeId, itemTypeIds: [typeId] } : {}),
    }
    if (folder) folder = { ...folder, listIds: [listId] }
    setup = { list: dest, ...(folder ? { folder } : {}), ...(fileIn ? { fileInFolderId: fileIn } : {}), ...(type ? { type } : {}) }
    const where = folder ? ` in new folder "${folder.name}"` : fileIn ? ` in folder "${(w.folders ?? []).find((f2) => f2.id === fileIn)?.name}"` : ""
    impacts.push({ count: 1, label: `new list "${name}"${where}` })
    if (type) impacts.push({ count: 1, label: `new item type "${type.name}", which the list pins` })
    else if (typeId) impacts.push({ count: 1, label: `the list pins the "${typeName(w, typeId)}" item type` })
  }

  // The items. Each stage is noted so the chat can show how the set narrowed.
  const trace: string[] = []
  let rows = w.tasks.filter((t) => !t.stepOf && String(t.type ?? "") !== "action" && String(t.type ?? "") !== "step")
  trace.push(`Start: ${plural(rows.length, "item")} in the store (steps and logged actions left out).`)
  if (f.typeId) {
    rows = itemsOfType(f.typeId, rows, w.lists, w.types)
    trace.push(`Item type ${typeName(w, f.typeId)}: ${rows.length} remain.`)
  }
  const nameOf = (id: string) => listName(w, id)
  const expr = { all: f.inListIds, any: f.inAnyListIds, none: f.notInListIds }
  for (const st of combineSteps(rows, expr, nameOf).slice(1)) trace.push(`List set, ${st.label}: ${st.count} remain.`)
  rows = combineLists(rows, expr)
  let undated = 0
  if (f.due) {
    const { from, to } = f.due
    rows = rows.filter((t) => {
      const k = dueKey(t)
      if (!k) {
        undated++
        return false
      }
      return (!from || k >= from) && (!to || k <= to)
    })
    trace.push(`Due ${f.due.label ?? "in range"}: ${rows.length} remain (${undated} had no due date).`)
  }
  let done = 0
  if (!f.includeDone) {
    const before = rows.length
    rows = rows.filter((t) => !t.completed)
    done = before - rows.length
    trace.push(`Finished items out: ${done} dropped, ${rows.length} remain.`)
  }
  const what = describeFilter(w, f)
  const already = rows.filter((t) => (t.lists ?? []).includes(dest.id))
  rows = rows.filter((t) => !(t.lists ?? []).includes(dest.id))
  if (!rows.length) {
    trace.push("Nothing left to add.")
    return { trace, kind: "answer", text: already.length ? `Nothing to add: all ${plural(already.length, "match", "matches")} (${what}) are already in "${dest.name}".` : `No items match: ${what}.` }
  }

  const changes: ItemChange[] = rows.map((t) => {
    const patch: Record<string, unknown> = { lists: [...(t.lists ?? []), dest.id] }
    const before: Record<string, unknown> = { lists: t.lists }
    if ((t.listMembershipExclusions ?? []).includes(dest.id)) {
      patch.listMembershipExclusions = (t.listMembershipExclusions ?? []).filter((id) => id !== dest.id)
      before.listMembershipExclusions = t.listMembershipExclusions
    }
    return { id: t.id, title: titleOf(t), patch, before, note: `joins "${dest.name}"` }
  })
  if (already.length) warnings.push(`${plural(already.length, "match", "matches")} already in "${dest.name}", so skipped.`)
  if (done) warnings.push(`${plural(done, "finished item")} left out. Say "including done items" to add those too.`)
  if (undated) warnings.push(`${plural(undated, "item")} have no due date, so they do not count as due.`)
  if (setup?.list?.itemTypeId) warnings.push(`Their own types are not changed. Because the list pins "${typeName(w, setup.list.itemTypeId)}", they read as that type there.`)
  warnings.push("Items stay on the lists they are already on. Nothing is copied or removed.")

  trace.push(already.length ? `${plural(already.length, "match", "matches")} already on "${dest.name}": skipped.` : `None are on "${dest.name}" yet.`)
  trace.push(`Plan: ${plural(rows.length, "item")} would join "${dest.name}". Nothing written yet.`)
  const plan: Plan = {
    trace,
    tool: "collect-items",
    working: `Adding items to ${dest.name}`,
    title: `Add ${plural(rows.length, "item")} to ${setup ? "a new list" : "list"} "${dest.name}"`,
    summary: [`Gathers ${what}.`, setup ? `They go onto the new list "${dest.name}".` : `They go onto "${dest.name}".`],
    impacts: [...impacts, { count: rows.length, label: `join "${dest.name}"` }],
    samples: sample(changes.map((x) => x.title)),
    warnings,
    oneTime: true,
    changes,
    ...(setup ? { setup } : {}),
    total: rows.length,
    signature: signatureOf({ ids: changes.map((x) => x.id), d: setup ? ["new", dest.name, setup.type?.name ?? dest.itemTypeId, setup.folder?.name ?? setup.fileInFolderId] : dest.id }),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- merge-lists

/** A list the app makes and guards itself: it cannot be taken away, so it can only be the one that stays. */
const isGuardedList = (l: List) =>
  isNaSmartCategoryId(l.id) || isFolderAllItemsCategoryId(l.id) || l.id === "reminders" || l.id === "people-i-know" || !!(l.reminderList || l.peopleList || l.instagramFollowingList || l.instagramFollowersList || l.instagramAnalysisList)

function mergeLists(w: World, c: Extract<ToolCall, { tool: "merge-lists" }>): ToolResult {
  const lists = [...new Set(c.listIds)].map((id) => w.lists.find((l) => l.id === id))
  if (lists.some((l) => !l)) return { kind: "error", text: "One of those lists no longer exists." }
  const all = lists as List[]
  if (all.length < 2) return { kind: "error", text: "Merge needs two or more lists." }
  const smart = all.find((l) => isNaSmartCategoryId(l.id) || isFolderAllItemsCategoryId(l.id))
  if (smart) return { kind: "error", text: `"${smart.name}" fills itself, so it can't be merged into another list.` }
  const count = (id: string) => w.tasks.filter((t) => (t.lists ?? []).includes(id)).length
  const guarded = all.filter(isGuardedList)
  if (guarded.length > 1) return { kind: "error", text: `${guarded.map((l) => `"${l.name}"`).join(" and ")} are lists the app keeps, so they can't be folded into each other.` }
  const keep = (c.keepId && all.find((l) => l.id === c.keepId)) || guarded[0] || [...all].sort((a, b) => count(b.id) - count(a.id))[0]!
  const drop = all.filter((l) => l.id !== keep.id)
  const dropIds = new Set(drop.map((l) => l.id))

  let to = c.typeId
  let made: ItemTypeDefinition | undefined
  const warnings: string[] = []
  if (c.newTypeName?.trim()) {
    const existing = w.types.find((t) => sameName(t.name, c.newTypeName!))
    if (existing) {
      to = String(existing.id)
      warnings.push(`An item type "${existing.name}" already exists, so I use that one.`)
    } else {
      made = newType(w, c.newTypeName)
      to = String(made.id)
    }
  }
  const toName = made ? made.name : to ? typeName(w, to) : undefined

  const trace = all.map((l) => `"${l.name}"${l.id === keep.id ? " (stays)" : ""}: ${plural(count(l.id), "item")}.`)
  const rows = w.tasks.filter((t) => (t.lists ?? []).some((id) => id === keep.id || dropIds.has(id)))
  const changes: ItemChange[] = []
  for (const t of rows) {
    const had = t.lists ?? []
    const lists2 = [...had.filter((id) => !dropIds.has(id)), ...(had.includes(keep.id) ? [] : [keep.id])]
    const patch: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const notes: string[] = []
    if (JSON.stringify(lists2) !== JSON.stringify(had)) {
      patch.lists = lists2
      before.lists = t.lists
      notes.push(had.includes(keep.id) ? "leaves the other list" : `moves to "${keep.name}"`)
    }
    const ex = t.listMembershipExclusions ?? []
    if (ex.includes(keep.id) || ex.some((id) => dropIds.has(id))) {
      patch.listMembershipExclusions = ex.filter((id) => id !== keep.id && !dropIds.has(id))
      before.listMembershipExclusions = t.listMembershipExclusions
    }
    if (to && String(t.type ?? "") !== to) {
      patch.type = to
      before.type = t.type
      notes.push(`${String(t.type ?? "item")} → ${toName}`)
    }
    if (Object.keys(patch).length) changes.push({ id: t.id, title: titleOf(t), patch, before, note: notes.join("; ") })
  }
  const onMany = rows.filter((t) => (t.lists ?? []).filter((id) => id === keep.id || dropIds.has(id)).length > 1).length
  if (onMany) warnings.push(`${plural(onMany, "item")} sat on more than one of these lists, so each ends up once on "${keep.name}".`)
  if (keep.itemTypeId && to && keep.itemTypeId !== to) warnings.push(`"${keep.name}" pins the "${typeName(w, keep.itemTypeId)}" item type, so its items still read as that type there.`)
  warnings.push(`The other ${plural(drop.length, "list")} (${drop.map((l) => `"${l.name}"`).join(", ")}) are taken away, with their own settings. Say "undo" to bring them back.`)
  trace.push(`Plan: ${plural(changes.length, "item")} change; ${plural(drop.length, "list")} go.`)
  const plan: Plan = {
    trace,
    tool: "merge-lists",
    working: `Merging into ${keep.name}`,
    title: `Merge ${plural(all.length, "list")} into "${keep.name}"`,
    summary: [`Every item stays and ends up on "${keep.name}".`, ...(toName ? [`Every item on them becomes ${toName}.`] : [])],
    impacts: [
      ...(made ? [{ count: 1, label: `new item type "${made.name}"` }] : []),
      { count: drop.length, label: `${drop.length === 1 ? "list" : "lists"} folded into "${keep.name}" and removed` },
      { count: changes.length, label: `${changes.length === 1 ? "item" : "items"} edited${toName ? `, type → ${toName}` : ""}` },
    ],
    samples: sample(changes.map((x) => x.title)),
    warnings,
    oneTime: true,
    changes,
    ...(made ? { setup: { type: made } } : {}),
    dropLists: drop.map((list) => ({ list, folderId: w.folders?.find((f) => f.listIds.includes(list.id))?.id })),
    total: Math.max(changes.length, drop.length),
    signature: signatureOf({ keep: keep.id, drop: drop.map((l) => l.id), c: changes.map((x) => [x.id, x.patch]), made: made?.name }),
  }
  return { kind: "plan", plan }
}

// ---------------------------------------------------------------- lookup-id

const norm = (s: string) => s.toLowerCase().replace(/["“”'‘’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

/** Rank a name against the words: 0 exact, 1 starts with, 2 contains, 3 every word present, else none. */
function rank(name: string, words: string): number | undefined {
  const n = norm(name)
  const q = norm(words)
  if (!q) return undefined
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.includes(q)) return 2
  const ns = new Set(n.split(" "))
  return q.split(" ").every((x) => ns.has(x)) ? 3 : undefined
}

function lookupId(w: World, c: Extract<ToolCall, { tool: "lookup-id" }>): ToolResult {
  const pool: { id: string; name: string; detail?: string }[] = []
  const folderOf = (listId: string) => w.folders?.find((f) => f.listIds.includes(listId))?.name
  if (c.what === "list") {
    const inFolder = c.folderId ? new Set(w.folders?.find((f) => f.id === c.folderId)?.listIds ?? []) : undefined
    for (const l of w.lists) if (!inFolder || inFolder.has(l.id)) pool.push({ id: l.id, name: l.name, detail: folderOf(l.id) ? `in ${folderOf(l.id)}` : undefined })
  } else if (c.what === "folder") for (const f of w.folders ?? []) pool.push({ id: f.id, name: f.name, detail: `${f.listIds.length} lists` })
  else if (c.what === "type") for (const t of w.types) pool.push({ id: String(t.id), name: t.name })
  else {
    const rows = c.typeId ? itemsInScope(w, { typeId: c.typeId }) : w.tasks
    for (const t of rows) pool.push({ id: t.id, name: titleOf(t), detail: t.type && t.type !== "task" ? typeName(w, String(t.type)) : undefined })
  }
  const trace = [`Looking for a ${c.what} matching "${c.words}"${c.folderId ? ` in folder "${w.folders?.find((f) => f.id === c.folderId)?.name}"` : ""}${c.typeId ? ` of type ${typeName(w, c.typeId)}` : ""}: ${plural(pool.length, c.what)} to compare.`]
  const exactId = pool.find((r) => r.id === c.words.trim())
  const ranked = exactId
    ? [{ r: exactId, k: -1 }]
    : pool.flatMap((r) => {
        const k = rank(r.name, c.words)
        return k === undefined ? [] : [{ r, k }]
      }).sort((a, b) => a.k - b.k)
  const best = ranked.length ? ranked[0]!.k : undefined
  // An exact name wins outright unless several share it.
  const kept = best === 0 || best === -1 ? ranked.filter((x) => x.k === best) : ranked
  trace.push(`${plural(kept.length, "candidate")}${best === 0 ? " (exact name)" : ""}.`)
  const other: Candidate = { id: "other", label: "Other…", detail: `search all ${c.what}s`, text: `search ${c.what}s`, other: true }
  if (!kept.length) {
    // Nothing fits as typed: offer the closest names, and always a way to search by other words.
    const near = closest(pool, c.words, 8)
    trace.push(near.length ? `No name fits; ${plural(near.length, "close name")}.` : "No name is close.")
    const candidates: Candidate[] = [...near.map((r) => ({ id: r.id, label: r.name, detail: r.detail, text: `what is the ${c.what} id for ${r.id}`, ...(c.what === "list" ? { peek: `peek list ${r.id}` } : {}) })), other]
    return { kind: "answer", text: near.length ? `No ${c.what} is called "${c.words}". Is it one of these?` : `No ${c.what} fits "${c.words}". Search for it with other words:`, trace, candidates }
  }
  const candidates: Candidate[] = kept.slice(0, 12).map(({ r }) => ({ id: r.id, label: r.name, detail: r.detail, text: `what is the ${c.what} id for ${r.id}`, ...(c.what === "list" ? { peek: `peek list ${r.id}` } : {}) }))
  if (kept.length === 1) return { kind: "answer", text: `The ${c.what} id for "${candidates[0]!.label}" is ${candidates[0]!.id}`, trace, candidates }
  return { kind: "answer", text: `${plural(kept.length, "possible match", "possible matches")} for "${c.words}". Click the one you mean, or Other to search:`, trace, candidates: [...candidates, other] }
}

// ---------------------------------------------------------------- entry

/** Run one tool call against a snapshot. Never writes. */
export function runTool(w: World, call: ToolCall, opts: { now?: Date; isDismissed?: (key: string) => boolean } = {}): ToolResult {
  const now = opts.now ?? new Date()
  switch (call.tool) {
    case "find-items":
      return findItems(w, call)
    case "find-duplicates":
      return duplicates(w, call, opts.isDismissed ?? (() => false))
    case "merge-items":
      return mergeItems(w, call)
    case "exclusive-type":
      return exclusiveType(w, call)
    case "copy-attributes":
      return copyAttributes(w, call)
    case "retype-items":
      return retypeItems(w, call)
    case "add-items":
      return addItems(w, call, now)
    case "collect-items":
      return collectItems(w, call, now)
    case "merge-lists":
      return mergeLists(w, call)
    case "lookup-id":
      return lookupId(w, call)
    case "shopping-list":
      return shoppingList(w, call, now)
  }
}

/** The tasks after a merge plan, without writing. Used by apply and by undo's snapshot. */
export const mergedTasks = (tasks: Task[], plan: Plan): Task[] => (plan.merge ? applyItemMerge(tasks, plan.merge) : tasks)

export const needsCountToConfirm = (plan: Plan) => plan.total > CONFIRM_COUNT_ABOVE
