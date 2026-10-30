/**
 * lib/bim-flow/entity-link.ts — Link the names and topics in a message to vault entities, with no model
 *
 * An entity here is a person or a topic. Topics are lists, habits, pens, and
 * items, so "garlic confit" links to the item and the Cooking pen the same way
 * "Elijah" links to a person. The stages follow the entity-linking literature:
 *
 *   1. mention detection   longest span of up to four words that is a known alias
 *   2. candidate generation exact name, one word of a longer name, or a one-edit typo
 *   3. ranking             match quality + message context + how often the vault
 *                          mentions it + shape (a capital mid-sentence reads as a name)
 *   4. coherence           a candidate gains when another mention in the same
 *                          message sits on one of the same lists
 *   5. NIL                 a name-shaped word with no candidate stays unlinked
 *   6. ambiguity           two near-equal candidates are returned as both, not guessed
 *
 * Nothing here writes the vault or calls a model. A later `clarify` node can
 * turn an `ambiguous` mention into a question. See
 * `docs/KG_ONTOLOGY_KGQA_REFERENCES.md` (QA-7) and `docs/BIM_FLOW_HANDOFF.md`.
 */

import { contentWords, type VaultSnapshot } from "./vault-search"

export type EntityKind = "person" | "topic"
export type EntitySub = "person" | "list" | "habit" | "pen" | "item"
export type MatchHow = "full" | "partial" | "fuzzy"

export interface IndexedEntity {
  id: string
  kind: EntityKind
  sub: EntitySub
  label: string
  /** Lowercase content words that describe it (members of a list, the scope of a pen). */
  context: Set<string>
  /** Lists it sits on (a list is its own group). Mentions sharing a group cohere. */
  groups: string[]
  /** Lowercase text used to count how often the vault mentions it. */
  needle: string
}

export interface EntityCandidate {
  id: string
  kind: EntityKind
  sub: EntitySub
  label: string
  score: number
  how: MatchHow
  reasons: string[]
}

export type LinkStatus = "linked" | "ambiguous" | "nil"

export interface LinkedMention {
  text: string
  start: number
  end: number
  status: LinkStatus
  /** Set when linked or ambiguous. */
  kind?: EntityKind
  best?: EntityCandidate
  candidates: EntityCandidate[]
}

export interface EntityIndex {
  entities: Map<string, IndexedEntity>
  /** normalized phrase → entities with how it matched */
  aliases: Map<string, { entity: IndexedEntity; how: "full" | "partial" }[]>
  /** single-word alias keys of 5+ letters, for typo matching */
  fuzzyKeys: string[]
  /** lowercased history text, for the frequency prior */
  historyText: string[]
  priorCache: Map<string, number>
}

export interface LinkOptions {
  /** Two candidates closer than this are ambiguous. */
  margin?: number
  /** Most candidates kept per mention. */
  maxCandidates?: number
}

const MAX_PHRASE = 4

/** Lowercase, drop apostrophes and a possessive, fold a plural s. */
export function normalizeWord(raw: string): string {
  let w = raw.toLowerCase().replace(/['’]s$/u, "").replace(/['’]/g, "")
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1)
  return w
}

interface Token {
  raw: string
  norm: string
  start: number
  end: number
}

function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu)) {
    const raw = m[0]
    out.push({ raw, norm: normalizeWord(raw), start: m.index ?? 0, end: (m.index ?? 0) + raw.length })
  }
  return out
}

function phraseKey(words: string[]): string {
  return words.map(normalizeWord).join(" ")
}

function wordsOf(label: string): string[] {
  return [...label.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu)].map((m) => m[0])
}

