/**
 * components/Bim/thought-popup.tsx — The whole of one BIM turn, readable
 *
 * Opened from a reply's THOUGHT strip (two clicks: the route chip opens the strip, OPEN FULL THOUGHT opens this).
 * Reads the turn's Trace (`lib/agents/trace-store.ts`): what you said and how it was read, the pipeline of
 * stages in order with how each ended, then every event nested under the one it ran inside, with its timing
 * bar. A model call opens to its system prompt, its input and its output (kept since 2026-11-24, clipped to
 * 4000 / 4000 / 3000 characters). The reply and its evidence close the sheet. Writes nothing.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { getTrace } from "@/lib/agents/trace-store"
import { maskSecrets, useSecretsShown } from "@/lib/secrets-store"
import type { Trace, TraceEvent } from "@/lib/agents/trace"
import type { BimLine } from "@/lib/ingest/bim-chat"
import "./thought-popup.css"

const STOP_SAYS: Record<Trace["stop"], string> = {
  done: "done",
  "gate-no": "a gate said no",
  budget: "ran out of time",
  "needs-person": "needs you",
  error: "failed",
  "refused-tool": "a tool was refused",
}

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}s` : `${Math.round(n)}ms`)

function pretty(value: unknown): string {
  if (value === undefined) return ""
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** A model call's data in labeled blocks; anything else as pretty JSON. */
function EventData({ data }: { data: unknown }) {
  if (data === undefined || data === null) return null
  if (typeof data === "object" && !Array.isArray(data)) {
    const { system, user, output, ...rest } = data as Record<string, unknown>
    const blocks: [string, unknown][] = [
      ["System prompt", system],
      ["Input", user],
      ["Output", output],
    ]
    const shown = blocks.filter(([, v]) => v !== undefined)
    if (shown.length) {
      return (
        <div className="bim-th-data">
          {shown.map(([label, v]) => (
            <section key={label}>
              <h5>{label}</h5>
              <pre>{pretty(v)}</pre>
            </section>
          ))}
          {Object.keys(rest).length ? (
            <section>
              <h5>Timing</h5>
              <pre>{pretty(rest)}</pre>
            </section>
          ) : null}
        </div>
      )
    }
  }
  return (
    <div className="bim-th-data">
      <pre>{pretty(data)}</pre>
    </div>
  )
}

function EventRow({ event, kids, depth, span, open, toggle }: { event: TraceEvent; kids: Map<string, TraceEvent[]>; depth: number; span: number; open: Set<string>; toggle: (id: string) => void }) {
  const isOpen = open.has(event.id)
  const hasData = event.data !== undefined && event.data !== null
  const left = span ? (event.t0 / span) * 100 : 0
  const width = span ? Math.max(0.8, ((event.t1 - event.t0) / span) * 100) : 0
  return (
    <li className={`bim-th-ev is-${event.status}`} style={{ ["--depth" as string]: depth }}>
      <button data-no95 type="button" className="bim-th-ev-head" aria-expanded={hasData ? isOpen : undefined} disabled={!hasData} onClick={() => toggle(event.id)}>
        <i className="bim-th-lamp" aria-hidden="true" />
        <span className="bim-th-kind">{event.kind}</span>
        <span className="bim-th-actor">{event.actor}</span>
        {event.agent ? <span className="bim-th-agent">{event.agent}</span> : null}
        {event.model ? <span className="bim-th-model">{event.model}</span> : null}
        <span className="bim-th-time">
          {ms(event.t0)} → {ms(event.t1)}
        </span>
        {hasData ? <span className="bim-th-more">{isOpen ? "▾" : "▸"}</span> : null}
      </button>
      <span className="bim-th-bar" aria-hidden="true">
        <b style={{ left: `${left}%`, width: `${width}%` }} />
      </span>
      {event.note ? <p className="bim-th-note">{event.note}</p> : null}
      {isOpen ? <EventData data={event.data} /> : null}
      {kids.get(event.id)?.length ? (
        <ol>
          {kids.get(event.id)!.map((k) => (
            <EventRow key={k.id} event={k} kids={kids} depth={depth + 1} span={span} open={open} toggle={toggle} />
          ))}
        </ol>
      ) : null}
    </li>
  )
}

