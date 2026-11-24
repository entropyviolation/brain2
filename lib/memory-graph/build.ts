/**
 * lib/memory-graph/build.ts — The graph BIM draws, read from what Brain2 already keeps
 *
 * Pure. No second store: every node is an item, a list, a note, a date, a chat turn or a lane that already
 * exists somewhere (the Item graph, `useBimChatStore`, the turn's Trace). Two lenses:
 *
 * - `itemGraph(centerId, …)`: one item and everything around it. Parent, children and steps, links (read with
 *   `egoEdges`, so a backlink counts), needs / waits on / resources, the lists it sits in, its deadline and
 *   schedule, its newest notes, items that mention it by name, and the chat turns that named it. Walk by
 *   re-centering on a neighbor.
 * - `bimGraph(lines, …)`: BIM's working memory. The hub, the lanes the recent turns went through, each turn, and
 *   the items a turn named (matched by title in code, people by first name too).
 *
 * The view is `components/Bim/graph/memory-graph.tsx`.
 */

import { egoEdges } from "@/lib/link-graph"
import { itemTitle } from "@/lib/item-utils"
import type { BimLine } from "@/lib/ingest/bim-chat"
import type { ItemRecord, List } from "@/lib/types"

export type GraphNodeKind =
  | "hub"
  | "item"
  | "project"
  | "person"
  | "step"
  | "list"
  | "note"
  | "date"
  | "resource"
  | "lane"
  | "turn"
  | "evidence"

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  /** The item this node is, so it can be opened, asked about, or made the center. */
  itemId?: string
  /** Facts shown in the inspector, one per line. Built in code; no model. */
  facts: string[]
  /** Done or past: drawn dim. */
  dim?: boolean
  /** A line BIM can be asked, put in the compose well (never sent on its own). */
  ask?: string
  /** On a turn: the reply's Trace, for the Thought popup. */
  traceId?: string
}

export interface GraphEdge {
  a: string
  b: string
  label?: string
}

export interface MemoryGraph {
  centerId: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const CAP = { children: 14, steps: 10, links: 16, notes: 4, mentions: 10, chatMentions: 4, turns: 12, namedPerTurn: 4, evidencePerTurn: 3 }

const cut = (text: string, n: number) => {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

const dayOf = (value: unknown): string | undefined => {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })
}

const isPast = (value: unknown, now: Date) => {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null
  return !!d && !Number.isNaN(d.getTime()) && d.getTime() < now.getTime()
}

/** Person, project (has children or steps), or a plain item. */
export function kindOfItem(item: ItemRecord, all: readonly ItemRecord[]): GraphNodeKind {
  if (item.personProfile) return "person"
  if (item.subtasks?.length || all.some((t) => t.parentTaskId === item.id)) return "project"
  return "item"
}

/** A question BIM can take for this kind of node. The person edits it before sending. */
export function askFor(kind: GraphNodeKind, label: string): string {
  switch (kind) {
    case "person":
      return `When did I last see ${label}, and is there anything I owe them?`
    case "project":
      return `What is the state of ${label}: what is done, what is left, and what should I do next?`
    case "hub":
      return "What have we talked about today?"
    default:
      return `Tell me about ${label}.`
  }
}

