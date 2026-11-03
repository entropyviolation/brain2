/**
 * lib/bim-flow/label-model.ts — A model that answers from the hand labels
 *
 * Runs a flow as if every model step were right, so what is left wrong is code:
 * search that never offered the right pen or list, a lane wired to the wrong
 * place, a block placed at the wrong time. The same labels score a real model in
 * `real-feed.live.test.ts`; the gap between the two runs is the model's share.
 *
 * It reads the message out of the prompt (`MESSAGE sent … HH:MM: text`), finds
 * its label, and answers each request by its schema: a route by its keys, a PICK
 * from its options only, a PULL from the label. Anything it has no label for gets
 * the safe answer (no, none, empty), as `scriptedModel` does.
 */

import type { ModelCall } from "./ollama"
import type { RealLine, RealPair, RealWant } from "./real-feed"

type Req = Parameters<ModelCall>[0]
const props = (r: Req) => Object.keys(((r.schema as { properties?: Record<string, unknown> }).properties ?? {}) as object)
const enumOf = (r: Req, key: string): string[] => {
  const p = (r.schema as { properties?: Record<string, { items?: { enum?: string[] }; enum?: string[] }> }).properties?.[key]
  return p?.items?.enum ?? p?.enum ?? []
}
const maxOf = (r: Req, key: string): number => ((r.schema as { properties?: Record<string, { maxItems?: number }> }).properties?.[key]?.maxItems ?? 1)

/** The message a prompt is about: the text after "MESSAGE sent … HH:MM: ". */
export function promptMessage(user: string): string | undefined {
  const m = /MESSAGE sent [^\n]*?\d{1,2}:\d{2}: ([\s\S]*)$/.exec(user)
  return m?.[1]?.trim()
}

/** Which route a label takes, by the route's own keys. */
function routeFor(keys: string[], w: RealWant): string | undefined {
  if (keys.includes("doing") && keys.includes("keeping")) return w.family === "none" ? undefined : w.family
  if (keys.includes("habit") && keys.includes("place")) return w.habit?.length ? "habit" : w.place ? "place" : undefined
  if (keys.includes("intake") && keys.includes("dream")) return w.self
  if (keys.includes("person") && keys.includes("with")) return w.people?.length ? "person" : undefined
  return undefined
}

export interface LabelModel {
  call: ModelCall
  /** Messages the model was asked about that had no label. */
  unlabelled: Set<string>
}

export function labelModel(lines: RealLine[], pairs: RealPair[] = []): LabelModel {
  const byText = new Map(lines.map((l) => [l.text.trim(), l.want]))
  const unlabelled = new Set<string>()
  const call: ModelCall = async (req) => {
    const p = props(req)
    // The context check: "EARLIER (hh:mm): … / MESSAGE (hh:mm): …".
    const pair = /EARLIER \(\d\d:\d\d\): ([\s\S]*?)\nMESSAGE \(\d\d:\d\d\): ([\s\S]*)$/.exec(req.user)
    if (pair) {
      const hit = pairs.find((x) => x.earlier.trim() === pair[1]!.trim() && x.text.trim() === pair[2]!.trim())
      return { answer: hit?.linked ? "yes" : "no" }
    }
    const text = promptMessage(req.user)
    const w = text ? byText.get(text) : undefined
    if (!w) {
      if (text) unlabelled.add(text)
      if (p.includes("answer")) return { answer: "no" }
      if (p.includes("picks")) return { picks: [] }
      if (p.includes("routes")) return { routes: [] }
      return {}
    }
    if (p.includes("routes")) {
      const r = routeFor(enumOf(req, "routes"), w)
      return { routes: r ? [r] : [] }
    }
    if (p.includes("picks")) {
      const want = [w.act?.[0], w.keep, w.place, ...(w.habit ?? []), ...(w.people ?? [])].filter(Boolean).map((s) => s!.toLowerCase())
      const picks = enumOf(req, "picks").filter((o) => want.includes(o.toLowerCase()))
      return { picks: picks.slice(0, maxOf(req, "picks")) }
    }
    if (p.includes("relation")) return { relation: w.act?.[1] ?? "", since: w.act?.[2] ?? "", minutes_left: w.act?.[3] ?? 0 }
    if (p.includes("class") && p.includes("what")) return { what: w.self === "intake" ? text : "", class: w.self === "intake" ? "drug" : "", count: 0 }
    if (p.includes("valence")) return { words: w.self === "mood" ? "feeling" : "", valence: w.self === "mood" ? "meh" : "" }
    if (p.includes("answer")) return { answer: "no" }
    return {}
  }
  return { call, unlabelled }
}
