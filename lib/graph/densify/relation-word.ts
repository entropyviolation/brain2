/**
 * Densify source `relation-word`: a relation written in words on this item
 * (KG-N3, KG-NL7, KG-NL8).
 *
 * Walks the same text fields as `mention`. "Blocked by Tax return", "Kitchen
 * is part of House", and `[[part of::House]]` become rows with that relation,
 * read from this item's side. A sentence about two other items stays off the
 * shelf (the vault pass in `extract/vault-extract.ts` proposes it). The
 * reason quotes the sentence. Scores above `mention`: the words name the
 * relation, not only the item.
 */
import { allRelations } from "@/lib/relation-registry"
import { suggestion, type DensifyContext, type Suggestion, type SuggestionSourceFn } from "@/lib/graph/densify"
import { sentenceAt, textsOf, whereOf } from "@/lib/graph/densify/mention"
import { buildPhraseTable, buildTitleIndex, extractRelationSentences, type PhraseTable, type TitleIndex } from "@/lib/graph/extract/relation-phrases"
import { extractWikiLinks } from "@/lib/graph/extract/wiki-links"
import type { ItemRecord } from "@/lib/types"

export const RELATION_WORD_SCORE = 1

const titleCache = new WeakMap<readonly ItemRecord[], { title: DensifyContext["title"]; index: TitleIndex }>()

function titlesFor(ctx: DensifyContext): TitleIndex {
  const hit = titleCache.get(ctx.all)
  if (hit && hit.title === ctx.title) return hit.index
  const index = buildTitleIndex(ctx.all.map((other) => ({ id: other.id, title: ctx.title(other.id) })))
  titleCache.set(ctx.all, { title: ctx.title, index })
  return index
}

export function relationWordSuggestions(item: ItemRecord, ctx: DensifyContext, table: PhraseTable): Suggestion[] {
  const texts = textsOf(item)
  if (!texts.length || !table.re) return []
  const index = titlesFor(ctx)
  const out: Suggestion[] = []
  const seen = new Set<string>()
  const push = (otherId: string, relation: string, field: string, when: string | undefined, sentence: string, span: string) => {
    if (otherId === item.id || seen.has(`${otherId}|${relation}`)) return
    if (ctx.scopeOk && !ctx.scopeOk(relation, otherId)) return
    seen.add(`${otherId}|${relation}`)
    out.push(suggestion(otherId, relation, "relation-word", `Written in ${whereOf(field, when)}: "${sentence}"`, RELATION_WORD_SCORE, { itemId: item.id, field, span }))
  }
  for (const text of texts) {
    for (const hit of extractRelationSentences(text.text, index, table, { selfId: item.id, field: text.field })) {
      if (hit.subjectId === item.id) push(hit.objectId, hit.relation, text.field, text.when, hit.sentence, hit.span)
      else if (hit.objectId === item.id) push(hit.subjectId, table.inverseOf(hit.relation), text.field, text.when, hit.sentence, hit.span)
    }
    for (const link of extractWikiLinks(text.text, index, table, { selfId: item.id })) {
      if (!link.typed) continue
      push(link.targetId, link.relation, text.field, text.when, sentenceAt(text.text, link.start, link.end - link.start), link.span)
    }
  }
  return out
}

export const relationWordSource: SuggestionSourceFn = (item, ctx) => relationWordSuggestions(item, ctx, buildPhraseTable(allRelations()))