/** The code brief for one item: status, due, steps done, notes. */
export function itemFacts(item: ItemRecord, all: readonly ItemRecord[], now = new Date()): string[] {
  const facts: string[] = []
  const kids = all.filter((t) => t.parentTaskId === item.id)
  const steps = item.subtasks ?? []
  facts.push(item.completed ? `done${item.completedDate ? ` ${dayOf(item.completedDate)}` : ""}` : item.status ? `status: ${item.status}` : `stage: ${item.stage}`)
  if (item.deadline) facts.push(`due ${dayOf(item.deadline)}${!item.completed && isPast(item.deadline, now) ? " · overdue" : ""}`)
  if (item.scheduledDate) facts.push(`scheduled ${dayOf(item.scheduledDate)}${item.scheduledTime ? ` ${item.scheduledTime}` : ""}`)
  if (kids.length) facts.push(`${kids.filter((k) => k.completed).length} of ${kids.length} parts done`)
  if (steps.length) facts.push(`${steps.filter((s) => s.completed).length} of ${steps.length} steps done`)
  if (item.estimatedDuration) facts.push(`about ${item.estimatedDuration} min`)
  if (item.why) facts.push(`why: ${cut(item.why, 90)}`)
  const p = item.personProfile
  if (p?.relation) facts.push(`relation: ${p.relation}`)
  const lastNote = item.noteLog?.length ? item.noteLog[item.noteLog.length - 1] : undefined
  if (lastNote) facts.push(`note ${lastNote.date}: ${cut(lastNote.text, 90)}`)
  else if (item.notes) facts.push(`note: ${cut(item.notes, 90)}`)
  return facts
}

/** One item and everything around it. Unknown center: an empty graph. */
export function itemGraph(
  centerId: string,
  all: readonly ItemRecord[],
  lists: readonly Pick<List, "id" | "name">[] = [],
  now = new Date(),
  lines: readonly BimLine[] = [],
): MemoryGraph {
  const byId = new Map(all.map((t) => [t.id, t]))
  const center = byId.get(centerId)
  if (!center) return { centerId, nodes: [], edges: [] }
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  const itemNode = (item: ItemRecord): GraphNode => {
    const kind = kindOfItem(item, all)
    const label = itemTitle(item) || "Untitled"
    return { id: item.id, kind, label, itemId: item.id, facts: itemFacts(item, all, now), dim: item.completed, ask: askFor(kind, label) }
  }
  const add = (node: GraphNode, label?: string) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node)
    const key = `${centerId}>${node.id}`
    if (node.id === centerId || seen.has(key)) return
    seen.add(key)
    edges.push({ a: centerId, b: node.id, label })
  }

  nodes.set(center.id, itemNode(center))

  const parent = center.parentTaskId ? byId.get(center.parentTaskId) : undefined
  if (parent) add(itemNode(parent), "part of")

  for (const kid of all.filter((t) => t.parentTaskId === center.id).slice(0, CAP.children)) add(itemNode(kid), "part")

  for (const step of (center.subtasks ?? []).slice(0, CAP.steps))
    add({ id: `step:${center.id}:${step.id}`, kind: "step", label: cut(step.description || "step", 40), facts: [step.completed ? "done" : "open", ...(step.estimatedDuration ? [`about ${step.estimatedDuration} min`] : [])], dim: step.completed }, "step")

  for (const edge of egoEdges(center, all).slice(0, CAP.links)) {
    const other = byId.get(edge.otherId)
    if (other) add(itemNode(other), edge.relation.replace(/-/g, " "))
  }

  const refs: [string[] | undefined, string][] = [
    [center.dependencies, "needs"],
    [center.awaitIds, "waits on"],
    [center.resourceIds, "resource"],
  ]
  for (const [ids, label] of refs)
    for (const id of ids ?? []) {
      const other = byId.get(id)
      if (other) add(itemNode(other), label)
    }

  const listName = new Map(lists.map((l) => [l.id, l.name]))
  for (const id of center.lists ?? []) {
    const name = listName.get(id)
    if (name) add({ id: `list:${id}`, kind: "list", label: name, facts: [`${all.filter((t) => t.lists?.includes(id)).length} items in this list`] }, "in")
  }

  if (center.deadline) add({ id: `date:due:${center.id}`, kind: "date", label: `due ${dayOf(center.deadline)}`, facts: [isPast(center.deadline, now) && !center.completed ? "overdue" : "deadline"], dim: center.completed }, "deadline")
  if (center.scheduledDate) add({ id: `date:sched:${center.id}`, kind: "date", label: `${dayOf(center.scheduledDate)}${center.scheduledTime ? ` ${center.scheduledTime}` : ""}`, facts: ["scheduled"] }, "scheduled")

  const notes = (center.noteLog ?? []).slice(-CAP.notes).reverse()
  for (const note of notes) add({ id: `note:${center.id}:${note.id}`, kind: "note", label: cut(note.text, 34), facts: [`${note.date}${note.time ? ` ${note.time}` : ""}`, note.text] }, "note")
  if (!notes.length && center.notes) add({ id: `note:${center.id}:notes`, kind: "note", label: cut(center.notes, 34), facts: [center.notes] }, "note")

  for (const res of (center.resources ?? []).slice(0, 4)) {
    const name = (res as { name?: string; caption?: string }).caption || (res as { name?: string }).name || "file"
    add({ id: `res:${center.id}:${name}:${res.addedAt}`, kind: "resource", label: cut(name, 30), facts: [`attached ${dayOf(res.addedAt) ?? ""}`.trim()] }, "file")
  }

  // Items that name this one in their title, notes or description ("Mail Foxtide CDs" → Foxtide CDs).
  const title = itemTitle(center).trim()
  if (title.length >= 4) {
    const self = [{ name: title.toLowerCase(), id: center.id }]
    let n = 0
    for (const t of all) {
      if (n >= CAP.mentions) break
      if (t.id === center.id || nodes.has(t.id)) continue
      const text = [itemTitle(t), t.notes ?? "", t.taskDescription ?? ""].join("\n")
      if (!namedIn(text, self, 1).length) continue
      add(itemNode(t), "mentions it")
      n++
    }
    // Chat turns of yours that named it, newest first.
    const turns = lines.filter((l) => l.who === "you" && namedIn(l.text, self, 1).length).slice(-CAP.chatMentions).reverse()
    for (const you of turns)
      add({ id: `turn:${you.id}`, kind: "turn", label: cut(you.text, 28), facts: [`you said: ${cut(you.text, 200)}`, dayOf(you.at) ?? ""].filter(Boolean), ask: `About what I said ("${cut(you.text, 80)}"): ` }, "said in chat")
  }

  return { centerId, nodes: [...nodes.values()], edges }
}