function within1(a: string, b: string): boolean {
  if (a === b) return true
  const d = a.length - b.length
  if (d > 1 || d < -1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Build the alias table once per snapshot. */
export function buildEntityIndex(snap: VaultSnapshot): EntityIndex {
  const entities = new Map<string, IndexedEntity>()
  const aliases: EntityIndex["aliases"] = new Map()
  const skip = snap.skipListIds
  const membersByList = new Map<string, string[]>()
  const listsOfItem = new Map<string, string[]>()
  for (const it of snap.items) {
    listsOfItem.set(it.id, it.listIds)
    for (const l of it.listIds) {
      if (skip.has(l)) continue
      const arr = membersByList.get(l) ?? []
      if (arr.length < 40) arr.push(it.title)
      membersByList.set(l, arr)
    }
  }

  const add = (e: IndexedEntity, names: string[]) => {
    entities.set(e.id, e)
    for (const name of names) {
      const ws = wordsOf(name)
      if (ws.length === 0 || ws.length > MAX_PHRASE) continue
      const full = phraseKey(ws)
      if (ws.length > 1 || contentWords(name).length > 0) push(full, e, "full")
      if (ws.length > 1) {
        for (const w of ws) if (w.length >= 3 && contentWords(w).length > 0) push(normalizeWord(w), e, "partial")
      }
    }
  }
  const push = (key: string, entity: IndexedEntity, how: "full" | "partial") => {
    const arr = aliases.get(key) ?? []
    const have = arr.find((a) => a.entity.id === entity.id)
    if (have) {
      if (how === "full") have.how = "full"
    } else arr.push({ entity, how })
    aliases.set(key, arr)
  }

  if (snap.people?.length) {
    for (const p of snap.people) {
      add(
        {
          id: p.id,
          kind: "person",
          sub: "person",
          label: p.title,
          context: new Set(),
          groups: listsOfItem.get(p.id)?.filter((l) => !skip.has(l)) ?? [],
          needle: p.title.toLowerCase(),
        },
        p.names,
      )
    }
  } else {
    for (const it of snap.items) {
      if (it.type !== "person") continue
      add({ id: it.id, kind: "person", sub: "person", label: it.title, context: new Set(), groups: it.listIds.filter((l) => !skip.has(l)), needle: it.title.toLowerCase() }, [it.title])
    }
  }

  for (const l of snap.lists) {
    if (skip.has(l.id)) continue
    const ctx = new Set<string>()
    for (const t of membersByList.get(l.id) ?? []) for (const w of contentWords(t)) ctx.add(w)
    add({ id: `list:${l.id}`, kind: "topic", sub: "list", label: l.name, context: ctx, groups: [l.id], needle: l.name.toLowerCase() }, [l.name])
  }
  for (const h of snap.habits) {
    add({ id: `habit:${h.id}`, kind: "topic", sub: "habit", label: h.title, context: new Set(contentWords(h.title)), groups: [], needle: h.title.toLowerCase() }, [h.title])
  }
  for (const s of snap.scopes) {
    const ctx = new Set(contentWords(s.name))
    for (const p of s.pens) add({ id: `pen:${s.id}:${p.id}`, kind: "topic", sub: "pen", label: p.name, context: ctx, groups: [], needle: p.name.toLowerCase() }, [p.name])
  }
  for (const it of snap.items) {
    if (it.type === "person" || !it.title) continue
    const visible = it.listIds.filter((l) => !skip.has(l))
    if (it.listIds.length > 0 && visible.length === 0) continue
    const ctx = new Set<string>()
    for (const l of visible) {
      const list = snap.lists.find((x) => x.id === l)
      if (list) for (const w of contentWords(list.name)) ctx.add(w)
    }
    add({ id: `item:${it.id}`, kind: "topic", sub: "item", label: it.title, context: ctx, groups: visible, needle: it.title.toLowerCase() }, [it.title])
  }

  const fuzzyKeys = [...aliases.keys()].filter((k) => !k.includes(" ") && k.length >= 5)
  const historyText = (snap.history?.entries ?? []).map((e) => e.text.toLowerCase())
  return { entities, aliases, fuzzyKeys, historyText, priorCache: new Map() }
}

const indexCache = new WeakMap<VaultSnapshot, EntityIndex>()

/** One index per snapshot object. A rebuilt snapshot gets a fresh index. */
export function entityIndexFor(snap: VaultSnapshot): EntityIndex {
  let ix = indexCache.get(snap)
  if (!ix) {
    ix = buildEntityIndex(snap)
    indexCache.set(snap, ix)
  }
  return ix
}

function priorFor(ix: EntityIndex, e: IndexedEntity): number {
  const hit = ix.priorCache.get(e.id)
  if (hit !== undefined) return hit
  let n = 0
  if (e.needle.length >= 3) for (const t of ix.historyText) if (t.includes(e.needle)) n++
  const prior = Math.min(0.15, 0.04 * Math.log2(1 + n))
  ix.priorCache.set(e.id, prior)
  return prior
}

interface RawSpan {
  from: number
  to: number
  key: string
  fuzzy?: boolean
}

function detect(tokens: Token[], ix: EntityIndex): RawSpan[] {
  const used = new Array<boolean>(tokens.length).fill(false)
  const spans: RawSpan[] = []
  // Longest span first, so "garlic confit" wins over "garlic".
  for (let n = Math.min(MAX_PHRASE, tokens.length); n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue
      const key = tokens.slice(i, i + n).map((t) => t.norm).join(" ")
      if (!ix.aliases.has(key)) continue
      if (n === 1 && contentWords(tokens[i]!.raw).length === 0) continue
      for (let k = i; k < i + n; k++) used[k] = true
      spans.push({ from: i, to: i + n, key })
    }
  }
  // One-edit typos on single words that matched nothing.
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue
    const w = tokens[i]!.norm
    if (w.length < 5) continue
    const near = ix.fuzzyKeys.find((k) => k !== w && within1(w, k))
    if (near) {
      used[i] = true
      spans.push({ from: i, to: i + 1, key: near, fuzzy: true })
    }
  }
  return spans.sort((a, b) => a.from - b.from)
}

