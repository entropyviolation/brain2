/**
 * lib/graph/extract/relation-phrases.ts — Relation words written in text
 * (KG-N3, KG-NL1, KG-NL7). Pure.
 *
 * `buildPhraseTable` reads the vocabulary: each def's label, inverse label,
 * and `phrases` templates ("$s is part of $o", "$o includes $s"). Every row
 * reads "A <phrase> B" as "A <relation> B". A phrase two relations claim is
 * dropped. `extractRelationSentences` finds "<Title A> <phrase> <Title B>"
 * and "<phrase> <Title B>" (the item itself is the subject). Titles match
 * longest first, case-insensitive, on word edges. Only relations already in
 * the vocabulary come out (closed list). Nothing here writes a link.
 */
import type { RelationDef } from "@/lib/links"

const MIN_TITLE = 3
const COPULA = /^(?:is|are|was|were)\s+/i
const WORD_EDGE_BEFORE = "(?<![\\p{L}\\p{N}])"
const WORD_EDGE_AFTER = "(?![\\p{L}\\p{N}])"
/** Between subject and phrase: nothing, or a copula ("Sam is part of"). */
const SUBJECT_GAP = /^\s*(?:(?:is|are|was|were)\s+)?$/i
/** Between phrase and object: nothing, or "the". */
const OBJECT_GAP = /^\s*(?:the\s+)?$/i
/** Before a subject-less phrase: a bullet, a checkbox, "this is", "it is". */
const SELF_LEAD = /^\s*(?:[-*•>]\s*)?(?:\[[ xX]?\]\s*)?(?:(?:this|it)\s+)?(?:(?:is|are|was|were)\s+)?$/i

export interface PhraseRow {
  /** Normalized: lowercase, single spaces, no leading copula. */
  phrase: string
  /** "A <phrase> B" reads as "A <relation> B". */
  relation: string
}

export interface PhraseTable {
  rows: PhraseRow[]
  byPhrase: Map<string, string>
  /** Relation ids in the table's vocabulary. */
  ids: Set<string>
  inverseOf: (relation: string) => string
  /** Phrase alternation; null when the table is empty. */
  re: RegExp | null
}

export interface TitleEntry {
  id: string
  title: string
}

export interface TitleIndex {
  /** Normalized title → id, or null when two items share it. */
  byTitle: Map<string, string | null>
  re: RegExp | null
}

export interface RelationSentence {
  subjectId: string
  relation: string
  objectId: string
  /** The words from subject (or phrase) to object. */
  span: string
  field: string
  /** The whole sentence, spaces collapsed. */
  sentence: string
  phrase: string
}

export function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().replace(COPULA, "").trim()
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function alternation(values: readonly string[]): RegExp | null {
  if (!values.length) return null
  const alts = [...values].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).map((v) => escape(v).replace(/ /g, "\\s+"))
  return new RegExp(`${WORD_EDGE_BEFORE}(?:${alts.join("|")})${WORD_EDGE_AFTER}`, "giu")
}

/** "$s part of $o" → [phrase, slot order]. Other shapes are skipped. */
function parseTemplate(template: string): { phrase: string; subjectFirst: boolean } | null {
  const m = /^\s*\$(s|o)\s+(.+?)\s+\$(s|o)\s*$/.exec(template)
  if (!m || m[1] === m[3] || m[2].includes("$")) return null
  return { phrase: m[2], subjectFirst: m[1] === "s" }
}

export function buildPhraseTable(defs: readonly RelationDef[]): PhraseTable {
  const claimed = new Map<string, string | null>()
  const inverse = new Map<string, string>()
  const ids = new Set<string>()
  const add = (raw: string | undefined, relation: string) => {
    if (!raw) return
    const phrase = normalizePhrase(raw)
    if (phrase.length < 2) return
    const prev = claimed.get(phrase)
    if (prev === undefined) claimed.set(phrase, relation)
    else if (prev !== relation) claimed.set(phrase, null)
  }
  for (const def of defs) {
    if (def.archived || def.aliasOf) continue
    ids.add(def.id)
    inverse.set(def.id, def.inverse)
    if (!inverse.has(def.inverse)) inverse.set(def.inverse, def.id)
    add(def.label, def.id)
    add(def.inverseLabel, def.inverse)
    for (const template of [...(def.phrases?.forward ?? []), ...(def.phrases?.inverse ?? [])]) {
      const parsed = parseTemplate(template)
      if (parsed) add(parsed.phrase, parsed.subjectFirst ? def.id : def.inverse)
    }
  }
  const byPhrase = new Map<string, string>()
  for (const [phrase, relation] of claimed) if (relation) byPhrase.set(phrase, relation)
  const rows = [...byPhrase].map(([phrase, relation]) => ({ phrase, relation }))
  return { rows, byPhrase, ids, inverseOf: (id) => inverse.get(id) ?? id, re: alternation([...byPhrase.keys()]) }
}

