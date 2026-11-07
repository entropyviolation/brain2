/**
 * components/Lab/InboxBimby/InboxBimbyLab.tsx — Try the Inbox BIMBY on an idea
 *
 * Pick one of your Inbox ideas, or type a new one, and see where it would go: the lists to file under, the items it
 * repeats, and the questions that would make it clear. A dry run of `helpTask`: nothing is filed or merged.
 * The real keys are on the Inbox foot. Engine: `lib/inbox-bimby/`.
 */
"use client"

import { useMemo, useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { embedScores, ollamaCall } from "@/lib/bim-flow/ollama"
import { helpTask } from "@/lib/inbox-bimby/suggest"
import type { HelperSuggestion } from "@/lib/inbox-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import "../bimby-lab.css"

export function InboxBimbyLab() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const ideas = useMemo(() => tasks.filter((t) => t.stage === "inbox").slice(-40).reverse(), [tasks])
  const [id, setId] = useState("")
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HelperSuggestion | null>(null)
  const [err, setErr] = useState("")

  async function go() {
    const picked = ideas.find((t) => t.id === id)
    // A typed idea is a throwaway Task shape that is never stored.
    const task = (picked ?? ({ id: "lab-typed", title: typed.trim(), stage: "inbox" } as unknown as Task))
    if (!picked && !typed.trim()) return
    setBusy(true)
    setErr("")
    try {
      const crew = await chatCrew().catch(() => null)
      setResult(
        await helpTask({
          task,
          tasks,
          lists,
          call: crew ? ollamaCall(crew.main) : null,
          ladder: crew?.pick ?? [],
          embed: (q, texts) => embedScores(q, texts),
        }),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The suggestion failed.")
    }
    setBusy(false)
  }

  return (
    <div className="bl-lab">
      <a className="bl-back" href="/lab/agents">← Agent lab</a>
      <h1>Inbox BIMBY</h1>
      <p className="bl-note">Where does this idea go? Pool, pick, clean. A dry run: nothing is filed or merged. The real keys are on the Inbox foot.</p>

      <section>
        <h2>An idea</h2>
        <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Inbox idea">
          <option value="">Type one below, or choose one of your {ideas.length} newest Inbox ideas…</option>
          {ideas.map((t) => (
            <option key={t.id} value={t.id}>{(t.title || t.description || "").slice(0, 80)}</option>
          ))}
        </select>
        <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} placeholder="Or type an idea" aria-label="Typed idea" disabled={Boolean(id)} />
        <button type="button" disabled={busy || (!id && !typed.trim())} onClick={() => void go()}>{busy ? "Working…" : "Ask"}</button>
      </section>

      {err && <p className="bl-note">{err}</p>}

      {result && (
        <section>
          <h2>{result.title || "(untitled)"}</h2>
          <p className="bl-note">by {result.by}{result.model ? ` · ${result.model}` : ""}{result.fallback ? ` · ${result.fallback}` : ""}</p>
          <h3>File under</h3>
          {result.files.length === 0 ? <p className="bl-note">No list fits.</p> : (
            <ul className="bl-list">{result.files.map((f) => (<li key={f.listId}><b>{f.name}</b> ({Math.round(f.sure * 100)}%): {f.why}</li>))}</ul>
          )}
          <h3>Repeats or sits close to</h3>
          {result.matches.length === 0 ? <p className="bl-note">Nothing close.</p> : (
            <ul className="bl-list">{result.matches.map((m) => (<li key={m.id}><b>{m.name}</b> ({m.relation}, {m.where}, {Math.round(m.sure * 100)}%): {m.why}</li>))}</ul>
          )}
          {result.questions.length > 0 && (
            <>
              <h3>Questions that would make it clear</h3>
              <ul className="bl-list">{result.questions.map((q) => (<li key={q}>{q}</li>))}</ul>
            </>
          )}
        </section>
      )}
    </div>
  )
}
