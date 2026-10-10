/**
 * lib/people-i-know.ts — Built-in People I Know list and its pipelines
 *
 * The list is created once the vault has hydrated (`hooks/use-people-i-know.ts`).
 * Rename keeps `peopleList`. Delete is refused. A list already named
 * People I Know is adopted instead of a second copy.
 *
 * A pipeline is one visible join on the person (`Task.personPipelines`):
 * - `company-pen` — a pen on the Company tracking view. This is the
 *   association. Company time is every Company block painted with that pen.
 * - `company-timeblock` — a stored block join from before pen color was the
 *   rule. Still read so old rows are not erased. It does not decide which
 *   blocks are theirs.
 *
 * Attach a person on the pen. A Company block shows the people whose pen is
 * on that block. Unknown kinds are left on the record so a later join is
 * not erased by this build.
 */
import { createListItem } from "@/lib/item-utils"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { List, PersonPipeline, Task } from "@/lib/types"

export const PEOPLE_I_KNOW_LIST_ID = "people-i-know"
export const PEOPLE_I_KNOW_LIST_NAME = "People I Know"
/** Seeded Company view. Renaming the view does not change this id. */
export const COMPANY_SCOPE_ID = "company"

export const PERSON_PIPELINE_KINDS = ["company-pen", "company-timeblock"] as const

function peopleName(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === PEOPLE_I_KNOW_LIST_NAME.toLowerCase()
}

/** Canonical id, then the flagged list, then a name match. */
export function findPeopleIKnowList(lists: List[]): List | undefined {
  return (
    lists.find((list) => list.id === PEOPLE_I_KNOW_LIST_ID) ??
    lists.find((list) => list.peopleList) ??
    lists.find((list) => peopleName(list.name))
  )
}

/** Canonical id or the flagged list. A same-named list is not protected until adopted. */
export function isPeopleIKnowList(list: { id: string; peopleList?: boolean } | null | undefined): boolean {
  if (!list) return false
  return list.id === PEOPLE_I_KNOW_LIST_ID || list.peopleList === true
}

export function itemShowsPersonPipelines(
  task: Pick<Task, "type" | "lists">,
  lists: List[],
): boolean {
  if (task.type === PERSON_TYPE_ID) return true
  const people = findPeopleIKnowList(lists)
  return !!people && (task.lists ?? []).includes(people.id)
}

/** Create or adopt the People I Know list. Rename keeps `peopleList`. */
export function ensurePeopleIKnowList(): string {
  const store = useTaskStore.getState()
  const existing = findPeopleIKnowList(store.lists)
  if (existing) {
    const patch: Partial<List> = {}
    if (!existing.peopleList) patch.peopleList = true
    if (!existing.itemTypeId) patch.itemTypeId = PERSON_TYPE_ID
    if (!existing.itemLabel) patch.itemLabel = "person"
    if (!existing.detailPanels?.length) patch.detailPanels = ["details"]
    if (Object.keys(patch).length > 0) {
      store.updateList({ ...existing, ...patch })
    }
    return existing.id
  }
  store.addList({
    id: PEOPLE_I_KNOW_LIST_ID,
    name: PEOPLE_I_KNOW_LIST_NAME,
    color: "#0f766e",
    createdAt: new Date(),
    itemLabel: "person",
    itemTypeId: PERSON_TYPE_ID,
    scheduleable: false,
    peopleList: true,
    detailPanels: ["details"],
    displayedAttributes: ["birthday", "notes"],
    description:
      "People you know. Birthday and notes are on each person. A Company pen joined here is the association: Company time is the blocks painted with that pen. A stored timeblock join from before is kept.",
  })
  return PEOPLE_I_KNOW_LIST_ID
}

