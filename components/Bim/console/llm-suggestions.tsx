/**
 * components/Bim/console/llm-suggestions.tsx — "LLM suggested …" sections for the BIM console's LLM tab
 *
 * Runs the routed Log flow (`lib/bim-flow/suggestions.ts`) over the last week of BIM messages and
 * sent texts, plus the declared Screen Time and file rules, and lists what Brain2 does not hold yet:
 * time blocks, items, habit completions. Needs the local Ollama daemon. Running writes nothing. Accept
 * writes that one suggestion through the app's own paths (`lib/bim-flow/accept.ts`, one undo step);
 * Dismiss only hides it on this device.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { acceptSuggestion } from "@/lib/bim-flow/accept"
import { loadFileEvents } from "@/lib/bim-flow/file-activity-client"
import { FLOWS, flowDef, type FlowId } from "@/lib/bim-flow/flows"
import { DEFAULT_MODEL, listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { loadHubVault, snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { SUGGESTION_KINDS, suggestWeek, type Suggestion } from "@/lib/bim-flow/suggestions"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import type { Flow, ModelPlan } from "@/lib/bim-flow/types"

const FLOW_ID: FlowId = "log-routed"
const DISMISS_KEY = "bimsuggest-dismissed-v1"

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

function loadDismissed(): Set<string> {
  return new Set(readJson<string[]>(DISMISS_KEY) ?? [])
}

type Phase = "idle" | "loading" | "running" | "done" | "no-ollama"

export function LlmSuggestions() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [progress, setProgress] = useState("")
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set())
  const [note, setNote] = useState("")
  const ctl = useRef<AbortController | null>(null)
  const feed = useTelegramFeedStore((s) => s.rows)

  useEffect(() => {
    setDismissed(loadDismissed())
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
    try {
      await suggestWeek({
        snap,
        feed: rows,
        texts: texts ?? [],
        files: files ?? [],
        now: new Date(),
        habitDone,
        flow: loadLogFlow(),
        call: ollamaCall(model, abort.signal),
        models: plan,
        signal: abort.signal,
        getFlow: (id) => FLOWS.some((f) => f.id === id) ? flowDef(id as FlowId).build() : undefined,
        onSuggestions: setSuggestions,
        onProgress: (done, total, cached) => setProgress(total === 0 ? `ALL ${cached} MESSAGES ALREADY READ` : `${done}/${total} NEW MESSAGES · ${cached} ALREADY READ · ${model.toUpperCase()}`),
      })
      setPhase("done")
    } catch (err) {
      setProgress(abort.signal.aborted ? "STOPPED" : `FAILED: ${err instanceof Error ? err.message.toUpperCase() : String(err)}`)
      setPhase("done")
    }
  }, [feed])

  const stop = () => {
    ctl.current?.abort()
    setPhase("done")
    setProgress("STOPPED")
  }

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id)
    setDismissed(next)
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]))
    } catch {}
  }

  const accept = (s: Suggestion) => {
    const r = acceptSuggestion(s)
    setNote(`${r.ok ? "" : "NOT SAVED: "}${r.message}`)
    if (r.ok) setAccepted((a) => new Set(a).add(s.id))
  }

  const shown = useMemo(() => suggestions.filter((s) => !dismissed.has(s.id) && !accepted.has(s.id)), [suggestions, dismissed, accepted])
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
                <button data-no95 type="button" aria-label={`Dismiss ${s.title}`} onClick={() => dismiss(s.id)}>
                  DISMISS
                </button>
                {open === s.id ? (
                  <div className="bim-llm-why">
                    <p className="bim-crt-line bim-crt-dim">WHY: {s.why.toUpperCase()}</p>
                    {s.evidence.map((line, i) => (
                      <p key={i} className="bim-crt-line bim-crt-dim">
                        &gt; {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
