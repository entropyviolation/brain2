/**
 * components/ItemDetail/links/relation-phrase.ts — A first guess at the
 * reverse of a new relation phrase, for `NewRelationForm`. Always editable.
 *
 * - "is a member of" / "is the coach of" / "is part of" → "has member" …
 * - "… with" (is roommates with) → the same phrase, both ways.
 * - "has member" → "is a member of".
 * - one verb ("coaches", "employs") → "is coached by", "is employed by".
 * - anything else → "" (the person types it).
 */
export interface ReverseGuess {
  inverseLabel: string
  symmetric: boolean
}

function pastParticiple(verb: string): string {
  let stem = verb
  if (/(ch|sh|ss|x|z)es$/.test(stem)) stem = stem.slice(0, -2)
  else if (stem.endsWith("ies")) stem = `${stem.slice(0, -3)}y`
  else if (stem.endsWith("s")) stem = stem.slice(0, -1)
  if (stem.endsWith("e")) return `${stem}d`
  if (stem.endsWith("y") && !/[aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ied`
  return `${stem}ed`
}

export function guessReversePhrase(raw: string): ReverseGuess {
  const label = raw.trim().replace(/\s+/g, " ").toLowerCase()
  if (!label) return { inverseLabel: "", symmetric: false }
  if (/ with$/.test(label)) return { inverseLabel: label, symmetric: true }
  const of = /^is (?:(a|an|the) )?(.+) of$/.exec(label)
  if (of) return { inverseLabel: `has ${of[2]}`, symmetric: false }
  const has = /^has (.+)$/.exec(label)
  if (has) {
    const noun = has[1]
    const article = /^[aeiou]/.test(noun) ? "an" : "a"
    return { inverseLabel: `is ${article} ${noun} of`, symmetric: false }
  }
  if (/^[a-z]+s$/.test(label)) return { inverseLabel: `is ${pastParticiple(label)} by`, symmetric: false }
  return { inverseLabel: "", symmetric: false }
}
