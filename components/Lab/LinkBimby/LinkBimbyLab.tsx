/**
 * components/Lab/LinkBimby/LinkBimbyLab.tsx — Try the Link BIMBY on a saved link
 *
 * Pick one of your saved links (or paste a URL), read what the page says (Peek, optionally watching the video), and see
 * the guesses. Nothing is filed, linked or reviewed here: a dry run of `guessLink`. The real keys are on Inbox → Links.
 * Engine: `lib/link-bimby/`.
 */
"use client"

import { useMemo, useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { embedScores, ollamaCall } from "@/lib/bim-flow/ollama"
import { peekLink } from "@/lib/link-bimby/peek"
import { guessLink } from "@/lib/link-bimby/suggest"
import { reviewedReadings } from "@/lib/link-bimby/store"
import type { LinkPeek, LinkReading } from "@/lib/link-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import "../bimby-lab.css"

export function LinkBimbyLab() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const links = useMemo(() => tasks.filter((t) => t.savedLink?.url).slice(-40).reverse(), [tasks])
  const [id, setId] = useState("")
  const [watch, setWatch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [peek, setPeek] = useState<LinkPeek | null>(null)
  const [reading, setReading] = useState<LinkReading | null>(null)
  const [err, setErr] = useState("")

  const link = links.find((t) => t.id === id) ?? null

  async function go() {
    if (!link?.savedLink?.url) return
    setBusy(true)
    setErr("")
    setReading(null)
    try {
      const p = await peekLink(link.savedLink.url, { watch })
      setPeek(p)
      const crew = await chatCrew().catch(() => null)
      const r = await guessLink({
        link,
        tasks,
        lists,
        peek: p,
        call: crew ? ollamaCall(crew.main) : null,
        ladder: crew?.pick ?? [],
        embed: (q, texts) => embedScores(q, texts),
        reviewed: reviewedReadings(),
      })
      setReading(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The guess failed.")
    }
    setBusy(false)
  }

  return (
    <div className="bl-lab">
      <a className="bl-back" href="/lab/agents">← Agent lab</a>
      <h1>Link BIMBY</h1>
      <p className="bl-note">Peek, pool, pick, clean. A dry run on one saved link: nothing is filed, linked or reviewed. The real keys are on Inbox → Links.</p>

      <section>
        <h2>A saved link</h2>
        <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Saved link">
          <option value="">Choose one of your {links.length} newest saved links…</option>
          {links.map((t) => (
            <option key={t.id} value={t.id}>{(t.title || t.savedLink?.url || "").slice(0, 80)}</option>
          ))}
        </select>
        <label className="bl-row">
          <input type="checkbox" checked={watch} onChange={(e) => setWatch(e.target.checked)} /> Watch the video (one to two minutes the first time)
        </label>
        <button type="button" disabled={busy || !link} onClick={() => void go()}>{busy ? "Working…" : "Guess"}</button>
      </section>

      {err && <p className="bl-note">{err}</p>}

      {peek && (
        <section>
          <h2>Peek</h2>
          <p className="bl-note">
            {peek.site} · {peek.author} · {peek.title}
            {peek.watched ? " · watched" : peek.watchError ? ` · not watched: ${peek.watchError}` : ""}
          </p>
          {peek.description && <p className="bl-note">{peek.description.slice(0, 400)}</p>}
        </section>
      )}
      {peek === null && reading && <p className="bl-note">The page did not answer (the Mac is needed to peek).</p>}

      {reading && (
        <section>
          <h2>{reading.gist || "(no gist)"}</h2>
          <p className="bl-note">by {reading.by}{reading.model ? ` · ${reading.model}` : ""}{reading.fallback ? ` · ${reading.fallback}` : ""}</p>
          <table className="bl-table">
            <thead><tr><th>Where</th><th>Why</th><th>Use</th><th>Sure</th></tr></thead>
            <tbody>
              {reading.guesses.map((g) => (
                <tr key={`${g.kind}-${g.id}`}>
                  <td>{g.kind}: {g.name}</td><td>{g.why}</td><td>{g.use}</td><td>{Math.round(g.sure * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
