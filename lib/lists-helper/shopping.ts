/**
 * lib/lists-helper/shopping.ts — The `shopping-list` tool: one consolidated list of everything to get (pure)
 *
 * "Help me find all the things I need to get or want or need to buy (create a consolidated Nov 8th shopping list)
 * it must have at least modafinil, brow bleach, hair dye". The tool finds every **buy list** by its name or its
 * folder ("shopping list", "wanted", "to order", "things to get on temu", a list in the "online shopping" folder,
 * a list that pins a Shopping item type), gathers their open items, folds items with the same name into one,
 * leaves out what is already bought, and puts them all on one list. Each must-have is matched to an item already
 * found ("brow bleach" → "jolene brow bleach"), or made new on the list. It never writes: the plan goes through
 * the same approval, guard and undo as `collect-items`. Plan: `components/Lab/ListsHelper/README.md`.
 */

import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { createListItem, itemTitle, withListMembership } from "@/lib/item-utils"
import { itemsOfType } from "@/lib/item-types"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"
import type { List, Task } from "@/lib/types"
import { normalizeTitle } from "./duplicates"
import { titleOf } from "./resolve"
import type { ItemChange, Plan, ToolCall, ToolResult, World } from "./types"

export type ShoppingCall = Extract<ToolCall, { tool: "shopping-list" }>

/** A list name that says "things to get": buy, shop, order, need, want, wish list, groceries, a store. */
const BUY_NAME = /\b(?:buy|to buy|shop|shopping|order|orders|to order|purchase|to get|get online|gifts? to get|needed|need from|need for|all needed|wanted|wants?|want to (?:own|try|get|buy)|wish ?list|grocer(?:y|ies)|amazon|temu|tiktok shop|etsy|ebay|restock|supplies)\b|^(?:get|need|needs|needed|want|wanted|to get)$/i
/** Names that use those words but are not things to buy: done buys, messages, food to cook, shows, plans, people. */
const NOT_BUY = /\b(?:purchased|bought|send|texts?|cook|eps|episodes|ideas|money|elijah|budget|to do|todo|before|read|watch|call|healthcare|wishing|dashboard|widgets?)\b/i
/** Folders whose every list is a buy list. */
const BUY_FOLDER = /\b(?:wanted|shopping|online shopping|to buy|buy|orders?|wish ?list)\b/i
/** A list or folder of things already bought: its items are left out. */
const BOUGHT = /\b(?:purchased|bought)\b/i
/** An item type for things to buy. A list that pins one is a buy list, and the new list pins it too. */
const BUY_TYPE = /^(?:shopping(?: item)?|to buy|purchase|wish ?list item|buy)$/i
/** Past this many characters a title is a pasted note, not a thing to buy. */
const NOTE_LENGTH = 160
/** A pasted list name (a sentence or a paragraph) is never a buy list. */
const LONG_NAME = 60

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function folderOf(w: World, listId: string) {
  return (w.folders ?? []).find((f) => (f.listIds ?? []).includes(listId))
}

/** The item type the new list pins, when the person has one for things to buy. */
export function buyTypeId(w: World): string | undefined {
  const t = w.types.find((x) => BUY_TYPE.test(x.name.trim()))
  return t ? String(t.id) : undefined
}

export interface BuyLists {
  /** Lists whose open items are gathered, with why each one counts. */
  lists: { list: List; why: string }[]
  /** Lists of things already bought: an item on one of these is left out. */
  bought: Set<string>
}

/** Every list that holds things to get, found by its name, its folder, or the item type it pins. */
export function findBuyLists(w: World, skip: string[] = [], destId?: string): BuyLists {
  const typeId = buyTypeId(w)
  const lists: BuyLists["lists"] = []
  const bought = new Set<string>()
  for (const l of w.lists) {
    const name = (l.name ?? "").trim()
    const folder = folderOf(w, l.id)
    if (BOUGHT.test(name) || (folder && BOUGHT.test(folder.name))) {
      bought.add(l.id)
      continue
    }
    if (l.id === destId || skip.includes(l.id)) continue
    if (isNaSmartCategoryId(l.id) || isFolderAllItemsCategoryId(l.id)) continue
    if (!name || name.length > LONG_NAME || NOT_BUY.test(name)) continue
    const pins = typeId && (l.itemTypeId === typeId || (l.itemTypeIds ?? []).includes(typeId))
    const why = BUY_NAME.test(name) ? "name" : folder && BUY_FOLDER.test(folder.name) ? `folder "${folder.name}"` : pins ? "pins the shopping type" : null
    if (why) lists.push({ list: l, why })
  }
  return { lists, bought }
}

