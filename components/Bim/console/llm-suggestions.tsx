/**
 * components/Bim/console/llm-suggestions.tsx — "LLM suggested …" sections for the BIM console's LLM tab
 *
 * Runs the routed Log flow (`lib/bim-flow/suggestions.ts`) over the last week of BIM messages and
 * sent texts, plus the declared Screen Time and file rules, and lists what Brain2 does not hold yet:
 * time blocks, items, habit completions. Needs the local Ollama daemon. Running writes nothing. Accept
 * writes that one suggestion through the app's own paths (`lib/bim-flow/accept.ts`, one undo step), with
 * the row's note kept on the block. Reject asks why, and keeps the reason
 * (`lib/bim-flow/suggestion-verdicts.ts`). Every pass that asked the model is kept as a BIM flow run marked
 * "Activated from Brain2 button click" (`saveButtonRun`), reviewable and annotatable in the bench's Runs.
 * Accepted LLM blocks that overlap are listed below the suggestions until their bounds are set in Tracking.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { acceptSuggestion, llmOverlaps } from "@/lib/bim-flow/accept"
import { saveButtonRun } from "@/lib/bim-flow/run-history"
import { decidedIds, loadVerdicts, recordVerdict, type Verdict } from "@/lib/bim-flow/suggestion-verdicts"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { loadFileEvents } from "@/lib/bim-flow/file-activity-client"
import { FLOWS, flowDef, type FlowId } from "@/lib/bim-flow/flows"
import { DEFAULT_MODEL, listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { loadHubVault, snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { SUGGESTION_KINDS, suggestWeek, type Suggestion } from "@/lib/bim-flow/suggestions"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import type { Flow, MessageRun, ModelPlan } from "@/lib/bim-flow/types"

const FLOW_ID: FlowId = "log-routed"

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** The bench's saved copy of the routed Log flow (so taught examples carry over), else the shipped one. */
function loadLogFlow(): Flow {
  const saved = readJson<Flow>(`bimflow-graph-v2:${FLOW_ID}`)
  return saved?.nodes?.length ? saved : flowDef(FLOW_ID).build()
}

const CACHE_KEY = "bim-llm-suggestions-v1"

type Cached = { suggestions: Suggestion[]; runId?: string; at: string }

/** The last pass's suggestions, kept so the tab does not make you regenerate them. Decided ones drop out on read. */
function loadCached(decided: Set<string>): Cached | null {
  const c = readJson<Cached>(CACHE_KEY)
  if (!c || !Array.isArray(c.suggestions)) return null
  const suggestions = c.suggestions.filter((s) => !decided.has(s.id))
  return suggestions.length ? { ...c, suggestions } : null
}

function saveCached(c: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* storage full or blocked: the pass still shows, it just is not kept */
  }
}

const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

type Phase = "idle" | "loading" | "running" | "done" | "no-ollama"

