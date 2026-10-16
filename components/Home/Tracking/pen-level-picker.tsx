/**
 * components/Home/Tracking/pen-level-picker.tsx — Which named level a pen sits on
 *
 * Lives under Counts as in pen settings. The view's level categories read as a
 * ladder, broadest first (Country › State › City › Neighborhood); a key per
 * level, plus None. The line under it reads the pen's chain by level ("San
 * Diego is a City, in California, a State"). New level adds a category to this
 * view at the narrow end and puts the pen on it; order and names are edited in
 * Tracking settings → General → Level categories. Writes straight to the store.
 */
"use client"

import { useState } from "react"
import { ancestorChain } from "@/lib/pen-tree"
import { makeLevelId, penLevel, penLevelId, scopeLevels } from "@/lib/pen-levels"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function PenLevelPicker({ scopeId, penId, penName }: { scopeId: string; penId: string; penName: string }) {
  const scope = useTimeTrackingStore((s) => s.scopes.find((sc) => sc.id === scopeId))
  const setPenLevel = useTimeTrackingStore((s) => s.setPenLevel)
  const setScopeLevels = useTimeTrackingStore((s) => s.setScopeLevels)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  if (!scope) return null

  const levels = scopeLevels(scope)
  const pen = scope.pens.find((p) => p.id === penId)
  const current = penLevelId(scope, pen)
  const chain = ancestorChain(scope.pens, penId).slice(0, -1).reverse()
  const ladder = chain
    .map((p) => ({ name: p.name, level: penLevel(scope, p.id)?.name }))
    .filter((row) => row.level)

  const create = () => {
    const name = draft.trim()
    if (!name) return
    const existing = levels.find((level) => level.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setPenLevel(scopeId, penId, existing.id)
    } else {
      const level = { id: makeLevelId(), name }
      setScopeLevels(scopeId, [...levels, level])
      setPenLevel(scopeId, penId, level.id)
    }
    setDraft("")
    setAdding(false)
  }

  return (
    <div className="trk-level-picker" data-testid="pen-level-picker">
      <div className="trk-level-keys" role="group" aria-label={`Level category in ${scope.name}`}>
        <button type="button" data-no95="" aria-pressed={!current} onClick={() => setPenLevel(scopeId, penId, undefined)}>
          None
        </button>
        {levels.map((level, i) => (
          <span key={level.id} className="trk-level-step">
            {i > 0 ? (
              <span className="trk-level-sep" aria-hidden>
                ›
              </span>
            ) : null}
            <button
              type="button"
              data-no95=""
              aria-pressed={current === level.id}
              onClick={() => setPenLevel(scopeId, penId, level.id)}
            >
              {level.name}
            </button>
          </span>
        ))}
        {adding ? (
          <span className="trk-level-new">
            <input
              autoFocus
              aria-label="New level category"
              placeholder="Neighborhood"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  create()
                }
                if (event.key === "Escape") setAdding(false)
              }}
            />
            <button type="button" data-no95="" onClick={create} disabled={!draft.trim()}>
              Add
            </button>
          </span>
        ) : (
          <button type="button" data-no95="" className="trk-level-add" onClick={() => setAdding(true)}>
            + New level
          </button>
        )}
      </div>
      <p className="trk-help">
        {current ? (
          <>
            <strong>{penName}</strong> is a {levels.find((l) => l.id === current)?.name}
            {ladder.length
              ? `, in ${ladder.map((row) => `${row.name} (${row.level})`).join(", in ")}`
              : ""}
            . Analytics can roll {scope.name} up to any level.
          </>
        ) : levels.length ? (
          <>Name this rung so {scope.name} can be read by level in Analytics instead of “level 2”.</>
        ) : (
          <>No level categories in {scope.name} yet. Add one, such as Neighborhood or City.</>
        )}
      </p>
    </div>
  )
}
