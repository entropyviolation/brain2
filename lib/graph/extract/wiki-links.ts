/**
 * lib/graph/extract/wiki-links.ts — `[[Title]]`, `[[Title|alias]]`, and
 * `[[relation::Title]]` in text (KG-N2, KG-NL7). Pure.
 *
 * The title must name exactly one item (case-insensitive, spaces collapsed);
 * an unknown or shared title gives no row. A typed link's relation is a
 * vocabulary id, label, or phrase; an unknown one reads as `mentioned`, so
 * no relation is invented. The item that holds the text is the subject.
 */
import { buildTitleIndex, normalizeTitle, resolveRelationWord, type PhraseTable, type TitleEntry, type TitleIndex } from "@/lib/graph/extract/relation-phrases"

export const PLAIN_WIKI_RELATION = "mentioned"

export interface WikiLink {
  targetId: string
  relation: string
  /** Written as `[[relation::Title]]` with a known relation. */
  typed: boolean
  /** The raw `[[…]]`. */
  span: string
  start: number
  end: number
}

export function extractWikiLinks(text: string, titles: TitleIndex | readonly TitleEntry[], table?: PhraseTable, opts: { selfId?: string } = {}): WikiLink[] {
  if (!text.includes("[[")) return []
  const index = "byTitle" in titles ? titles : buildTitleIndex(titles)
  const out: WikiLink[] = []
  const re = /\[\[([^[\]\n]+?)\]\]/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let inner = m[1]
    let word: string | undefined
    const cut = inner.indexOf("::")
    if (cut >= 0) {
      word = inner.slice(0, cut)
      inner = inner.slice(cut + 2)
    }
    const titlePart = inner.split("|")[0]
    const targetId = index.byTitle.get(normalizeTitle(titlePart))
    if (!targetId || targetId === opts.selfId) continue
    const resolved = word && table ? resolveRelationWord(word, table) : undefined
    out.push({ targetId, relation: resolved ?? PLAIN_WIKI_RELATION, typed: !!resolved, span: m[0], start: m.index, end: m.index + m[0].length })
  }
  return out
}
