/**
 * lib/idea-swarm/lenses.ts — The twelve readers and the default experiment
 *
 * Prompt diversity beats sampling diversity: twelve samples of one prompt mostly agree, twelve different questions about
 * the same pages do not. Each lens is one way to read. `defaultConfig` picks a weak model for the readers and the biggest
 * installed one for the writing steps, by the parameter count in the model's name.
 */

import { DEFAULT_EMBED_MODEL } from "./embed"
import type { Config, Knob, Lens } from "./types"

export const LENSES: Lens[] = [
  { id: "claims", label: "Claims", prompt: "The author's central claims and arguments, stated plainly.", on: true },
  { id: "terms", label: "Terms", prompt: "Technical terms and coined words, each with the meaning this author gives it.", on: true },
  { id: "objections", label: "Objections", prompt: "What a careful sceptic would doubt or find unclear. Name the idea being doubted.", on: true },
  { id: "examples", label: "Examples", prompt: "Concrete examples, images, metaphors and cases used, and the idea each one illustrates.", on: true },
  { id: "novelty", label: "What's new", prompt: "What here is new or surprising compared with common thinking.", on: true },
  { id: "contrasts", label: "Contrasts", prompt: "Distinctions and oppositions the author draws (this, not that).", on: true },
  { id: "topics", label: "Topics", prompt: "The topics discussed. name is the topic; gist is what the passage says about it.", on: true },
  { id: "insight", label: "Insight on topics", prompt: "For each main topic, the insight the passage gives onto it that its name alone would not tell you.", on: true },
  { id: "teach", label: "Teach a child", prompt: "The ideas worth remembering, put the way you would teach a curious child.", on: true },
  { id: "implications", label: "Implications", prompt: "What follows for how someone should live, think or act if the author is right.", on: true },
  { id: "assumptions", label: "Hidden assumptions", prompt: "Assumptions the author relies on without defending.", on: true },
  { id: "structure", label: "How it argues", prompt: "How the argument moves: what leads to what, the steps of the reasoning.", on: true },
]

export const SYNTH_PROMPT =
  "Several readers reported the ideas below independently, each through a different lens. Write ONE idea card for what they converge on: a short name, a two-to-three sentence plain elaboration that keeps the specific terms and examples more than one reader named, and a quote copied exactly from the passage. Add nothing the readers or the passage do not support."

export const LONE_PROMPT =
  "Each idea below was reported by only one reader and matched no one else's. Most are noise, restatements or small. Some are hidden gems: correct, specific, non-obvious, and really in the passage. Pick the gems (none is a fine answer), say in a sentence why each is one, and rewrite it cleanly."

export const INSIGHT_PROMPT =
  "Below are topics found by keyword analysis. For each topic the passage really discusses (skip the ones it does not), say what insight the passage gives onto it."

export const BASELINE_PROMPT = "Read the passage and give its most important ideas, the way a very good student would note them."

const sizeOf = (m: string) => Number(/(\d+(?:\.\d+)?)b\b/i.exec(m)?.[1] ?? NaN)

/** The smallest chat model, the largest, and the middle one (embedding models left out). */
export function pickModels(installed: string[]): { weak: string; mid: string; strong: string } {
  const chat = installed.filter((m) => !/embed/i.test(m))
  const ranked = [...chat].sort((a, b) => (sizeOf(a) || 99) - (sizeOf(b) || 99))
  const weak = ranked[0] ?? "qwen2.5:3b-instruct"
  const strong = ranked.at(-1) ?? weak
  return { weak, mid: ranked[Math.floor((ranked.length - 1) / 2)] ?? weak, strong }
}

const knob = (model: string, temperature: number, maxTokens: number): Knob => ({ model, temperature, maxTokens })

export function defaultConfig(installed: string[] = [], id = "default", name = "Twelve readers"): Config {
  const m = pickModels(installed)
  return {
    id,
    name,
    keyphrases: { on: true, methods: ["textrank", "yake", "rake"], top: 12, feed: false },
    topicInsight: { on: false, knob: knob(m.mid, 0.4, 700), prompt: INSIGHT_PROMPT },
    agents: { knob: knob(m.weak, 0.7, 500), lenses: LENSES.map((l) => ({ ...l })), perAgent: 4, samples: 1, parallel: 3 },
    embed: { model: DEFAULT_EMBED_MODEL },
    cluster: { threshold: 0.72, minSize: 2 },
    synth: { on: true, knob: knob(m.strong, 0.3, 450), prompt: SYNTH_PROMPT },
    lone: { on: false, knob: knob(m.strong, 0.6, 800), prompt: LONE_PROMPT, groundedOnly: true },
    baseline: { on: true, knob: knob(m.strong, 0.2, 900), prompt: BASELINE_PROMPT },
  }
}

/** Why each temperature starts where it does; shown beside the knob. */
export const TEMPERATURE_ADVICE: Record<string, string> = {
  agents: "0.6 to 0.9. The readers are many weak guesses; spread between them is what clustering feeds on. Too low and identical lenses repeat each other, too high and they drift off the page.",
  topicInsight: "0.3 to 0.5. Grounded explanation of known topics; little to gain from variety.",
  synth: "0.2 to 0.4. It should fuse what the readers said, not invent. Raise only to see whether wording improves.",
  lone: "0.5 to 0.8. Hunting for something others missed is the one place a bolder reading helps.",
  baseline: "0.1 to 0.3. The fair single-call comparison: one careful read.",
}
