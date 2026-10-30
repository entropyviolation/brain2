/**
 * lib/graph/pattern-questions.ts — House questions from triples (E5, KG-Q, KG-NL)
 *
 * A small grammar. No model. A sentence is a template over returned triples.
 * If the query returns nothing, the sentence is not said.
 *
 *   who with <person> during <YYYY-MM-DD>..<YYYY-MM-DD>
 *   who with <person> during <trip title>
 *   blocks with <person> during …     (same query)
 *   people with <person> during …
 *   places with one person
 *   captures never linked
 *   where from <derived value>
 *   what reads <item|pen:|list:>
 *   day <YYYY-MM-DD>
 *   people unseen
 *   unsupported beliefs
 *   shared names
 *   unpinned derived
 *   via <relation> <title>
 *   ? <subject> <relation> <object>     * is a wildcard
 *
 * Week keys and seasons are the ones `projectVault` emits.
 */
import type { EdgeOrder, SpineGraph, VaultTriple } from "@/lib/graph/vault-graph"
import {
  peopleDuring,
  peopleNotSeenButMessaged,
  placesWithOnePerson,
  spanRangeForTitle,
  triplesForDay,
  unlinkedCaptures,
} from "@/lib/graph/vault-graph"
import { whatReadsThis, whereFrom, type ImpactSnapshot } from "@/lib/graph/machinery"
import { deriveAround } from "@/lib/graph/ego-reason"
import { linkIndexOf } from "@/lib/graph/link-index"
import { pathsAlong } from "@/lib/graph/link-path"
import { buildLattice } from "@/lib/graph/relation-lattice"
import type { RelationRule } from "@/lib/graph/relation-rules"
import { isEvidenceRelation, relationLabel } from "@/lib/links"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { BELIEF_TYPE_ID } from "@/lib/second-brain-types"

export const NO_TRIPLE = "No triple supports an answer."

export interface PatternAnswer {
  question: string
  pattern: string
  triples: VaultTriple[]
  /** Null when nothing supports a sentence. */
  sentence: string | null
  quiet: string
  lines: string[]
}

export interface HouseItem {
  id: string
  title?: string
  type?: string
  links?: readonly { relation: string; targetId: string }[]
}

export interface QuestionContext {
  graph: SpineGraph
  /** Local day the "people unseen" window ends. Default: no people if omitted. */
  asOf?: string
  impact?: ImpactSnapshot
  /** Item graph for the questions the spine cannot see. */
  items?: readonly HouseItem[]
  rules?: readonly RelationRule[]
}

function label(graph: SpineGraph, address: string): string {
  return graph.labels[address] || address
}

function line(graph: SpineGraph, triple: VaultTriple): string {
  const when = triple.at ? ` · ${triple.at}` : ""
  return `${label(graph, triple.s)} · ${triple.p} · ${label(graph, triple.o)} · ${triple.order}${when}`
}

function ordersOf(triples: readonly VaultTriple[]): string {
  const orders = [...new Set(triples.map((triple) => triple.order))]
  return orders.join(", ") || "recorded"
}

