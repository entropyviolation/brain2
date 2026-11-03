/**
 * components/BabyGame/gens/GensLog.tsx — The Baby animal game's ComfyUI generation log
 *
 * Every image in the ComfyUI output folder beside the recipe it carries. Like or nope it, say what it was meant to
 * be (character, prop, tile), tag it and write a note. The boards above count likes per whole setup and per LoRA at
 * a strength, so the winning recipes show. Keys: ← → move, L like, X nope, 0 clears, when no field has focus.
 * Data: `/api/baby-gens` (`scripts/baby-gens-api.mjs`); notes are saved to `data/baby-game-gens.json`.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  filterGens,
  GEN_ISSUES,
  GEN_KIND_LABEL,
  likeScore,
  loraBoard,
  loraLine,
  parseTags,
  setupBoard,
  setupKey,
  stripExt,
  type BoardRow,
  type Gen,
  type GenFilter,
  type GenKind,
  type GenNote,
  type GenNotes,
  type GenPatch,
  type GenRecipe,
} from "@/lib/baby-game/gens"

const KINDS = Object.keys(GEN_KIND_LABEL) as GenKind[]
const FILTERS: { id: GenFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unrated", label: "Unrated" },
  { id: "like", label: "Liked" },
  { id: "nope", label: "Nope" },
]

const imgSrc = (file: string) => `/api/baby-gens/img/${file.split("/").map(encodeURIComponent).join("/")}`

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; dir: string; missing: boolean; gens: Gen[] }

export function GensLog() {
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [notes, setNotes] = useState<GenNotes>({})
  const [filter, setFilter] = useState<GenFilter>("all")
  const [kind, setKind] = useState<GenKind | "any">("any")
  const [setup, setSetup] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tryFrom, setTryFrom] = useState<Gen | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/baby-gens", { cache: "no-store" })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setLoad({ state: "ok", dir: body.dir, missing: body.missing, gens: body.gens })
      setNotes(body.notes ?? {})
    } catch (e) {
      setLoad({ state: "error", message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback(async (file: string, p: GenPatch) => {
    setNotes((old) => ({ ...old, [file]: { ...(old[file] ?? { verdict: null, kind: null, text: "", tags: [], issues: [], at: 0 }), ...p, at: Date.now() } }))
    try {
      const res = await fetch("/api/baby-gens/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, patch: p }) })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setNotes((old) => ({ ...old, [file]: body.note as GenNote }))
      setSaveError(null)
    } catch (e) {
      setSaveError(`Not saved: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  const gens = load.state === "ok" ? load.gens : []
  const shown = useMemo(() => filterGens(gens, notes, filter, kind, setup), [gens, notes, filter, kind, setup])
  const setups = useMemo(() => setupBoard(gens, notes), [gens, notes])
  const loras = useMemo(() => loraBoard(gens, notes), [gens, notes])
  const counts = useMemo(() => {
    const v = gens.map((g) => notes[g.file]?.verdict)
    return { liked: v.filter((x) => x === "like").length, nope: v.filter((x) => x === "nope").length, total: gens.length }
  }, [gens, notes])

  const current = shown.find((g) => g.file === selected) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey || !shown.length) return
      const i = shown.findIndex((g) => g.file === selected)
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault()
        const step = e.key === "ArrowRight" ? 1 : -1
        const next = i < 0 ? 0 : Math.min(shown.length - 1, Math.max(0, i + step))
        setSelected(shown[next].file)
        return
      }
      if (!current) return
      const k = e.key.toLowerCase()
      if (k === "l") void patch(current.file, { verdict: notes[current.file]?.verdict === "like" ? null : "like" })
      else if (k === "x") void patch(current.file, { verdict: notes[current.file]?.verdict === "nope" ? null : "nope" })
      else if (k === "0") void patch(current.file, { verdict: null })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shown, selected, current, notes, patch])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Baby animal game · art</p>
        <h1 className="text-xl font-semibold">Generation log</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          ComfyUI outputs with the recipe each one carries. Like what looks cute and would work in the game; the boards show which setups win. These likes become the recipes the game generates from later.
        </p>
      </header>

      {load.state === "loading" ? <p className="text-sm">Reading the output folder…</p> : null}
      {load.state === "error" ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Could not read <code>/api/baby-gens</code> ({load.message}). The local server answers it; restart <code>npm run dev</code> if it was started before this page existed.
        </p>
      ) : null}

      {load.state === "ok" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              {counts.total} images · {counts.liked} liked · {counts.nope} nope · <code className="text-xs">{load.dir}</code>
            </span>
            <button type="button" data-no95="" onClick={() => void refresh()} className="rounded border px-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Refresh
            </button>
            {saveError ? <span className="text-red-600">{saveError}</span> : null}
          </div>
          {load.missing ? <p className="text-sm">That folder does not exist. Set <code>BABY_GENS_DIR</code> to your ComfyUI output folder.</p> : null}

          <TryPanel from={tryFrom} onClear={() => setTryFrom(null)} onDone={() => void refresh()} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Board title="Setups" rows={setups} active={setup} onPick={(k) => setSetup(setup === k ? null : k)} />
            <Board title="LoRA at strength" rows={loras} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded border px-2 py-0.5 ${filter === f.id ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                {f.label}
              </button>
            ))}
            <select value={kind} onChange={(e) => setKind(e.target.value as GenKind | "any")} aria-label="Meant to be" className="rounded border bg-transparent px-1 py-0.5">
              <option value="any">Any kind</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {GEN_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {setup ? (
              <button type="button" data-no95="" onClick={() => setSetup(null)} className="rounded border px-2 py-0.5 text-xs">
                Setup: {setup} ✕
              </button>
            ) : null}
            <span className="text-neutral-500">{shown.length} shown · ← → L X 0</span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_minmax(280px,380px)]">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((g) => (
                <Card key={g.file} gen={g} note={notes[g.file]} selected={g.file === selected} onSelect={() => setSelected(g.file)} onPatch={(p) => void patch(g.file, p)} />
              ))}
            </ul>
            <aside className="md:sticky md:top-4 md:self-start">
              {current ? <Detail key={current.file} gen={current} note={notes[current.file]} onPatch={(p) => void patch(current.file, p)} onTry={() => setTryFrom(current)} /> : <p className="text-sm text-neutral-500">Pick an image to see its recipe and write a note.</p>}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Verdicts({ note, onPatch, small }: { note?: GenNote; onPatch: (p: GenPatch) => void; small?: boolean }) {
  const v = note?.verdict ?? null
  const cls = (on: boolean, tone: string) => `rounded border ${small ? "px-1.5 text-xs" : "px-2 py-0.5 text-sm"} ${on ? tone : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`
  return (
    <span className="flex gap-1">
      <button type="button" data-no95="" aria-pressed={v === "like"} title="Like (L)" onClick={() => onPatch({ verdict: v === "like" ? null : "like" })} className={cls(v === "like", "border-emerald-600 bg-emerald-600 text-white")}>
        {small ? "♥" : "♥ Like"}
      </button>
      <button type="button" data-no95="" aria-pressed={v === "nope"} title="Nope (X)" onClick={() => onPatch({ verdict: v === "nope" ? null : "nope" })} className={cls(v === "nope", "border-neutral-500 bg-neutral-500 text-white")}>
        ✕
      </button>
    </span>
  )
}

function Card({ gen, note, selected, onSelect, onPatch }: { gen: Gen; note?: GenNote; selected: boolean; onSelect: () => void; onPatch: (p: GenPatch) => void }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" })
  }, [selected])
  const v = note?.verdict
  return (
    <li
      ref={ref}
      className={`flex flex-col gap-1 rounded border p-1 ${selected ? "ring-2 ring-sky-500" : ""} ${v === "like" ? "border-emerald-500" : v === "nope" ? "opacity-50" : ""}`}
    >
      <button type="button" data-no95="" onClick={onSelect} className="block aspect-square overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800" aria-label={`Open ${gen.file}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(gen.file)} alt={gen.recipe?.positive || gen.file} loading="lazy" className="h-full w-full object-contain" />
      </button>
      <div className="flex items-center justify-between gap-1">
        <Verdicts note={note} onPatch={onPatch} small />
        <span className="truncate text-[10px] text-neutral-500" title={gen.file}>
          {gen.file.replace(/\.png$/i, "")}
        </span>
      </div>
      <p className="truncate text-[11px] text-neutral-600 dark:text-neutral-400" title={setupKey(gen.recipe)}>
        {loraLine(gen.recipe)}
        {gen.recipe?.seed != null ? ` · seed ${gen.recipe.seed}` : ""}
      </p>
      {note?.text ? <p className="line-clamp-2 text-[11px] italic">{note.text}</p> : null}
    </li>
  )
}

function Detail({ gen, note, onPatch, onTry }: { gen: Gen; note?: GenNote; onPatch: (p: GenPatch) => void; onTry: () => void }) {
  const r = gen.recipe
  const [text, setText] = useState(note?.text ?? "")
  const [tags, setTags] = useState((note?.tags ?? []).join(", "))
  const [copied, setCopied] = useState(false)
  const recipeJson = JSON.stringify({ file: gen.file, recipe: r, note: note ?? null }, null, 2)
  return (
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc(gen.file)} alt={r?.positive || gen.file} className="w-full rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="flex flex-wrap items-center gap-2">
        <Verdicts note={note} onPatch={onPatch} />
        <select value={note?.kind ?? ""} onChange={(e) => onPatch({ kind: (e.target.value || null) as GenKind | null })} aria-label="Meant to be" className="rounded border bg-transparent px-1 py-0.5">
          <option value="">Meant to be…</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {GEN_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">What went wrong</span>
        <div className="flex flex-wrap gap-1">
          {GEN_ISSUES.map((i) => {
            const on = (note?.issues ?? []).includes(i)
            return (
              <button
                key={i}
                type="button"
                data-no95=""
                aria-pressed={on}
                onClick={() => onPatch({ issues: on ? (note?.issues ?? []).filter((x) => x !== i) : [...(note?.issues ?? []), i] })}
                className={`rounded border px-1.5 py-0.5 text-xs ${on ? "border-amber-700 bg-amber-700 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                {i}
              </button>
            )
          })}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Note (what works, what is off)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== (note?.text ?? "") && onPatch({ text })} rows={3} className="rounded border bg-transparent p-1" placeholder="e.g. cute face, but the outline is too thick; LoRA at 1.2 adds noise" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Tags, comma separated</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => onPatch({ tags: parseTags(tags) })} className="rounded border bg-transparent p-1" placeholder="cute, clean outline, wrong facing" />
      </label>

      {r ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-neutral-500">Model</dt>
          <dd>{stripExt(r.checkpoint ?? "?")}</dd>
          <dt className="text-neutral-500">LoRAs</dt>
          <dd>{r.loras.length ? r.loras.map((l) => `${stripExt(l.name)} (model ${l.model ?? "?"}, clip ${l.clip ?? "?"})`).join(", ") : "none"}</dd>
          <dt className="text-neutral-500">Prompt</dt>
          <dd className="whitespace-pre-wrap">{r.positive || "—"}</dd>
          <dt className="text-neutral-500">Negative</dt>
          <dd className="whitespace-pre-wrap">{r.negative || "—"}</dd>
          <dt className="text-neutral-500">Sampler</dt>
          <dd>
            {[r.sampler, r.scheduler].filter(Boolean).join(" / ") || "?"} · {r.steps ?? "?"} steps · cfg {r.cfg ?? "?"}
            {r.denoise != null && r.denoise !== 1 ? ` · denoise ${r.denoise}` : ""}
          </dd>
          <dt className="text-neutral-500">Seed</dt>
          <dd>{r.seed ?? "?"}</dd>
          <dt className="text-neutral-500">Size</dt>
          <dd>{r.width && r.height ? `${r.width}×${r.height}${r.batch && r.batch > 1 ? ` × batch ${r.batch}` : ""}` : "?"}</dd>
          <dt className="text-neutral-500">File</dt>
          <dd>
            {gen.file} · {Math.round(gen.bytes / 1024)} KB · {new Date(gen.at).toLocaleString()} · {r.nodes} nodes
          </dd>
        </dl>
      ) : (
        <p className="text-xs text-neutral-500">No recipe in this file (not saved by ComfyUI's Save Image, or metadata stripped).</p>
      )}
      {gen.workflowNotes.length ? (
        <div className="text-xs">
          <p className="text-neutral-500">Notes on the ComfyUI canvas</p>
          {gen.workflowNotes.map((n, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {n}
            </p>
          ))}
        </div>
      ) : null}
      <RawGraph file={gen.file} />
      <button type="button" data-no95="" onClick={onTry} className="self-start rounded border border-sky-600 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300">
        Try this recipe…
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(recipeJson)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          } catch {
            setCopied(false)
          }
        }}
        className="self-start rounded border px-2 py-0.5 text-xs"
      >
        {copied ? "Copied" : "Copy recipe as JSON"}
      </button>
    </div>
  )
}

/** The exact graph ComfyUI ran, fetched on open. */
function RawGraph({ file }: { file: string }) {
  const [text, setText] = useState<string | null>(null)
  const open = async (isOpen: boolean) => {
    if (!isOpen || text !== null) return
    try {
      const body = await (await fetch(`/api/baby-gens/raw/${file.split("/").map(encodeURIComponent).join("/")}`)).json()
      setText(body.ok && body.prompt ? JSON.stringify(body.prompt, null, 2) : "No graph in this file.")
    } catch {
      setText("Could not read the graph.")
    }
  }
  return (
    <details onToggle={(e) => void open((e.target as HTMLDetailsElement).open)} className="text-xs">
      <summary className="cursor-pointer text-neutral-500">Exact ComfyUI graph (JSON)</summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded border bg-neutral-50 p-2 text-[10px] dark:bg-neutral-950">{text ?? "Reading…"}</pre>
    </details>
  )
}