/** A relation id, label, or phrase → relation id ("A <word> B"). */
export function resolveRelationWord(word: string, table: PhraseTable): string | undefined {
  const phrase = normalizePhrase(word)
  if (table.byPhrase.has(phrase)) return table.byPhrase.get(phrase)
  const id = phrase.replace(/ /g, "-")
  return table.ids.has(id) ? id : undefined
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim()
}

export function buildTitleIndex(entries: readonly TitleEntry[]): TitleIndex {
  const byTitle = new Map<string, string | null>()
  for (const { id, title } of entries) {
    const key = normalizeTitle(title ?? "")
    if (key.length < MIN_TITLE || key === "untitled") continue
    const prev = byTitle.get(key)
    if (prev === undefined) byTitle.set(key, id)
    else if (prev !== id) byTitle.set(key, null)
  }
  return { byTitle, re: alternation([...byTitle.keys()]) }
}

interface Hit {
  start: number
  end: number
  id: string | null
}

const withoutCache = new WeakMap<TitleIndex, Map<string, RegExp | null>>()

/** The title regex minus one item's own titles (its title field names itself). */
function regexWithout(index: TitleIndex, id: string): RegExp | null {
  let byId = withoutCache.get(index)
  if (!byId) withoutCache.set(index, (byId = new Map()))
  if (!byId.has(id)) byId.set(id, alternation([...index.byTitle].filter(([, owner]) => owner !== id).map(([key]) => key)))
  return byId.get(id) ?? null
}

function titleHits(segment: string, index: TitleIndex, source: RegExp | null = index.re): Hit[] {
  if (!source) return []
  const re = new RegExp(source.source, source.flags)
  const hits: Hit[] = []
  for (let m = re.exec(segment); m; m = re.exec(segment)) {
    hits.push({ start: m.index, end: m.index + m[0].length, id: index.byTitle.get(normalizeTitle(m[0])) ?? null })
  }
  return hits
}

function clip(sentence: string): string {
  return sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence
}

/** Sentences: runs between `.`, `!`, `?`, and line ends. */
export function segments(text: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = []
  const re = /[^\n.!?]+/g
  for (let m = re.exec(text); m; m = re.exec(text)) if (m[0].trim()) out.push({ start: m.index, text: m[0] })
  return out
}

export function extractRelationSentences(
  text: string,
  titles: TitleIndex | readonly TitleEntry[],
  table: PhraseTable,
  opts: { selfId?: string; field?: string } = {},
): RelationSentence[] {
  if (!table.re || !text.trim()) return []
  const index = "byTitle" in titles ? titles : buildTitleIndex(titles)
  const out: RelationSentence[] = []
  for (const seg of segments(text)) {
    let hits = titleHits(seg.text, index)
    const re = new RegExp(table.re.source, table.re.flags)
    if (opts.selfId && hits.some((h) => h.id === opts.selfId)) {
      const phrases = [...seg.text.matchAll(new RegExp(table.re.source, table.re.flags))].map((m) => [m.index, m.index + m[0].length])
      const covers = hits.some((h) => h.id === opts.selfId && phrases.some(([a, b]) => h.start < b && a < h.end))
      if (covers) hits = titleHits(seg.text, index, regexWithout(index, opts.selfId))
    }
    for (let m = re.exec(seg.text); m; m = re.exec(seg.text)) {
      const start = m.index
      const end = start + m[0].length
      if (hits.some((h) => h.start < end && start < h.end)) continue
      const relation = table.byPhrase.get(normalizePhrase(m[0]))
      if (!relation) continue
      const before = [...hits].reverse().find((h) => h.end <= start)
      let subjectId: string | null = null
      let from = start
      if (before && SUBJECT_GAP.test(seg.text.slice(before.end, start))) {
        subjectId = before.id
        from = before.start
      } else if (opts.selfId && SELF_LEAD.test(seg.text.slice(0, start))) {
        subjectId = opts.selfId
      } else continue
      const after = hits.find((h) => h.start >= end)
      if (!after || !OBJECT_GAP.test(seg.text.slice(end, after.start))) continue
      if (!subjectId || !after.id || subjectId === after.id) continue
      out.push({
        subjectId,
        relation,
        objectId: after.id,
        span: seg.text.slice(from, after.end).replace(/\s+/g, " ").trim(),
        field: opts.field ?? "text",
        sentence: clip(seg.text.replace(/\s+/g, " ").trim()),
        phrase: normalizePhrase(m[0]),
      })
    }
  }
  return out
}
