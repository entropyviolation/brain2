/**
 * components/Lab/NodeDetailLab/MockIndex.tsx — Concept II · Speed Index
 *
 * A filing drawer on cool paper. Four cards with staggered tabs (Ident,
 * Points, Needs, Notes). The front card is open, the rest show their tab and
 * one line. The wheel over the drawer flips cards; the brass rod pulls every
 * card out at once. State is a rubber stamp that slams on Done. Needs are an
 * ERMA-style cross-reference tree. Notes are typed onto a ruled card.
 * Egg: type "erma" anywhere in the drawer and the tree redraws as punch tape.
 */
"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { AddNeed, Picker, toPts, TypeOn, useFlash } from "./kit"
import { fmtPct, NEED_KINDS, noteDate, NOTE_PROMPT, type NodeModel, type Ref } from "./model"

type CardId = "ident" | "points" | "needs" | "notes"
const CARDS: { id: CardId; tab: string }[] = [
  { id: "ident", tab: "Ident" },
  { id: "points", tab: "Points" },
  { id: "needs", tab: "Needs" },
  { id: "notes", tab: "Notes" },
]

function callNumber(n: NodeModel) {
  const letters = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.slice(0, 3).toUpperCase())
      .join("·")
  return n.isTask ? `${letters(n.name)} / 0` : `${letters(n.path[0] ?? "")} / ${n.path.length}.${n.name.length % 10}`
}

