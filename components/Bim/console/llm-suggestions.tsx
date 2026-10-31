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
    setDecided(decidedIds(v))
    return () => ctl.current?.abort()
  }, [])

  const run = useCallback(async () => {
    ctl.current?.abort()
    const abort = new AbortController()
    ctl.current = abort
    setPhase("loading")
    setProgress("LOOKING FOR OLLAMA…")
    const models = await listOllamaModels()
    if (!models) {
      setPhase("no-ollama")
      return
    }
    const saved = readJson<string>("bimflow-model")
    const model = typeof saved === "string" && models.includes(saved) ? saved : models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0]!
    const plan = readJson<ModelPlan>("bimflow-model-plan") ?? undefined
    setProgress("READING THE WEEK…")
    // A window whose stores are empty (a plain tab) reads the hub instead, as the bench does.
    const stores = snapshotFromStores()
    const hub = stores.items.length === 0 || feed.length === 0 ? await loadHubVault() : null
    const base = stores.items.length === 0 && hub ? hub.snap : stores
    const rows = feed.length > 0 ? feed : hub?.feed ?? []
    const [texts, files] = await Promise.all([loadTexts({ days: 8, people: base.people }), loadFileEvents(8)])
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
          setProgress(total === 0 ? `ALL ${cached} MESSAGES ALREADY READ` : `${done}/${total} NEW MESSAGES · ${cached} ALREADY READ · ${model.toUpperCase()}`)
        },
      })
      setPhase("done")
    } catch (err) {
      setProgress(abort.signal.aborted ? "STOPPED" : `FAILED: ${err instanceof Error ? err.message.toUpperCase() : String(err)}`)
      setPhase("done")
    } finally {
      // Kept even when stopped or failed part way: every model answer is worth reading back.
      keep()
    }
  }, [feed])

  const stop = () => {
    ctl.current?.abort()
    setPhase("done")
    setProgress("STOPPED")
  }

  const decide = (s: Suggestion, verdict: Verdict["verdict"]) => {
    const next = recordVerdict({ suggestionId: s.id, verdict, reason: (words[s.id] ?? "").trim(), at: new Date().toISOString(), runId, suggestion: s })
    setVerdicts(next)
    setDecided((d) => new Set(d).add(s.id))
    setRejecting(null)
  }

  const accept = (s: Suggestion) => {
    const r = acceptSuggestion(s, words[s.id] ?? "")
    setNote(`${r.ok ? "" : "NOT SAVED: "}${r.message}`)
    if (r.ok) decide(s, "accepted")
  }

  const shown = useMemo(() => suggestions.filter((s) => !decided.has(s.id)), [suggestions, decided])
  const rejectedCount = verdicts.filter((v) => v.verdict === "rejected").length
  const busy = phase === "loading" || phase === "running"
  const today = formatLocalDateKey(new Date())

  return (
    <div className="bim-llm-sug">
      <p className="bim-crt-line">
        LLM SUGGESTIONS — THE LAST 7 DAYS OF BIM MESSAGES, TEXTS YOU SENT, SCREEN TIME AND FILE SAVES, MINUS WHAT BRAIN2 ALREADY HOLDS. ACCEPT SAVES ONE (UNDO WORKS).
      </p>
      <div className="bim-crt-chips">
        {busy ? (
          <button data-no95 type="button" onClick={stop}>
            STOP
          </button>
        ) : (
          <button data-no95 type="button" onClick={() => void run()}>
            {phase === "idle" ? "SUGGEST FROM THE LAST WEEK" : "RUN AGAIN"}
          </button>
        )}
      </div>
      {phase === "no-ollama" ? <p className="bim-crt-line is-error">OLLAMA DID NOT ANSWER ON 127.0.0.1:11434. START IT, THEN RUN AGAIN.</p> : null}
      {note ? <p className="bim-crt-line">{note}</p> : null}
      {progress && phase !== "no-ollama" ? <p className="bim-crt-line bim-crt-dim">{progress}</p> : null}
      {verdicts.length || runId ? (
        <p className="bim-crt-line bim-crt-dim">
          {verdicts.length} VERDICTS KEPT ({rejectedCount} REJECTED WITH REASONS){runId ? " · THIS PASS IS KEPT AS A RUN" : ""} · REVIEW AND ANNOTATE IN FLOW BENCH → RUNS
        </p>
      ) : null}
      {phase === "idle" ? null : SUGGESTION_KINDS.map(({ kind, label, empty }) => {
        const rows = shown.filter((s) => s.kind === kind)
        return (
          <section key={kind} className="bim-llm-sec" aria-label={label}>
            <p className="bim-crt-line bim-llm-head">
              {label} ({rows.length})
            </p>
            {rows.length === 0 ? <p className="bim-crt-line bim-crt-dim">{busy ? "…" : empty}</p> : null}
            {rows.map((s) => (
              <div key={s.id} className="bim-llm-row">
                <button data-no95 type="button" className="bim-llm-main" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span>{s.title.toUpperCase()}</span>
                  <span className="bim-crt-dim">
                    {s.detail.toUpperCase()}
                    {s.estimated ? " · ESTIMATED" : ""} · {s.source.toUpperCase()}
                    {s.at.slice(0, 10) === today ? " · TODAY" : ""}
                  </span>
                </button>
                <button data-no95 type="button" aria-label={`Accept ${s.title}`} onClick={() => accept(s)}>
                  ACCEPT
                </button>
                <button data-no95 type="button" aria-label={`Reject ${s.title}`} onClick={() => { setRejecting(s.id); setOpen(s.id) }}>
                  REJECT
                </button>
                {open === s.id ? (
                  <div className="bim-llm-why">
                    {(s.detections?.length ?? 0) > 1 ? <p className="bim-crt-line">DETECTED {s.detections!.length} TIMES BY LLM</p> : null}
                    <p className="bim-crt-line bim-crt-dim">WHY: {s.why.toUpperCase()}</p>
                    {s.evidence.map((line, i) => (
                      <p key={i} className="bim-crt-line bim-crt-dim">
                        &gt; {line}
                      </p>
                    ))}
                    <label className="bim-crt-line" htmlFor={`bim-llm-words-${s.id}`}>
                      {rejecting === s.id ? "WHY IS THIS WRONG? KEPT SO THE FLOW CAN LEARN FROM IT." : "NOTE (OPTIONAL). ACCEPT KEEPS IT ON THE BLOCK."}
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
                      <div className="bim-crt-chips">
                        <button data-no95 type="button" onClick={() => decide(s, "rejected")}>
                          SAVE REJECTION
                        </button>
                        <button data-no95 type="button" onClick={() => setRejecting(null)}>
                          CANCEL
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
          <p className="bim-crt-line bim-llm-head">ACCEPTED LLM BLOCKS THAT OVERLAP ({overlaps.length})</p>
          <p className="bim-crt-line bim-crt-dim">OPEN THE DAY IN TRACKING, READ EACH BLOCK&apos;S NOTES, AND SET ITS TRUE START AND END. MOVING ONE EDGE TRIMS THE OTHER.</p>
          {overlaps.map((o) => (
            <p key={`${o.a.id}:${o.b.id}`} className="bim-crt-line">
              {o.date} · {penName(o.a.penId).toUpperCase()} {clock(o.a.startMin)}–{clock(o.a.endMin)} × {penName(o.b.penId).toUpperCase()} {clock(o.b.startMin)}–{clock(o.b.endMin)} · {o.endMin - o.startMin} MIN SHARED
            </p>
          ))}
        </section>
      ) : null}
    </div>
  )
}
