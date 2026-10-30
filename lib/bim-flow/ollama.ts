/**
 * lib/bim-flow/ollama.ts — Structured calls to the local Ollama daemon
 *
 * `127.0.0.1:11434` only. Every call sends a JSON schema in `format`, so the
 * model can only answer in that shape. Arrays carry `maxItems`: a small model
 * under a grammar will otherwise repeat items until it runs out of tokens.
 * `num_ctx` stays fixed, because a new value reloads the model (about 25s).
 */

import { archive } from "./archive"

export const OLLAMA_URL = "http://127.0.0.1:11434"
export const DEFAULT_MODEL = "qwen2.5:14b-instruct"
const NUM_CTX = 4096

export type ModelCall = (req: {
  /** An Ollama model for this call alone; omitted = the model the call was bound to. */
  model?: string
  system: string
  user: string
  schema: Record<string, unknown>
  maxTokens?: number
}) => Promise<unknown>

const cache = new Map<string, unknown>()

/** A `ModelCall` bound to one Ollama model. Identical prompts are answered from memory, unless `fresh` (a test run: real timings, every call archived). */
export function ollamaCall(bound: string, signal?: AbortSignal, opts: { fresh?: boolean } = {}): ModelCall {
  return async ({ model: only, system, user, schema, maxTokens = 200 }) => {
    const model = only || bound
    const key = JSON.stringify([model, system, user, schema])
    if (!opts.fresh && cache.has(key)) return cache.get(key)
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        keep_alive: "15m",
        options: { temperature: 0, num_ctx: NUM_CTX, num_predict: maxTokens },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}`)
    const body = (await res.json()) as { message?: { content?: string } }
    const parsed: unknown = JSON.parse(body.message?.content ?? "")
    cache.set(key, parsed)
    archive("model-call", { model, system, user, schema, maxTokens, output: parsed })
    return parsed
  }
}

/** Installed model names, or `null` when the daemon does not answer. */
export async function listOllamaModels(): Promise<string[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
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
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: batch.map((t) => t.slice(0, 400)) }),
      })
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
