/**
 * lib/baby-game/study-llm.ts — The Study BIMBIES: a friend studying their shelf, and writing their manifesto
 *
 * Small single-job loops, each with a script behind it so tests and a missing model both work (like `chatter.ts`):
 *  1. **A study session** (`runStudySession`). The friend picks what to study, then, one JSON step at a time, uses
 *     tools: `search_shelf` (the whole shelf), `search_book` (one book), `take_note` and `finish`. Searches return
 *     passage chunks (`passages.ts`). A note is only written if its quote is really in a passage they were shown, it
 *     is not a repeat, and a strict second look says it is good, worthy and truthful. The session ends with a summary.
 *  2. **A topic** (`topicWithModel`) drawn out of ten sessions, **an outline** (`outlineWithModel`), and **a section**
 *     fleshed out from the workbook (`sectionWithModel`).
 * Asking friends to read the manifesto is in `chatter.ts` (`pitchWithModel`). The rules and state are `study.ts`.
 */

import { RESIDENTS } from "./cast"
import { characterBrief } from "./character"
import type { GameState } from "./engine"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { modelEndpoint } from "@/lib/bim-flow/ollama"
import { hasQuote, searchLibrary, terms, type Library, type Passage } from "./passages"
import { ideasOf, sentences } from "./shelf"
import { activeManifesto, studyOf, type OutlineDraft, type Section, type SessionResult, type StudyNote, type StudySession } from "./study"

const MAX_STEPS = 9
const MAX_NOTES = 4
const nameOf = (id: string) => RESIDENTS.find((r) => r.id === id)?.name ?? id
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

let embedDeadUntil = 0

/** Embeddings from the local daemon (`nomic-embed-text`), or null when it is not installed or not answering. */
export async function embedWithOllama(texts: string[]): Promise<number[][] | null> {
  if (Date.now() < embedDeadUntil) return null
  try {
    const e = modelEndpoint()
    const res = await fetch(`${e.base}/api/embed`, { method: "POST", headers: { "Content-Type": "application/json", ...e.headers }, body: JSON.stringify({ model: "nomic-embed-text", input: texts }) })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as { embeddings?: number[][] }
    if (!body.embeddings || body.embeddings.length !== texts.length) throw new Error("shape")
    return body.embeddings
  } catch {
    embedDeadUntil = Date.now() + 5 * 60_000
    return null
  }
}

const jaccard = (a: string, b: string) => {
  const x = new Set(terms(a))
  const y = new Set(terms(b))
  const both = [...x].filter((w) => y.has(w)).length
  return both / Math.max(1, x.size + y.size - both)
}

/** Everything they have already written down, to refuse repeats. */
const knownIdeas = (s: GameState, id: string, mine: StudyNote[]) => {
  const st = studyOf(s, id)
  return [...st.notebook, ...st.workbook, ...mine]
}

const listBooks = (lib: Library) => lib.books.map((b, i) => `${i + 1}. "${b.title}"`).join("; ")

const format = (ps: Passage[]) => (ps.length ? ps.map((p, i) => `[${i + 1}] "${p.title}" p. ${p.page}: ${p.text}`).join("\n") : "Nothing matched. Try other words.")

/** What a friend could study: their own ideas and open questions from reading, not repeating recent themes. */
function curiosities(s: GameState, id: string): string[] {
  const recent = new Set(studyOf(s, id).sessions.slice(-8).map((x) => x.theme.toLowerCase()))
  const qs = (s.shelves?.[id] ?? []).flatMap((b) => b.readings.slice(-2).map((r) => r.question).filter((q): q is string => !!q))
  const ideas = ideasOf(s, id).map((i) => `${i.name}: ${i.gist}`)
  return [...qs, ...ideas].filter((x) => !recent.has(x.split(":")[0]!.toLowerCase())).slice(0, 6)
}

/** Does the whole shelf have words to study? */
async function readable(lib: Library): Promise<boolean> {
  for (const b of lib.books) if (await lib.text(b)) return true
  return false
}

