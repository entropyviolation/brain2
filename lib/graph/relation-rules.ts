/**
 * lib/graph/relation-rules.ts — Chain rules (LINKS_REDESIGN §6.3, L3.1).
 *
 * A rule names what follows from a chain of one to three relations:
 * `parent-of` ∘ `parent-of` ⇒ `grandparent-of`. Rules live in
 * `useItemTypeStore.relationRules`. They derive on read and never write a
 * link (invariant 7). Removing a rule touches no link.
 */
import type { RelationDef } from "@/lib/links"

export interface RelationRule {
  id: string
  label: string
  /** Body: relations from ?a to ?z, length 1–3. */
  chain: string[]
  /** Optional type guards per variable, a..z in chain order. */
  guards?: (string[] | undefined)[]
  /** Head relation between the first and last variable. */
  head: string
  /** Unless this relation already holds between them. */
  unless?: string
  enabled: boolean
  origin?: RelationDef["origin"]
  createdAt: string
}

export const RULE_CHAIN_MAX = 3

/** A reason the rule is refused, or null when it holds. */
export function validateRule(
  rule: Pick<RelationRule, "label" | "chain" | "head" | "unless">,
  getDef: (id: string) => Pick<RelationDef, "fromTypes" | "toTypes"> | undefined,
): string | null {
  if (!rule.label?.trim()) return "Name the rule."
  if (!Array.isArray(rule.chain) || rule.chain.length < 1) return "The chain needs one relation."
  if (rule.chain.length > RULE_CHAIN_MAX) return `A chain holds at most ${RULE_CHAIN_MAX} relations.`
  for (const id of [...rule.chain, rule.head, ...(rule.unless ? [rule.unless] : [])]) {
    if (!id || !getDef(id)) return `No relation called ${id || "(blank)"}.`
  }
  if (rule.chain.length === 1 && rule.chain[0] === rule.head) return "The head repeats the chain."
  const head = getDef(rule.head)!
  const first = getDef(rule.chain[0])!
  const last = getDef(rule.chain[rule.chain.length - 1])!
  if (!overlaps(head.fromTypes, first.fromTypes)) return "The head cannot start where the chain starts."
  if (!overlaps(head.toTypes, last.toTypes)) return "The head cannot end where the chain ends."
  return null
}

function overlaps(a?: string[], b?: string[]): boolean {
  if (!a?.length || !b?.length) return true
  return a.some((t) => b.includes(t))
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "rule"
}

export function makeRule(input: Omit<RelationRule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }, now = new Date()): RelationRule {
  return {
    ...input,
    id: `rule-${slug(input.label)}-${Math.random().toString(36).slice(2, 6)}`,
    enabled: input.enabled ?? true,
    origin: input.origin ?? "person",
    createdAt: now.toISOString(),
  }
}

/** Plain sentence for the editor and the proof card. */
export function ruleSentence(rule: Pick<RelationRule, "chain" | "head" | "unless">, label: (id: string) => string): string {
  const vars = "abcz"
  const v = (i: number) => `?${i === rule.chain.length ? "z" : vars[i]}`
  const body = rule.chain.map((r, i) => `${v(i)} ${label(r)} ${v(i + 1)}`).join(" and ")
  const unless = rule.unless ? `, unless ?a ${label(rule.unless)} ?z` : ""
  return `If ${body}, then ?a ${label(rule.head)} ?z${unless}.`
}

export function cleanRules(value: unknown): RelationRule[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (r): r is RelationRule =>
      !!r && typeof r === "object" && typeof r.id === "string" && Array.isArray(r.chain) && typeof r.head === "string",
  )
}