/** Every word of the must-have is in the title (a plural "s" allowed): "brow bleach" fits "jolene brow bleach". */
export function fitsMustHave(title: string, want: string): boolean {
  const have = normalizeTitle(title).split(" ").filter(Boolean)
  const words = normalizeTitle(want).split(" ").filter(Boolean)
  if (!words.length) return false
  return words.every((wd) => have.some((h) => h === wd || h === `${wd}s` || `${h}s` === wd || h === `${wd}es`))
}

export function shoppingList(w: World, c: ShoppingCall, now: Date): ToolResult {
  const name = c.name.trim()
  if (!name) return { kind: "error", text: "What should the shopping list be called?" }
  const trace: string[] = []
  const warnings: string[] = []
  const impacts: Plan["impacts"] = []

  // The destination: a list of that name already there (asking twice adds what is new), or a new one.
  const existing = w.lists.find((l) => normalizeTitle(l.name ?? "") === normalizeTitle(name))
  let dest: List
  let setup: Plan["setup"]
  if (existing) {
    if (isNaSmartCategoryId(existing.id) || isFolderAllItemsCategoryId(existing.id)) return { kind: "error", text: `"${existing.name}" fills itself, so I can't add to it. Pick another name.` }
    dest = existing
    trace.push(`A list called "${existing.name}" exists already: I add to it and skip what is on it.`)
  } else {
    const typeId = buyTypeId(w)
    const taken = new Set(w.lists.map((l) => l.id))
    let id = String(now.getTime())
    for (let n = 2; taken.has(id); n++) id = `${now.getTime()}-${n}`
    dest = { id, name, color: "#3B82F6", createdAt: now, order: w.lists.length, ...(typeId ? { itemTypeId: typeId, itemTypeIds: [typeId] } : {}) }
    setup = { list: dest }
    impacts.push({ count: 1, label: `new list "${name}"` })
    if (typeId) warnings.push(`The new list pins the "${w.types.find((t) => String(t.id) === typeId)?.name}" item type. Items keep their own types.`)
  }

  // The sources.
  const { lists: sources, bought } = findBuyLists(w, c.skipListIds ?? [], dest.id)
  if (!sources.length) return { kind: "error", text: "I found no lists of things to get (a name like \"shopping list\", \"to order\", \"wanted\", or a list in a shopping folder)." }
  trace.push(`Buy lists found: ${plural(sources.length, "list")} by name, folder or type${c.skipListIds?.length ? ` (${plural(c.skipListIds.length, "list")} skipped as asked)` : ""}.`)
  if (bought.size) trace.push(`Already-bought lists: ${[...bought].map((id) => `"${w.lists.find((l) => l.id === id)?.name}"`).join(", ")}. Their items are left out.`)

  const sourceIds = new Set(sources.map((s) => s.list.id))
  const typeId = buyTypeId(w)
  const typed = typeId ? new Set(itemsOfType(typeId, w.tasks, w.lists, w.types).map((t) => t.id)) : new Set<string>()
  const isItem = (t: Task) => !t.stepOf && !["action", "step", "log"].includes(String(t.type ?? ""))
  let rows = w.tasks.filter((t) => isItem(t) && ((t.lists ?? []).some((id) => sourceIds.has(id)) || typed.has(t.id)))
  trace.push(`Start: ${plural(rows.length, "item")} on those lists or of the shopping type.`)

  const done = rows.filter((t) => t.completed).length
  rows = rows.filter((t) => !t.completed)
  const gotIt = rows.filter((t) => (t.lists ?? []).some((id) => bought.has(id))).length
  rows = rows.filter((t) => !(t.lists ?? []).some((id) => bought.has(id)))
  const notes = rows.filter((t) => (itemTitle(t) ?? "").trim().length > NOTE_LENGTH || !(itemTitle(t) ?? "").trim()).length
  rows = rows.filter((t) => {
    const s = (itemTitle(t) ?? "").trim()
    return s && s.length <= NOTE_LENGTH
  })
  trace.push(`Left out: ${done} done, ${gotIt} already bought, ${notes} long notes or blank. ${rows.length} remain.`)

  // Same name, one row: the one already on the list, else the one on most buy lists, else the oldest.
  const onDest = (t: Task) => (t.lists ?? []).includes(dest.id)
  const score = (t: Task) => (onDest(t) ? 1000 : 0) + (t.lists ?? []).filter((id) => sourceIds.has(id)).length
  const byName = new Map<string, Task>()
  for (const t of rows) {
    const k = normalizeTitle(itemTitle(t) ?? "")
    const had = byName.get(k)
    if (!had || score(t) > score(had) || (score(t) === score(had) && new Date(t.createdAt).getTime() < new Date(had.createdAt).getTime())) byName.set(k, t)
  }
  const folded = rows.length - byName.size
  // Items already on the list count as found, so the must-haves and the name fold see them too.
  const destRows = w.tasks.filter((t) => onDest(t) && isItem(t) && !t.completed)
  for (const t of destRows) {
    const k = normalizeTitle(itemTitle(t) ?? "")
    if (!byName.has(k) || !onDest(byName.get(k)!)) byName.set(k, t)
  }
  const unique = [...byName.values()]
  trace.push(`Same name folded: ${folded} repeats, ${unique.length} different things.`)

  // Must-haves: an item found already, or a new one on the list.
  const creates: Task[] = []
  const covered: string[] = []
  for (const want of c.mustHave) {
    const hit = unique.find((t) => fitsMustHave(itemTitle(t) ?? "", want)) ?? creates.find((t) => fitsMustHave(itemTitle(t) ?? "", want))
    if (hit) {
      covered.push(`${want} → "${titleOf(hit)}"`)
      trace.push(`Must-have "${want}": found "${titleOf(hit)}".`)
      continue
    }
    const item = { ...(withListMembership(createListItem(want.trim(), [dest.id]), dest, w.types) as Task), createdAt: now }
    creates.push(item)
    trace.push(`Must-have "${want}": not on any buy list, so it is made new.`)
  }

  const changes: ItemChange[] = unique
    .filter((t) => !onDest(t))
    .map((t) => {
      const patch: Record<string, unknown> = { lists: [...(t.lists ?? []), dest.id] }
      const before: Record<string, unknown> = { lists: t.lists }
      if ((t.listMembershipExclusions ?? []).includes(dest.id)) {
        patch.listMembershipExclusions = (t.listMembershipExclusions ?? []).filter((id) => id !== dest.id)
        before.listMembershipExclusions = t.listMembershipExclusions
      }
      return { id: t.id, title: titleOf(t), patch, before, note: `joins "${dest.name}"` }
    })
  const already = unique.length - changes.length
  if (!changes.length && !creates.length) {
    trace.push("Nothing left to add.")
    return { kind: "answer", trace, text: `Nothing to add: "${dest.name}" already holds every open thing to get${covered.length ? ` and your must-haves (${covered.join("; ")})` : ""}.` }
  }

  // Where they came from, biggest first, so a list that should not count is easy to spot and skip.
  const counts = sources
    .map((s) => ({ s, n: changes.filter((ch) => (w.tasks.find((t) => t.id === ch.id)?.lists ?? []).includes(s.list.id)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  const fromLine = counts.map((x) => `${x.s.list.name.trim()} (${x.n})`).join(", ")
  trace.push(`From: ${fromLine}.`)

  impacts.push({ count: changes.length, label: `found on ${plural(counts.length, "buy list")}, join "${dest.name}"` })
  if (creates.length) impacts.push({ count: creates.length, label: `must-have${creates.length === 1 ? "" : "s"} made new: ${creates.map(titleOf).join(", ")}` })
  if (covered.length) warnings.push(`Must-haves already found: ${covered.join("; ")}.`)
  if (folded) warnings.push(`${plural(folded, "repeat")} with the same name as another item folded into one row.`)
  if (already) warnings.push(`${plural(already, "item")} already on "${dest.name}", so skipped.`)
  if (done || gotIt) warnings.push(`Left out ${plural(done, "done item")} and ${plural(gotIt, "item")} on a bought list.`)
  if (notes) warnings.push(`Left out ${plural(notes, "long pasted note")}: not things to buy.`)
  warnings.push(`To drop a list, ask again with "skip <list name>" (for example "skip books i want to own").`)
  warnings.push("Items stay on the lists they are already on. Nothing is copied or removed.")
  trace.push(`Plan: ${plural(changes.length, "item")} join and ${plural(creates.length, "item")} made on "${dest.name}". Nothing written yet.`)

  const total = changes.length + creates.length
  const plan: Plan = {
    tool: "shopping-list",
    trace,
    working: `Building ${dest.name}`,
    title: `Shopping list "${dest.name}": ${plural(total, "thing")} to get`,
    summary: [
      `Gathers every open thing to get from ${plural(counts.length, "buy list")}: ${fromLine}.`,
      creates.length ? `Makes ${creates.map((t) => `"${titleOf(t)}"`).join(", ")} on it, because no buy list has ${creates.length === 1 ? "it" : "them"} yet.` : "Every must-have was already on a buy list.",
      setup ? `They go onto the new list "${dest.name}".` : `They go onto "${dest.name}".`,
    ],
    impacts,
    samples: [...creates.map(titleOf), ...changes.map((x) => x.title)].slice(0, 8),
    warnings,
    oneTime: true,
    changes,
    creates,
    ...(setup ? { setup } : {}),
    total,
    signature: JSON.stringify({ ids: changes.map((x) => x.id), make: creates.map(titleOf), d: setup ? ["new", dest.name] : dest.id }),
  }
  return { kind: "plan", plan }
}
