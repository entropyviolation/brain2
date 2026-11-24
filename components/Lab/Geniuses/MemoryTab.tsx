/**
 * components/Lab/Geniuses/MemoryTab.tsx — What one genius remembers, and exactly how it reads it back
 *
 * Notes (add and delete), talks (open and delete), the councils it sat in, and the MEMORY block its next prompt will
 * carry.
 */
"use client"

import { useState } from "react"
import { useGeniusesStore } from "@/lib/geniuses/store"
import { btn, card, field, GeniusSelect, useContextFor, useGeniusNames } from "./lab-kit"

export function MemoryTab() {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const talks = useGeniusesStore((s) => s.talks)
  const meetings = useGeniusesStore((s) => s.meetings)
  const store = useGeniusesStore.getState
  const names = useGeniusNames()
  const contextFor = useContextFor()
  const [geniusId, setGeniusId] = useState(geniuses[0]?.id ?? "")
  const [note, setNote] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const g = geniuses.find((x) => x.id === geniusId) ?? geniuses[0]
  if (!g) return <p className="text-sm">No geniuses.</p>
  const mine = talks.filter((t) => t.geniusId === g.id).reverse()
  const sat = meetings.filter((m) => m.geniusIds.includes(g.id)).reverse()

  return (
    <div className="space-y-4">
      <GeniusSelect value={g.id} onChange={setGeniusId} />
      <section className={card} aria-label="Memory block">
        <h2 className="text-sm font-semibold">What its next prompt carries</h2>
        <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{contextFor(g).memory}</pre>
      </section>
      <section className={card} aria-label="Notes">
        <h2 className="text-sm font-semibold">Notes · {g.notes.length}</h2>
        <div className="flex gap-2">
          <input className={field} placeholder="Tell it something to keep: I work best before noon" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { store().addNote(g.id, note); setNote("") } }} />
          <button type="button" className={btn} disabled={!note.trim()} onClick={() => { store().addNote(g.id, note); setNote("") }}>Keep</button>
        </div>
        <ul className="space-y-1 text-sm">
          {[...g.notes].reverse().map((n) => (
            <li key={n.id} className="flex gap-2">
              <span className="text-xs opacity-60">{n.at.slice(0, 10)}{n.source === "picked-up" ? " · picked up" : ""}</span>
              <span>{n.said}</span>
              <button type="button" className="ml-auto text-xs underline" onClick={() => store().removeNote(g.id, n.id)}>forget</button>
            </li>
          ))}
        </ul>
      </section>
      <section className={card} aria-label="Talks">
        <h2 className="text-sm font-semibold">Talks · {mine.length}</h2>
        <ul className="space-y-1 text-sm">
          {mine.map((t) => (
            <li key={t.id}>
              <button type="button" className="underline" onClick={() => setOpen(open === t.id ? null : t.id)}>{t.startedAt.slice(0, 10)} · {t.task}</button>
              <span className="text-xs opacity-60"> · {t.outcome} · {t.lines.length} lines</span>
              <button type="button" className="ml-2 text-xs underline" onClick={() => store().removeTalk(t.id)}>delete</button>
              {open === t.id ? (
                <ol className="ml-4 text-xs">
                  {t.lines.map((l, i) => <li key={i}>{l.who === "you" ? "You" : g.name}: {l.text}{l.stance ? ` (${l.stance})` : ""}</li>)}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className={card} aria-label="Councils">
        <h2 className="text-sm font-semibold">Councils · {sat.length}</h2>
        <ul className="space-y-1 text-sm">
          {sat.map((m) => (
            <li key={m.id}>
              {m.at.slice(0, 10)} · {m.topic} · asked “{m.asks.find((a) => a.geniusId === g.id)?.ask ?? "nothing"}” · {m.pickedId ? (m.pickedId === g.id ? "got it" : `went to ${names[m.pickedId] ?? "another"}`) : "undecided"}
              <button type="button" className="ml-2 text-xs underline" onClick={() => store().removeMeeting(m.id)}>delete</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