/** A session with no model: search the shelf for a theme and keep the sentences that really answer it. */
async function scriptedSession(s: GameState, id: string, lib: Library, mkDay: { day: number; minute: number }): Promise<SessionResult> {
  const m = activeManifesto(s, id)
  const recent = new Set(studyOf(s, id).sessions.slice(-8).map((x) => x.theme.toLowerCase()))
  const idea = ideasOf(s, id).find((i) => !recent.has(i.name.toLowerCase()))
  const theme = m ? m.topic : idea?.name ?? lib.books[0]?.title ?? "what I read"
  const query = [theme, m ? "" : idea?.gist ?? ""].join(" ")
  const found = await searchLibrary(lib, query, { k: 3 })
  const want = new Set(terms(query))
  const known = knownIdeas(s, id, [])
  const notes: StudyNote[] = []
  for (const p of found) {
    const best = sentences(p.text)
      .filter((x) => x.length >= 40 && x.length <= 260)
      .map((x) => ({ x, n: terms(x).filter((w) => want.has(w)).length }))
      .sort((a, b) => b.n - a.n)[0]
    if (!best || best.n < Math.min(2, want.size) || known.some((k) => k.quote === best.x) || notes.some((k) => k.quote === best.x)) continue
    notes.push({ day: mkDay.day, idea: idea && !m ? idea.gist : `This passage in "${p.title}" bears on ${theme}.`, quote: best.x, book: p.title, bookId: p.bookId, page: p.page, theme })
    if (notes.length >= 2) break
  }
  const summary = notes.length
    ? `I searched my shelf for "${theme}" and kept ${notes.length} note${notes.length === 1 ? "" : "s"}. The one I trust most: “${clip(notes[0]!.quote, 110)}”`
    : `I searched my shelf for "${theme}" but found nothing worth writing down yet.`
  return { session: { ...mkDay, theme, summary, searches: [{ tool: "shelf", query }], kept: notes.length, refused: 0, by: "scripted" }, notes }
}

const STEP_SCHEMA = {
  type: "object",
  properties: {
    theme: { type: "string", maxLength: 70 },
    thought: { type: "string", maxLength: 160 },
    action: { type: "string", enum: ["search_shelf", "search_book", "take_note", "finish"] },
    query: { type: "string", maxLength: 100 },
    book: { type: "string", maxLength: 90 },
    idea: { type: "string", maxLength: 220 },
    quote: { type: "string", maxLength: 220 },
  },
  required: ["theme", "thought", "action", "query", "book", "idea", "quote"],
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: { good: { type: "boolean" }, worthy: { type: "boolean" }, truthful: { type: "boolean" }, why: { type: "string", maxLength: 140 } },
  required: ["good", "worthy", "truthful", "why"],
}

/** Their strict second look at a note before it goes in the notebook. */
async function judge(call: ModelCall, who: string, theme: string, idea: string, p: Passage, quote: string): Promise<{ ok: boolean; why: string }> {
  try {
    const raw = (await call({
      system: [
        `You are ${who}, a careful student deciding whether to write a note in your Study notebook. Be a strict editor of your own notes.`,
        `Theme: ${theme}`,
        `Proposed note, in your words: ${idea}`,
        `The quote it rests on, from "${p.title}" p. ${p.page}: """${quote}"""`,
        "good: the note is clear and specific, a real idea and not a vague remark.",
        "worthy: it matters for the theme and is worth keeping, not trivial or off topic.",
        "truthful: the quote really supports the note, with nothing added, overstated or twisted from what the author means.",
        "Answer false if you have any real doubt.",
      ].join("\n"),
      user: "Is this note good, worthy and truthful?",
      schema: JUDGE_SCHEMA,
      maxTokens: 140,
      temperature: 0,
    })) as Record<string, unknown> | null
    return { ok: raw?.good === true && raw?.worthy === true && raw?.truthful === true, why: str(raw?.why, 140) }
  } catch {
    return { ok: false, why: "could not decide" }
  }
}

