/**
 * components/Home/Tracking/pen-settings/pen-person-link.tsx — Which person a phone pen is
 *
 * Pen settings → Person, on iPhone Texts and iPhone Calls pens only. Search
 * People I Know and pick one: the pen's number is saved on that person and
 * the pen shows their name (`lib/phone-person-links.ts`). Unlink takes the
 * number off them again. Writes straight away, like the place editor.
 */
"use client"

import { useMemo, useState } from "react"
import { formatHandle } from "@/lib/phone-sync/handles"
import { penHandle } from "@/lib/phone-sync/person-links"
import { linkPhonePenToPerson } from "@/lib/phone-person-links"
import { personRecords } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function PenPersonLink({ scopeId, penId }: { scopeId: string; penId: string }) {
  const pen = useTimeTrackingStore((s) => s.scopes.find((sc) => sc.id === scopeId)?.pens.find((p) => p.id === penId))
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const people = useMemo(() => personRecords(tasks, lists), [tasks, lists])
  const [query, setQuery] = useState("")
  if (!pen) return null
  const handle = penHandle(pen)
  const linked = pen.personId ? people.find((p) => p.id === pen.personId) : undefined
  const q = query.trim().toLowerCase()
  const results = q
    ? people
        .filter((p) =>
          [p.title, p.description, ...(p.personProfile?.nicknames ?? [])].some((n) => n?.toLowerCase().includes(q)),
        )
        .slice(0, 8)
    : []

  return (
    <div className="trk-place" data-testid="pen-person-link">
      <div className="trk-place-block">
        <span className="trk-place-label">{handle ? formatHandle(handle) : "No number known"}</span>
        {linked ? (
          <div className="trk-place-pinned">
            <div className="trk-place-pinned-copy">
              <span className="trk-place-address">{linked.title || linked.description}</span>
              <span className="trk-place-parts">
                {handle ? "This number is saved on them in People I Know." : "Linked by hand."}
              </span>
            </div>
            <div className="trk-place-actions">
              <button type="button" onClick={() => linkPhonePenToPerson(scopeId, penId, null)}>
                Unlink
              </button>
            </div>
          </div>
        ) : null}
        <div className="trk-place-search">
          <input
            type="search"
            aria-label="Search People I Know"
            placeholder={linked ? "Link to someone else…" : "Search People I Know…"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {q && !results.length ? <span className="trk-place-hint">No one by that name in People I Know.</span> : null}
          {results.length ? (
            <ul className="trk-place-results" role="listbox" aria-label="People">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    data-no95=""
                    role="option"
                    aria-selected={person.id === pen.personId}
                    onClick={() => {
                      linkPhonePenToPerson(scopeId, penId, person.id)
                      setQuery("")
                    }}
                  >
                    <span className="trk-place-result-name">{person.title || person.description}</span>
                    {person.personProfile?.relation ? (
                      <span className="trk-place-result-line">{person.personProfile.relation}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
