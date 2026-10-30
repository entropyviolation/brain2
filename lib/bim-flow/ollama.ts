/**
 * lib/bim-flow/ollama.ts — Structured calls to the local Ollama daemon
 *
 * `127.0.0.1:11434` only. Every call sends a JSON schema in `format`, so the
 * model can only answer in that shape. Arrays carry `maxItems`: a small model
 * under a grammar will otherwise repeat items until it runs out of tokens.
 * `num_ctx` stays fixed, because a new value reloads the model (about 25s).
 */

export const OLLAMA_URL = "http://127.0.0.1:11434"
export const DEFAULT_MODEL = "qwen2.5:14b-instruct"
const NUM_CTX = 4096

export type ModelCall = (req: {
  system: string
  user: string
  schema: Record<string, unknown>
  maxTokens?: number
}) => Promise<unknown>

const cache = new Map<string, unknown>()

/** A `ModelCall` bound to one Ollama model. Identical prompts are answered from memory. */
export function ollamaCall(model: string, signal?: AbortSignal): ModelCall {
  return async ({ system, user, schema, maxTokens = 200 }) => {
    const key = JSON.stringify([model, system, user, schema])
    if (cache.has(key)) return cache.get(key)
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
