/**
 * components/ItemDetail/TagInput.tsx — Chip/token tag editor
 *
 * Presentational tag input: renders applied tags as removable chips and a text
 * field that adds a tag on Enter/comma, with autocomplete suggestions drawn from
 * all tags in use across the repository. Normalization is delegated to the pure
 * `lib/links.ts` helpers; this component holds no business logic of its own.
 *
 * Spec: §5 (tags & links) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, Tag as TagIcon } from "lucide-react"
import { normalizeTag } from "@/lib/links"
import { taskRepository } from "@/lib/data/task-repository"

interface TagInputProps {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}

/** Removable tag chips + autocompleting text input. */
export function TagInput({ tags, onAdd, onRemove }: TagInputProps) {
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)

  const applied = useMemo(() => new Set(tags.map(normalizeTag)), [tags])

  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const t of taskRepository.getAll()) {
      for (const tag of t.tags ?? []) {
        const norm = normalizeTag(tag)
        if (norm) seen.add(norm)
      }
    }
    return Array.from(seen).sort()
  }, [])

  const query = normalizeTag(value)
  const suggestions = useMemo(() => {
    return allTags
      .filter((t) => !applied.has(t) && (query === "" || t.includes(query)))
      .slice(0, 8)
  }, [allTags, applied, query])

  const commit = (raw: string) => {
    const norm = normalizeTag(raw)
    if (!norm) return
    onAdd(norm)
    setValue("")
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No tags</p>
        ) : (
          tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-sm">
              <TagIcon className="h-3 w-3" />
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onRemove(tag)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Add a tag…"
          aria-label="Add a tag"
          className="focus-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commit(value)
            } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
              onRemove(tags[tags.length - 1])
            }
          }}
        />
        {focused && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto custom-scrollbar">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(s)
                }}
              >
                <TagIcon className="h-3 w-3 text-muted-foreground" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
