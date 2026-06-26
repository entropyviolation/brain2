import { useMemo, useState } from "react"
import type { Task, List, Folder } from "@/lib/types"

export interface SearchResults {
  folders: Folder[]
  lists: List[]
  tasks: Task[]
}

export function useListsSearch(
  folders: Folder[],
  categories: List[],
  allTasks: Task[],
) {
  const [searchTerm, setSearchTerm] = useState("")
  const q = searchTerm.trim().toLowerCase()
  const searchActive = q.length > 0

  const searchResults = useMemo<SearchResults>(() => {
    if (!searchActive) return { folders: [], lists: [], tasks: [] }
    const f = folders.filter(
      (x) => x.name.toLowerCase().includes(q) || (x.description || "").toLowerCase().includes(q),
    )
    const l = categories.filter(
      (x) => x.name.toLowerCase().includes(q) || (x.description || "").toLowerCase().includes(q),
    )
    const t = allTasks.filter((x) => !x.completed && x.description.toLowerCase().includes(q)).slice(0, 50)
    return { folders: f, lists: l, tasks: t }
  }, [searchActive, q, folders, categories, allTasks])

  const filteredItems = searchActive ? searchResults.tasks : allTasks.filter((t) => !t.completed)

  return {
    searchTerm,
    setSearchTerm,
    searchActive,
    searchResults,
    filteredItems,
  }
}
