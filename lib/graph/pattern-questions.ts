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

export interface QuestionContext {
  graph: SpineGraph
  /** Local day the "people unseen" window ends. Default: no people if omitted. */
  asOf?: string
  impact?: ImpactSnapshot
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

  return null
}