const findBook = (lib: Library, ref: string) => {
  const r = ref.trim().toLowerCase().replace(/^["“]|["”]$/g, "")
  const n = Number(r.replace(/\D/g, ""))
  if (/^\d+\.?$/.test(r) && lib.books[n - 1]) return lib.books[n - 1]
  return lib.books.find((b) => b.title.toLowerCase() === r) ?? lib.books.find((b) => r.length >= 3 && (b.title.toLowerCase().includes(r) || r.includes(b.title.toLowerCase())))
}

/**
 * One study session. With a model, the friend works as an agent: choose a theme, search, read passages, and take only
 * the notes they can stand behind, then cap the session off. Falls back to the script when the model gives nothing
 * usable. Null when no book on the shelf has words to study.
 */
export async function runStudySession(s: GameState, id: string, lib: Library, call: ModelCall | null): Promise<SessionResult | null> {
  if (!lib.books.length || !(await readable(lib))) return null
  const when = { day: s.day, minute: s.minutes }
  if (!call) return scriptedSession(s, id, lib, when)
  const c = s.characters[id]
  const m = activeManifesto(s, id)
  const who = nameOf(id)
  const seen: Passage[] = []
  const notes: StudyNote[] = []
  const searches: StudySession["searches"] = []
  const steps: string[] = []
  const rejected: string[] = []
  let last = "(you have not searched yet)"
  let theme = m?.topic ?? ""
  let refused = 0
  let broken = 0
  const recent = studyOf(s, id).sessions.slice(-6).map((x) => x.theme)
  const cur = curiosities(s, id)
  const system = () =>
    [
      `You are ${who}, a baby ${id} in Valdivia, at the study desk in your home. You keep a Study notebook. Your bookshelf: ${listBooks(lib)}.`,
      c ? characterBrief(c, 2) : "",
      m
        ? `You are studying for your manifesto, "${m.title}", on the topic: ${m.topic}. Search for what serves it: strong ideas, evidence, and the best objections.`
        : `Choose one thing you truly want to understand today${cur.length ? `. On your mind from reading: ${cur.join(" | ")}` : ""}.${recent.length ? ` Do not repeat recent themes: ${recent.join("; ")}.` : ""} Put it in "theme".`,
      "Each step choose ONE action: search_shelf (query: words or a question; searches every book by meaning and keywords), search_book (book: its number or title, query), take_note (idea: your own words; quote: copied exactly from a passage you were shown), or finish.",
      `Take a note only for an idea that is good, worthy and truthful, and always with its quote. Most sessions keep one to ${MAX_NOTES} notes; do not write down everything you think. Finish when you have what you came for.`,
      notes.length ? `Notes kept so far: ${notes.map((n) => n.idea).join(" / ")}` : "",
      rejected.length ? `Refused notes (do not repeat): ${rejected.slice(-3).join(" / ")}` : "",
      "Never mention being an AI. Fill every field; leave ones you do not need as an empty string.",
    ].filter(Boolean).join("\n")
  for (let n = 0; n < MAX_STEPS && broken < 2; n++) {
    let raw: Record<string, unknown> | null
    try {
      raw = (await call({
        system: system(),
        user: `${steps.length ? `Steps so far: ${steps.slice(-5).join(" → ")}\n\n` : ""}Latest result:\n${last}\n\nWhat do you do next?`,
        schema: STEP_SCHEMA,
        maxTokens: 300,
        temperature: 0.5,
      })) as Record<string, unknown> | null
    } catch {
      broken++
      continue
    }
    if (!raw) {
      broken++
      continue
    }
    theme ||= str(raw.theme, 70)
    const action = raw.action
    if (action === "finish") {
      if (!searches.length) {
        last = "You have not searched yet. Search first."
        continue
      }
      break
    }
    if (action === "search_shelf" || action === "search_book") {
      const q = str(raw.query, 100) || theme
      const only = action === "search_book" ? findBook(lib, str(raw.book, 90)) : undefined
      if (action === "search_book" && !only) {
        last = `No such book. Your books: ${listBooks(lib)}`
        steps.push("tried a book that is not on the shelf")
        continue
      }
      const got = await searchLibrary(lib, q, { only, k: 3 })
      for (const p of got) if (!seen.some((x) => x.bookId === p.bookId && x.from === p.from)) seen.push(p)
      searches.push({ tool: only ? "book" : "shelf", query: q, ...(only ? { book: only.title } : {}) })
      steps.push(`searched ${only ? `"${only.title}"` : "the shelf"} for "${clip(q, 40)}" (${got.length} passages)`)
      last = format(got)
      continue
    }
    if (action === "take_note") {
      const idea = str(raw.idea, 220)
      const quote = str(raw.quote, 220).replace(/^["“]|["”]$/g, "")
      if (notes.length >= MAX_NOTES) {
        last = "You have enough notes. Finish the session."
        continue
      }
      const source = seen.find((p) => hasQuote(p.text, quote))
      const reason = idea.length < 25 ? "the idea is too short to be a real idea" : !source ? "the quote is not word for word in any passage you were shown" : knownIdeas(s, id, notes).some((k) => k.quote === quote || jaccard(k.idea, idea) > 0.6) ? "you already have this note" : ""
      if (reason) {
        refused++
        rejected.push(clip(idea, 60))
        last = `Note refused: ${reason}.`
        steps.push("a note was refused")
        continue
      }
      const verdict = await judge(call, who, theme || "your studies", idea, source!, quote)
      if (!verdict.ok) {
        refused++
        rejected.push(clip(idea, 60))
        last = `You looked again and decided not to keep that note${verdict.why ? `: ${verdict.why}` : ""}.`
        steps.push("a note was not good, worthy and true enough")
        continue
      }
      notes.push({ day: s.day, idea, quote, book: source!.title, bookId: source!.bookId, page: source!.page, theme: theme || "my studies" })
      steps.push(`kept a note (${notes.length})`)
      last = `Note kept: ${idea}`
      continue
    }
    broken++
  }
  if (!searches.length) return scriptedSession(s, id, lib, when)
  theme ||= recent.length ? "my studies" : (lib.books[0]?.title ?? "my studies")
  let summary = ""
  try {
    const raw = (await call({
      system: [
        `You are ${who}. You just finished a study session on "${theme}"${m ? ` for your manifesto on ${m.topic}` : ""}.`,
        `You searched: ${searches.map((x) => `"${x.query}"${x.book ? ` in "${x.book}"` : ""}`).join("; ")}.`,
        notes.length ? `Notes you kept:\n${notes.map((n) => `- ${n.idea} (“${clip(n.quote, 90)}”, ${n.book} p. ${n.page})`).join("\n")}` : "You kept no notes.",
        "Cap off the session in two to four sentences, first person: what you studied, what you now understand, and what is still open. Be honest if little came of it.",
      ].join("\n"),
      user: "Write your summary.",
      schema: { type: "object", properties: { summary: { type: "string", maxLength: 460 } }, required: ["summary"] },
      maxTokens: 220,
      temperature: 0.4,
    })) as Record<string, unknown> | null
    summary = str(raw?.summary, 460)
  } catch {
    // the script below stands in
  }
  if (!summary) {
    summary = notes.length ? `I studied "${theme}" and kept ${notes.length} note${notes.length === 1 ? "" : "s"}; ${clip(notes[0]!.idea, 120)}` : `I studied "${theme}" but nothing was worth writing down yet.`
  }
  return { session: { ...when, theme, summary, searches, kept: notes.length, refused, by: "model" }, notes }
}

