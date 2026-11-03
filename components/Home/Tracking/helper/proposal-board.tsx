/**
 * components/Home/Tracking/helper/proposal-board.tsx — The Helper's blocks, drawn
 *
 * Per day: a ribbon of hours with one lane per block (a bar for the Activity, a thin strip under it for
 * the place), then one card per block. A firm edge ends in a solid cap; a guessed edge fades out in
 * hatching; a stand-in for a time never given is dashed with a "?". Click a time, the activity or the
 * place to edit it. Nothing is written until Add.
 */
"use client"

import { useState } from "react"
import { clockText, parseTyped } from "@/lib/tracking-helper/clock"
import { openBlocks, useTrackingHelper, type HelperLine } from "@/lib/tracking-helper/store"
import type { Cert, ProposedBlock } from "@/lib/tracking-helper/types"

const hue = (s: string) => {
  let h = 0
  for (const c of s.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360
  // Cool half of the wheel only: teal to violet, never yellow.
  return 165 + (h % 130)
}

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })

function Inline({ value, onCommit, label, validate }: { value: string; onCommit: (v: string) => void; label: string; validate?: (v: string) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <button type="button" className="th-inline" data-no95="" title={`Edit ${label}`} onClick={() => setDraft(value)}>
        {value || `+ ${label}`}
      </button>
    )
  }
  const done = (keep: boolean) => {
    if (keep && draft !== value && (!validate || validate(draft))) onCommit(draft)
    setDraft(null)
  }
  return (
    <input
      className="th-inline-input"
      aria-label={label}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") done(true)
        if (e.key === "Escape") done(false)
      }}
    />
  )
}

function CertChip({ cert, chained, open, onToggle }: { cert: Cert; chained?: boolean; open?: boolean; onToggle: () => void }) {
  const text = open ? "not given" : chained ? (cert === "exact" ? "from neighbour" : "est, from neighbour") : cert === "exact" ? "certain" : "est"
  return (
    <button type="button" className="th-cert" data-cert={open ? "open" : cert} data-no95="" title="Click to flip certain / estimated" onClick={onToggle}>
      {text}
    </button>
  )
}

