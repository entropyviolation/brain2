/**
 * lib/bim-flow/ollama.ts — Structured calls to the local Ollama daemon
 *
 * `127.0.0.1:11434` only. Every call sends a JSON schema in `format`, so the
 * model can only answer in that shape. Arrays carry `maxItems`: a small model
 * under a grammar will otherwise repeat items until it runs out of tokens.
 * `num_ctx` stays fixed, because a new value reloads the model (about 25s).
 *
 * Every request goes through `modelFetch`: a time cap per try, retries on a
 * refused connection or a 5xx, and a circuit breaker. After `BREAK_AFTER` calls
 * in a row fail, the breaker opens for `COOL_MS` and every call throws
 * `ModelDownError` at once. `chatCrew()` then answers null, so BIM chat runs in
 * ROUTER mode (the grammar ladder) until one trial call gets through.
 */

import { archive } from "./archive"

export const OLLAMA_URL = "http://127.0.0.1:11434"

/**
 * Where model calls go. The Mac asks its own daemon. The iPhone app has no
 * daemon, so BIM chat points this at the Mac's `/api/ollama` proxy
 * (`scripts/persist-api.mjs`) with the hub token (`lib/bim-flow/chat-models.ts`).
 */
export interface ModelEndpoint {
  base: string
  headers?: Record<string, string>
}

let endpoint: ModelEndpoint = { base: OLLAMA_URL }

export function setModelEndpoint(next: ModelEndpoint | null): void {
  endpoint = next ?? { base: OLLAMA_URL }
}
/** Where calls go now (the Mac's daemon, or the hub's proxy on the phone). */
export const modelEndpoint = (): ModelEndpoint => endpoint

// ---------------------------------------------------------------- resilience

/** One try's cap when the caller sets none. A cold 30B load is about 25s; a long answer on it can take a minute more. */
export const CALL_TIMEOUT_MS = 120_000
/** Retries after the first try, for a refused connection, a 5xx or a 429. A timeout is not retried: the daemon is busy. */
export const RETRIES = 2
const BACKOFF_MS = 250
/** Failed calls in a row that open the breaker. */
export const BREAK_AFTER = 3
/** How long the breaker stays open before one trial call is let through. */
export const COOL_MS = 30_000

/** Thrown at once while the breaker is open: the local models are treated as down. */
export class ModelDownError extends Error {
  constructor(public readonly until: number) {
    super(`local models down (retry after ${new Date(until).toLocaleTimeString()})`)
    this.name = "ModelDownError"
  }
}

const circuit = { fails: 0, openUntil: 0, trial: false, lastError: "" }

/** True while the breaker is open. Once `COOL_MS` has passed it is false again, and the next call is the trial. */
export const modelDown = (now = Date.now()): boolean => circuit.openUntil > now

/** The breaker as plain data, for a status chip or a test. */
export function circuitState(now = Date.now()): { state: "closed" | "open" | "half-open"; fails: number; openUntil: number; lastError: string } {
  const state = circuit.openUntil > now ? "open" : circuit.openUntil ? "half-open" : "closed"
  return { state, fails: circuit.fails, openUntil: circuit.openUntil, lastError: circuit.lastError }
}

export function resetCircuit(): void {
  Object.assign(circuit, { fails: 0, openUntil: 0, trial: false, lastError: "" })
}

function succeeded(): void {
  Object.assign(circuit, { fails: 0, openUntil: 0, trial: false })
}

function failed(why: string, now = Date.now()): void {
  circuit.lastError = why.slice(0, 120)
  circuit.fails += 1
  // A failed trial reopens at once; a closed breaker opens on the `BREAK_AFTER`th failure in a row.
  if (circuit.trial || circuit.fails >= BREAK_AFTER) circuit.openUntil = now + COOL_MS
  circuit.trial = false
}

const isTimeout = (e: unknown) => e instanceof Error && e.name === "TimeoutError"
const reasonOf = (signal?: AbortSignal) => (signal?.aborted ? signal.reason : undefined)

/** Both signals in one: aborted when either is. */
function either(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b
  if (typeof AbortSignal.any === "function") return AbortSignal.any([a, b])
  const c = new AbortController()
  const stop = (s: AbortSignal) => () => c.abort(s.reason)
  if (a.aborted) c.abort(a.reason)
  else if (b.aborted) c.abort(b.reason)
  else {
    a.addEventListener("abort", stop(a), { once: true })
    b.addEventListener("abort", stop(b), { once: true })
  }
  return c.signal
}

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done, fail) => {
    if (signal?.aborted) return fail(signal.reason)
    const t = setTimeout(done, ms)
    signal?.addEventListener("abort", () => (clearTimeout(t), fail(signal.reason)), { once: true })
  })

