/**
 * components/Lab/BimFlow/node-palette.tsx — The "+ Node" menu
 *
 * One silver key that opens a grouped menu of node kinds, in place of eighteen keys in the header.
 * Groups follow the order a flow reads: decide, find, read, say, write. Closes on pick, Esc, or a click outside.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { FlowNodeKind } from "@/lib/bim-flow/types"

type Kind = FlowNodeKind

const GROUPS: { name: string; kinds: { kind: Kind; hint: string }[] }[] = [
  { name: "Decide", kinds: [
    { kind: "gate", hint: "One yes/no question; follows the Y or N wire" },
    { kind: "route", hint: "Pick one of several lanes" },
    { kind: "guard", hint: "No model: stop if no subject word was ever written down" },
    { kind: "clarify", hint: "No model: ask which one when a name fits two" },
    { kind: "fallback", hint: "Runs when nothing upstream took the message" },
  ] },
  { name: "Find", kinds: [
    { kind: "search", hint: "No model: match content words against items, lists, habits, pens, people" },
    { kind: "link", hint: "Link the message to a known thing" },
    { kind: "choose", hint: "The model picks from a search's options only" },
    { kind: "context", hint: "Which of the two earlier lines this message needs" },
    { kind: "related", hint: "The model adds words the notes may have used" },
  ] },
  { name: "Read", kinds: [
    { kind: "extract", hint: "Named fields under a JSON schema" },
    { kind: "retrieve", hint: "No model: read tracked entries, messages, notes" },
    { kind: "compute", hint: "No model: count, minutes, streaks, compare" },
  ] },
  { name: "Say", kinds: [
    { kind: "question", hint: "No model: the wording an interview answer asks" },
    { kind: "answer", hint: "The model writes from the evidence only" },
    { kind: "handoff", hint: "Hand the message to another agent" },
  ] },
  { name: "Write", kinds: [
    { kind: "propose", hint: "Collects what would be written" },
    { kind: "blocks", hint: "Code opens, closes and estimates time spans" },
  ] },
]

export function NodePalette({ onAdd }: { onAdd: (kind: Kind) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc) }
  }, [open])

  return (
    <div className="bf-pal" ref={box}>
      <button type="button" data-no95 className={`bf-cap${open ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        + Node ▾
      </button>
      {open ? (
        <div className="bf-pal-menu" role="menu">
          {GROUPS.map((g) => (
            <div key={g.name} className="bf-pal-group">
              <span className="bf-pal-k">{g.name}</span>
              {g.kinds.map(({ kind, hint }) => (
                <button key={kind} type="button" data-no95 role="menuitem" className="bf-pal-item" title={hint} onClick={() => { onAdd(kind); setOpen(false) }}>
                  {kind}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