function TypeKey({ children, onClick, label, disabled, wide }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean; wide?: boolean }) {
  return (
    <button type="button" className={`ix-tkey${wide ? " is-wide" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <span>{children}</span>
    </button>
  )
}

function Stamp({ state, onClick }: { state: string; onClick: () => void }) {
  const f = useFlash(state, 700)
  return (
    <button type="button" className={`ix-stamp is-${state}${f}`} onClick={onClick} title={state === "done" ? "Reopen" : "Stamp it done"}>
      {state}
    </button>
  )
}

function Ledger({ n }: { n: NodeModel }) {
  const p = n.points
  const val = p.onDone.value ?? p.onDone.fallback ?? 0
  const f = useFlash(p.total)
  return (
    <div className="ix-ledger">
      <div className="ix-ledger-top">
        <span className={`ix-big${f}`}>{p.total}</span>
        <span className="ix-unit">points</span>
        {p.canByLevel ? (
          <span className="ix-switch" role="group" aria-label="Points mode">
            <button type="button" aria-pressed={!p.byLevel} onClick={() => n.act.setByLevel(false)}>
              On done
            </button>
            <button type="button" aria-pressed={p.byLevel} onClick={() => n.act.setByLevel(true)}>
              By level
            </button>
          </span>
        ) : null}
      </div>
      <table>
        <thead>
          <tr>
            <th>Entry</th>
            <th>Pays</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {p.byLevel ? (
            p.rungs.map((r) => (
              <tr key={r.tier} className={`${r.inside ? "" : "is-off"}${r.reached ? " is-reached" : ""}`}>
                <td>
                  <b className={`ix-tier is-${r.tier}`}>{r.short}</b> {r.label}
                </td>
                <td className="ix-pays">
                  <TypeKey label={`${r.label} minus one`} disabled={!r.inside || !(r.value ?? 0)} onClick={() => n.act.setRung(r.tier, Math.max(0, (r.value ?? 0) - 1))}>
                    −
                  </TypeKey>
                  <input type="number" min={0} disabled={!r.inside} aria-label={`${r.label} points`} value={r.value ?? ""} placeholder="0" onChange={(e) => n.act.setRung(r.tier, toPts(e.target.value))} />
                  <TypeKey label={`${r.label} plus one`} disabled={!r.inside} onClick={() => n.act.setRung(r.tier, (r.value ?? 0) + 1)}>
                    +
                  </TypeKey>
                </td>
                <td className="ix-src">{!r.inside ? "no step inside" : r.reached ? "✓ reached" : "on reaching"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td>On done</td>
              <td className="ix-pays">
                <TypeKey label="On done minus one" disabled={val <= 0} onClick={() => n.act.setOnDone(Math.max(0, val - 1))}>
                  −
                </TypeKey>
                <input type="number" min={0} aria-label="On done" value={p.onDone.value ?? ""} placeholder={p.onDone.fallback != null ? String(p.onDone.fallback) : "—"} onChange={(e) => n.act.setOnDone(toPts(e.target.value))} />
                <TypeKey label="On done plus one" onClick={() => n.act.setOnDone(val + 1)}>
                  +
                </TypeKey>
              </td>
              <td className="ix-src">
                {p.onDone.caption}
                {p.onDone.resetTo != null ? (
                  <button type="button" className="ix-link" onClick={() => n.act.setOnDone(undefined)}>
                    ↺ {n.isTask ? "rule" : "inherit"} {p.onDone.resetTo}
                  </button>
                ) : null}
              </td>
            </tr>
          )}
          {p.each.show ? (
            <tr>
              <td>Each step</td>
              <td className="ix-pays">
                <TypeKey label="Each step minus one" disabled={!(p.each.value ?? 0)} onClick={() => n.act.setEach(Math.max(0, (p.each.value ?? 0) - 1))}>
                  −
                </TypeKey>
                <input type="number" min={0} aria-label="Each step" value={p.each.value ?? ""} placeholder={p.each.fallback != null ? String(p.each.fallback) : "—"} onChange={(e) => n.act.setEach(toPts(e.target.value))} />
                <TypeKey label="Each step plus one" onClick={() => n.act.setEach((p.each.value ?? p.each.fallback ?? 0) + 1)}>
                  +
                </TypeKey>
              </td>
              <td className="ix-src">{p.each.caption}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function XrefTree({ n, tape }: { n: NodeModel; tape: boolean }) {
  const [adding, setAdding] = useState<null | "need" | "unlock">(null)
  const groups = [
    ...NEED_KINDS.map((k) => ({ id: k.id, label: k.label === "Task first" ? "Tasks first" : k.label, items: n.needs.filter((r) => r.kind === k.id), title: k.title })),
    { id: "unlock", label: "Unlocks", items: n.unlocks, title: n.isTask ? "Tasks that wait on this one" : "Steps that wait on this one" },
  ].filter((g) => g.items.length)
  const chip = (r: Ref) => (
    <li key={r.key} className={`ix-xref is-${r.state}`}>
      <span className="ix-box" />
      {r.canOpen ? (
        <button type="button" className="ix-xname" onClick={() => n.act.open(r)}>
          {r.label}
        </button>
      ) : (
        <span className="ix-xname">{r.label}</span>
      )}
      <small>{r.state === "wait" ? "waiting" : r.state === "ref" ? r.hint : r.state}</small>
      {r.canLog ? (
        <button type="button" className="ix-log" onClick={() => n.act.log(r.id)}>
          log
        </button>
      ) : null}
      <button type="button" className="ix-x" aria-label={`Remove ${r.label}`} onClick={() => n.act.removeNeed(r)}>
        ×
      </button>
    </li>
  )
  return (
    <div className={`ix-tree${tape ? " is-tape" : ""}`}>
      <div className="ix-root">
        <span>{n.name}</span>
      </div>
      {groups.length ? (
        <div className="ix-branches" style={{ ["--cols" as string]: groups.length }}>
          {groups.map((g) => (
            <div key={g.id} className={`ix-branch is-${g.id}`}>
              <h5 title={g.title}>{g.label}</h5>
              <ul>{g.items.map(chip)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="ix-quiet">Needs nothing yet. Unlocks nothing yet.</p>
      )}
      <div className="ix-keys">
        <TypeKey wide label="Add need" onClick={() => setAdding(adding === "need" ? null : "need")}>
          + Need
        </TypeKey>
        <TypeKey wide label={`Make ${n.isTask ? "a task" : "a step"} wait on this`} disabled={!n.unlockOptions.length} onClick={() => setAdding(adding === "unlock" ? null : "unlock")}>
          + Waits on this
        </TypeKey>
      </div>
      {adding === "need" ? <AddNeed cls="ix" n={n} onDone={() => setAdding(null)} /> : null}
      {adding === "unlock" ? <Picker cls="ix" placeholder={`Make ${n.isTask ? "a task" : "a step"} wait on this…`} options={n.unlockOptions} onPick={n.act.addUnlock} onDone={() => setAdding(null)} /> : null}
    </div>
  )
}

function NotesCard({ n }: { n: NodeModel }) {
  const [draft, setDraft] = useState("")
  const [fresh, setFresh] = useState<string | null>(null)
  const send = () => draft.trim() && (n.act.addNote(draft), setFresh(draft.trim()), setDraft(""))
  return (
    <div className="ix-notes">
      <div className="ix-compose">
        <textarea rows={2} value={draft} aria-label="Note" placeholder={n.due ? NOTE_PROMPT : "Type a note on this task…"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), send())} />
        <TypeKey wide label="Log note (⌘↩)" disabled={!draft.trim()} onClick={send}>
          Log ⌘↩
        </TypeKey>
      </div>
      <ol>
        {n.notes.map((a) => (
          <li key={a.id}>
            <time className="ix-datestamp">{noteDate(a.date)}</time>
            <p>
              <TypeOn text={a.text} speed={34} on={fresh === a.text} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function MockIndex({ n, showMath }: { n: NodeModel; showMath: boolean }) {
  const [front, setFront] = useState<CardId>("ident")
  const [fanned, setFanned] = useState(false)
  const [tape, setTape] = useState(false)
  const typed = useRef("")
  const wheelLock = useRef(0)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return
      typed.current = (typed.current + e.key.toLowerCase()).slice(-4)
      if (typed.current === "erma") setTape((t) => !t)
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
  const flip = (dir: number) => {
    const i = CARDS.findIndex((c) => c.id === front)
    setFront(CARDS[(i + dir + CARDS.length) % CARDS.length].id)
  }
  const summary: Record<CardId, string> = {
    ident: `${n.state} · ${n.est}m est · ${n.spent}m spent${n.ends ? ` · ${n.ends.done}/${n.ends.leaves} ends` : ""}`,
    points: `${n.points.total} pts ${n.points.byLevel ? "by level" : "on done"}`,
    needs: `${n.needs.length} needs · ${n.unlocks.length} unlocks`,
    notes: `${n.notes.length} notes${n.due ? " · dot due" : ""}`,
  }
  const body: Record<CardId, ReactNode> = {
    ident: (
      <div className="ix-ident">
        <div className="ix-callno">
          <span>{callNumber(n)}</span>
          <Stamp state={n.state} onClick={n.act.toggleDone} />
        </div>
        <p className="ix-path">{n.path.join(" › ")}</p>
        <h2>{n.name}</h2>
        <dl>
          <dt>Level</dt>
          <dd>{n.tier ? <b className={`ix-tier is-${n.tier}`}>{n.tier === "min" ? "B · Bare minimum" : n.tier === "goal" ? "G · Goal" : "E · Exceptional"}</b> : "whole task"}</dd>
          <dt>Estimate</dt>
          <dd>{n.est} min</dd>
          <dt>Spent</dt>
          <dd className={n.spent > n.est ? "is-over" : undefined}>
            {n.spent} min{n.spent > n.est ? ` (+${n.spent - n.est})` : ""}
          </dd>
          {n.ends ? (
            <>
              <dt>Ends</dt>
              <dd>
                <span className="ix-ends">
                  {Array.from({ length: n.ends.leaves }, (_, i) => (
                    <i key={i} className={i < n.ends!.done ? "is-on" : undefined} />
                  ))}
                </span>
                {n.ends.done}/{n.ends.leaves}
              </dd>
            </>
          ) : null}
          {showMath && n.math ? (
            <>
              <dt>ρ / σ</dt>
              <dd className="ix-math">
                ρ = Σd/ΣL = {fmtPct(n.math.rho)} · σ = mean(d/L) = {fmtPct(n.math.sigma)}
              </dd>
            </>
          ) : null}
        </dl>
        {!n.isTask ? (
          <button type="button" className="ix-link is-block" onClick={n.act.openStepItem}>
            ↗ Open as step item
          </button>
        ) : null}
        <span className="ix-hole" aria-hidden />
      </div>
    ),
    points: <Ledger n={n} />,
    needs: <XrefTree n={n} tape={tape} />,
    notes: <NotesCard n={n} />,
  }
  return (
    <article className={`ix${fanned ? " is-fanned" : ""}`}>
      <header className="ix-drawer-face">
        <span className="ix-label-frame">
          <small>Correspondence storage</small>
          <b>{n.name.slice(0, 1).toUpperCase()}</b>
        </span>
        <button type="button" className="ix-rod" aria-pressed={fanned} onClick={() => setFanned(!fanned)} title={fanned ? "Push the cards back" : "Pull the rod: every card out at once"}>
          <i />
          {fanned ? "Push back" : "Pull rod"}
        </button>
      </header>
      <div
        className="ix-drawer"
        onWheel={(e) => {
          if (fanned || Date.now() - wheelLock.current < 380) return
          if (Math.abs(e.deltaY) < 18) return
          wheelLock.current = Date.now()
          flip(e.deltaY > 0 ? 1 : -1)
        }}
      >
        {CARDS.map((c, i) => {
          const isFront = fanned || c.id === front
          return (
            <section key={c.id} className={`ix-card is-${c.id}${isFront ? " is-front" : ""}`} style={{ ["--i" as string]: i }} aria-label={c.tab}>
              <button type="button" className="ix-tab" style={{ ["--i" as string]: i }} aria-expanded={isFront} onClick={() => setFront(c.id)}>
                {c.tab}
              </button>
              {isFront ? <div className="ix-card-body">{body[c.id]}</div> : <button type="button" className="ix-card-peek" onClick={() => setFront(c.id)}>{summary[c.id]}</button>}
            </section>
          )
        })}
      </div>
      <p className="ix-foot">Scroll over the drawer to flip · type “erma” for punch tape</p>
    </article>
  )
}