type Form = { positive: string; negative: string; seed: string; count: string; steps: string; cfg: string; width: string; height: string; loraStrength: string; prefix: string }
const EMPTY_FORM: Form = { positive: "", negative: "", seed: "", count: "1", steps: "22", cfg: "7", width: "768", height: "768", loraStrength: "1.2", prefix: "try" }

const formFrom = (r: GenRecipe | null): Form => ({
  positive: r?.positive ?? "",
  negative: r?.negative ?? "",
  seed: "",
  count: "1",
  steps: String(r?.steps ?? 22),
  cfg: String(r?.cfg ?? 7),
  width: String(r?.width ?? 768),
  height: String(r?.height ?? 768),
  loraStrength: String(r?.loras[0]?.model ?? 1.2),
  prefix: "try",
})

/** Try a prompt: queue jobs in the local ComfyUI, starting from an image's exact graph or the liked default. */
function TryPanel({ from, onClear, onDone }: { from: Gen | null; onClear: () => void; onDone: () => void }) {
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState<{ running: number; pending: number } | null>(null)
  const wasBusy = useRef(false)

  useEffect(() => {
    if (!from) return
    setForm(formFrom(from.recipe))
    setOpen(true)
    setStatus(null)
  }, [from])

  useEffect(() => {
    if (!open) return
    let live = true
    const tick = async () => {
      try {
        const q = await (await fetch("/api/baby-gens/queue", { cache: "no-store" })).json()
        if (!live) return
        if (q.ok) {
          setQueue({ running: q.running, pending: q.pending })
          const busyNow = q.running + q.pending > 0
          if (wasBusy.current && !busyNow) onDone()
          wasBusy.current = busyNow
        } else setQueue(null)
      } catch {
        if (live) setQueue(null)
      }
    }
    void tick()
    const t = setInterval(tick, 4000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [open, onDone])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async () => {
    setBusy(true)
    setStatus(null)
    const n = (v: string) => (v.trim() === "" ? undefined : Number(v))
    try {
      const res = await fetch("/api/baby-gens/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: from?.file,
          positive: form.positive,
          negative: form.negative,
          seed: n(form.seed) ?? null,
          count: n(form.count),
          steps: n(form.steps),
          cfg: n(form.cfg),
          width: n(form.width),
          height: n(form.height),
          loraStrength: n(form.loraStrength),
          prefix: form.prefix,
        }),
      })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setStatus(`Queued ${body.queued.length}: seeds ${body.queued.map((q: { seed: number }) => q.seed).join(", ")}`)
      wasBusy.current = true
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof Form, label: string, w = "w-20") => (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-neutral-500">{label}</span>
      <input value={form[k]} onChange={set(k)} className={`${w} rounded border bg-transparent p-1`} />
    </label>
  )

  return (
    <section className="rounded border p-2 text-sm">
      <button type="button" data-no95="" onClick={() => setOpen(!open)} aria-expanded={open} className="font-medium">
        {open ? "▾" : "▸"} Try a prompt
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-neutral-500">
            {from ? (
              <>
                Starting from the exact graph of <code>{from.file}</code>; only the fields below change.{" "}
                <button type="button" data-no95="" onClick={onClear} className="underline">
                  Use the liked default instead
                </button>
              </>
            ) : (
              "Using the liked default (SDXL + pixel-art-xl, euler). Pick an image and press “Try this recipe…” to start from its graph."
            )}
            {queue ? ` · ComfyUI: ${queue.running} running, ${queue.pending} waiting` : " · ComfyUI not reachable"}
          </p>
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-neutral-500">Prompt</span>
            <textarea value={form.positive} onChange={set("positive")} rows={3} className="rounded border bg-transparent p-1 text-sm" placeholder="pixel art, one single cute fluffy baby hedgehog, …" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-neutral-500">Negative</span>
            <textarea value={form.negative} onChange={set("negative")} rows={2} className="rounded border bg-transparent p-1 text-sm" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {field("seed", "Seed (blank = random)", "w-32")}
            {field("count", "How many")}
            {field("steps", "Steps")}
            {field("cfg", "cfg")}
            {field("width", "Width")}
            {field("height", "Height")}
            {field("loraStrength", "LoRA")}
            {field("prefix", "File prefix", "w-28")}
            <button type="button" data-no95="" disabled={busy || !form.positive.trim()} onClick={() => void submit()} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">
              {busy ? "Queuing…" : "Queue"}
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">“How many” queues that many jobs on consecutive seeds. ComfyUI runs them one at a time; new images appear below when the queue empties.</p>
          {status ? <p className="text-xs">{status}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function Board({ title, rows, active, onPick }: { title: string; rows: BoardRow[]; active?: string | null; onPick?: (key: string) => void }) {
  return (
    <section className="rounded border p-2 text-xs">
      <h2 className="mb-1 text-sm font-medium">{title}</h2>
      <table className="w-full">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="font-normal">Setup</th>
            <th className="w-10 text-right font-normal">n</th>
            <th className="w-10 text-right font-normal">♥</th>
            <th className="w-10 text-right font-normal">✕</th>
            <th className="w-24 font-normal" title="(likes + 1) / (rated + 2)">
              score
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={active === r.key ? "bg-sky-50 dark:bg-sky-950" : ""}>
              <td className="max-w-0 truncate py-0.5" title={r.key}>
                {onPick ? (
                  <button type="button" data-no95="" onClick={() => onPick(r.key)} className="truncate text-left underline-offset-2 hover:underline">
                    {r.key}
                  </button>
                ) : (
                  r.key
                )}
              </td>
              <td className="text-right">{r.total}</td>
              <td className="text-right">{r.liked}</td>
              <td className="text-right">{r.nope}</td>
              <td className="pl-2">
                <span className="block h-1.5 rounded bg-neutral-200 dark:bg-neutral-700">
                  <span className="block h-1.5 rounded bg-emerald-600" style={{ width: `${Math.round(likeScore(r) * 100)}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