// ——— topic, outline, sections ———

const words = (xs: string[]) => {
  const n = new Map<string, number>()
  for (const x of xs) for (const w of new Set(terms(x))) n.set(w, (n.get(w) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1])
}
const titleCase = (t: string) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** The topic their sessions keep circling, by the words they share most. */
export function scriptedTopic(s: GameState, id: string): { topic: string; title: string } {
  const st = studyOf(s, id)
  const top = words([...st.sessions.map((x) => x.theme), ...st.notebook.map((x) => x.idea)]).slice(0, 2).map(([w]) => w)
  const topic = top.length ? top.join(" and ") : "what I have been reading"
  return { topic, title: `A Manifesto on ${titleCase(topic)}` }
}

export async function topicWithModel(s: GameState, id: string, call: ModelCall | null): Promise<{ topic: string; title: string }> {
  const script = scriptedTopic(s, id)
  if (!call) return script
  const st = studyOf(s, id)
  try {
    const raw = (await call({
      system: [
        `You are ${nameOf(id)}, a baby ${id} in Valdivia. You have finished ${st.sessions.length} study sessions. Here is what you studied and wrote down:`,
        st.sessions.slice(-10).map((x) => `- ${x.theme}: ${clip(x.summary, 200)}`).join("\n"),
        `Notes:\n${st.notebook.slice(-14).map((n) => `- ${clip(n.idea, 130)}`).join("\n")}`,
        "Find the ONE topic your studies keep circling: something you could write a whole manifesto about, specific enough to argue and large enough to fill a small book.",
        "topic: a short noun phrase. title: the manifesto's title, in your voice, that sounds like a manifesto.",
      ].join("\n"),
      user: "What will your manifesto be about?",
      schema: { type: "object", properties: { topic: { type: "string", maxLength: 60 }, title: { type: "string", maxLength: 80 } }, required: ["topic", "title"] },
      maxTokens: 120,
      temperature: 0.5,
    })) as Record<string, unknown> | null
    const topic = str(raw?.topic, 60)
    const title = str(raw?.title, 80)
    return topic && title ? { topic, title } : script
  } catch {
    return script
  }
}

