/**
 * lib/graph/path-sentence.ts — One sentence for a relation path.
 *
 * Templates only. No model. A forward step reads `phrases.forward`; an
 * incoming step reads `phrases.inverse`. Missing phrases fall back to the
 * def's label, then `relationLabel`.
 */
import { relationLabel } from "@/lib/links"

export interface PathSentenceStep {
  relation: string
  to: string
  /** `out` reads the forward phrase. `in` reads the inverse phrase. Absent means out. */
  direction?: "out" | "in"
}

export interface PathSentenceDef {
  id: string
  label?: string
  phrases?: { forward?: readonly string[]; inverse?: readonly string[] }
}

function firstPhrase(phrases: readonly string[] | undefined): string {
  for (const phrase of phrases ?? []) {
    const trimmed = phrase.trim()
    if (trimmed) return trimmed
  }
  return ""
}

function phraseFor(step: PathSentenceStep, defs: readonly PathSentenceDef[]): string {
  const def = defs.find((row) => row.id === step.relation)
  const spoken = firstPhrase(step.direction === "in" ? def?.phrases?.inverse : def?.phrases?.forward)
  if (spoken) return spoken
  const label = def?.label?.trim()
  if (label) return label
  return relationLabel(step.relation)
}

function clause(phrase: string, subject: string, object: string): string {
  const filled = phrase.includes("$s") || phrase.includes("$o")
    ? phrase.replaceAll("$s", subject).replaceAll("$o", object)
    : `${subject} ${phrase} ${object}`
  return filled.replace(/\s+/g, " ").trim().replace(/[.]+$/, "")
}

/** One sentence from `fromId` along `steps`. Null when there are no steps. */
export function pathSentence(
  fromId: string,
  steps: readonly PathSentenceStep[],
  title: (id: string) => string,
  defs: readonly PathSentenceDef[],
): string | null {
  if (!fromId || !steps.length) return null
  let at = fromId
  const parts: string[] = []
  for (const step of steps) {
    if (!step?.to || !step.relation) continue
    parts.push(clause(phraseFor(step, defs), title(at), title(step.to)))
    at = step.to
  }
  if (!parts.length) return null
  return `${parts.join("; ")}.`
}
