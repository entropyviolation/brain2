/**
 * components/Lab/PlanBimby/PlanBimbyPanel.tsx — Say a plan, confirm what was heard, then play it through
 *
 * A chat shell (mode keys, a thread, a composer) holding one kind of plan chat at a time (`lib/plan-bimby/modes.ts`).
 * The "Right now" chat has three steps. SAY: a sentence about right now. CONFIRM: the detected tasks, each one editable in
 * place (title, pace, minutes, subtasks, link), and nothing is written yet. RUN: ordered rows with play / pause /
 * done; finishing one logs what its link says. The engine is `lib/plan-bimby/`; this file only draws it.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MessageSquare, SendHorizontal } from "lucide-react"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import "@/components/Home/ToDo/task-card/task-card.css"
import "./plan-bimby.css"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { applyKey, keysOf } from "@/lib/critic-bimby/keys"
import { appendRecord, makeRecord } from "@/lib/critic-bimby/ledger"
import { modelLayerOn, setModelLayer } from "@/lib/critic-bimby/gate"
import { qualifyModel } from "@/lib/critic-bimby/qualify"
import { critiqueWithModel, traceLines } from "@/lib/critic-bimby/run"
import { critiquePlan } from "@/lib/critic-bimby/verdict"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { modeById, PLAN_CHAT_MODES, type PlanChatMode, type PlanChatModeId } from "@/lib/plan-bimby/modes"
import { matchTasks } from "@/lib/plan-bimby/links"
import { parsePlan, planItemId } from "@/lib/plan-bimby/parse"
import { elapsedMs, formatClock, isFinished } from "@/lib/plan-bimby/run"
import { usePlanRunStore } from "@/lib/plan-bimby/store"
import type { PlanDraft, PlanItem, PlanLink, PlanPace, RunItem } from "@/lib/plan-bimby/types"
import { useTaskStore } from "@/lib/task-store"

const btn = "min-h-11 min-w-11 rounded border border-neutral-400 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-800"
const field = "min-h-11 rounded border border-neutral-300 bg-transparent px-2 py-1 text-base dark:border-neutral-600"

function useNow(live: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [live])
  return now
}

export function PlanBimbyPanel() {
  const [modeId, setModeId] = useState<PlanChatModeId>("short-term")
  const mode = modeById(modeId)
  return (
    <div className="pb-chat" data-ui-name="Plan BIMBY" data-ui-docs="lib/plan-bimby/README.md">
      <header className="pb-chat-head">
        <MessageSquare aria-hidden className="pb-chat-icon" />
        <div className="pb-chat-title">
          <b>PLAN BIMBY</b>
          <span className="pb-quiet">plan chats</span>
        </div>
        <nav className="pb-modes" aria-label="Kind of plan">
          {PLAN_CHAT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="task-card-key task-card-keycap"
              data-no95=""
              aria-pressed={m.id === modeId}
              disabled={!m.ready}
              title={m.ready ? m.label : `${m.label}: planned`}
              onClick={() => setModeId(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </header>
      <ShortTermThread key={mode.id} mode={mode} />
    </div>
  )
}

function Bubble({ who, children }: { who: "bimby" | "you"; children: ReactNode }) {
  return <div className={`pb-bubble is-${who}`}>{children}</div>
}

/** The "Right now" chat: BIMBY greets, you say the plan, BIMBY answers with the confirm card, then the run list. */
function ShortTermThread({ mode }: { mode: PlanChatMode }) {
  const run = usePlanRunStore((s) => s.run)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const said = run?.source ?? draft?.source
  return (
    <>
      <div className="pb-thread">
        <Bubble who="bimby">{mode.hello}</Bubble>
        {said && <Bubble who="you">{said}</Bubble>}
        {run ? (
          <Bubble who="bimby"><RunView /></Bubble>
        ) : draft ? (
          <Bubble who="bimby"><ConfirmView draft={draft} onChange={setDraft} /></Bubble>
        ) : null}
      </div>
      {!run && !draft && <Composer mode={mode} onDraft={setDraft} />}
    </>
  )
}

