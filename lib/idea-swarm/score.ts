/**
 * lib/idea-swarm/score.ts — How close each node's output lands to the player's gold answers
 *
 * A gold set has one or more acceptable *versions*, each answered step by step (key phrases, insights on topics, ideas,
 * hidden gems). A node's output is a list of short texts. Both sides are embedded and compared:
 *   - **coverage**: for each gold item, its best match among the outputs (did the node find what you wanted?), averaged;
 *   - **precision**: for each output, its best match among the gold items (is the node's list worth reading?), averaged;
 *   - **f**: their harmonic mean.
 * With several versions the best-scoring version counts. It is a rough measure, because embedding similarity rewards
 * sharing topic words and cannot tell a correct claim from a wrong one; use it to rank setups, then read the output.
 */

import type { Embedder } from "./embed"
import type { Gold, GoldVersion, Run } from "./types"
import { cosine } from "./vec"

export type Score = {
  coverage: number
  precision: number
  f: number
  n: number
  gold: number
  version: string
  /** Best similarity of each gold item to any output, and of each output to any gold item. Cut them at any cutoff with `hits`. */
  bests: number[]
  outBests: number[]
}

/** How many gold items an output list covers, and how many of its items are close to something wanted, at a similarity cutoff. */
export const hits = (s: Score, cutoff: number) => ({ covered: s.bests.filter((b) => b >= cutoff).length, useful: s.outBests.filter((b) => b >= cutoff).length })

/** Which gold field a target is judged against. */
export type GoldField = keyof Pick<GoldVersion, "keyphrases" | "insights" | "ideas" | "gems">

export type Target = { key: string; label: string; field: GoldField; texts: string[]; stage: string }

/** Every output of a run that can be scored, in pipeline order. */
export function targetsOf(run: Run): Target[] {
  const out: Target[] = []
  const kp = run.stages.keyphrases?.items ?? []
  for (const m of [...new Set(kp.map((i) => i.method!))]) out.push({ key: `keyphrases:${m}`, label: `Key phrases · ${m}`, field: "keyphrases", texts: kp.filter((i) => i.method === m).map((i) => i.text), stage: "keyphrases" })
  const ti = run.stages.topicInsight?.items ?? []
  if (ti.length) out.push({ key: "topicInsight", label: "Insight on topics", field: "insights", texts: ti.map((i) => i.text), stage: "topicInsight" })
  const ag = run.stages.agents?.items ?? []
  if (ag.length) {
    out.push({ key: "agents:all", label: "All readers, pooled", field: "ideas", texts: ag.map((i) => i.text), stage: "agents" })
    for (const lens of [...new Set(ag.map((i) => i.lens!))]) out.push({ key: `agents:${lens}`, label: `Reader · ${run.config.agents.lenses.find((l) => l.id === lens)?.label ?? lens}`, field: "ideas", texts: ag.filter((i) => i.lens === lens).map((i) => i.text), stage: "agents" })
  }
  const cl = run.stages.cluster?.items ?? []
  if (cl.length) out.push({ key: "cluster:medoids", label: "Cluster medoids (nearest real answer)", field: "ideas", texts: cl.map((i) => i.text), stage: "cluster" })
  const sy = run.stages.synth?.items ?? []
  if (sy.length) out.push({ key: "synth", label: "Strong-model cluster cards", field: "ideas", texts: sy.map((i) => i.text), stage: "synth" })
  const gm = run.stages.lone?.items ?? []
  if (gm.length) out.push({ key: "lone", label: "Hidden gems", field: "gems", texts: gm.map((i) => i.text), stage: "lone" })
  if (sy.length || gm.length) out.push({ key: "final", label: "Swarm result (cards + gems)", field: "ideas", texts: [...sy, ...gm].map((i) => i.text), stage: "synth" })
  const bl = run.stages.baseline?.items ?? []
  if (bl.length) out.push({ key: "baseline", label: "Single careful call", field: "ideas", texts: bl.map((i) => i.text), stage: "baseline" })
  return out
}

export async function scoreTexts(embed: Embedder, outputs: string[], gold: GoldVersion[], field: GoldField): Promise<Score | null> {
  const versions = gold.filter((v) => v[field].some((x) => x.trim()))
  if (!outputs.length || !versions.length) return null
  const all = [...new Set([...outputs, ...versions.flatMap((v) => v[field].filter((x) => x.trim()))])]
  const vecs = await embed(all)
  const vec = new Map(all.map((t, i) => [t, vecs[i]!]))
  let best: Score | null = null
  for (const v of versions) {
    const g = v[field].filter((x) => x.trim())
    const bests = g.map((x) => Math.max(...outputs.map((o) => cosine(vec.get(x)!, vec.get(o)!))))
    const outBests = outputs.map((o) => Math.max(...g.map((x) => cosine(vec.get(o)!, vec.get(x)!))))
    const cov = bests.reduce((a, b) => a + b, 0) / g.length
    const pre = outBests.reduce((a, b) => a + b, 0) / outputs.length
    const f = cov + pre ? (2 * cov * pre) / (cov + pre) : 0
    if (!best || f > best.f) best = { coverage: cov, precision: pre, f, n: outputs.length, gold: g.length, version: v.label, bests, outBests }
  }
  return best
}

export async function scoreRun(run: Run, gold: Gold | null, embed: Embedder): Promise<Record<string, Score | null>> {
  const out: Record<string, Score | null> = {}
  if (!gold) return out
  for (const t of targetsOf(run)) out[t.key] = await scoreTexts(embed, t.texts, gold.versions, t.field)
  return out
}

/** A starting gold version from a run's own output, so the player edits instead of writing from nothing. */
export function goldFromRun(run: Run, label: string): GoldVersion {
  const t = new Map(targetsOf(run).map((x) => [x.key, x.texts]))
  return {
    id: `v${Date.now().toString(36)}`,
    label,
    keyphrases: (t.get(`keyphrases:${run.config.keyphrases.methods[0]}`) ?? []).slice(0, 10),
    insights: t.get("topicInsight") ?? [],
    ideas: t.get("synth") ?? t.get("cluster:medoids") ?? t.get("baseline") ?? [],
    gems: t.get("lone") ?? [],
  }
}
