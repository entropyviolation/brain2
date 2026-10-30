/**
 * components/Lab/BimFlow/flow-preview.tsx — The dry run, laid out as it would land in Brain2
 *
 * Three wells: the day's time blocks on an hour axis (with a tick for every
 * message that fed the flow), items grouped by the list they would join, and
 * every other change (habit, intake, mood, person, body, dream, idea, todo).
 * Nothing here is written. Each card names the message and the node that made it.
 */
"use client"

import type { Flow, FlowRun, MessageRun, Proposal, TimeBlock } from "@/lib/bim-flow/types"

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
const mins = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const ACTION_LABEL: Record<string, string> = {
  "habit-done": "Habit",
  intake: "Intake",
  mood: "Mood",
  "person-mention": "Person",
  body: "Body",
  dream: "Dream",
  idea: "Idea",
  todo: "To-do",
}

interface Props {
  flow: Flow
  runs: MessageRun[]
  run: FlowRun | null
  onClose: () => void
}

export function FlowPreview({ flow, runs, run, onClose }: Props) {
  const blocks = run?.blocks ?? []
  const nodeLabel = (id: string) => flow.nodes.find((n) => n.id === id)?.label ?? id
  const answers = runs.flatMap((r) => r.answers.map((a) => ({ a, r })))
  const withMsg = runs.flatMap((r) => r.proposals.map((p) => ({ p, r })))

  const items = new Map<string, { p: Proposal; r: MessageRun }[]>()
  const changes: { p: Proposal; r: MessageRun }[] = []
  const empty: { p: Proposal; r: MessageRun }[] = []
  for (const x of withMsg) {
    if (/^(No habit picked|Unknown person)$/.test(x.p.summary)) empty.push(x)
    else if (x.p.action === "add-to-list") {
      const picks = (x.p.data.picks as string[] | undefined)?.length ? (x.p.data.picks as string[]) : ["Inbox"]
      for (const list of picks) items.set(list, [...(items.get(list) ?? []), x])
    } else changes.push(x)
  }

  const times = [...blocks.flatMap((b) => [mins(b.start), mins(b.end)]), ...runs.map((r) => mins(r.message.at))]
  const lo = times.length ? Math.floor(Math.min(...times) / 60) * 60 : 0
  const hi = times.length ? Math.max(lo + 120, Math.ceil(Math.max(...times) / 60) * 60) : 120
  const PX = 3.4 // px per minute
  const y = (m: number) => (m - lo) * PX
  const hours: number[] = []
  for (let m = lo; m <= hi; m += 60) hours.push(m)

  const changeCount = withMsg.length - empty.length
  const logLike = blocks.length > 0 || changeCount > 0 || answers.length === 0

  return (
    <div className="bf-pv" role="dialog" aria-label="Dry run preview">
      <header className="bf-pv-top">
        <b className="bf-title">DRY RUN</b>
        <span className="bf-pv-flag">NOTHING WRITTEN</span>
        <span className="bf-k">
          {answers.length ? `${answers.length} answers · ` : ""}{blocks.length} blocks · {changeCount} suggested changes · {runs.length} inputs
        </span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={onClose}>Close</button>
      </header>

      <div className="bf-pv-cols" style={logLike ? (answers.length ? { gridTemplateColumns: "1.3fr 1.1fr 1fr 1fr" } : undefined) : { gridTemplateColumns: "1fr" }}>
        {answers.length ? (
          <section className="bf-pv-well">
            <span className="bf-k">Answers</span>
            {answers.map(({ a, r }, i) => (
              <div key={i} className="bf-pv-group">
                <div className="bf-pv-list">{r.message.text.split("\n")[0]!.slice(0, 90)}</div>
                <span className={`bf-chip is-conf-${a.confidence}`}>{a.mode} · confidence {a.confidence}</span>
                <div className="bf-pv-answer">{a.text}</div>
                {a.draft && a.draft !== a.text ? <div className="bf-why">Draft before the check: {a.draft}</div> : null}
                {a.facts.map((f, j) => <div key={j} className="bf-why">• {f}</div>)}
                <details>
                  <summary>Evidence the model read ({a.evidence.length})</summary>
                  {a.evidence.map((e, j) => (
                    <div key={j} className="bf-why">{a.used.includes(j + 1) ? "★ " : ""}{e.when} · {e.source}: {e.text}</div>
                  ))}
                </details>
              </div>
            ))}
          </section>
        ) : null}
        {logLike ? (<>
        <section className="bf-pv-well">
          <span className="bf-k">Time blocks</span>
          <div className="bf-pv-axis" style={{ height: (hi - lo) * PX + 8 }}>
            {hours.map((m) => (
              <div key={m} className="bf-pv-hour" style={{ top: y(m) }}>
                <span>{String(Math.floor(m / 60) % 24).padStart(2, "0")}:00</span>
              </div>
            ))}
            {runs.map((r) => (
              <div key={r.message.id} className="bf-pv-tick" style={{ top: y(mins(r.message.at)) }} title={`${clock(r.message.at)} ${r.message.text}`} />
            ))}
            {blocks.map((b, i) => (
              <BlockBar key={i} b={b} top={y(mins(b.start))} height={Math.max(18, (mins(b.end) - mins(b.start)) * PX)} lane={i % 2} />
            ))}
          </div>
          {run && blocks.length === 0 ? <i className="bf-pv-none">no blocks suggested</i> : null}
        </section>

        <section className="bf-pv-well">
          <span className="bf-k">Items · by list</span>
          {[...items.entries()].map(([list, rows]) => (
            <div key={list} className="bf-pv-group">
              <div className="bf-pv-list">{list}</div>
              {rows.map(({ p, r }, i) => (
                <Card key={i} r={r} node={nodeLabel(p.nodeId)} text={r.message.text} tag="+ add" />
              ))}
            </div>
          ))}
          {items.size === 0 ? <i className="bf-pv-none">no items suggested</i> : null}
        </section>

        <section className="bf-pv-well">
          <span className="bf-k">Other changes</span>
          {changes.map(({ p, r }, i) => (
            <Card key={i} r={r} node={nodeLabel(p.nodeId)} text={p.summary} tag={ACTION_LABEL[p.action] ?? p.action} />
          ))}
          {runs.flatMap((r) => r.signals).length ? (
            <i className="bf-pv-none">Activity signals feed the time blocks, not a change of their own.</i>
          ) : null}
          {empty.length ? (
            <i className="bf-pv-none">
              Fired but found nothing to write: {empty.map(({ r }) => `${clock(r.message.at)} ${r.message.text.slice(0, 24)}`).join("; ")}
            </i>
          ) : null}
          {changes.length === 0 ? <i className="bf-pv-none">no other changes suggested</i> : null}
        </section>
        </>) : null}
      </div>
    </div>
  )
}

function BlockBar({ b, top, height, lane }: { b: TimeBlock; top: number; height: number; lane: number }) {
  return (
    <div className={`bf-pv-block${b.estimated ? " is-est" : ""}`} style={{ top, height, left: lane ? "52%" : "8%", width: "42%" }} title={b.evidence.join("\n")}>
      <b>{b.activity}</b>
      <span>{clock(b.start)}–{clock(b.end)}{b.estimated ? " est." : ""}</span>
      {height > 44 ? <em>{b.why}</em> : null}
    </div>
  )
}

function Card({ r, node, text, tag }: { r: MessageRun; node: string; text: string; tag: string }) {
  return (
    <div className="bf-pv-card">
      <span className="bf-chip is-add-to-list">{tag}</span>
      <div>{text}</div>
      <div className="bf-why">
        {clock(r.message.at)} “{r.message.text.slice(0, 70)}” → {node}
      </div>
    </div>
  )
}