function Composer({ mode, onDraft }: { mode: PlanChatMode; onDraft: (d: PlanDraft) => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [rulesOnly, setRulesOnly] = useState(false)
  // The model layer of the second look: off until turned on, and only for a model that passed the bench.
  const [second, setSecond] = useState(false)
  const [check, setCheck] = useState("")
  useEffect(() => setSecond(modelLayerOn()), [])
  const checkSecondLook = async () => {
    setCheck("Looking for a model…")
    const crew = await chatCrew().catch(() => null)
    const model = crew?.critic[0]
    if (!crew || !model) return setCheck("No model reachable.")
    try {
      const { result } = await qualifyModel(ollamaCall(model, undefined, { fresh: true }), model, (n, t) => setCheck(`${model}: ${n}/${t}`))
      setCheck(result.ready ? `${model} can be the second look.` : `${model} is not ready: ${result.why.join("; ")}.`)
    } catch {
      setCheck(`${model} did not answer.`)
    }
  }
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const crew = rulesOnly ? null : await chatCrew().catch(() => null)
      const read = await parsePlan({
        text,
        call: crew ? ollamaCall(crew.main) : null,
        ladder: crew?.extract ?? [],
        tasks: tasks.filter((t) => !t.completed),
      })
      const critique =
        second && crew
          ? await critiqueWithModel({ draft: read, call: ollamaCall(crew.main), ladder: crew.critic }).catch(() => critiquePlan(read))
          : critiquePlan(read)
      onDraft({ ...read, critique })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pb-composer">
      <textarea
        className="pb-input"
        rows={3}
        value={text}
        placeholder={mode.placeholder}
        aria-label="Your plan"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send()
        }}
      />
      <div className="pb-composer-row">
        <label className="pb-quiet pb-check">
          <input type="checkbox" checked={rulesOnly} onChange={(e) => setRulesOnly(e.target.checked)} />
          Rules only (no model)
        </label>
        <label className="pb-quiet pb-check" title="A second model reads your sentence against the plan. It only warns. Needs a check first.">
          <input type="checkbox" checked={second} onChange={(e) => { setSecond(e.target.checked); setModelLayer(e.target.checked) }} />
          Second look with a model
        </label>
        {second && (
          <button type="button" className="task-card-key task-card-keycap" data-no95="" onClick={() => void checkSecondLook()}>Check it</button>
        )}
        <button type="button" className="task-card-key task-card-keycap is-primary" data-no95="" disabled={busy || !text.trim()} onClick={() => void send()}>
          <SendHorizontal aria-hidden className="pb-send" /> {busy ? "Reading…" : "Send"}
        </button>
      </div>
      {second && check && <p className="pb-quiet" role="status">{check}</p>}
    </div>
  )
}

function linkValue(link: PlanLink | undefined): string {
  if (!link) return "none"
  if (link.kind === "task") return `task:${link.taskId}`
  return link.kind === "intake" ? `intake:${link.label}` : "flight"
}

