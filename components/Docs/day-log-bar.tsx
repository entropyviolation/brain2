/**
 * components/Docs/day-log-bar.tsx — The Day Log BIMBY, above a Day Log
 *
 * Two faces:
 * - `DayLogBar` sits above an open Day Log doc. **Rebuild** reads every source
 *   again; the box under it is the Day Log BIMBY's chat: type a correction,
 *   an addition or a note in your own words, it is kept word for word, shown
 *   in the thread, and the log is rebuilt with it (amendments win over every
 *   other row). ✕ on an amendment drops it on the next rebuild.
 * - `DayLogMaker` sits on the LOG DOCS → DAY LOGS folder home: pick a day, build it.
 * Logic lives in `lib/day-log-bimby/`.
 */
"use client"

import { useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { amendDayLog, buildDayLog, type BuildResult } from "@/lib/day-log-bimby/run"
import { useDayLogStore } from "@/lib/day-log-bimby/store"
import type { Amendment } from "@/lib/day-log-bimby/types"

function said(r: BuildResult): string {
  if (r.status === "skipped") return `Not rebuilt: ${r.reason}.`
  return `Rebuilt as version ${r.version} from ${r.rows} rows${r.narrated ? "" : " (no narrative: LLM mode is off)"}.${r.keptCopyId ? " Your hand edits were kept as a copy in this folder." : ""}`
}

type Turn = { id: string; who: "you" | "bimby"; text: string }

export function DayLogBar({ date }: { date: string }) {
  const llm = useBimLlmMode((s) => s.on)
  const record = useDayLogStore((s) => s.logs.find((l) => l.id === date))
  // Select the stable array, then filter: a selector that returns a new array each time loops React.
  const allAmendments = useDayLogStore((s) => s.amendments)
  const amendments = useMemo(() => allAmendments.filter((a) => a.date === date), [allAmendments, date])
  const dropAmendment = useDayLogStore((s) => s.dropAmendment)
  const [busy, setBusy] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])

  const say = (who: Turn["who"], t: string) => setTurns((ts) => [...ts, { id: `${Date.now()}-${ts.length}`, who, text: t }].slice(-8))

  const rebuild = async () => {
    setBusy("Reading every source…")
    try {
      say("bimby", said(await buildDayLog(date, { llm, onProgress: setBusy })))
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
      const { amendment, result } = await amendDayLog(date, words, "docs", { llm, onProgress: setBusy })
      say("bimby", `Kept as a ${amendment.kind}${amendment.atMin !== undefined ? ` about ${String(Math.floor(amendment.atMin / 60)).padStart(2, "0")}:${String(amendment.atMin % 60).padStart(2, "0")}` : ""}. ${said(result)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="docs-daylog-bar" data-text-mirror="off">
      <div className="docs-daylog-head">
        <span className="docs-daylog-name">Day Log BIMBY</span>
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
          placeholder="Correct or add, in your words: “the call with mom was at 3, not 2” · “add: walked to the park ~6pm with Sam”"
          aria-label="Amend this Day Log"
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
            {amendments.map((a: Amendment) => (
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

export function DayLogMaker({ onBuilt }: { onBuilt: (docId: string) => void }) {
  const llm = useBimLlmMode((s) => s.on)
  const [date, setDate] = useState(() => formatLocalDateKey(new Date(Date.now() - 86_400_000)))
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const build = async () => {
    setBusy("Reading every source…")
    try {
      const r = await buildDayLog(date, { llm, onProgress: setBusy })
      setNote(said(r))
      if (r.status === "built") onBuilt(r.docId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="docs-daylog-bar" data-text-mirror="off">
      <div className="docs-daylog-head">
        <span className="docs-daylog-name">Day Log BIMBY</span>
        <span className="docs-daylog-meta">{busy ?? (note || "Yesterday's log is finished on its own after 4 am; today's is refreshed every hour.")}</span>
        <input type="date" className="docs-field" value={date} max={formatLocalDateKey(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Day to log" />
        <button type="button" className="docs-milled-key" onClick={() => void build()} disabled={!!busy || !date}>
          Build day log
        </button>
      </div>
    </div>
  )
}
