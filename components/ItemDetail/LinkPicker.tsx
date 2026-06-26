/**
 * components/ItemDetail/LinkPicker.tsx — Add a typed link to another item
 *
 * Presentational control for creating an `ItemLink`: a relation `Select` sourced
 * from the `lib/links.ts` catalog plus a target-item typeahead that searches the
 * repository by title/description (excluding the current item). Confirming calls
 * `onAdd(relation, targetId)`; the parent persists via the shared draft path.
 *
 * Spec: §5 (tags & links) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Link2 } from "lucide-react"
import { RELATIONS } from "@/lib/links"
import { taskRepository } from "@/lib/data/task-repository"

interface LinkPickerProps {
  sourceId: string
  onAdd: (relation: string, targetId: string) => void
}

/** Relation select + target-item typeahead that emits a new link on confirm. */
export function LinkPicker({ sourceId, onAdd }: LinkPickerProps) {
  const [relation, setRelation] = useState(RELATIONS[0]?.id ?? "related")
  const [search, setSearch] = useState("")
  const [targetId, setTargetId] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const query = search.trim().toLowerCase()
  const matches = useMemo(() => {
    if (query === "") return []
    return taskRepository
      .getAll()
      .filter((t) => t.id !== sourceId)
      .filter(
        (t) =>
          t.description?.toLowerCase().includes(query) ||
          t.taskDescription?.toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [query, sourceId])

  const selectedTitle = targetId ? taskRepository.getById(targetId)?.description : undefined

  const confirm = () => {
    if (!targetId) return
    onAdd(relation, targetId)
    setTargetId(null)
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="space-y-1 sm:w-44">
        <Select value={relation} onValueChange={setRelation}>
          <SelectTrigger className="focus-ring" aria-label="Relation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIONS.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative flex-1">
        <Input
          value={targetId ? (selectedTitle ?? "") : search}
          onChange={(e) => {
            setTargetId(null)
            setSearch(e.target.value)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Search item to link…"
          aria-label="Search item to link"
          className="focus-ring"
        />
        {focused && !targetId && matches.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto custom-scrollbar">
            {matches.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setTargetId(t.id)
                  setSearch("")
                }}
              >
                <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{t.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Button type="button" onClick={confirm} disabled={!targetId} className="focus-ring">
        <Plus className="h-4 w-4 mr-1" />
        Add Link
      </Button>
    </div>
  )
}
