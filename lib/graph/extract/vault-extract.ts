/**
 * lib/graph/extract/vault-extract.ts — One pass over the vault's text that
 * turns written relations into inbox proposals (KG-N3, KG-N2, KG-N9). Pure.
 *
 * Sources: relation sentences (`extract:relation-word`), wiki links
 * (`extract:wiki-link`), and, only with `days: true`, explicit dates
 * (`extract:date`, relation `mentioned`, target a `day:` address). Rows are
 * `open` link proposals with a reason that quotes the words and an evidence
 * span. Deduped across the vault (A blocks B and B blocked-by A are one row);
 * links that already exist and dismissed suggestions are skipped. A UI hands
 * the rows to `useGraphInboxStore.addProposals`; the person accepts each one.
 */
import { edgeKey } from "@/lib/link-graph"
import type { RelationDef } from "@/lib/links"
import type { GraphProposal } from "@/lib/graph/proposal-schema"
import { sentenceAt, textsOf, whereOf } from "@/lib/graph/densify/mention"
import { buildPhraseTable, buildTitleIndex, extractRelationSentences } from "@/lib/graph/extract/relation-phrases"
import { extractWikiLinks } from "@/lib/graph/extract/wiki-links"
import { extractDateMentions } from "@/lib/graph/extract/date-mentions"
import type { ItemRecord } from "@/lib/types"

export type ExtractKind = "relation-word" | "wiki-link" | "date"

export interface ExtractOptions {
  /** Display title; defaults to `item.title`. */
  title?: (item: ItemRecord) => string
  /** Also propose `day:` mentions. Off by default: the target is an address, not an item. */
  days?: boolean
  /** Type id for scope checks (`fromTypes` / `toTypes`). */
  typeOf?: (id: string) => string | undefined
}

const SCORE: Record<ExtractKind, number> = { "relation-word": 1, "wiki-link": 0.9, date: 0.6 }

export function extractProposals(items: readonly ItemRecord[], defs: readonly RelationDef[], now: Date, opts: ExtractOptions = {}): GraphProposal[] {
  const table = buildPhraseTable(defs)
  const titleOf = opts.title ?? ((item: ItemRecord) => item.title ?? "")
  const index = buildTitleIndex(items.map((item) => ({ id: item.id, title: titleOf(item) })))
  const byId = new Map(items.map((item) => [item.id, item]))
  const defOf = new Map(defs.map((d) => [d.id, d]))
  const createdAt = now.toISOString()
  const seen = new Set<string>()
  const out: GraphProposal[] = []

  const exists = (s: string, r: string, t: string) => {
    const inv = table.inverseOf(r)
    if (byId.get(s)?.links?.some((l) => l.relation === r && l.targetId === t)) return true
    if (byId.get(t)?.links?.some((l) => l.relation === inv && l.targetId === s)) return true
    return !!byId.get(s)?.dismissedLinkSuggestions?.includes(edgeKey(t, r)) || !!byId.get(t)?.dismissedLinkSuggestions?.includes(edgeKey(s, inv))
  }
  const inScope = (s: string, r: string, t: string) => {
    const def = defOf.get(r)
    if (!def || !opts.typeOf) return true
    const from = opts.typeOf(s)
    const to = opts.typeOf(t)
    return (!def.fromTypes?.length || !from || def.fromTypes.includes(from)) && (!def.toTypes?.length || !to || def.toTypes.includes(to))
  }
  const add = (kind: ExtractKind, s: string, r: string, t: string, reason: string, evidence: GraphProposal["evidence"]) => {
    if (s === t) return
    const key = `${s}|${r}|${t}`
    if (seen.has(key) || seen.has(`${t}|${table.inverseOf(r)}|${s}`)) return
    if (kind !== "date" && (exists(s, r, t) || !inScope(s, r, t))) return
    seen.add(key)
    out.push({ id: `extract:${kind}:${key}`, kind: "link", sourceId: s, relation: r, targetId: t, origin: `extract:${kind}`, reason, evidence, score: SCORE[kind], createdAt, status: "open" })
  }

  for (const item of items) {
    const name = titleOf(item) || item.id
    for (const text of textsOf(item)) {
      const where = `${whereOf(text.field, text.when)} of ${name}`
      for (const hit of extractRelationSentences(text.text, index, table, { selfId: item.id, field: text.field })) {
        add("relation-word", hit.subjectId, hit.relation, hit.objectId, `Written in ${where}: "${hit.sentence}"`, { itemId: item.id, field: text.field, span: hit.span })
      }
      for (const link of extractWikiLinks(text.text, index, table, { selfId: item.id })) {
        const sentence = sentenceAt(text.text, link.start, link.end - link.start)
        add("wiki-link", item.id, link.relation, link.targetId, `Linked in ${where}: "${sentence}"`, { itemId: item.id, field: text.field, span: link.span })
      }
      if (!opts.days || !defOf.has("mentioned")) continue
      for (const date of extractDateMentions(text.text, now)) {
        const sentence = sentenceAt(text.text, date.start, date.end - date.start)
        add("date", item.id, "mentioned", date.address, `Dated in ${where}: "${sentence}"`, { itemId: item.id, field: text.field, span: date.span })
      }
    }
  }
  return out
}
