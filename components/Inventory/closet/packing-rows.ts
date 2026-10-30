const PACKING_LIST = /\bpack(?:ing)?\b/i

export type PackingListRef = { id: string; name: string }

export type PackingTaskRef = {
  id: string
  title: string
  lists?: string[]
  packKind?: string
}

export type PackingRow = {
  id: string
  title: string
  kind: string
  listName: string
}

export function isPackingList(list: PackingListRef): boolean {
  const id = list.id.replace(/[-_]+/g, " ")
  return PACKING_LIST.test(list.name) || PACKING_LIST.test(id)
}

/** Tasks that already carry packKind, plus every item on a list whose name or id says packing. */
export function packingRows(tasks: readonly PackingTaskRef[], lists: readonly PackingListRef[]): PackingRow[] {
  const listById = new Map(lists.map((list) => [list.id, list]))
  const packingIds = new Set(lists.filter(isPackingList).map((list) => list.id))
  const rows: PackingRow[] = []
  const seen = new Set<string>()
  for (const task of tasks) {
    const kind = task.packKind?.trim() ?? ""
    const listsOn = task.lists ?? []
    const onPackingList = listsOn.some((id) => packingIds.has(id))
    if (!kind && !onPackingList) continue
    if (seen.has(task.id)) continue
    seen.add(task.id)
    const listId = listsOn.find((id) => packingIds.has(id)) ?? listsOn[0] ?? ""
    const listName = listId ? listById.get(listId)?.name.trim() || "Packing" : "Packing"
    const title = task.title.trim() || "Untitled"
    rows.push({ id: task.id, title, kind, listName })
  }
  return rows.sort((a, b) => a.listName.localeCompare(b.listName) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}
