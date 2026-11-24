/**
 * components/friend-details/FriendDetailsGenius.tsx — The Genius page of one friend card
 *
 * A card can be the face of one genius (`lib/geniuses/`). Not a genius yet: wear one of the geniuses, or start a new
 * one named after this friend. A genius: its name, area, charter, status, the lists, goals, objectives, habits and
 * project items it cares about, and what it sees of them. Edits save as you make them, into the geniuses store, not
 * the personality draft. The lab (`/lab/geniuses`) has its talks, councils, memory and prompts.
 */
"use client"

import { useMemo, useState } from "react"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { liveVault } from "@/lib/geniuses/live"
import { areaLines, readArea } from "@/lib/geniuses/read"
import { CHARTER_MAX, MAX_ACTIVE } from "@/lib/geniuses/sanitize"
import { useGeniusesStore } from "@/lib/geniuses/store"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { GENIUS_STATUSES, type Genius, type GeniusBindings } from "@/lib/geniuses/types"

type Option = { id: string; label: string }

function Tray({ label, options, value, onChange, search = false }: { label: string; options: Option[]; value: string[]; onChange: (ids: string[]) => void; search?: boolean }) {
  const [q, setQ] = useState("")
  const picked = new Set(value)
  const free = options.filter((o) => !picked.has(o.id))
  const found = q.trim() ? free.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []
  return (
    <div className="friend-tray">
      <span className="friend-tray-label">{label}</span>
      <ul className="friend-beads">
        {value.map((id) => (
          <li key={id} className="friend-bead">
            {options.find((o) => o.id === id)?.label ?? "(gone)"}
            <button type="button" className="friend-bead-x" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange(value.filter((x) => x !== id))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {search ? (
        <>
          <input className="friend-bead-input" placeholder="Find an item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Find ${label.toLowerCase()}`} />
          {found.map((o) => (
            <button key={o.id} type="button" className="friend-bead" onClick={() => { onChange([...value, o.id]); setQ("") }}>
              + {o.label}
            </button>
          ))}
        </>
      ) : free.length ? (
        <select className="native-select" value="" aria-label={`Add ${label.toLowerCase()}`} onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">Add…</option>
          {free.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      ) : null}
    </div>
  )
}

function GeniusEditor({ g }: { g: Genius }) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const habits = useHabitsStore((s) => s.tasks)
  const [refused, setRefused] = useState(false)
  const store = useGeniusesStore.getState
  const options = useMemo<Record<keyof GeniusBindings, Option[]>>(
    () => ({
      listIds: lists.map((l) => ({ id: l.id, label: l.name })),
      goalIds: goals.map((x) => ({ id: x.id, label: x.title })),
      objectiveIds: objectives.map((o) => ({ id: o.id, label: o.title })),
      habitIds: habits.map((h) => ({ id: h.id, label: h.name })),
      rootItemIds: tasks.filter((t) => !t.secret && !t.completed).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t) })),
    }),
    [lists, goals, objectives, habits, tasks],
  )
  const sees = useMemo(() => areaLines(readArea(g, liveVault())), [g, tasks, habits, goals]) // eslint-disable-line react-hooks/exhaustive-deps
  const bind = (key: keyof GeniusBindings, ids: string[]) => store().updateGenius(g.id, { bindings: { ...g.bindings, [key]: ids } })

  return (
    <div className="friend-genius">
      <label className="friend-genius-field">
        <span className="friend-tray-label">Name</span>
        <input className="friend-bead-input" value={g.name} maxLength={40} onChange={(e) => e.target.value.trim() && store().updateGenius(g.id, { name: e.target.value })} />
      </label>
      <label className="friend-genius-field">
        <span className="friend-tray-label">Area</span>
        <input className="friend-bead-input" value={g.area} maxLength={80} placeholder="Budget and making money" onChange={(e) => store().updateGenius(g.id, { area: e.target.value })} />
      </label>
      <label className="friend-genius-field is-wide">
        <span className="friend-tray-label">
          What it wants for you, in your words · {g.charter.length}/{CHARTER_MAX}
        </span>
        <textarea className="friend-bead-input" rows={2} maxLength={CHARTER_MAX} value={g.charter} onChange={(e) => store().updateGenius(g.id, { charter: e.target.value })} />
      </label>
      <label className="friend-genius-field">
        <span className="friend-tray-label">Status</span>
        <select className="native-select friend-bead-input" value={g.status} onChange={(e) => setRefused(!store().setStatus(g.id, e.target.value as Genius["status"]))}>
          {GENIUS_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      {refused ? <p className="friend-tray-note">At most {MAX_ACTIVE} geniuses are active. Rest or retire one first.</p> : null}
      <Tray label="Lists" options={options.listIds} value={g.bindings.listIds} onChange={(ids) => bind("listIds", ids)} />
      <Tray label="Goals" options={options.goalIds} value={g.bindings.goalIds} onChange={(ids) => bind("goalIds", ids)} />
      <Tray label="Objectives" options={options.objectiveIds} value={g.bindings.objectiveIds} onChange={(ids) => bind("objectiveIds", ids)} />
      <Tray label="Habits" options={options.habitIds} value={g.bindings.habitIds} onChange={(ids) => bind("habitIds", ids)} />
      <Tray label="Project items" options={options.rootItemIds} value={g.bindings.rootItemIds} onChange={(ids) => bind("rootItemIds", ids)} search />
      <details className="friend-genius-sees">
        <summary className="friend-tray-label">What {g.name} sees</summary>
        <pre>{sees}</pre>
      </details>
      <p className="friend-tray-note">
        {g.notes.length} notes kept. Talks, councils, memory and prompts: <a href="/lab/geniuses">the geniuses lab</a>.
      </p>
      <div className="friend-key-row">
        <button type="button" className="friend-key" data-no95="" onClick={() => store().updateGenius(g.id, { animalId: "" })}>
          Stop being {g.name}
        </button>
      </div>
    </div>
  )
}

export function FriendDetailsGenius({ animalId, displayName }: { animalId: string; displayName: string }) {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const photos = useBabyAnimalsStore((s) => s.photos)
  const store = useGeniusesStore.getState
  const mine = geniuses.find((g) => g.animalId === animalId && animalId)
  const name = displayName.trim()
  const wornElsewhere = (g: Genius) => !!g.animalId && photos.some((p) => p.animalId === g.animalId)
  if (mine) return <GeniusEditor g={mine} />
  return (
    <div className="friend-genius">
      <p className="friend-tray-note">
        {name || "This card"} is not a genius yet. A genius is a friend who cares about one area of your life: it gives
        assignments only from that area, answers your reasons, and remembers. Pick one for {name || "this card"} to be, or
        start a new one.
      </p>
      <div className="friend-key-row is-wrap">
        {geniuses.map((g) => (
          <button key={g.id} type="button" className="friend-key" data-no95="" onClick={() => store().updateGenius(g.id, { animalId })} title={g.area}>
            Be {g.name}{wornElsewhere(g) ? " (moves from its other card)" : ""}
          </button>
        ))}
        <button
          type="button"
          className="friend-key is-primary"
          data-no95=""
          disabled={!animalId}
          onClick={() => store().addGenius({ name: displayName.trim().slice(0, 40) || "New genius", animalId, area: "", charter: "", origin: "goal" })}
        >
          New genius
        </button>
      </div>
    </div>
  )
}