export function ThoughtPopup({ line: asWritten, said: saidRaw, onClose }: { line: BimLine; said?: string; onClose: () => void }) {
  // Locked, the sheet draws no `\secret` span anywhere: the line, what you said, every step, every prompt (`docs/SECRETS.md`).
  const shown = useSecretsShown("chat")
  const line = useMemo(() => maskSecrets(asWritten, shown), [asWritten, shown])
  const said = saidRaw === undefined ? undefined : maskSecrets(saidRaw, shown)
  const trace = useMemo(() => (line.traceId ? maskSecrets(getTrace(line.traceId), shown) : undefined), [line.traceId, shown])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  const { roots, kids, span } = useMemo(() => {
    const events = trace?.events ?? []
    const kids = new Map<string, TraceEvent[]>()
    const ids = new Set(events.map((e) => e.id))
    const roots: TraceEvent[] = []
    for (const e of events) {
      if (e.parent && ids.has(e.parent)) kids.set(e.parent, [...(kids.get(e.parent) ?? []), e])
      else roots.push(e)
    }
    const span = Math.max(1, ...events.map((e) => e.t1))
    return { roots, kids, span }
  }, [trace])

  const toggle = (id: string) =>
    setOpen((now) => {
      const next = new Set(now)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const withData = trace?.events.filter((e) => e.data !== undefined && e.data !== null).map((e) => e.id) ?? []
  const allOpen = withData.length > 0 && withData.every((id) => open.has(id))

  const copy = () => {
    const text = JSON.stringify(trace ?? { line }, null, 2)
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  const models = trace ? Object.entries(trace.cost.models) : []

  return (
    <div className="bim-th-scrim" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* A labelled region, not role="dialog": the Win95 skin paints every dialog silver. */}
      <section className="bim-th bim-glass" aria-label="Thought: the whole turn">
        <header className="bim-th-top">
          <span className="bim-th-title">THOUGHT // {line.route?.split("·")[0]?.trim() || line.kind || "reply"}</span>
          {trace ? <span className="bim-th-id">{trace.run.id}</span> : null}
          <span className="bim-th-gap" />
          {withData.length ? (
            <button data-no95 type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(withData))}>
              {allOpen ? "fold all" : "unfold all"}
            </button>
          ) : null}
          <button data-no95 type="button" onClick={copy}>
            {copied ? "copied" : "copy"}
          </button>
          <button data-no95 type="button" className="is-mod" aria-label="Close thought" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="bim-th-body bim-scroll">
          <dl className="bim-th-sum">
            <dt>You said</dt>
            <dd className="is-you">{trace?.run.input ?? said ?? "—"}</dd>
            {line.readAs ? (
              <>
                <dt>Read as</dt>
                <dd>{line.readAs}</dd>
              </>
            ) : null}
            {line.route ? (
              <>
                <dt>Route</dt>
                <dd className="is-route">{line.route}</dd>
              </>
            ) : null}
            {trace ? (
              <>
                <dt>Ended</dt>
                <dd>
                  {STOP_SAYS[trace.stop]} · {ms(new Date(trace.run.end).getTime() - new Date(trace.run.start).getTime())}
                </dd>
                <dt>Models</dt>
                <dd>
                  {trace.cost.calls
                    ? `${trace.cost.calls} call${trace.cost.calls === 1 ? "" : "s"} · ${ms(trace.cost.ms)}${models.length ? " · " + models.map(([m, c]) => `${m} ×${c.calls}`).join(", ") : ""}`
                    : "none: code only"}
                </dd>
                <dt>Wrote</dt>
                <dd>{trace.result.wrote.length ? trace.result.wrote.join(", ") : "nothing"}</dd>
                {trace.result.proposals ? (
                  <>
                    <dt>Waiting</dt>
                    <dd>a card to accept</dd>
                  </>
                ) : null}
              </>
            ) : null}
          </dl>

          {trace ? (
            <>
              <h4 className="bim-th-h">Pipeline</h4>
              <ol className="bim-th-pipe" aria-label="Stages in order">
                {roots.map((e, i) => (
                  <li key={e.id} className={`is-${e.status}`} title={e.note ?? e.status}>
                    {i ? <span className="bim-th-arrow" aria-hidden="true">→</span> : null}
                    <i className="bim-th-lamp" aria-hidden="true" />
                    {e.actor}
                  </li>
                ))}
              </ol>

              <h4 className="bim-th-h">
                Every step <small>({trace.events.length}) · tap a step with ▸ to read its prompt and output</small>
              </h4>
              <ol className="bim-th-tree">
                {roots.map((e) => (
                  <EventRow key={e.id} event={e} kids={kids} depth={0} span={span} open={open} toggle={toggle} />
                ))}
              </ol>
            </>
          ) : (
            <p className="bim-th-none">
              {line.traceId
                ? "This turn's Trace is no longer on this device (the newest 150 are kept; the disk archive has the rest)."
                : "This line has no Trace: it came before turns were traced, or BIM wrote it on its own."}
            </p>
          )}

          <h4 className="bim-th-h">Reply</h4>
          <p className="bim-th-reply">{line.text}</p>

          {line.evidence?.length ? (
            <>
              <h4 className="bim-th-h">Evidence ({line.evidence.length})</h4>
              <ul className="bim-th-evidence">
                {line.evidence.map((row, i) => (
                  <li key={i}>{row}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
