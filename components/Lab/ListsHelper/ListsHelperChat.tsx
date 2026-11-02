/**
 * components/Lab/ListsHelper/ListsHelperChat.tsx — The Lists helper's chat, shared by the lab and the Lists dialog
 *
 * Plans show counts, real rows and warnings before anything is written; a duplicate shows its items side by side.
 * The engine is `lib/lists-helper/`; this file only draws it and calls `step`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
import { KeycapClose } from "@/components/keycap-close"
import { readJournal, writeJournal } from "@/lib/lists-helper/guard"
import { clearHistory, loadHistory, saveHistory, type Turn } from "@/lib/lists-helper/history"
import { browserPort } from "@/lib/lists-helper/port"
import { newSession, step, type Choice, type Reply, type Session } from "@/lib/lists-helper/session"
import { TOOLS } from "@/lib/lists-helper/tools"
import { useTaskStore } from "@/lib/task-store"
import "@/components/Bim/bim-ink.css"
import "@/components/Bim/console/bim-console.css"
import "./lists-helper-lab.css"

const GREETING: Turn = {
  id: 0,
  who: "helper",
  replies: [{ kind: "say", text: "Hi, I'm the Lists BIMBY. I find duplicates and make bulk list and item changes, one plan at a time. Try one of these.", choices: [
    { label: "Find duplicates", text: "help me find and merge duplicate items" },
    { label: "What can you do?", text: "help" },
  ] }],
}

/** Sentences to start from, as quick keys under the box. They send at once; none writes without a plan. */
const QUICK = [
  { label: "duplicates", text: "help me find and merge duplicate items" },
  { label: "help", text: "help" },
  { label: "undo", text: "undo" },
] as const

/** Plans over this many items show the progress bar while they are written. */
const BAR_ABOVE = 25

