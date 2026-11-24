/**
 * components/Docs/week-log-bar.tsx — The Week Log BIMBY, above a Week Log
 *
 * Same face and classes as the Day Log bar (`day-log-bar.tsx`):
 * - `WeekLogBar` sits above an open Week Log. **Rebuild** reads the seven days
 *   again; the box is the BIMBY's chat: say what to fix or add in your own words,
 *   it is kept word for word and the week is rebuilt with it (amendments win).
 * - `WeekLogMaker` sits on the LOG DOCS → WEEK LOGS folder home: pick any day,
 *   its week (Monday to Sunday) is built.
 * Logic lives in `lib/week-log-bimby/`.
 */
"use client"

import { useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { amendWeekLog, buildWeekLog, type WeekBuildResult } from "@/lib/week-log-bimby/run"
import { useWeekLogStore } from "@/lib/week-log-bimby/store"
import { addDays, weekLogTitle, weekStartKey } from "@/lib/week-log-bimby/week"

function said(r: WeekBuildResult): string {
  if (r.status === "skipped") return `Not rebuilt: ${r.reason}.`
  return `Rebuilt as version ${r.version} from ${r.days} of 7 days, ${r.rows} rows${r.narrated ? "" : " (no narrative: LLM mode is off)"}.${r.keptCopyId ? " Your hand edits were kept as a copy in this folder." : ""}`
}

type Turn = { id: string; who: "you" | "bimby"; text: string }

export function WeekLogBar({ start }: { start: string }) {
  const llm = useBimLlmMode((s) => s.on)
  const record = useWeekLogStore((s) => s.logs.find((l) => l.id === start))
  const allAmendments = useWeekLogStore((s) => s.amendments)
  const amendments = useMemo(() => allAmendments.filter((a) => a.date === start), [allAmendments, start])
  const dropAmendment = useWeekLogStore((s) => s.dropAmendment)
  const [busy, setBusy] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])

  const say = (who: Turn["who"], t: string) => setTurns((ts) => [...ts, { id: `${Date.now()}-${ts.length}`, who, text: t }].slice(-8))

  const rebuild = async () => {
    setBusy("Reading the seven days…")
    try {
      say("bimby", said(await buildWeekLog(start, { llm, onProgress: setBusy })))
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    const words = text.trim()
    if (!words || busy) return
    setText("")
    say("you", words)
    setBusy("Keeping your words…")
    try {
      const { amendment, result } = await amendWeekLog(start, words, "docs", { llm, onProgress: setBusy })
      say("bimby", `Kept as a ${amendment.kind}. ${said(result)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="docs-daylog-bar" data-text-mirror="off">
      <div className="docs-daylog-head">
        <span className="docs-daylog-name">Week Log BIMBY</span>
        <span className="docs-daylog-meta">
          {record ? `v${record.version} · ${record.rows} rows · built ${new Date(record.builtAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : "not built yet"}
          {busy ? ` · ${busy}` : ""}
        </span>
        <button type="button" className="docs-milled-key" onClick={() => void rebuild()} disabled={!!busy}>
          Rebuild
        </button>
      </div>
      {turns.length ? (
        <ul className="docs-daylog-thread">
          {turns.map((t) => (
            <li key={t.id} data-who={t.who}>
              {t.who === "you" ? "❝" : ""}
              {t.text}
              {t.who === "you" ? "❞" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="docs-daylog-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          className="docs-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Correct or add, in your words: “Tuesday I was home sick all day” · “add: the whole week was about the move”"
          aria-label="Amend this Week Log"
          disabled={!!busy}
        />
        <button type="submit" className="docs-milled-key" disabled={!!busy || !text.trim()}>
          Amend
        </button>
      </form>
      {amendments.length ? (
        <details className="docs-daylog-amends">
          <summary>
            {amendments.length} amendment{amendments.length === 1 ? "" : "s"} kept
          </summary>
          <ul>
            {amendments.map((a) => (
              <li key={a.id}>
                <strong>{a.kind}</strong> ❝{a.text}❞{" "}
                <button type="button" className="docs-daylog-drop" aria-label="Drop this amendment" title="Drop it; the next rebuild leaves it out" onClick={() => dropAmendment(a.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export function WeekLogMaker({ onBuilt }: { onBuilt: (docId: string) => void }) {
  const llm = useBimLlmMode((s) => s.on)
  const [date, setDate] = useState(() => addDays(weekStartKey(formatLocalDateKey(new Date())), -7))
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const start = date ? weekStartKey(date) : ""

  const build = async () => {
    setBusy("Reading the seven days…")
    try {
      const r = await buildWeekLog(start, { llm, onProgress: setBusy })
      setNote(said(r))
      if (r.status === "built") onBuilt(r.docId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="docs-daylog-bar" data-text-mirror="off">
      <div className="docs-daylog-head">
        <span className="docs-daylog-name">Week Log BIMBY</span>
        <span className="docs-daylog-meta">{busy ?? (note || (start ? `${weekLogTitle(start)} · last week's log is finished on its own after Monday 4 am` : "Pick any day of the week."))}</span>
        <input type="date" className="docs-field" value={date} max={formatLocalDateKey(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Any day of the week to log" />
        <button type="button" className="docs-milled-key" onClick={() => void build()} disabled={!!busy || !start}>
          Build week log
        </button>
      </div>
    </div>
  )
}
