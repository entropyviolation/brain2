/**
 * components/ItemDetail/links/LinkPath.tsx — Path view (L6.2): pick a second
 * item; the shortest relation path reads left to right as a ruler.
 */
"use client"

import { useMemo, useState } from "react"
import { linkPath } from "@/lib/graph/link-path"
import type { LinkIndex } from "@/lib/graph/link-index"
import { relationLabel } from "@/lib/links"
import type { Task } from "@/lib/types"
import { itemTitleOrUntitled } from "@/lib/item-utils"

export function LinkPath({ itemId, links, tasks, title, onOpen }: { itemId: string; links: LinkIndex; tasks: readonly Task[]; title: (id: string) => string; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<string | null>(null)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tasks.filter((t) => t.id !== itemId && itemTitleOrUntitled(t).toLowerCase().includes(q)).slice(0, 6)
  }, [query, tasks, itemId])
  const path = target ? linkPath(itemId, target, links) : null
  return (
    <div className="rl-path" data-testid="link-path">
      <input className="rl-path-input" placeholder="Path to…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Path to item" />
      {matches.length && !target ? (
        <ul className="rl-path-matches">
          {matches.map((t) => (
            <li key={t.id}>
              <button type="button" className="rl-key" onClick={() => setTarget(t.id)}>
                {itemTitleOrUntitled(t)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {target ? (
        path ? (
          <ol className="rl-ruler">
            <li className="rl-ruler-node">{title(itemId)}</li>
            {path.map((s, i) => (
              <li key={i} className="rl-ruler-step">
                <span className="rl-ruler-tick">{relationLabel(s.relation)}</span>
                <button type="button" className="rl-key" onClick={() => onOpen(s.to)}>
                  {title(s.to)}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rl-empty">No path within six steps.</p>
        )
      ) : null}
      {target ? (
        <button type="button" className="rl-key" onClick={() => { setTarget(null); setQuery("") }}>
          Clear
        </button>
      ) : null}
    </div>
  )
}