/** Names to look for in chat: titles of 3 to 40 characters, and a person's first name when no other person shares it. */
export function nameIndex(all: readonly ItemRecord[]): { name: string; id: string }[] {
  const out: { name: string; id: string }[] = []
  const firsts = new Map<string, string[]>()
  for (const t of all) {
    const title = itemTitle(t).trim()
    if (title.length < 3 || title.length > 40) continue
    if (t.completed && !t.personProfile) continue
    out.push({ name: title.toLowerCase(), id: t.id })
    if (t.personProfile && !t.personProfile.self) {
      const first = title.split(/\s+/)[0].toLowerCase()
      if (first.length >= 3 && first !== title.toLowerCase()) firsts.set(first, [...(firsts.get(first) ?? []), t.id])
    }
  }
  for (const [name, ids] of firsts) if (ids.length === 1) out.push({ name, id: ids[0] })
  // Longest first, so "Foxtide CDs" wins over "Foxtide".
  return out.sort((a, b) => b.name.length - a.name.length)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Item ids named in `text`, longest names first, at most `cap`. Whole words only. */
export function namedIn(text: string, index: readonly { name: string; id: string }[], cap = CAP.namedPerTurn): string[] {
  const low = text.toLowerCase()
  const ids: string[] = []
  for (const { name, id } of index) {
    if (ids.length >= cap) break
    if (ids.includes(id) || !low.includes(name)) continue
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}($|[^\\p{L}\\p{N}])`, "u").test(low)) ids.push(id)
  }
  return ids
}

/** The lane a reply went through: the route chip's first word, else the ingest kind. */
export function laneOf(line: BimLine): string {
  const chip = line.route?.split("·")[0]?.trim()
  if (chip) return chip.toUpperCase()
  return (line.kind ?? "reply").toUpperCase()
}

/** BIM's working memory: hub → lanes → recent turns → the items each turn named, and its evidence. */
export function bimGraph(lines: readonly BimLine[], all: readonly ItemRecord[], now = new Date()): MemoryGraph {
  const hub: GraphNode = { id: "bim", kind: "hub", label: "BIM", facts: [], ask: askFor("hub", "BIM") }
  const nodes = new Map<string, GraphNode>([[hub.id, hub]])
  const edges: GraphEdge[] = []
  const edgeSeen = new Set<string>()
  const link = (a: string, b: string, label?: string) => {
    const key = `${a}>${b}`
    if (edgeSeen.has(key)) return
    edgeSeen.add(key)
    edges.push({ a, b, label })
  }
  const byId = new Map(all.map((t) => [t.id, t]))
  const index = nameIndex(all)

  // A turn is a line of yours and the reply that answers it.
  const replies = new Map(lines.filter((l) => l.who === "bim" && l.replyTo).map((l) => [l.replyTo!, l]))
  const yours = lines.filter((l) => l.who === "you")
  const turns = yours.slice(-CAP.turns).map((you, i, arr) => {
    const at = lines.indexOf(you)
    const next = lines[at + 1]
    const reply = replies.get(you.id) ?? (next?.who === "bim" ? next : undefined)
    return { you, reply, n: yours.length - arr.length + i + 1 }
  })

  for (const { you, reply, n } of turns) {
    const lane = reply && !reply.waiting ? laneOf(reply) : "WAITING"
    const laneId = `lane:${lane}`
    if (!nodes.has(laneId)) nodes.set(laneId, { id: laneId, kind: "lane", label: lane, facts: [] })
    nodes.get(laneId)!.facts.push(`turn ${n}: ${cut(you.text, 50)}`)
    link(hub.id, laneId)
    const turnId = `turn:${you.id}`
    nodes.set(turnId, {
      id: turnId,
      kind: "turn",
      label: cut(you.text || "(photo)", 28),
      facts: [`you: ${cut(you.text, 200)}`, ...(reply ? [`BIM: ${cut(reply.text, 260)}`] : []), ...(reply?.route ? [reply.route] : []), ...(reply?.readAs ? [`read as: ${reply.readAs}`] : [])],
      ask: `About what I said earlier ("${cut(you.text, 80)}"): `,
      traceId: reply?.traceId,
      dim: reply?.status === "error",
    })
    link(laneId, turnId)

    const said = [you.text, reply?.text ?? "", ...(reply?.evidence ?? [])].join("\n")
    for (const id of namedIn(said, index)) {
      const item = byId.get(id)
      if (!item) continue
      const kind = kindOfItem(item, all)
      const label = itemTitle(item) || "Untitled"
      if (!nodes.has(id)) nodes.set(id, { id, kind, label, itemId: id, facts: itemFacts(item, all, now), dim: item.completed, ask: askFor(kind, label) })
      link(turnId, id, "named")
    }
    for (const [i, row] of (reply?.evidence ?? []).slice(0, CAP.evidencePerTurn).entries()) {
      const evId = `ev:${you.id}:${i}`
      nodes.set(evId, { id: evId, kind: "evidence", label: cut(row, 30), facts: [row] })
      link(turnId, evId, "read")
    }
  }
  hub.facts = [`${turns.length} recent turns`, `${[...nodes.values()].filter((n) => n.kind === "lane").length} lanes used`, `${[...nodes.values()].filter((n) => n.itemId).length} items named`]
  return { centerId: hub.id, nodes: [...nodes.values()], edges }
}

/** Items whose title holds the query, for the graph's search. People and projects first. */
export function searchItems(query: string, all: readonly ItemRecord[], cap = 8): ItemRecord[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const rank = (t: ItemRecord) => (t.personProfile ? 0 : t.subtasks?.length ? 1 : 2) + (t.completed ? 3 : 0) + (itemTitle(t).toLowerCase().startsWith(q) ? 0 : 0.5)
  return all
    .filter((t) => itemTitle(t).toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, cap)
}
