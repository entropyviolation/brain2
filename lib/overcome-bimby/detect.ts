/**
 * lib/overcome-bimby/detect.ts — Is this chat line someone who cannot start? (pure, no model)
 *
 * Strong phrases ("can't make myself", "so much resistance") are a hit alone. A weaker avoidance word needs a task shape
 * too ("I have to … but"). Questions and commands are never hits. The chat lane in `lib/ingest/bim-resistance.ts` calls this
 * first, so ordinary lines cost nothing.
 */

export interface Detection {
  hit: boolean
  /** 0 none, 1 weak signs, 2 sure. */
  score: 0 | 1 | 2
  /** The phrases that matched, for the route chip. */
  signs: string[]
}

const STRONG: [string, RegExp][] = [
  ["resistance", /\b(resistance|resisting)\b/i],
  ["can't start", /\b(can'?t|cannot|can not|unable to|won'?t) (seem to )?(make myself|get myself|force myself|bring myself|start|begin|get started|get going|get to)\b/i],
  ["putting off", /\b(keep|kept|been) (putting off|avoiding|pushing off|procrastinating|delaying)\b/i],
  ["procrastinating", /\bprocrastinat(e|ing|ion)\b/i],
  ["avoiding", /\b(avoiding|dreading|dread)\b/i],
  ["executive dysfunction", /\bexecutive (dys)?function\b/i],
  ["stuck", /\b(i'?m|im|i am|am|feel|feeling|still|so|totally|completely|just) stuck\b/i],
  ["frozen", /\b(frozen|paralyzed|paralysed|stuck) (on|with|about)\b/i],
]
const WEAK: [string, RegExp][] = [
  ["overdue", /\b(overdue|was due|due (a|last|\d+) (week|month|day)s?|(a|\d+) (week|month|day)s? (ago|late|overdue))\b/i],
  ["have to", /\b(i )?(really |just )?(have|need|got|gotta|should|must) (to )?\w+/i],
  ["but", /\bbut\b/i],
  ["don't want", /\b(don'?t|do not) (want|feel like)\b/i],
]

export function detectResistance(text: string): Detection {
  const t = text.trim()
  if (!t || t.length > 400 || t.includes("\n")) return { hit: false, score: 0, signs: [] }
  // A question or a command is not someone avoiding a task.
  if (/\?\s*$/.test(t) || /^(log|intake|dh|ask|tell|remind|add|make|create)\b[: ]/i.test(t)) return { hit: false, score: 0, signs: [] }
  const strong = STRONG.filter(([, re]) => re.test(t)).map(([k]) => k)
  if (strong.length) return { hit: true, score: 2, signs: strong }
  const weak = WEAK.filter(([, re]) => re.test(t)).map(([k]) => k)
  // "have to" + "but" + lateness together read as stuck; "have to" alone is a plain to-do.
  const stuck = weak.includes("have to") && weak.includes("but") && (weak.includes("overdue") || weak.includes("don't want"))
  return stuck ? { hit: true, score: 1, signs: weak } : { hit: false, score: 0, signs: weak }
}