const HOW_SCORE: Record<MatchHow, number> = { full: 1, partial: 0.55, fuzzy: 0.45 }

function rank(
  ix: EntityIndex,
  span: RawSpan,
  tokens: Token[],
  msgWords: Set<string>,
  firstTokenIndex: number,
): EntityCandidate[] {
  const entries = ix.aliases.get(span.key) ?? []
  const mentionWords = new Set(tokens.slice(span.from, span.to).map((t) => t.norm))
  const first = tokens[span.from]!.raw
  const capitalized = /^\p{Lu}/u.test(first) && span.from !== firstTokenIndex
  const out: EntityCandidate[] = []
  for (const { entity, how: aliasHow } of entries) {
    const how: MatchHow = span.fuzzy ? "fuzzy" : aliasHow
    const reasons: string[] = [how === "full" ? "name matches" : how === "partial" ? "one word of the name" : "one letter off"]
    let score = HOW_SCORE[how]
    let overlap = 0
    for (const w of entity.context) if (msgWords.has(w) && !mentionWords.has(w)) overlap++
    if (overlap > 0) {
      score += Math.min(0.3, 0.1 * overlap)
      reasons.push(`${overlap} context word${overlap > 1 ? "s" : ""}`)
    }
    const prior = priorFor(ix, entity)
    if (prior > 0) {
      score += prior
      reasons.push("often in the notes")
    }
    if (capitalized && entity.kind === "person") {
      score += 0.1
      reasons.push("capitalized like a name")
    } else if (!capitalized && entity.kind === "topic" && first === first.toLowerCase()) score += 0.05
    out.push({ id: entity.id, kind: entity.kind, sub: entity.sub, label: entity.label, score, how, reasons })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Link every known name and topic in `text`. Pure and deterministic. */
export function linkEntities(ix: EntityIndex, text: string, opts: LinkOptions = {}): LinkedMention[] {
  const margin = opts.margin ?? 0.15
  const maxCandidates = opts.maxCandidates ?? 4
  const tokens = tokenize(text)
  if (tokens.length === 0) return []
  const msgWords = new Set(contentWords(text).map(normalizeWord))
  const spans = detect(tokens, ix)
  const ranked = spans.map((s) => ({ span: s, cands: rank(ix, s, tokens, msgWords, 0) }))

  // Coherence: a candidate gains when another mention has a candidate on one of its lists.
  for (let i = 0; i < ranked.length; i++) {
    const others = new Set<string>()
    ranked.forEach((r, j) => {
      if (j === i) return
      for (const c of r.cands) for (const g of ix.entities.get(c.id)?.groups ?? []) others.add(g)
    })
    if (others.size === 0) continue
    for (const c of ranked[i]!.cands) {
      if ((ix.entities.get(c.id)?.groups ?? []).some((g) => others.has(g))) {
        c.score += 0.12
        c.reasons.push("shares a list with another mention")
      }
    }
    ranked[i]!.cands.sort((a, b) => b.score - a.score)
  }

  const mentions: LinkedMention[] = ranked.map(({ span, cands }) => {
    const first = tokens[span.from]!
    const last = tokens[span.to - 1]!
    const kept = cands.slice(0, maxCandidates)
    const ambiguous = kept.length > 1 && kept[0]!.score - kept[1]!.score < margin
    return {
      text: text.slice(first.start, last.end),
      start: first.start,
      end: last.end,
      status: ambiguous ? "ambiguous" : "linked",
      kind: kept[0]!.kind,
      best: kept[0],
      candidates: kept,
    }
  })

  // NIL: a capitalized word mid-sentence that matched nothing reads as a name the vault lacks.
  const covered = (i: number) => spans.some((s) => i >= s.from && i < s.to)
  tokens.forEach((t, i) => {
    if (i === 0 || covered(i) || !/^\p{Lu}/u.test(t.raw) || contentWords(t.raw).length === 0) return
    mentions.push({ text: t.raw, start: t.start, end: t.end, status: "nil", candidates: [] })
  })
  return mentions.sort((a, b) => a.start - b.start)
}

/** Convenience: index (cached per snapshot) then link. */
export function linkText(snap: VaultSnapshot, text: string, opts?: LinkOptions): LinkedMention[] {
  return linkEntities(entityIndexFor(snap), text, opts)
}

/** Short plain lines for a prompt or a trace. */
export function describeLinks(mentions: LinkedMention[]): string[] {
  return mentions.map((m) => {
    if (m.status === "nil") return `"${m.text}": a name, not in the vault.`
    if (m.status === "ambiguous") return `"${m.text}": could be ${m.candidates.map((c) => `${c.label} (${c.sub})`).join(" or ")}.`
    return `"${m.text}": ${m.best!.label} (${m.best!.sub}).`
  })
}