export function LlmSuggestions() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [progress, setProgress] = useState("")
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  const [decided, setDecided] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [words, setWords] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [runId, setRunId] = useState<string | undefined>(undefined)
  const ctl = useRef<AbortController | null>(null)
  const latest = useRef<Suggestion[]>([])
  const feed = useTelegramFeedStore((s) => s.rows)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const overlaps = useMemo(() => llmOverlaps(entries), [entries])
  const penName = (id: string) => scopes.find((x) => x.id === "activity")?.pens.find((p) => p.id === id)?.name ?? id

  useEffect(() => {
    const v = loadVerdicts()
    setVerdicts(v)
    const d = decidedIds(v)
    setDecided(d)
    const cached = loadCached(d)
    if (cached && latest.current.length === 0) {
      latest.current = cached.suggestions
      setSuggestions(cached.suggestions)
      setRunId(cached.runId)
      setProgress(`Kept from the last pass (${new Date(cached.at).toLocaleString()}). Run again to look for more.`)
      setPhase("done")
    }
    return () => ctl.current?.abort()
  }, [])

  const run = useCallback(async () => {
    ctl.current?.abort()
    const abort = new AbortController()
    ctl.current = abort
    setPhase("loading")
    setProgress("Looking for Ollama…")
    const models = await listOllamaModels()
    if (!models) {
      setPhase("no-ollama")
      return
    }
    const saved = readJson<string>("bimflow-model")
    const model = typeof saved === "string" && models.includes(saved) ? saved : models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0]!
    const plan = readJson<ModelPlan>("bimflow-model-plan") ?? undefined
    setProgress("Reading the week…")
    // A window whose stores are empty (a plain tab) reads the hub instead, as the bench does.
    const stores = snapshotFromStores()
    const hub = stores.items.length === 0 || feed.length === 0 ? await loadHubVault() : null
    const base = stores.items.length === 0 && hub ? hub.snap : stores
    const rows = feed.length > 0 ? feed : hub?.feed ?? []
    const [texts, files] = await Promise.all([loadTexts({ days: 8, people: base.people, hideHandles: base.secretHandles }), loadFileEvents(8)])
    const snap = { ...base, texts: texts ?? [], files: files ?? [] }
    const weekly = useHabitsStore.getState().weeklyData
    const habitDone = (habitId: string, date: string) => {
      const cell = weekly[date]?.[habitId]
      return !!cell && (cell.completed === true || (cell.value ?? 0) > 0 || !!cell.text)
    }
    setPhase("running")
    const flow = loadLogFlow()
    const startedAt = new Date()
    const id = `bimsuggest-${startedAt.getTime()}`
    const ran: MessageRun[] = []
    let cachedCount = 0
    const keep = () => {
      if (!ran.length) return
      const shown = latest.current
      saveButtonRun({
        id,
        flowId: FLOW_ID,
        flowName: flowDef(FLOW_ID).name,
        at: startedAt.toISOString(),
        model,
        inputLabel: `${ran.length} new message${ran.length === 1 ? "" : "s"} · ${cachedCount} already read · BIM LLM tab`,
        flow,
        origin: "brain2-button",
        suggestions: shown,
        run: {
          model,
          startedAt: startedAt.toISOString(),
          ms: Date.now() - startedAt.getTime(),
          messages: ran,
          blocks: shown.filter((x) => x.kind === "timeblock" && x.end).map((x) => ({ activity: x.title, start: x.at, end: x.end!, estimated: !!x.estimated, why: x.why, evidence: x.evidence })),
        },
      })
      setRunId(id)
    }
    const cache = (runId?: string) => saveCached({ suggestions: latest.current, runId, at: new Date().toISOString() })
    try {
      await suggestWeek({
        snap,
        feed: rows,
        texts: texts ?? [],
        files: files ?? [],
        now: new Date(),
        habitDone,
        flow,
        call: ollamaCall(model, abort.signal),
        models: plan,
        signal: abort.signal,
        getFlow: (id) => FLOWS.some((f) => f.id === id) ? flowDef(id as FlowId).build() : undefined,
        onSuggestions: (all) => {
          latest.current = all
          setSuggestions(all)
        },
        onMessageRun: (r) => ran.push(r),
        onProgress: (done, total, cached) => {
          cachedCount = cached
          setProgress(total === 0 ? `All ${cached} messages already read` : `${done}/${total} new messages · ${cached} already read · ${model}`)
        },
      })
      setPhase("done")
    } catch (err) {
      setProgress(abort.signal.aborted ? "Stopped" : `Failed: ${err instanceof Error ? err.message : String(err)}`)
      setPhase("done")
    } finally {
      // Kept even when stopped or failed part way: every model answer is worth reading back.
      keep()
      cache(ran.length ? id : undefined)
    }
  }, [feed])

  const stop = () => {
    ctl.current?.abort()
    setPhase("done")
    setProgress("Stopped")
  }

  const decide = (s: Suggestion, verdict: Verdict["verdict"]) => {
    const next = recordVerdict({ suggestionId: s.id, verdict, reason: (words[s.id] ?? "").trim(), at: new Date().toISOString(), runId, suggestion: s })
    setVerdicts(next)
    setDecided((d) => new Set(d).add(s.id))
    setRejecting(null)
  }

  const accept = (s: Suggestion) => {
    const r = acceptSuggestion(s, words[s.id] ?? "")
    setNote(`${r.ok ? "" : "Not saved: "}${r.message}`)
    if (r.ok) decide(s, "accepted")
  }

  const shown = useMemo(() => suggestions.filter((s) => !decided.has(s.id)), [suggestions, decided])
  const rejectedCount = verdicts.filter((v) => v.verdict === "rejected").length
  const busy = phase === "loading" || phase === "running"
  const today = formatLocalDateKey(new Date())

  return (
    <div className="bim-llm-sug">
      <p className="bim-legend">LLM suggestions</p>
      <p>The last 7 days of BIM messages, texts you sent, screen time and file saves, minus what Brain2 already holds. Accept saves one (undo works).</p>
      <div className="bim-chips">
        {busy ? (
          <button data-no95 type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button data-no95 type="button" className="is-on" onClick={() => void run()}>
            {phase === "idle" ? "Suggest from the last week" : "Run again"}
          </button>
        )}
      </div>
      {phase === "no-ollama" ? <p style={{ color: "var(--bim-fault)" }}>Ollama did not answer on 127.0.0.1:11434. Start it, then run again.</p> : null}
      {note ? <p>{note}</p> : null}
      {progress && phase !== "no-ollama" ? <p className="bim-dim">{progress}</p> : null}
      {verdicts.length || runId ? (
        <p className="bim-dim">
          {verdicts.length} verdicts kept ({rejectedCount} rejected with reasons){runId ? " · this pass is kept as a run" : ""} · review and annotate in Flow bench → Runs
        </p>
      ) : null}
      {phase === "idle" ? null : SUGGESTION_KINDS.map(({ kind, label, empty }) => {
        const rows = shown.filter((s) => s.kind === kind)
        return (
          <section key={kind} className="bim-llm-sec" aria-label={label}>
            <p className="bim-llm-head">
              {label} ({rows.length})
            </p>
            {rows.length === 0 ? <p className="bim-dim">{busy ? "…" : empty}</p> : null}
            {rows.map((s) => (
              <div key={s.id} className="bim-llm-row">
                <button data-no95 type="button" className="bim-llm-main" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span>{s.title}</span>
                  <span className="bim-dim">
                    {s.detail}
                    {s.estimated ? " · estimated" : ""} · {s.source}
                    {s.at.slice(0, 10) === today ? " · today" : ""}
                  </span>
                </button>
                <button data-no95 type="button" className="bim-act bim-yes" aria-label={`Accept ${s.title}`} onClick={() => accept(s)}>
                  Accept
                </button>
                <button data-no95 type="button" className="bim-act" aria-label={`Reject ${s.title}`} onClick={() => { setRejecting(s.id); setOpen(s.id) }}>
                  Reject
                </button>
                {open === s.id ? (
                  <div className="bim-llm-why">
                    {(s.detections?.length ?? 0) > 1 ? <p>Detected {s.detections!.length} times by the LLM</p> : null}
                    <p className="bim-dim">Why: {s.why}</p>
                    {s.evidence.map((line, i) => (
                      <p key={i} className="bim-dim">
                        &gt; {line}
                      </p>
                    ))}
                    <label className="bim-legend" htmlFor={`bim-llm-words-${s.id}`}>
                      {rejecting === s.id ? "Why is this wrong? Kept so the flow can learn from it." : "Note (optional). Accept keeps it on the block."}
                    </label>
                    <textarea
                      id={`bim-llm-words-${s.id}`}
                      className="bim-llm-words"
                      data-no95
                      rows={2}
                      autoFocus={rejecting === s.id}
                      value={words[s.id] ?? ""}
                      onChange={(e) => setWords((w) => ({ ...w, [s.id]: e.target.value }))}
                    />
                    {rejecting === s.id ? (
                      <div className="bim-chips">
                        <button data-no95 type="button" onClick={() => decide(s, "rejected")}>
                          Save rejection
                        </button>
                        <button data-no95 type="button" onClick={() => setRejecting(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        )
      })}
      {overlaps.length ? (
        <section className="bim-llm-sec" aria-label="LLM blocks that overlap">
          <p className="bim-llm-head">Accepted LLM blocks that overlap ({overlaps.length})</p>
          <p className="bim-dim">Open the day in Tracking, read each block&apos;s notes, and set its true start and end. Moving one edge trims the other.</p>
          {overlaps.map((o) => (
            <p key={`${o.a.id}:${o.b.id}`}>
              {o.date} · {penName(o.a.penId)} {clock(o.a.startMin)}–{clock(o.a.endMin)} × {penName(o.b.penId)} {clock(o.b.startMin)}–{clock(o.b.endMin)} · {o.endMin - o.startMin} min shared
            </p>
          ))}
        </section>
      ) : null}
    </div>
  )
}