const noteLine = (n: StudyNote) => `- ${n.idea} [“${clip(n.quote, 110)}” ${n.book} p. ${n.page}]`

/** An outline with no model: a fixed argument shape, each part filled from the strongest notes. */
export function scriptedOutline(s: GameState, id: string): OutlineDraft {
  const m = studyOf(s, id).manifesto!
  const notes = studyOf(s, id).workbook
  const pick = (i: number) => notes[i % Math.max(1, notes.length)]?.idea ?? `what I have learned about ${m.topic}`
  const shape: Array<[string, string]> = [
    [`Why ${m.topic} matters`, `Why I could not stop thinking about ${m.topic}: ${pick(0)}`],
    ["What the books say", `What my shelf has taught me, in particular: ${pick(1)}`],
    ["The core idea", `The one thing I would say if I could say only one: ${pick(2)}`],
    ["What follows from it", `If that is true, then: ${pick(3)}`],
    ["The best objection, and my reply", `The strongest thing against me, and why I still hold it: ${pick(4)}`],
    ["How to live it in the valley", `What it looks like on an ordinary day, by the pond or the fire: ${pick(5)}`],
    ["What I still do not know", "The questions my studies left open, which I will keep studying."],
  ]
  return { thesis: `A manifesto on ${m.topic}: ${pick(2)}`, sections: shape.map(([title, summary]) => ({ title, summary })) }
}