function countNoun(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function answer(question: string, pattern: string, graph: SpineGraph, triples: VaultTriple[], sentence: string | null, quiet = NO_TRIPLE): PatternAnswer {
  return {
    question,
    pattern,
    triples,
    sentence: triples.length && sentence ? sentence : null,
    quiet,
    lines: triples.slice(0, 12).map((triple) => line(graph, triple)),
  }
}

function peopleSentence(graph: SpineGraph, person: string, start: string, end: string, hit: ReturnType<typeof peopleDuring>): string | null {
  if (!hit.n) return null
  const others = hit.others.map((id) => label(graph, id))
  const places = hit.places.map((id) => label(graph, id))
  const withWhom = others.length ? ` with ${others.join(", ")}` : ""
  const where = places.length ? ` at ${places.join(", ")}` : ""
  return `From ${start} to ${end}, ${person} co-occurs on ${countNoun(hit.n, "block")}${withWhom}${where}. Orders: ${ordersOf(hit.triples)}. This is the painted company on the day spine in that range.`
}

function matchPattern(graph: SpineGraph, raw: string): VaultTriple[] {
  const parts = raw.trim().split(/\s+/)
  if (parts.length !== 3) return []
  const [s, p, o] = parts
  return graph.triples.filter((triple) => {
    const subject = s === "*" || triple.s === s
    const relation = p === "*" || triple.p === p
    const object = o === "*" || triple.o === o
    return subject && relation && object
  })
}

/** Null when the text is not a house question, so node lookup can run. */
export function answerHouseQuestion(text: string, ctx: QuestionContext): PatternAnswer | null {
  const question = text.trim().replace(/\s+/g, " ")
  if (!question) return null
  const graph = ctx.graph

  if (question.startsWith("?")) {
    const body = question.slice(1).trim()
    const triples = matchPattern(graph, body)
    const sentence = triples.length
      ? `${triples.length} triples match \`${body}\`. Orders: ${ordersOf(triples)}.`
      : null
    return answer(question, body || "?", graph, triples, sentence)
  }

  const during = /^(?:who|blocks|people) with (.+?) during (.+)$/i.exec(question)
  if (during) {
    const person = during[1].trim()
    const rest = during[2].trim()
    const dates = /^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to|–|-)\s*(\d{4}-\d{2}-\d{2})$/.exec(rest)
    const range = dates ? { start: dates[1], end: dates[2] } : spanRangeForTitle(graph, rest)
    if (!range) {
      return answer(question, `with-person ${person} during ${rest}`, graph, [], null)
    }
    const hit = peopleDuring(graph, { start: range.start, end: range.end, person })
    return answer(
      question,
      `with-person ${person} during ${range.start}..${range.end}`,
      graph,
      hit.triples,
      peopleSentence(graph, person, range.start, range.end, hit),
    )
  }

  if (/^places with one person$/i.test(question)) {
    const rows = placesWithOnePerson(graph)
    const triples = rows.flatMap((row) => row.triples)
    const sentence = rows.length
      ? rows
          .map((row) => `${label(graph, row.place)} co-occurs with only ${label(graph, row.person)} (${row.n} visits, ${row.start}–${row.end}).`)
          .join(" ")
      : null
    return answer(question, "at-place · with-person count = 1", graph, triples, sentence)
  }

  if (/^captures never linked$/i.test(question)) {
    const triples = unlinkedCaptures(graph)
    const sentence = triples.length
      ? `${triples.length === 1 ? "1 capture on the spine has" : `${triples.length} captures on the spine have`} no item links. Order: ${ordersOf(triples)}.`
      : null
    return answer(question, "captured-on and not has-link", graph, triples, sentence)
  }

  const from = /^where from (.+)$/i.exec(question)
  if (from) {
    const value = whereFrom(from[1])
    if (!value) return answer(question, `where-from ${from[1].trim()}`, graph, [], null)
    const triples: VaultTriple[] = value.from.map((input) => ({
      s: `value:${value.id}`,
      p: "derived-from",
      o: input.id,
      graph: "machinery",
      order: "derived" as EdgeOrder,
    }))
    const named: SpineGraph = {
      ...graph,
      labels: { ...graph.labels, [`value:${value.id}`]: value.label, ...Object.fromEntries(value.from.map((input) => [input.id, input.label])) },
    }
    const sentence = `${value.label} is derived from ${value.from.map((input) => `${input.label} (${input.via})`).join(", ")}.`
    return answer(question, `derived-from ${value.id}`, named, triples, sentence)
  }

  const reads = /^what reads (\S+)$/i.exec(question)
  if (reads) {
    const token = reads[1]
    const kind = token.startsWith("pen:") ? "pen" : token.startsWith("list:") ? "list" : "item"
    const hits = whatReadsThis({ kind, id: token }, ctx.impact ?? {})
    const triples: VaultTriple[] = hits.map((hit) => ({
      s: hit.reader,
      p: "reads",
      o: token.includes(":") ? token : `item:${token}`,
      graph: "machinery",
      order: "derived",
    }))
    const sentence = hits.length ? `${hits.length} records read ${token}. Order: derived.` : null
    const named: SpineGraph = { ...graph, labels: { ...graph.labels } }
    hits.forEach((hit, index) => {
      named.labels[hit.reader] = hit.how
      triples[index] = { ...triples[index], o: token.includes(":") ? token : `item:${token}` }
    })
    return answer(question, `reads ${token}`, named, triples, sentence)
  }

  const day = /^day (\d{4}-\d{2}-\d{2})$/i.exec(question)
  if (day) {
    const triples = triplesForDay(graph.triples, day[1])
    const sentence = triples.length ? `On ${day[1]}, the spine has ${triples.length} triples. Orders: ${ordersOf(triples)}.` : null
    return answer(question, `day:${day[1]}`, graph, triples, sentence)
  }

  if (/^people unseen$/i.test(question)) {
    if (!ctx.asOf) return answer(question, "messaged weekly and not with-person in 90 days", graph, [], null)
    const found = peopleNotSeenButMessaged(graph, { asOf: ctx.asOf })
    const triples = found.people.flatMap((row) => row.triples)
    if (!found.messagesProjected) {
      return answer(
        question,
        "messaged weekly and not with-person in 90 days",
        graph,
        [],
        null,
        `${NO_TRIPLE} Message edges are iPhone Texts and iPhone Calls blocks. None are on the spine.`,
      )
    }
    const sentence = found.people.length
      ? found.people
          .map((row) => `${label(graph, row.person)} has no co-time in the 90 days before ${ctx.asOf} and a message in each of the last 4 weeks.`)
          .join(" ")
      : null
    return answer(question, "messaged weekly and not with-person in 90 days", graph, triples, sentence)
  }

  const items = ctx.items ?? []
  const named = items.length ? withItemLabels(graph, items) : graph

  if (/^unsupported beliefs$/i.test(question)) {
    const rows = items.filter((item) => item.type === BELIEF_TYPE_ID && !hasEvidence(item, items))
    const triples = rows.map((item) => fact(`item:${item.id}`, "has-no-evidence", `item:${item.id}`, "recorded"))
    const sentence = rows.length
      ? `${rows.length === 1 ? "1 belief has" : `${rows.length} beliefs have`} no supports or refutes link.`
      : null
    return answer(question, "belief and not supports|refutes", named, triples, sentence)
  }

  if (/^shared names$/i.test(question)) {
    const people = items.filter((item) => item.type === "person" && (item.title ?? "").trim())
    const triples: VaultTriple[] = []
    const bits: string[] = []
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i]
        const b = people[j]
        if (a.title!.trim().toLowerCase() !== b.title!.trim().toLowerCase()) continue
        if (linkedAs(a, b.id, "same-as") || linkedAs(b, a.id, "same-as")) continue
        triples.push(fact(`item:${a.id}`, "same-name", `item:${b.id}`, "recorded"))
        bits.push(`${a.title} is the title of two people, and neither links same-as.`)
      }
    }
    return answer(question, "person title equal and not same-as", named, triples, bits.length ? bits.join(" ") : null)
  }

  if (/^unpinned derived$/i.test(question)) {
    const triples: VaultTriple[] = []
    const bits: string[] = []
    const index = linkIndexOf(items as Parameters<typeof linkIndexOf>[0])
    const lattice = buildLattice(allRelations())
    const transitive = allRelations().filter((def) => getRelationDef(def.id)?.traits?.transitive).map((def) => def.id)
    const typeOf = (id: string) => items.find((item) => item.id === id)?.type
    let scanned = 0
    for (const item of items) {
      if (!item.links?.length || triples.length >= 12) continue
      scanned += 1
      if (scanned > 80) break
      for (const edge of deriveAround(item.id, { links: index, rules: ctx.rules ?? [], lattice, transitive, typeOf })) {
        const pinned = index.steps(item.id).some((step) => step.to === edge.otherId && (step.relation === edge.relation || lattice.isSubrelation(step.relation, edge.relation)))
        if (pinned) continue
        triples.push(fact(`item:${item.id}`, edge.relation, `item:${edge.otherId}`, "derived"))
        bits.push(`${item.title || item.id} ${relationLabel(edge.relation)} ${items.find((row) => row.id === edge.otherId)?.title || edge.otherId} follows from a rule and is not pinned.`)
        if (triples.length >= 12) break
      }
    }
    return answer(question, "derived and not stored", named, triples, bits.length ? bits.join(" ") : null)
  }

  const via = /^via\s+(\S+)\s+(.+)$/i.exec(question)
  if (via) {
    const relation = relationToken(via[1])
    if (!relation) return null
    const needle = via[2].trim().toLowerCase()
    const start = items.find((item) => (item.title ?? "").trim().toLowerCase() === needle) ?? items.find((item) => (item.title ?? "").toLowerCase().includes(needle))
    if (!start) return answer(question, `via ${relation} ${via[2].trim()}`, named, [], null)
    const lattice = buildLattice(allRelations())
    const hits = pathsAlong(start.id, linkIndexOf(items as Parameters<typeof linkIndexOf>[0]), {
      relation,
      isSubrelation: (step, asked) => lattice.isSubrelation(step, asked),
    })
    const triples = hits.map((hit) => fact(`item:${start.id}`, relation, `item:${hit.id}`, "derived"))
    const sentence = hits.length
      ? hits
          .map((hit) => `${start.title || start.id} — ${hit.steps.map((step) => `${relationLabel(step.relation)} ${items.find((item) => item.id === step.to)?.title || step.to}`).join(" — ")}`)
          .join(". ")
      : null
    return answer(question, `via ${relation} ⊒ children`, named, triples, sentence)
  }

  return null
}

function fact(s: string, p: string, o: string, order: EdgeOrder): VaultTriple {
  return { s, p, o, graph: "items", order }
}

function withItemLabels(graph: SpineGraph, items: readonly HouseItem[]): SpineGraph {
  const labels = { ...graph.labels }
  for (const item of items) labels[`item:${item.id}`] = item.title || item.id
  return { ...graph, labels }
}

function hasEvidence(item: HouseItem, items: readonly HouseItem[]): boolean {
  for (const link of item.links ?? []) {
    if (isEvidenceRelation(link.relation)) return true
  }
  for (const other of items) {
    if (other.id === item.id) continue
    for (const link of other.links ?? []) {
      if (link.targetId === item.id && isEvidenceRelation(link.relation)) return true
    }
  }
  return false
}

function linkedAs(item: HouseItem, targetId: string, relation: string): boolean {
  return (item.links ?? []).some((link) => link.targetId === targetId && link.relation === relation)
}

function relationToken(token: string): string | undefined {
  const needle = token.toLowerCase()
  const def = allRelations().find((row) => row.id !== "related" && (row.id.toLowerCase() === needle || row.label.toLowerCase() === needle))
  return def?.id
}