/**
 * `fetch` to the model daemon, with the cap, the retries and the breaker. A caller's own abort (a person
 * cancelling) is passed on and never counts against the daemon; a caller's timeout does. A 4xx is the
 * request's fault, not the daemon's: it is returned as is and counts as an answer.
 */
export async function modelFetch(url: string, init: RequestInit & { signal?: AbortSignal }, opts: { timeoutMs?: number; retries?: number } = {}): Promise<Response> {
  const now = Date.now()
  if (modelDown(now)) throw new ModelDownError(circuit.openUntil)
  if (circuit.openUntil) circuit.trial = true
  const { timeoutMs = CALL_TIMEOUT_MS, retries = circuit.trial ? 0 : RETRIES } = opts
  const caller = init.signal ?? undefined
  let why = ""
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) {
      try {
        await pause(BACKOFF_MS * 2 ** (attempt - 1), caller)
      } catch (e) {
        throw e
      }
    }
    try {
      const res = await fetch(url, { ...init, signal: either(caller, AbortSignal.timeout(timeoutMs)) })
      if (res.status >= 500 || res.status === 429) {
        why = `Ollama ${res.status}`
        continue
      }
      succeeded()
      return res
    } catch (error) {
      const callerReason = reasonOf(caller)
      if (callerReason !== undefined && !isTimeout(callerReason)) throw error // cancelled by a person: not the daemon's fault
      why = isTimeout(callerReason) || isTimeout(error) || isTimeout(reasonOf(AbortSignal.timeout(0))) ? "timed out" : error instanceof Error ? error.message : String(error)
      if (/timed out|timeout/i.test(why) || callerReason !== undefined) {
        why = "timed out"
        break
      }
    }
  }
  failed(why)
  throw new Error(`Ollama ${why}`)
}

export const DEFAULT_MODEL = "qwen2.5:14b-instruct"
const NUM_CTX = 4096

export type ModelCall = (req: {
  /** An Ollama model for this call alone; omitted = the model the call was bound to. */
  model?: string
  system: string
  user: string
  schema: Record<string, unknown>
  maxTokens?: number
  /** Default 0 (same prompt, same answer). Conversation raises it so two reads of a book do not sound alike. */
  temperature?: number
}) => Promise<unknown>

const cache = new Map<string, unknown>()

/**
 * One finished (or failed) model call, as seen by `ollamaCall`. `loadMs`, `promptMs` and `evalMs` are Ollama's own
 * `load_duration`, `prompt_eval_duration` and `eval_duration`: a large `loadMs` means the model was cold or swapped
 * in. A cached answer has `cached: true` and no daemon time. Used by the BIM chat Trace and the scorecard.
 */
export interface ModelCallSeen {
  model: string
  /** The first words of the system prompt: which job asked. */
  task: string
  startedAt: number
  ms: number
  ok: boolean
  cached?: boolean
  error?: string
  loadMs?: number
  promptMs?: number
  evalMs?: number
  /** The prompt and the reply, for the turn's Trace (the Thought popup). Clipped where they are kept. */
  system?: string
  user?: string
  output?: unknown
}

const watchers = new Set<(call: ModelCallSeen) => void>()

/** Hear every model call made through `ollamaCall`, until the returned function is called. A throwing watcher is ignored. */
export function watchModelCalls(fn: (call: ModelCallSeen) => void): () => void {
  watchers.add(fn)
  return () => void watchers.delete(fn)
}

function tell(call: ModelCallSeen): void {
  for (const fn of watchers)
    try {
      fn(call)
    } catch {}
}

/**
 * How long Ollama keeps a model loaded after a call. The 3B router stays for good (-1): it is 2 GB and every chat
 * turn asks it first, so a reload there is pure wait. Everything else stays 15 minutes.
 */
export function keepAliveFor(model: string): string | number {
  return /:3b\b|3b-instruct/.test(model) ? -1 : "15m"
}

const nsToMs = (ns: unknown) => (typeof ns === "number" && ns > 0 ? Math.round(ns / 1e6) : undefined)
const taskOf = (system: string) => system.replace(/\s+/g, " ").trim().slice(0, 60)

