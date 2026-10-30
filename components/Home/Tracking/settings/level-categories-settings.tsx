/**
 * components/Home/Tracking/settings/level-categories-settings.tsx — Level categories per view
 *
 * Tracking settings → General. One card per view: its named levels broadest
 * first (Country › State › City › Neighborhood), each renamable, movable up or
 * down, removable (pens on it lose the level, nothing else changes), with how
 * many pens sit on it. Add a level at the narrow end. A view with a built-in
 * set (Location, Company, Activity) can go back to it. Pens are put on a level
 * in pen settings → Counts as. See `lib/pen-levels.ts`.
 */
"use client"

import { useState } from "react"
import { DEFAULT_SCOPE_LEVELS, levelCounts, makeLevelId, scopeLevels, type ScopeLevel } from "@/lib/pen-levels"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"

export function LevelCategoriesSettings() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  return (
    <div className="trk-levels" data-testid="level-categories">
      {scopes.map((scope) => (
        <ScopeLevelsCard key={scope.id} scope={scope} />
      ))}
    </div>
  )
}

function ScopeLevelsCard({ scope }: { scope: TrackScope }) {
  const setScopeLevels = useTimeTrackingStore((s) => s.setScopeLevels)
  const [draft, setDraft] = useState("")
  const levels = scopeLevels(scope)
  const counts = new Map(levelCounts(scope).map((row) => [row.level.id, row.pens.length]))
  const builtIn = DEFAULT_SCOPE_LEVELS[scope.id]
  const write = (next: ScopeLevel[]) => setScopeLevels(scope.id, next)

  const move = (index: number, by: -1 | 1) => {
    const next = [...levels]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    write(next)
  }

  const add = () => {
    const name = draft.trim()
    if (!name || levels.some((level) => level.name.toLowerCase() === name.toLowerCase())) return
    write([...levels, { id: makeLevelId(), name }])
    setDraft("")
  }

  return (
    <div className="trk-levels-card" role="group" aria-label={`${scope.name} levels`}>
      <div className="trk-levels-head">
        <span className="trk-levels-view">{scope.name}</span>
        <span className="trk-levels-ladder" aria-hidden>
          {levels.length ? levels.map((level) => level.name).join(" › ") : "No levels"}
        </span>
      </div>
      {levels.map((level, i) => (
        <LevelRow
          key={level.id}
          level={level}
          pens={counts.get(level.id) ?? 0}
          first={i === 0}
          last={i === levels.length - 1}
          onRename={(name) => write(levels.map((l) => (l.id === level.id ? { ...l, name } : l)))}
          onUp={() => move(i, -1)}
          onDown={() => move(i, 1)}
          onRemove={() => write(levels.filter((l) => l.id !== level.id))}
        />
      ))}
      <div className="trk-levels-row trk-levels-add">
        <input
          aria-label={`New ${scope.name} level`}
          placeholder={scope.id === "location" ? "Region" : "New level"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <button type="button" data-no95="" onClick={add} disabled={!draft.trim()}>
          Add level
        </button>
        {builtIn && scope.levels && JSON.stringify(scope.levels) !== JSON.stringify(builtIn) ? (
          <button type="button" data-no95="" onClick={() => write(builtIn.map((level) => ({ ...level })))}>
            Built-in set
          </button>
        ) : null}
      </div>
    </div>
  )
}

function LevelRow({
  level,
  pens,
  first,
  last,
  onRename,
  onUp,
  onDown,
  onRemove,
}: {
  level: ScopeLevel
  pens: number
  first: boolean
  last: boolean
  onRename: (name: string) => void
  onUp: () => void
  onDown: () => void
  onRemove: () => void
}) {
  const [name, setName] = useState(level.name)
  const commit = () => {
    const next = name.trim()
    if (!next) setName(level.name)
    else if (next !== level.name) onRename(next)
  }
  return (
    <div className="trk-levels-row">
      <input
        aria-label={`Level name ${level.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
      />
      <span className="trk-levels-count">
        {pens} {pens === 1 ? "pen" : "pens"}
      </span>
      <button type="button" data-no95="" aria-label={`Move ${level.name} broader`} onClick={onUp} disabled={first}>
        ↑
      </button>
      <button type="button" data-no95="" aria-label={`Move ${level.name} narrower`} onClick={onDown} disabled={last}>
        ↓
      </button>
      <button type="button" data-no95="" aria-label={`Remove level ${level.name}`} onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
