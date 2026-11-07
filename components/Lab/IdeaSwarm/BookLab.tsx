/**
 * components/Lab/IdeaSwarm/BookLab.tsx — A whole book through the chunk pipeline, watched chunk by chunk and in aggregate
 *
 * Upload a PDF or text, cut it into chunks, and let a weak model gate each one ("any useful ideas here?") before the
 * current setup runs on it, several chunks at once. A strip of squares shows every chunk's state; click one to see its
 * gate answer, its nodes and its cards. Totals sit above. When chunks are done, optional book-level passes cluster all the
 * cards, pull key phrases and write a summary loop. Books and chunks are saved after every change; a refresh resumes.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { bookLevel, chunkText, poolIdeas, processBook } from "@/lib/idea-swarm/book"
import { ollamaEmbedder } from "@/lib/idea-swarm/embed"
import { allOf, dropOne, putOne } from "@/lib/idea-swarm/store"
import type { Book, ChunkRec, Config } from "@/lib/idea-swarm/types"
import { textFromFile } from "./file-text"

const ACTIVE_KEY = "brain2:idea-swarm:book:v1"
type Filter = "all" | "useful" | "problems"

export function BookLab({ config, models }: { config: Config; models: string[] | null }) {
  const [books, setBooks] = useState<Book[]>([])
  const [bid, setBid] = useState<string | null>(null)
  const [chunks, setChunks] = useState<ChunkRec[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [agg, setAgg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [lvl, setLvl] = useState({ cluster: true, keywords: true, summarize: false })
  const [ready, setReady] = useState(false)
  const stop = useRef<AbortController | null>(null)
  const resumed = useRef(false)
  const book = books.find((b) => b.id === bid) ?? null

  useEffect(() => {
    void (async () => {
      const [bs, cs] = await Promise.all([allOf<Book>("books"), allOf<ChunkRec>("chunks")])
      setBooks(bs.sort((a, b) => b.at.localeCompare(a.at)))
      const last = (() => { try { return window.localStorage.getItem(ACTIVE_KEY) } catch { return null } })()
      const pick = bs.find((b) => b.id === last) ?? bs[0]
      if (pick) { setBid(pick.id); setChunks(cs.filter((c) => c.bookId === pick.id).sort((a, b) => a.i - b.i)) }
      setReady(true)
    })()
  }, [])

  async function open(id: string) {
    setBid(id); setSel(null); setAgg(null)
    try { window.localStorage.setItem(ACTIVE_KEY, id) } catch { /* fine */ }
    setChunks((await allOf<ChunkRec>("chunks")).filter((c) => c.bookId === id).sort((a, b) => a.i - b.i))
  }

  const saveBook = useCallback((b: Book) => { setBooks((bs) => bs.map((x) => (x.id === b.id ? b : x))); void putOne("books", b) }, [])

  async function upload(file: File) {
    setErr(null)
    try {
      const text = await textFromFile(file)
      if (text.length < 200) throw new Error("Hardly any words came out of that file.")
      const b: Book = { id: `bk-${Date.now().toString(36)}`, title: file.name.replace(/\.(pdf|txt|md)$/i, ""), at: new Date().toISOString(), text, chunkSize: 4000, parallel: 2, gate: true, status: "idle" }
      await putOne("books", b)
      setBooks((bs) => [b, ...bs])
      await rechunk(b)
      setBid(b.id)
      try { window.localStorage.setItem(ACTIVE_KEY, b.id) } catch { /* fine */ }
    } catch (e) { setErr(e instanceof Error ? e.message : "That file could not be read.") }
  }

  async function rechunk(b: Book) {
    for (const c of await allOf<ChunkRec>("chunks")) if (c.bookId === b.id) await dropOne("chunks", c.id)
    const recs: ChunkRec[] = chunkText(b.text, b.chunkSize).map((r, i) => ({ id: `${b.id}:${i}`, bookId: b.id, i, from: r.from, to: r.to, status: "pending" }))
    for (const r of recs) await putOne("chunks", r)
    setChunks(recs); setSel(null)
    saveBook({ ...b, status: "idle", agg: undefined })
  }

  const process = useCallback(async (b: Book, from: ChunkRec[], only?: number) => {
    if (!models?.length) { setErr("No local model answered. Start Ollama, then reload."); return }
    setErr(null)
    const ctl = new AbortController()
    stop.current = ctl
    setBusy(true)
    const cfg = b.config ?? structuredClone(config)
    const live = { ...b, config: cfg, status: "running" as const }
    saveBook(live)
    const base = from.map((c) => (c.status === "running" || c.status === "gating" ? { ...c, status: "pending" as const } : c))
    setChunks(base)
    try {
      await processBook(base, {
        call: ollamaCall(cfg.agents.knob.model, ctl.signal, { fresh: true }),
        embed: ollamaEmbedder(cfg.embed.model, ctl.signal),
        only, signal: ctl.signal, text: b.text, title: b.title, config: cfg, gate: b.gate, parallel: b.parallel,
        onChunk: (c) => { setChunks((cs) => cs.map((x) => (x.id === c.id ? c : x))); void putOne("chunks", c) },
      })
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    saveBook({ ...live, status: ctl.signal.aborted ? "stopped" : "done" })
    setBusy(false)
  }, [config, models, saveBook])

  // A refresh mid-book leaves it `running`; carry on with the chunks not yet finished.
  useEffect(() => {
    if (!ready || resumed.current || !models?.length || !book || !chunks.length) return
    resumed.current = true
    if (book.status === "running") void process(book, chunks)
  }, [ready, models, book, chunks, process])

  async function levels() {
    if (!book) return
    const ctl = new AbortController()
    stop.current = ctl
    setBusy(true); setErr(null)
    const cfg = book.config ?? config
    try {
      const a = await bookLevel(chunks, cfg, { ...lvl, threshold: cfg.cluster.threshold }, { call: ollamaCall(cfg.synth.knob.model, ctl.signal, { fresh: true }), embed: ollamaEmbedder(cfg.embed.model, ctl.signal), signal: ctl.signal, progress: setAgg })
      saveBook({ ...book, agg: a })
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    setAgg(null); setBusy(false)
  }

  const n = (s: ChunkRec["status"]) => chunks.filter((c) => c.status === s).length
  const done = chunks.filter((c) => c.run)
  const totals = useMemo(() => ({
    ideas: done.reduce((s, c) => s + (c.run!.stages.agents?.items.length ?? 0), 0),
    cards: done.reduce((s, c) => s + (c.run!.stages.synth?.items.length ?? 0), 0),
    gems: done.reduce((s, c) => s + (c.run!.stages.lone?.items.length ?? 0), 0),
    calls: done.reduce((s, c) => s + c.run!.calls, 0),
    secs: Math.round(chunks.reduce((s, c) => s + (c.ms ?? 0), 0) / 1000),
  }), [chunks, done])
  const shown = chunks.filter((c) => filter === "all" || (filter === "useful" ? c.status === "done" : c.status === "error"))
  const cur = sel !== null ? chunks.find((c) => c.i === sel) : undefined
  const pooled = useMemo(() => poolIdeas(chunks), [chunks])
  const nameOf = (id: string) => pooled.find((i) => i.id === id)

  return (
    <div className="is-book">
      <div className="is-book-top">
        <label className="is-file">Upload book (PDF / text)<input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = "" }} /></label>
        {books.length ? <select value={bid ?? ""} onChange={(e) => void open(e.target.value)} aria-label="Book">{books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.status === "running" ? " (running)" : ""}</option>)}</select> : null}
        {book ? <button type="button" onClick={() => { void dropOne("books", book.id); chunks.forEach((c) => void dropOne("chunks", c.id)); const rest = books.filter((b) => b.id !== book.id); setBooks(rest); setChunks([]); setBid(rest[0]?.id ?? null) }} disabled={busy}>Delete book</button> : null}
      </div>
      {err ? <p className="is-warn">{err}</p> : null}
      {!book ? <p className="is-empty">Upload a book to cut it into chunks, gate out the contents and index, and run the pipeline on each page-sized piece. The setup is whatever the Pipeline tab has now.</p> : (
        <>
          <div className="is-book-ctl">
            <label>Chunk size <input type="number" min="1500" max="6000" step="500" value={book.chunkSize} disabled={busy} onChange={(e) => saveBook({ ...book, chunkSize: Number(e.target.value) || 4000 })} /></label>
            <button type="button" disabled={busy} onClick={() => void rechunk(book)} title="Cut the book again at this size; clears chunk results">Re-cut</button>
            <label>Chunks at once <input type="number" min="1" max="6" value={book.parallel} disabled={busy} onChange={(e) => saveBook({ ...book, parallel: Number(e.target.value) || 1 })} /></label>
            <label className="is-check"><input type="checkbox" checked={book.gate} disabled={busy} onChange={(e) => saveBook({ ...book, gate: e.target.checked })} /> Gate: skip chunks with no useful ideas</label>
            {busy ? <button type="button" className="is-stop" onClick={() => stop.current?.abort()}>■ Stop</button> : (
              <>
                <button type="button" className="is-go" onClick={() => void process({ ...book, config: undefined }, chunks.map((c) => c))} disabled={!models?.length || !chunks.length}>▶ Process {chunks.some((c) => c.status === "done" || c.status === "skipped") ? "rest" : "book"}</button>
                {n("error") ? <button type="button" onClick={() => void process(book, chunks.map((c) => (c.status === "error" ? { ...c, status: "pending" as const } : c)))}>Retry {n("error")} failed</button> : null}
              </>
            )}
          </div>

          <div className="is-book-totals" aria-live="polite">
            <span><b>{chunks.length}</b> chunks</span>
            <span className="t-done"><b>{n("done")}</b> done</span>
            <span className="t-run"><b>{n("running") + n("gating")}</b> working</span>
            <span><b>{n("skipped")}</b> gated out</span>
            <span className="t-err"><b>{n("error")}</b> failed</span>
            <span><b>{totals.ideas}</b> reader ideas</span>
            <span><b>{totals.cards}</b> cards</span>
            <span><b>{totals.gems}</b> gems</span>
            <span>{totals.calls} calls · {totals.secs}s</span>
            <i className="is-book-bar"><u style={{ width: `${((n("done") + n("skipped")) / Math.max(1, chunks.length)) * 100}%` }} /></i>
          </div>

          <div className="is-book-grid">
            <div className="is-chunks" role="list">
              {chunks.map((c) => <button key={c.id} type="button" role="listitem" className={`is-chunk s-${c.status}${sel === c.i ? " is-on" : ""}`} title={`#${c.i + 1} · ${c.status}${c.useful === false ? " (no useful ideas)" : ""}`} onClick={() => setSel(c.i)}>{c.i + 1}</button>)}
            </div>
            <div className="is-chunk-list">
              <div className="is-row">{(["all", "useful", "problems"] as Filter[]).map((f) => <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>{f}</button>)}</div>
              <ul>
                {shown.map((c) => (
                  <li key={c.id} className={sel === c.i ? "is-on" : ""}>
                    <button type="button" onClick={() => setSel(c.i)}>
                      <i className={`is-dot-s s-${c.status}`} /><b>#{c.i + 1}</b>
                      <span>{c.status === "done" ? `${c.run!.stages.agents?.items.length ?? 0} ideas → ${c.run!.stages.synth?.items.length ?? 0} cards` : c.status === "skipped" ? "no useful ideas" : c.status === "error" ? `failed: ${c.error ?? ""}` : c.status}</span>
                      {c.ms ? <small>{(c.ms / 1000).toFixed(0)}s</small> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="is-chunk-detail">
              {!cur ? <p className="is-muted">Click a chunk to see its gate answer, nodes and cards.</p> : (
                <>
                  <h3>Chunk {cur.i + 1} <small>chars {cur.from.toLocaleString()}–{cur.to.toLocaleString()} · {cur.status}</small></h3>
                  <p className="is-stage-meta">Gate: {cur.gateRaw ?? (book.gate ? "not asked yet" : "off")}{cur.error ? ` · ${cur.error}` : ""}</p>
                  <details><summary>Chunk text</summary><pre className="is-pre">{book.text.slice(cur.from, cur.to)}</pre></details>
                  {cur.run ? (
                    <>
                      <ul className="is-nodes-mini">{Object.values(cur.run.stages).map((s) => <li key={s!.id} className={`s-${s!.status}`}><b>{s!.id}</b> {s!.status === "done" ? `${s!.items.length} out · ${s!.calls} calls · ${(s!.ms / 1000).toFixed(1)}s` : s!.status === "error" ? s!.error : s!.note}</li>)}</ul>
                      <h4>Cards</h4>
                      <ol className="is-out">{(cur.run.stages.synth?.items ?? []).map((i) => <li key={i.id}><span>{i.text}</span><small>{i.grounded ? <span className="is-chip is-yes">quote ✓</span> : null}{i.note ? <em>{i.note}</em> : null}</small></li>)}</ol>
                      {cur.run.stages.lone?.items.length ? <><h4>Gems</h4><ol className="is-out">{cur.run.stages.lone.items.map((i) => <li key={i.id}><span>{i.text}</span></li>)}</ol></> : null}
                      <h4>Careful single call</h4>
                      <ol className="is-out">{(cur.run.stages.baseline?.items ?? []).map((i) => <li key={i.id}><span>{i.text}</span></li>)}</ol>
                    </>
                  ) : null}
                  {!busy && cur.status !== "running" && cur.status !== "gating" ? <button type="button" onClick={() => void rerunOne(cur)}>Run this chunk again</button> : null}
                </>
              )}
            </div>
          </div>

          <section className="is-book-level">
            <h3>Whole book <small>{pooled.length} cards and gems pooled from {done.length} chunks</small></h3>
            <div className="is-row">
              <label className="is-check"><input type="checkbox" checked={lvl.cluster} onChange={(e) => setLvl({ ...lvl, cluster: e.target.checked })} /> Cluster all ideas into themes</label>
              <label className="is-check"><input type="checkbox" checked={lvl.keywords} onChange={(e) => setLvl({ ...lvl, keywords: e.target.checked })} /> Key phrases</label>
              <label className="is-check"><input type="checkbox" checked={lvl.summarize} onChange={(e) => setLvl({ ...lvl, summarize: e.target.checked })} /> Summary loop</label>
              <button type="button" className="is-go" disabled={busy || !done.length || !models?.length} onClick={() => void levels()}>{agg ?? "Run book-level passes"}</button>
            </div>
            {book.agg ? (
              <div className="is-agg">
                {book.agg.clusters.length ? <>
                  <h4>Themes <small>{book.agg.clusters.filter((c) => !c.lone).length} across chunks, {book.agg.clusters.filter((c) => c.lone).length} single</small></h4>
                  <ol className="is-out">{book.agg.clusters.filter((c) => !c.lone).sort((a, b) => b.members.length - a.members.length).map((c) => (
                    <li key={c.id}><span><b>{c.name ?? `Theme ${c.id + 1}`}</b>{c.gist ? ` — ${c.gist}` : ""}</span><small><span className="is-chip">{c.members.length} ideas</span><span className="is-chip">chunks {c.chunks.map((x) => x + 1).join(", ")}</span></small>
                      <details><summary>members</summary><ul className="is-plain">{c.members.map((m) => <li key={m}>{nameOf(m)?.text ?? m}</li>)}</ul></details></li>
                  ))}</ol></> : null}
                {book.agg.keywords.map((k) => <div key={k.method}><h4>Key phrases · {k.method}</h4><p className="is-kw">{k.phrases.join(" · ")}</p></div>)}
                {book.agg.summaries.length ? <><h4>Summary loop</h4>{[...book.agg.summaries].reverse().map((lv, k) => <div key={k}><small>{lv.length === 1 ? "the whole book" : `${lv.length} parts`}</small><ol className="is-out">{lv.map((t, j) => <li key={j}><span>{t}</span></li>)}</ol></div>)}</> : null}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  )

  async function rerunOne(c: ChunkRec) {
    if (!book) return
    await process(book, chunks.map((x) => (x.i === c.i ? { ...x, status: "pending" as const, error: undefined } : x)), c.i)
  }
}