function Ribbon({ blocks, state }: { blocks: ProposedBlock[]; state: (id: string) => string | undefined }) {
  const from = Math.floor(Math.min(...blocks.map((b) => b.startMin ?? 1440)) / 60) * 60
  const to = Math.min(1440, Math.ceil(Math.max(...blocks.map((b) => b.endMin ?? 0)) / 60) * 60)
  const span = Math.max(60, to - from)
  const hours: number[] = []
  for (let m = from; m <= to; m += 60) hours.push(m)
  const step = hours.length > 9 ? 2 : 1
  return (
    <div className="th-ribbon" role="img" aria-label="Proposed blocks on a time ruler">
      <div className="th-ruler">
        {hours.map((m, i) => (
          <span key={m} className="th-tick" data-label={i % step === 0 ? "1" : "0"} style={{ left: `${((m - from) / span) * 100}%` }}>
            {i % step === 0 ? clockText(m).replace(":00", "") : ""}
          </span>
        ))}
      </div>
      {blocks.map((b) => {
        const left = (((b.startMin ?? from) - from) / span) * 100
        const width = Math.max(1.5, (((b.endMin ?? from) - (b.startMin ?? from)) / span) * 100)
        const done = state(b.id)
        return (
          <div key={b.id} className="th-lane" data-state={done ?? "open"}>
            <div
              className="th-bar"
              data-start={b.startCert}
              data-end={b.endCert}
              data-open={b.openEnd || b.openStart ? "1" : "0"}
              style={{ left: `${left}%`, width: `${width}%`, ["--th-h" as string]: hue(b.activity) }}
              title={`${b.activity} ${clockText(b.startMin!)} – ${clockText(b.endMin!)}`}
            >
              <span className="th-bar-label">{b.activity}</span>
              {b.openEnd ? <span className="th-bar-q">?</span> : null}
            </div>
            {b.place ? (
              <div className="th-place-strip" data-source={b.place.source} style={{ left: `${left}%`, width: `${width}%`, ["--th-h" as string]: hue(b.place.name) }}>
                {width > 14 ? b.place.name : ""}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function Card({ line, block }: { line: HelperLine; block: ProposedBlock }) {
  const edit = useTrackingHelper((s) => s.edit)
  const add = useTrackingHelper((s) => s.add)
  const dismiss = useTrackingHelper((s) => s.dismiss)
  const [msg, setMsg] = useState("")
  const decided = line.decided?.[block.id]
  const patch = (p: Partial<ProposedBlock>) => edit(line.id, block.id, p)
  const setTime = (edge: "start" | "end", v: string) => {
    const min = parseTyped(v)
    if (min === null) return
    patch(edge === "start" ? { startMin: min, startCert: "exact", startChained: false, openStart: false } : { endMin: min, endCert: "exact", endChained: false, openEnd: false })
  }
  const flip = (c: Cert): Cert => (c === "exact" ? "estimated" : "exact")
  const bad = block.endMin !== null && block.startMin !== null && block.endMin <= block.startMin
  return (
    <article className="th-card" data-state={decided ?? "open"} style={{ ["--th-h" as string]: hue(block.activity) }}>
      <header className="th-card-head">
        <span className="th-dot" aria-hidden />
        <Inline label="activity" value={block.activity} onCommit={(v) => patch({ activity: v.trim() })} validate={(v) => !!v.trim()} />
        {block.place ? (
          <span className="th-place" data-source={block.place.source} title={block.place.source === "stated" ? "You said this place" : block.place.source === "learned" ? "Learned from where this usually happens" : "Assumed for a chore at home. Change it if wrong"}>
            <Inline label="place" value={block.place.name} onCommit={(v) => patch(v.trim() ? { place: { name: v.trim(), source: "stated", isNew: true } } : { place: undefined })} />
            <em>{block.place.source}</em>
          </span>
        ) : (
          <Inline label="place" value="" onCommit={(v) => patch({ place: { name: v.trim(), source: "stated", isNew: true } })} validate={(v) => !!v.trim()} />
        )}
        {decided ? <span className="th-verdict">{decided}</span> : null}
      </header>
      <div className="th-times">
        <Inline label="start" value={block.startMin === null ? "" : clockText(block.startMin)} onCommit={(v) => setTime("start", v)} validate={(v) => parseTyped(v) !== null} />
        <CertChip cert={block.startCert} chained={block.startChained} open={block.openStart} onToggle={() => patch({ startCert: flip(block.startCert), openStart: false })} />
        <span className="th-arrow" aria-hidden>→</span>
        <Inline label="end" value={block.endMin === null ? "" : clockText(block.endMin)} onCommit={(v) => setTime("end", v)} validate={(v) => parseTyped(v) !== null} />
        <CertChip cert={block.endCert} chained={block.endChained} open={block.openEnd} onToggle={() => patch({ endCert: flip(block.endCert), openEnd: false })} />
        {block.startMin !== null && block.endMin !== null && !bad ? <span className="th-len">{block.endMin - block.startMin} min</span> : null}
      </div>
      {bad ? <p className="th-warn">End is not after start.</p> : null}
      <Inline label="with" value={block.with ?? ""} onCommit={(v) => patch({ with: v.trim() })} />
      <Inline label="mood" value={block.mood ?? ""} onCommit={(v) => patch({ mood: v.trim() })} />
      <Inline label="note" value={block.notes} onCommit={(v) => patch({ notes: v })} />
      <p className="th-from">“{block.from}”</p>
      {!decided ? (
        <footer className="th-actions">
          <button type="button" className="th-key th-key-go" data-no95="" disabled={bad} onClick={() => setMsg(add(line.id, [block.id]))}>Add</button>
          <button type="button" className="th-key" data-no95="" onClick={() => dismiss(line.id, block.id)}>Dismiss</button>
          {msg.includes("OVER TIME") ? (
            <button type="button" className="th-key th-key-warn" data-no95="" onClick={() => setMsg(add(line.id, [block.id], true))}>Add anyway</button>
          ) : null}
          {msg ? <span className="th-msg">{msg}</span> : null}
        </footer>
      ) : null}
    </article>
  )
}

export function ProposalBoard({ line }: { line: HelperLine }) {
  const add = useTrackingHelper((s) => s.add)
  const [msg, setMsg] = useState("")
  const blocks = (line.blocks ?? []).filter((b) => b.startMin !== null && b.endMin !== null)
  if (!blocks.length) return null
  const days = [...new Set(blocks.map((b) => b.day))]
  const open = openBlocks(line)
  return (
    <div className="th-board">
      {days.map((day) => {
        const rows = blocks.filter((b) => b.day === day)
        return (
          <section key={day} className="th-day">
            <h4>{dayLabel(day)}</h4>
            <Ribbon blocks={rows} state={(id) => line.decided?.[id]} />
            <div className="th-cards">
              {rows.map((b) => (
                <Card key={b.id} line={line} block={b} />
              ))}
            </div>
          </section>
        )
      })}
      {open.length > 1 ? (
        <div className="th-all">
          <button type="button" className="th-key th-key-go" data-no95="" onClick={() => setMsg(add(line.id))}>Add all {open.length}</button>
          {msg ? <span className="th-msg">{msg}</span> : null}
        </div>
      ) : null}
      <p className="th-legend">
        <i className="th-lg-solid" /> certain edge <i className="th-lg-hatch" /> estimated edge <i className="th-lg-open" /> end not given
      </p>
    </div>
  )
}
