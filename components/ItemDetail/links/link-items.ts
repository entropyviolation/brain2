/**
 * components/ItemDetail/links/link-items.ts — What the Links tab shows about
 * another item: its type ids (for relation scope), type plate name, first
 * list name, and title. Reads the stores once per render through
 * `useLinkItems`. Nothing here imports `components/People/` (8.1 reuses it).
 */
"use client"

import { useCallback, useMemo } from "react"
import { assignedItemTypes } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export interface LinkItemFacts {
  id: string
  title: string
  icon?: string
  typeIds: string[]
  typeName?: string
  listName?: string
}

export function useLinkItems(allTasks?: readonly Task[]) {
  const storeTasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const tasks = allTasks ?? storeTasks
  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const facts = useCallback(
    (task: Task): LinkItemFacts => {
      const assigned = assignedItemTypes(task, lists, types)
      const firstList = (task.lists ?? []).map((id) => lists.find((list) => list.id === id)).find(Boolean)
      return {
        id: task.id,
        title: itemTitleOrUntitled(task),
        icon: task.icon,
        typeIds: assigned.map((type) => type.id),
        typeName: assigned[0]?.name,
        listName: firstList?.name,
      }
    },
    [lists, types],
  )
  const factsFor = useCallback(
    (id: string): LinkItemFacts | null => {
      const task = byId.get(id)
      return task ? facts(task) : null
    },
    [byId, facts],
  )
  return { tasks, byId, types, facts, factsFor }
}