function clock(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export type Phase = "read" | "plan" | "approve" | "apply" | "undo"

function phaseOf(session: Session, last?: Reply): Phase {
  if (session.pending) return "approve"
  if (session.review) return "plan"
  if (last?.kind === "result") return last.undoable ? "apply" : "undo"
  return "read"
}

function Keys({ choices, live, onPick }: { choices?: Choice[]; live: boolean; onPick: (text: string) => void }) {
  if (!choices?.length) return null
  return (
    <div className="bim-chips lh-keys">
      {choices.map((c) => (
        <span key={`${c.label}|${c.text}`} className="lh-keypair">
          <button type="button" data-no95 disabled={!live} className={`lh-key is-${c.tone ?? "plain"}${c.tone === "go" ? " is-primary" : ""}`} onClick={() => onPick(c.text)}>
            {c.label}
          </button>
          {c.peek ? (
            <button type="button" data-no95 disabled={!live} className="lh-key is-mod lh-peek" title="See what is on this one before picking it" aria-label={`Details of ${c.label}`} onClick={() => onPick(c.peek!)}>
              Details
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function ReplyView({ reply, live, onPick }: { reply: Reply; live: boolean; onPick: (text: string) => void }) {
  switch (reply.kind) {
    case "say":
      return (
        <div className="lh-say">
          <p>{reply.text}</p>
          <Keys choices={reply.choices} live={live} onPick={onPick} />
        </div>
      )
    case "answer":
      return (
        <div className="lh-say">
          <p>{reply.text}</p>
          {reply.rows?.length ? (
            <ul className="lh-rows">
              {reply.rows.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
          {reply.candidates?.length ? (
            <div className="bim-chips lh-cands">
              {reply.candidates.map((c) => (
                <span key={c.id} className="lh-keypair">
                  <button type="button" data-no95 disabled={!live} className="lh-cand" onClick={() => onPick(c.text)}>
                    <b>{c.label}</b>
                    <small>{[c.detail, c.id].filter(Boolean).join(" · ")}</small>
                  </button>
                  {c.peek ? (
                    <button type="button" data-no95 disabled={!live} className="lh-key is-mod lh-peek" title="See what is on this one before picking it" aria-label={`Details of ${c.label}`} onClick={() => onPick(c.peek!)}>
                      Details
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          <Keys choices={reply.choices} live={live} onPick={onPick} />
        </div>
      )
    case "result":
      return (
        <div className="lh-result">
          <span className="lh-tick" aria-hidden="true">✓</span>
          <p>{reply.text}</p>
          {reply.undoable ? (
            <button type="button" data-no95 disabled={!live} className="lh-key is-mod" onClick={() => onPick("undo")}>
              Undo
            </button>
          ) : null}
        </div>
      )
    case "plan": {
      const p = reply.plan
      return (
        <article className="lh-plan" aria-label="Plan">
          <header>
            <span className="lh-badge">PLAN · nothing written yet</span>
            <h3>{p.title}</h3>
          </header>
          {p.summary.map((s, i) => (
            <p key={i} className="lh-sum">{s}</p>
          ))}
          <ul className="lh-impacts">
            {p.impacts.map((m, i) => (
              <li key={i}>
                <b>{m.count}</b>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
          {p.samples.length ? (
            <details open>
              <summary>{p.samples.length < p.total ? `First ${p.samples.length} of ${p.total}` : `All ${p.total}`}</summary>
              <ul className="lh-rows">
                {p.samples.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {p.warnings.length ? (
            <ul className="lh-warn">
              {p.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          {p.oneTime ? <p className="lh-once">One time only. This is not a rule; it does not change anything later.</p> : null}
          <Keys choices={reply.choices} live={live} onPick={onPick} />
        </article>
      )
    }
    case "dup": {
      const { card } = reply
      return (
        <article className="lh-dup" aria-label="Possible duplicate">
          <header>
            <span className="lh-badge">DUPLICATE {card.index} OF {card.total}</span>
            <span className="lh-why">{card.group.why}</span>
          </header>
          <div className="lh-dup-items" style={{ gridTemplateColumns: `repeat(${Math.min(card.items.length, 3)}, minmax(0, 1fr))` }}>
            {card.items.map((it) => (
              <div key={it.id} className="lh-dup-item">
                <b>{it.title}</b>
                <small>{it.type} · added {it.created}</small>
                <small>{it.lists.length ? it.lists.join(", ") : "no list"}</small>
                <small>{it.filled} attribute {it.filled === 1 ? "value" : "values"}</small>
                <code title="Item id">{it.id}</code>
              </div>
            ))}
          </div>
          <p className="lh-once">Merging keeps every value from all of them in one item. You can undo it.</p>
          <Keys choices={reply.choices} live={live} onPick={onPick} />
        </article>
      )
    }
    case "trace":
      return (
        <details className="lh-trace" open>
          <summary>Thought process</summary>
          <ol>
            {reply.lines.map((l, i) => (
              <li key={i} className={`is-${l.step}`}>
                {l.text}
              </li>
            ))}
          </ol>
        </details>
      )
    case "help":
      return (
        <div className="lh-say">
          <p>I work from these tools. Anything that changes data shows a plan first.</p>
          <ul className="lh-rows">
            {TOOLS.map((t) => (
              <li key={t.name}>
                <b>{t.label}</b> — {t.does}
              </li>
            ))}
          </ul>
        </div>
      )
  }
}

export function ListsHelperChat({ initialListId, onPhase, example, onClose }: { initialListId?: string; onPhase?: (phase: Phase) => void; example?: string; onClose?: () => void }) {
  // Reopening the window picks up where it left off. A plan that was waiting is not brought back.
  const [saved] = useState(() => loadHistory())
  // A write that never finished (the window died mid-way) left its old values in the journal. Offer to put them back.
  const [cut] = useState(() => readJournal())
  const [session, setSession] = useState<Session>(() => ({
    ...newSession(),
    undo: [...(saved?.undo ?? []), ...(cut ? [{ label: cut.label, patches: cut.patches, rows: [], created: cut.created, tombstoned: [] }] : [])].slice(-5),
    listId: initialListId ?? saved?.listId,
  }))
  const [turns, setTurns] = useState<Turn[]>(() => {
    const base = saved?.turns ?? [GREETING]
    if (!cut) return base
    const n = base.reduce((m, t) => Math.max(m, t.id), 0) + 1
    return [...base, { id: n, who: "helper", replies: [{ kind: "say", text: `An earlier change ("${cut.label}") did not finish. ${cut.patches.length} items may be half-written. I kept their old values. Put them back, or keep what is there?`, choices: [{ label: "Put them back", text: "undo", tone: "go" }, { label: "Keep as is", text: "keep" }] }] }]
  })
  const [restored, setRestored] = useState(saved?.turns.length ?? 0)
  const [busy, setBusy] = useState<string | null>(null)
  const [text, setText] = useState("")
  const lists = useTaskStore((s) => s.lists)
  const tail = useRef<HTMLDivElement>(null)
  const seq = useRef((saved?.turns.reduce((m, t) => Math.max(m, t.id), 0) ?? 0) + 1)

  useEffect(() => {
    tail.current?.scrollIntoView({ block: "end" })
  }, [turns.length])

  const focusName = useMemo(() => lists.find((l) => l.id === session.listId)?.name, [lists, session.listId])
  const last = turns[turns.length - 1]
  const phase = phaseOf(session, last?.replies?.[last.replies.length - 1])
  useEffect(() => onPhase?.(phase), [phase, onPhase])
  useEffect(() => writeJournal(null), [])
  useEffect(() => saveHistory(turns, session), [turns, session])
  useEffect(() => { if (example !== undefined) setText(example) }, [example])
  const pickable = useMemo(() => lists.filter((l) => !l.id.startsWith("__")).sort((a, b) => a.name.localeCompare(b.name)), [lists])

  const run = (line: string, working: string | null) => {
    let out: ReturnType<typeof step>
    try {
      out = step(session, line, browserPort())
    } catch (error) {
      out = { session, replies: [{ kind: "say", text: `Something went wrong and I stopped: ${error instanceof Error ? error.message : String(error)}. Check the item before trying again.` }] }
    }
    setSession(out.session)
    setTurns((t) => [...t, { id: seq.current++, who: "helper", replies: out.replies, at: new Date().toISOString() }])
    if (working) setBusy(null)
  }

  const send = (raw: string) => {
    const line = raw.trim()
    if (!line || busy) return
    setTurns((t) => [...t, { id: seq.current++, who: "you", text: line, at: new Date().toISOString() }])
    setText("")
    // A big approved plan: paint the progress bar first, then write, so the window never looks frozen.
    const big = session.pending && session.pending.plan.total > BAR_ABOVE && /^(yes|y|yep|yeah|confirm|approve|apply|do it|go ahead|go|ok|okay|sure)\b/i.test(line)
    const working = big ? session.pending!.plan.working ?? "Working" : null
    if (working) {
      setBusy(working)
      requestAnimationFrame(() => setTimeout(() => run(line, working), 0))
    } else run(line, null)
  }

  const startOver = () => {
    clearHistory()
    seq.current = 1
    setRestored(0)
    setTurns([GREETING])
    setSession({ ...newSession(), listId: session.listId })
  }

  const empty = turns.length <= 1

  return (
    <section className="lh-chat bim-crt bim-ink" aria-label="Chat">
      <div className="bim-crt-top">
        <div className="bim-glass bim-crt-plate">
          <span className={`bim-lamp${busy ? "" : " is-idle"}`} aria-hidden="true" />
          BIMBY
        </div>
        <span className="bim-crt-name">Lists helper · plans first, then writes</span>
        {onClose ? <KeycapClose className="bim-crt-x" label="Close Lists helper" onClick={onClose} /> : null}
      </div>

      <div className="bim-mode lh-focus">
        <label className="bim-mode-label" htmlFor="lh-list">WORKING IN</label>
        <select id="lh-list" value={session.listId ?? ""} onChange={(e) => send(e.target.value ? `focus on list id ${e.target.value}` : "clear focus")}>
          <option value="">no list (name one in each request)</option>
          {pickable.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {focusName ? <span className="bim-mode-says">{focusName}</span> : <span className="bim-mode-says">Name a list in each request, or pick one.</span>}
      </div>

      <div className="bim-glass bim-scroll lh-log" role="log" aria-live="polite">
        {turns.map((t, ti) =>
          t.who === "you" ? (
            <div key={t.id} className="bim-msg is-you">
              <span className="bim-msg-who">YOU {clock(t.at)}</span>
              <p className="bim-msg-text">{t.text}</p>
            </div>
          ) : (
            <div key={t.id} className="bim-msg is-bim lh-reply">
              <span className="bim-msg-who">BIMBY {clock(t.at)}</span>
              {t.replies?.map((r, i) => <ReplyView key={i} reply={r} live={ti === turns.length - 1 && ti >= restored && !busy} onPick={send} />)}
            </div>
          ),
        )}
        {busy ? (
          <div className="bim-msg is-bim" role="status" aria-live="polite">
            <span className="bim-msg-who">BIMBY · {busy}…</span>
            <span className="bim-wait" aria-label="Working">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : null}
        <div ref={tail} />
      </div>

      <form
        className="bim-compose"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <div className="bim-glass bim-well">
          <textarea
            value={text}
            rows={2}
            aria-label="Message the Lists BIMBY"
            placeholder={session.pending ? 'Say "yes" to apply the plan, or cancel' : 'Try "help me find and merge duplicate items"'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send(text)
              }
            }}
          />
        </div>
        <div className="bim-send">
          <button type="submit" data-no95 className="is-primary" aria-label="Send" disabled={!text.trim() || !!busy}>
            <span className="bim-key-word">SEND ↵</span>
            <ArrowUp className="bim-key-icon" aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="bim-quick" aria-label="Quick commands">
        {QUICK.map((q) => (
          <button key={q.label} type="button" data-no95 disabled={!!busy} onClick={() => send(q.text)}>
            {q.label}
          </button>
        ))}
        <button type="button" data-no95 className="is-mod bim-quick-gap" disabled={!!busy || empty} onClick={startOver} title="Forget this conversation">
          clear
        </button>
      </div>

      <div className="bim-foot">
        <span>Enter sends · Shift+Enter new line</span>
        <span>No model · changes only after you approve</span>
      </div>
    </section>
  )
}
