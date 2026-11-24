/**
 * components/Lab/Geniuses/GeniusesTab.tsx — Edit the council: name, face, area, charter, bindings, status
 *
 * A lab editor until Gallery Details gets its Genius tab (GN-3). Bindings pick from your real lists, goals, objectives,
 * habits and items. Each card shows the area read the genius will see.
 */
"use client"

import { useMemo, useState } from "react"
import { BABY_ANIMALS } from "@/lib/baby-animals"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { areaLines } from "@/lib/geniuses/read"
import { CHARTER_MAX, MAX_ACTIVE } from "@/lib/geniuses/sanitize"
import { useGeniusesStore } from "@/lib/geniuses/store"
import { GENIUS_STATUSES, type Genius, type GeniusBindings } from "@/lib/geniuses/types"
import { btn, card, field, useAreaVault, useContextFor } from "./lab-kit"

type Option = { id: string; label: string }

function Picker({ label, options, value, onChange }: { label: string; options: Option[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("")
  const picked = new Set(value)
  const shown = options.filter((o) => picked.has(o.id) || (q.trim() && o.label.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 30)
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{label} · {value.length}</p>
      <div className="flex flex-wrap gap-1">
        {value.map((id) => (
          <button key={id} type="button" className="rounded bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-700" title="Remove" onClick={() => onChange(value.filter((x) => x !== id))}>
            {options.find((o) => o.id === id)?.label ?? id} ×
          </button>
        ))}
      </div>
      <input className={field} placeholder={`Find ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() ? (
        <ul className="max-h-32 overflow-auto text-xs">
          {shown.filter((o) => !picked.has(o.id)).map((o) => (
            <li key={o.id}><button type="button" className="underline" onClick={() => { onChange([...value, o.id]); setQ("") }}>{o.label}</button></li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function GeniusCard({ g, options }: { g: Genius; options: Record<keyof GeniusBindings, Option[]> }) {
  const store = useGeniusesStore.getState
  const contextFor = useContextFor()
  const photos = useBabyAnimalsStore((s) => s.photos)
  const faces = useMemo(() => {
    const cards = photos.map((p) => ({ id: p.animalId, label: p.displayName.trim() || p.animalId }))
    const have = new Set(cards.map((c) => c.id))
    return [{ id: "", label: "(no face)" }, ...cards, ...BABY_ANIMALS.filter((a) => !have.has(a.id)).map((a) => ({ id: a.id, label: a.young }))]
  }, [photos])
  const [refused, setRefused] = useState(false)
  const read = useMemo(() => areaLines(contextFor(g).read), [g, contextFor])
  const bind = (key: keyof GeniusBindings, ids: string[]) => store().updateGenius(g.id, { bindings: { ...g.bindings, [key]: ids } })
  return (
    <section className={card} aria-label={g.name}>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">Name<input className={field} value={g.name} onChange={(e) => store().updateGenius(g.id, { name: e.target.value || g.name })} /></label>
        <label className="text-xs">Face
          <select className={field} value={g.animalId} onChange={(e) => store().updateGenius(g.id, { animalId: e.target.value })}>
            {faces.map((f) => <option key={f.id || "none"} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-xs">Status
          <select className={field} value={g.status} onChange={(e) => setRefused(!store().setStatus(g.id, e.target.value as Genius["status"]))}>
            {GENIUS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {refused ? <p className="text-xs">At most {MAX_ACTIVE} active. Rest or retire one first.</p> : null}
      <label className="block text-xs">Area<input className={field} value={g.area} onChange={(e) => store().updateGenius(g.id, { area: e.target.value })} /></label>
      <label className="block text-xs">Charter, in your words ({g.charter.length}/{CHARTER_MAX})<textarea className={`${field} min-h-14`} value={g.charter} maxLength={CHARTER_MAX} onChange={(e) => store().updateGenius(g.id, { charter: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Picker label="Lists" options={options.listIds} value={g.bindings.listIds} onChange={(ids) => bind("listIds", ids)} />
        <Picker label="Goals" options={options.goalIds} value={g.bindings.goalIds} onChange={(ids) => bind("goalIds", ids)} />
        <Picker label="Objectives" options={options.objectiveIds} value={g.bindings.objectiveIds} onChange={(ids) => bind("objectiveIds", ids)} />
        <Picker label="Habits" options={options.habitIds} value={g.bindings.habitIds} onChange={(ids) => bind("habitIds", ids)} />
        <Picker label="Project root items" options={options.rootItemIds} value={g.bindings.rootItemIds} onChange={(ids) => bind("rootItemIds", ids)} />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer">What it sees of its area</summary>
        <pre className="mt-1 whitespace-pre-wrap rounded bg-neutral-100 p-2 dark:bg-neutral-800">{read}</pre>
      </details>
      <button type="button" className={btn} onClick={() => { if (window.confirm(`Remove ${g.name}, its notes and its talks? Council minutes stay.`)) store().removeGenius(g.id) }}>Remove</button>
    </section>
  )
}

export function GeniusesTab() {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const store = useGeniusesStore.getState
  const v = useAreaVault()
  const [name, setName] = useState("")
  const options = useMemo<Record<keyof GeniusBindings, Option[]>>(
    () => ({
      listIds: v.lists.map((l) => ({ id: l.id, label: l.name })),
      goalIds: v.goals.map((x) => ({ id: x.id, label: x.title })),
      objectiveIds: v.objectives.map((o) => ({ id: o.id, label: o.title })),
      habitIds: v.habits.map((h) => ({ id: h.id, label: h.name })),
      rootItemIds: v.tasks.filter((t) => !t.secret && !t.completed).map((t) => ({ id: t.id, label: itemTitleOrUntitled(t) })),
    }),
    [v],
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className={`${field} max-w-xs`} placeholder="New genius name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className={btn} disabled={!name.trim()} onClick={() => { store().addGenius({ name: name.trim(), animalId: "fox", area: "A new goal", charter: "", origin: "goal" }); setName("") }}>Add genius</button>
        <button type="button" className={btn} onClick={() => store().restoreStarters()}>Restore missing starters</button>
      </div>
      {geniuses.map((g) => <GeniusCard key={g.id} g={g} options={options} />)}
    </div>
  )
}