/** A `ModelCall` bound to one Ollama model. Identical prompts are answered from memory, unless `fresh` (a test run: real timings, every call archived). */
export function ollamaCall(bound: string, signal?: AbortSignal, opts: { fresh?: boolean } = {}): ModelCall {
  return async ({ model: only, system, user, schema, maxTokens = 200, temperature = 0 }) => {
    const model = only || bound
    const key = JSON.stringify([model, system, user, schema, temperature])
    const startedAt = Date.now()
    if (!opts.fresh && cache.has(key)) {
      tell({ model, task: taskOf(system), startedAt, ms: 0, ok: true, cached: true, system, user, output: cache.get(key) })
      return cache.get(key)
    }
    try {
      const { parsed, times } = await askOllama(model, system, user, schema, maxTokens, temperature, signal)
      cache.set(key, parsed)
      const ms = Date.now() - startedAt
      tell({ model, task: taskOf(system), startedAt, ms, ok: true, ...times, system, user, output: parsed })
      archive("model-call", { model, system, user, schema, maxTokens, output: parsed, ms, ...times })
      return parsed
    } catch (error) {
      tell({ model, task: taskOf(system), startedAt, ms: Date.now() - startedAt, ok: false, error: error instanceof Error ? error.message : String(error), system, user })
      throw error
    }
  }
}

async function askOllama(
  model: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  maxTokens: number,
  temperature: number,
  signal?: AbortSignal,
): Promise<{ parsed: unknown; times: Pick<ModelCallSeen, "loadMs" | "promptMs" | "evalMs"> }> {
  const res = await modelFetch(`${endpoint.base}/api/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...endpoint.headers },
    body: JSON.stringify({
      model,
      stream: false,
      format: schema,
      // qwen3 thinks by default and spends `num_predict` on it, leaving `content` empty. Others ignore the flag.
      think: false,
      keep_alive: keepAliveFor(model),
      options: { temperature, num_ctx: NUM_CTX, num_predict: maxTokens },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const body = (await res.json()) as { message?: { content?: string }; done_reason?: string; load_duration?: number; prompt_eval_duration?: number; eval_duration?: number }
  const times = { loadMs: nsToMs(body.load_duration), promptMs: nsToMs(body.prompt_eval_duration), evalMs: nsToMs(body.eval_duration) }
  const content = body.message?.content?.trim() ?? ""
  if (!content) throw new Error(`${model} gave no JSON${body.done_reason === "length" ? " (hit the token cap)" : ""}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`${model} gave cut-off JSON${body.done_reason === "length" ? " (hit the token cap)" : ""}`)
  }
  return { parsed, times }
}

/** Installed model names, or `null` when the daemon does not answer. */
export async function listOllamaModels(): Promise<string[] | null> {
  try {
    const res = await modelFetch(`${endpoint.base}/api/tags`, { headers: endpoint.headers }, { timeoutMs: 5000, retries: 0 })
    if (!res.ok) return null
    const body = (await res.json()) as { models?: { name: string }[] }
    return (body.models ?? []).map((m) => m.name)
  } catch {
    return null
  }
}

export const EMBED_MODEL = "nomic-embed-text"
const vectors = new Map<string, number[]>()

/**
 * Cosine scores of `texts` against `query`, or null when the embedding model
 * is not installed or the daemon does not answer. Never pulls a model.
 */
export async function embedScores(query: string, texts: string[], signal?: AbortSignal): Promise<number[] | null> {
  try {
    const need = [query, ...texts].filter((t, i, a) => !vectors.has(t) && a.indexOf(t) === i)
    for (let i = 0; i < need.length; i += 64) {
      const batch = need.slice(i, i + 64)
      const res = await modelFetch(
        `${OLLAMA_URL}/api/embed`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: EMBED_MODEL, input: batch.map((t) => t.slice(0, 400)) }),
        },
        { timeoutMs: 60_000 },
      )
      if (!res.ok) return null
      const body = (await res.json()) as { embeddings?: number[][] }
      batch.forEach((t, j) => body.embeddings?.[j] && vectors.set(t, body.embeddings[j]!))
    }
    const q = vectors.get(query)
    if (!q) return null
    const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
    const qn = norm(q)
    return texts.map((t) => {
      const v = vectors.get(t)
      return v ? v.reduce((a, x, i) => a + x * q[i]!, 0) / (norm(v) * qn) : 0
    })
  } catch {
    return null
  }
}