function ConfirmView({ draft, onChange }: { draft: PlanDraft; onChange: (d: PlanDraft | null) => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const begin = usePlanRunStore((s) => s.begin)
  const open = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const set = (items: PlanItem[]) => onChange({ ...draft, items })
  const edit = (id: string, patch: Partial<PlanItem>) => set(draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const move = (at: number, by: number) => {
    const items = [...draft.items]
    const [row] = items.splice(at, 1)
    items.splice(Math.max(0, Math.min(items.length, at + by)), 0, row!)
    set(items)
  }
  // The first read and whether a critic key was pressed, so the ledger can say what the person did with the second look.
  const first = useRef(draft.items)
  const keyUsed = useRef(false)
  const [used, setUsed] = useState<string[]>([])
  const critique = draft.critique
  const keys = useMemo(() => (critique && critique.verdict === "fail" ? keysOf(critique, { items: first.current }).filter((k) => !used.includes(k.label)) : []), [critique, used])
  const note = (cancelled: boolean, confirmed: PlanItem[]) => {
    if (critique) appendRecord(makeRecord({ line: draft.source, first: first.current, confirmed, critique, keyUsed: keyUsed.current, cancelled }))
  }
  const start = () => {
    const items = draft.items
      .filter((i) => i.title.trim())
      .map((i) => (i.link?.kind === "task" ? { ...i, link: { ...i.link, confirmed: true } } : i))
    if (items.length) {
      note(false, items)
      begin(items, draft.remarks, draft.source)
    }
  }
  const flags = (id: string) => critique?.findings.filter((x) => x.where === id) ?? []
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Is this what you meant?</h2>
      <p className="text-xs opacity-70">
        Read by {draft.by === "model" ? `the model${draft.model ? ` (${draft.model})` : ""}` : `plain rules${draft.fallback ? ` (${draft.fallback})` : ""}`}. Edit anything, then start. Nothing is written until you finish a row.
      </p>
      {critique && critique.verdict === "fail" && (
        <div className="pb-critic is-fail" role="status" data-ui-name="Second look">
          <b>Second look: this may not match what you said.</b>
          <ul>
            {critique.findings.filter((x) => x.strength === "certain" || x.where === "plan").slice(0, 4).map((x, i) => (
              <li key={i}>{x.reason}</li>
            ))}
          </ul>
          <div className="pb-critic-keys">
            {keys.map((k) => (
              <button
                key={k.label}
                type="button"
                className="task-card-key task-card-keycap"
                data-no95=""
                onClick={() => {
                  keyUsed.current = true
                  setUsed((u) => [...u, k.label])
                  onChange(applyKey(draft, k.action))
                }}
              >
                {k.label}
              </button>
            ))}
            <span className="pb-quiet">Or edit below, or start as it is.</span>
          </div>
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {draft.items.map((item, at) => {
          const options = matchTasks(item, open)
          const current = item.link?.kind === "task" ? item.link : null
          return (
            <li key={item.id} className="pb-card p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-5 text-right text-xs opacity-60">{at + 1}</span>
                <input className="pb-input pb-name-input" value={item.title} onChange={(e) => edit(item.id, { title: e.target.value })} aria-label="Task" />
                <select className={field} value={item.pace} onChange={(e) => edit(item.id, { pace: e.target.value as PlanPace })} aria-label="Pace">
                  <option value="urgent">urgent</option>
                  <option value="steady">steady</option>
                  <option value="relaxed">relaxed</option>
                </select>
                <input
                  className={`${field} w-16`}
                  inputMode="numeric"
                  placeholder="min"
                  value={item.minutes ?? ""}
                  onChange={(e) => edit(item.id, { minutes: Number(e.target.value.replace(/\D/g, "")) || undefined })}
                  aria-label="Minutes"
                />
                <button type="button" className={btn} onClick={() => move(at, -1)} disabled={at === 0} aria-label="Move up">↑</button>
                <button type="button" className={btn} onClick={() => move(at, 1)} disabled={at === draft.items.length - 1} aria-label="Move down">↓</button>
                <button type="button" className={btn} onClick={() => set(draft.items.filter((i) => i.id !== item.id))} aria-label="Remove">✕</button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-7 text-xs">
                <label className="flex items-center gap-1">
                  Also:
                  <select
                    className={`${field} max-w-[18rem]`}
                    value={linkValue(item.link)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === "none") return edit(item.id, { link: undefined })
                      if (v === "flight") return edit(item.id, { link: { kind: "flight" } })
                      if (v.startsWith("intake:")) {
                        const label = v.slice(7)
                        return edit(item.id, { link: { kind: "intake", label, intakeClass: item.link?.kind === "intake" ? item.link.intakeClass : "drink" } })
                      }
                      const hit = [...options, ...(current ? [{ taskId: current.taskId, title: current.title, score: 1 }] : [])].find((o) => `task:${o.taskId}` === v)
                      if (hit) edit(item.id, { link: { kind: "task", taskId: hit.taskId, title: hit.title, confirmed: true } })
                    }}
                  >
                    <option value="none">no link</option>
                    {item.link?.kind === "intake" && <option value={linkValue(item.link)}>log intake: {item.link.label}</option>}
                    <option value="flight">ask for a flight confirmation</option>
                    {current && !options.some((o) => o.taskId === current.taskId) && <option value={linkValue(current)}>time on “{current.title}”</option>}
                    {options.map((o) => (
                      <option key={o.taskId} value={`task:${o.taskId}`}>time on “{o.title}”</option>
                    ))}
                  </select>
                </label>
                {item.paceNote && <span className="opacity-70">“{item.paceNote}”</span>}
              </div>
              {item.subtasks.length > 0 || item.link?.kind === "task" ? (
                <ul className="mt-1 flex flex-col gap-1 pl-7">
                  {item.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <input
                        className={`${field} min-w-0 flex-1`}
                        value={s.title}
                        onChange={(e) => edit(item.id, { subtasks: item.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })}
                        aria-label="Subtask"
                      />
                      <input
                        className={`${field} w-32`}
                        value={s.due ?? ""}
                        placeholder="by when"
                        onChange={(e) => edit(item.id, { subtasks: item.subtasks.map((x) => (x.id === s.id ? { ...x, due: e.target.value || undefined } : x)) })}
                        aria-label="Subtask due"
                      />
                      <button type="button" className={btn} onClick={() => edit(item.id, { subtasks: item.subtasks.filter((x) => x.id !== s.id) })} aria-label="Remove subtask">✕</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="pl-7">
                <button type="button" className="mt-1 text-xs underline opacity-70" onClick={() => edit(item.id, { subtasks: [...item.subtasks, { id: planItemId(), title: "" }] })}>
                  + subtask
                </button>
              </div>
              {flags(item.id).map((x, i) => (
                <p key={i} className={`pb-chip ${x.strength === "certain" ? "is-certain" : ""}`} data-ui-name="Second look chip">
                  {x.reason}
                </p>
              ))}
            </li>
          )
        })}
      </ol>
      {draft.remarks.length > 0 && <p className="text-xs opacity-70">Heard but not a task: {draft.remarks.join(" · ")}</p>}
      {critique && (critique.skipped || critique.hops.length > 0) && <p className="pb-quiet" style={{ whiteSpace: "pre-line" }}>{traceLines(critique).join("\n")}</p>}
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => set([...draft.items, { id: planItemId(), title: "", subtasks: [], pace: "steady" }])}>+ task</button>
        <button type="button" className={`${btn} font-semibold`} disabled={!draft.items.some((i) => i.title.trim())} onClick={start}>Start plan</button>
        <button type="button" className={btn} onClick={() => { note(true, draft.items); onChange(null) }}>Back</button>
      </div>
    </section>
  )
}

/** The run list alone. Also drawn under a day plan in BIM chat (`components/Bim/day-card.tsx`). */
export function RunView() {
  const { run, play, pause, complete, skip, reopen, toggleSub, fileConfirmation, end } = usePlanRunStore()
  const now = useNow(!!run?.items.some((i) => i.state === "running"))
  if (!run) return null
  const finished = isFinished(run)
  const doneCount = run.items.filter((i) => i.state === "done").length
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{finished ? "Plan finished" : "Plan · now"} · {doneCount}/{run.items.length}</h2>
        <button type="button" className={btn} onClick={() => end()}>{finished ? "Close" : "End plan"}</button>
      </div>
      <ol className="flex flex-col gap-2">
        {run.items.map((item, at) => (
          <RunRow
            key={item.id}
            item={item}
            at={at}
            now={now}
            onPlay={() => play(item.id)}
            onPause={() => pause(item.id)}
            onDone={() => complete(item.id)}
            onSkip={() => skip(item.id)}
            onReopen={() => reopen(item.id)}
            onSub={(subId) => toggleSub(item.id, subId)}
            onFile={(raw) => fileConfirmation(item.id, raw)}
          />
        ))}
      </ol>
      {run.remarks.length > 0 && <p className="text-xs opacity-70">Heard but not a task: {run.remarks.join(" · ")}</p>}
    </section>
  )
}

function RunRow(props: {
  item: RunItem
  at: number
  now: Date
  onPlay: () => void
  onPause: () => void
  onDone: () => void
  onSkip: () => void
  onReopen: () => void
  onSub: (id: string) => void
  onFile: (raw: string) => string | null
}) {
  const { item, now } = props
  const [paste, setPaste] = useState("")
  const [miss, setMiss] = useState(false)
  const closed = item.state === "done" || item.state === "skipped"
  const ms = elapsedMs(item, now)
  const target = item.minutes ? item.minutes * 60_000 : 0
  return (
    <li className={`pb-card ${item.state === "running" ? "is-running" : ""} ${closed ? "is-closed" : ""}`}>
      <div className="pb-head">
        <span className="task-card-num is-quiet">{props.at + 1}</span>
        {closed ? (
          <button type="button" className="task-card-key task-card-keycap" data-no95="" onClick={props.onReopen} aria-label="Reopen">Reopen</button>
        ) : (
          <DvdTransportKey
            mark={item.state === "running" ? "pause" : "play"}
            pressed={item.state === "running"}
            label={item.state === "running" ? `Pause ${item.title}` : `Work on ${item.title} now`}
            onClick={item.state === "running" ? props.onPause : props.onPlay}
          />
        )}
        <h3 className={`pb-name ${item.state === "done" ? "is-done" : ""}`}>{item.title}</h3>
        {item.pace === "urgent" && <span className="task-card-plate">urgent</span>}
        <span className={`task-card-lamp is-${item.state}`}>{item.state}</span>
        <span className={`pb-clock ${target && ms > target ? "is-over" : ""}`}>{formatClock(ms)}</span>
        {target > 0 && <span className="task-card-num is-quiet">of {item.minutes}m</span>}
        {!closed && <button type="button" className="task-card-key task-card-keycap is-primary" data-no95="" onClick={props.onDone}>Done</button>}
        {!closed && <button type="button" className="task-card-key task-card-keycap" data-no95="" onClick={props.onSkip}>Skip</button>}
      </div>
      <div className="pb-body">
        {item.paceNote && <p className="pb-quiet">“{item.paceNote}”</p>}
        {item.subtasks.map((s) => (
          <label key={s.id} className="pb-sub">
            <input type="checkbox" checked={!!s.done} onChange={() => props.onSub(s.id)} style={{ width: 22, height: 22, accentColor: "#8ecfc0" }} />
            <span className={s.done ? "is-quiet" : ""} style={s.done ? { textDecoration: "line-through" } : undefined}>{s.title}</span>
            {s.due && <span className="task-card-num is-quiet">{s.due}</span>}
          </label>
        ))}
        {item.link?.kind === "task" && <p className="pb-quiet">Time goes to “{item.link.title}”.</p>}
        {item.link?.kind === "intake" && !item.effects.length && <p className="pb-quiet">Done logs intake: {item.link.label}.</p>}
        {item.effects.map((e, i) => (
          <p key={i} className="pb-effect">✓ {e}</p>
        ))}
        {item.needsConfirmation && (
          <div className="flex flex-col gap-1">
            <textarea
              className="pb-input min-h-16"
              value={paste}
              placeholder="Paste the booking confirmation (or just the code) to add it to Upcoming flights"
              onChange={(e) => {
                setPaste(e.target.value)
                setMiss(false)
              }}
            />
            <div className="flex items-center gap-2">
              <button type="button" className="task-card-key task-card-keycap" data-no95="" disabled={!paste.trim()} onClick={() => setMiss(props.onFile(paste) === null)}>Add flight</button>
              {miss && <span className="text-xs text-red-600">Could not read a flight from that.</span>}
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