export async function outlineWithModel(s: GameState, id: string, call: ModelCall | null): Promise<OutlineDraft> {
  const script = scriptedOutline(s, id)
  if (!call) return script
  const m = studyOf(s, id).manifesto!
  const notes = studyOf(s, id).workbook.slice(-18).map(noteLine).join("\n").slice(0, 6000)
  try {
    const raw = (await call({
      system: [
        `You are ${nameOf(id)}, a baby ${id} in Valdivia, planning your manifesto "${m.title}" on ${m.topic}.`,
        s.characters[id] ? characterBrief(s.characters[id]!, 2) : "",
        `Your manifesto study workbook:\n${notes}`,
        "Write the outline as an argument that goes as deep into the idea as it can: what the problem is, the key terms defined, the central claim, the strongest evidence from your sources, the best objection and your reply, what follows, how to live it, and what you still do not know. Order the parts so each needs the one before.",
        "thesis: the central claim in one or two sentences. sections: five to eight parts, each a short title and a two or three sentence summary of exactly what that part will argue and which sources it draws on. title: the final title.",
      ].filter(Boolean).join("\n"),
      user: "Write your outline.",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 80 },
          thesis: { type: "string", maxLength: 320 },
          sections: { type: "array", minItems: 5, maxItems: 8, items: { type: "object", properties: { title: { type: "string", maxLength: 70 }, summary: { type: "string", maxLength: 280 } }, required: ["title", "summary"] } },
        },
        required: ["title", "thesis", "sections"],
      },
      maxTokens: 900,
      temperature: 0.5,
    })) as Record<string, unknown> | null
    const sections = (Array.isArray(raw?.sections) ? (raw!.sections as Array<Record<string, unknown>>) : [])
      .map((x): Section => ({ title: str(x.title, 70), summary: str(x.summary, 280) }))
      .filter((x) => x.title && x.summary)
    const thesis = str(raw?.thesis, 320)
    return sections.length >= 4 && thesis ? { title: str(raw?.title, 80) || undefined, thesis, sections } : script
  } catch {
    return script
  }
}

/** The workbook notes closest to a section, most relevant first. */
export function notesFor(s: GameState, id: string, sec: Section, n = 5): StudyNote[] {
  const want = new Set(terms(`${sec.title} ${sec.summary}`))
  return studyOf(s, id).workbook
    .map((x, i) => ({ x, i, k: terms(x.idea).filter((w) => want.has(w)).length }))
    .sort((a, b) => b.k - a.k || b.i - a.i)
    .slice(0, n)
    .map((r) => r.x)
}

/** A section with no model: the part's summary, then each source it rests on, quoted, with the point it makes. */
export function scriptedSection(s: GameState, id: string, index: number): string {
  const m = studyOf(s, id).manifesto!
  const sec = m.outline[index]!
  const notes = notesFor(s, id, sec, 4)
  const lines = [sec.summary]
  for (const n of notes) lines.push(`In "${n.book}" (p. ${n.page}) I found this: “${n.quote}” What I take from it: ${n.idea}`)
  if (!notes.length) lines.push("I have not yet found a source I trust for this part, so I will keep studying it.")
  return lines.join("\n\n")
}

export async function sectionWithModel(s: GameState, id: string, index: number, call: ModelCall | null): Promise<string> {
  const script = scriptedSection(s, id, index)
  if (!call) return script
  const m = studyOf(s, id).manifesto!
  const sec = m.outline[index]!
  const notes = notesFor(s, id, sec, 5).map(noteLine).join("\n")
  const prev = m.outline[index - 1]?.body
  try {
    const raw = (await call({
      system: [
        `You are ${nameOf(id)}, a baby ${id} in Valdivia, writing one part of your manifesto "${m.title}". Thesis: ${m.thesis ?? m.topic}.`,
        s.characters[id] ? characterBrief(s.characters[id]!, 2) : "",
        `The outline: ${m.outline.map((x, i) => `${i + 1}. ${x.title}`).join("; ")}.`,
        `You are writing part ${index + 1}, "${sec.title}": ${sec.summary}`,
        prev ? `The previous part ended: …${prev.slice(-260)}` : "",
        `Sources from your workbook:\n${notes || "(none close to this part; say honestly what you do not yet know)"}`,
        "Write this part in full, in your own voice, first person: develop the idea as deeply as you can, in about 250 to 350 words, with at least one picture from life in the valley. Quote a source word for word, with the book's name, where it supports you. Claim nothing your sources do not back.",
        "Plain prose, no headings, no lists. Never mention being an AI.",
      ].filter(Boolean).join("\n"),
      user: "Write the part.",
      schema: { type: "object", properties: { body: { type: "string", maxLength: 2200 } }, required: ["body"] },
      maxTokens: 800,
      temperature: 0.6,
    })) as Record<string, unknown> | null
    const body = str(raw?.body, 2200)
    return body.length >= 200 ? body : script
  } catch {
    return script
  }
}