function newPipelineId(): string {
  return `pp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Keep known joins and any later kind that still has an id. Drop junk. */
export function readPersonPipelines(value: unknown): PersonPipeline[] {
  if (!Array.isArray(value)) return []
  const out: PersonPipeline[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const rec = row as Record<string, unknown>
    const id = rec.id
    const kind = rec.kind
    if (typeof id !== "string" || !id || typeof kind !== "string" || !kind) continue
    if (kind === "company-pen") {
      if (typeof rec.penId === "string" && rec.penId) out.push({ id, kind, penId: rec.penId })
      continue
    }
    if (kind === "company-timeblock") {
      if (typeof rec.entryId === "string" && rec.entryId) out.push({ id, kind, entryId: rec.entryId })
      continue
    }
    out.push({ ...rec, id, kind })
  }
  return out
}

export function isCompanyPenPipeline(
  row: PersonPipeline,
): row is { id: string; kind: "company-pen"; penId: string } {
  return row.kind === "company-pen" && typeof (row as { penId?: unknown }).penId === "string"
}

export function isCompanyTimeblockPipeline(
  row: PersonPipeline,
): row is { id: string; kind: "company-timeblock"; entryId: string } {
  return row.kind === "company-timeblock" && typeof (row as { entryId?: unknown }).entryId === "string"
}

function writePipelines(task: Task, rows: PersonPipeline[]): Task {
  if (rows.length === 0) {
    const next = { ...task }
    delete next.personPipelines
    return next
  }
  return { ...task, personPipelines: rows }
}

export function withCompanyPen(task: Task, penId: string, id = newPipelineId()): Task {
  const rows = readPersonPipelines(task.personPipelines)
  if (rows.some((row) => isCompanyPenPipeline(row) && row.penId === penId)) return task
  return writePipelines(task, [...rows, { id, kind: "company-pen", penId }])
}

export function withCompanyTimeblock(task: Task, entryId: string, id = newPipelineId()): Task {
  const rows = readPersonPipelines(task.personPipelines)
  if (rows.some((row) => isCompanyTimeblockPipeline(row) && row.entryId === entryId)) return task
  return writePipelines(task, [...rows, { id, kind: "company-timeblock", entryId }])
}

export function withoutPipeline(task: Task, pipelineId: string): Task {
  const rows = readPersonPipelines(task.personPipelines).filter((row) => row.id !== pipelineId)
  return writePipelines(task, rows)
}

export function pipelinesForPen(
  tasks: Task[],
  penId: string,
): { task: Task; pipeline: PersonPipeline }[] {
  const hits: { task: Task; pipeline: PersonPipeline }[] = []
  for (const task of tasks) {
    for (const pipeline of readPersonPipelines(task.personPipelines)) {
      if (isCompanyPenPipeline(pipeline) && pipeline.penId === penId) hits.push({ task, pipeline })
    }
  }
  return hits
}

/** Pen ids joined to this person. Company time is the blocks painted with these. */
export function joinedCompanyPenIds(pipelines: readonly PersonPipeline[] | undefined): string[] {
  const ids: string[] = []
  for (const row of readPersonPipelines(pipelines)) {
    if (isCompanyPenPipeline(row) && !ids.includes(row.penId)) ids.push(row.penId)
  }
  return ids
}

/**
 * Company blocks that belong to this person: painted with a joined pen.
 * A stored `company-timeblock` row does not add a block, and it is not removed.
 * Entries with a scope other than Company are skipped. A missing scope is kept
 * so a caller who already filtered can pass plain rows.
 */
export function companyBlocksForPerson<
  T extends { date: string; penId: string; scopeId?: string; startMin?: number },
>(pipelines: readonly PersonPipeline[] | undefined, entries: readonly T[]): T[] {
  const penIds = new Set(joinedCompanyPenIds(pipelines))
  if (penIds.size === 0) return []
  return entries
    .filter((entry) => {
      if (entry.scopeId && entry.scopeId !== COMPANY_SCOPE_ID) return false
      return penIds.has(entry.penId)
    })
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return (b.startMin ?? 0) - (a.startMin ?? 0)
    })
}

export function pipelinesForEntry(
  tasks: Task[],
  entryId: string,
): { task: Task; pipeline: PersonPipeline }[] {
  const hits: { task: Task; pipeline: PersonPipeline }[] = []
  for (const task of tasks) {
    for (const pipeline of readPersonPipelines(task.personPipelines)) {
      if (isCompanyTimeblockPipeline(pipeline) && pipeline.entryId === entryId) hits.push({ task, pipeline })
    }
  }
  return hits
}

/** People on the list, plus anyone already carrying a pipeline. */
export function personRecords(tasks: Task[], lists: List[]): Task[] {
  const listId = findPeopleIKnowList(lists)?.id
  return tasks.filter(
    (task) =>
      task.type === PERSON_TYPE_ID ||
      (!!listId && (task.lists ?? []).includes(listId)) ||
      readPersonPipelines(task.personPipelines).length > 0,
  )
}

export function createPerson(name: string, listId: string, pipelines?: PersonPipeline[]): Task {
  const item = createListItem(name.trim(), [listId])
  return {
    ...item,
    type: PERSON_TYPE_ID,
    personPipelines: pipelines && pipelines.length > 0 ? pipelines : undefined,
  }
}
