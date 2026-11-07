/**
 * lib/idea-swarm/embed.ts — Text to vectors through the local Ollama daemon
 *
 * `/api/embed` on the same endpoint the chat calls use (the Mac's daemon, or the hub's proxy on the phone).
 * Results are cached per model and text for this page's life, so re-scoring a gold set costs nothing.
 */

import { modelEndpoint } from "@/lib/bim-flow/ollama"
import type { Vec } from "./vec"

export type Embedder = (texts: string[]) => Promise<Vec[]>
export const DEFAULT_EMBED_MODEL = "nomic-embed-text"

const cache = new Map<string, Vec>()

export function ollamaEmbedder(model = DEFAULT_EMBED_MODEL, signal?: AbortSignal): Embedder {
  return async (texts) => {
    const missing = [...new Set(texts.filter((t) => !cache.has(`${model}\n${t}`)))]
    for (let i = 0; i < missing.length; i += 32) {
      const batch = missing.slice(i, i + 32)
      const ep = modelEndpoint()
      const res = await fetch(`${ep.base}/api/embed`, { method: "POST", signal, headers: { "Content-Type": "application/json", ...ep.headers }, body: JSON.stringify({ model, input: batch.map((t) => t.slice(0, 2000)) }) })
      if (!res.ok) throw new Error(`Embedding ${res.status}: is ${model} installed? (ollama pull ${model})`)
      const body = (await res.json()) as { embeddings?: Vec[] }
      if (!body.embeddings || body.embeddings.length !== batch.length) throw new Error("The embedding model gave no vectors")
      batch.forEach((t, k) => cache.set(`${model}\n${t}`, body.embeddings![k]!))
    }
    return texts.map((t) => cache.get(`${model}\n${t}`)!)
  }
}
