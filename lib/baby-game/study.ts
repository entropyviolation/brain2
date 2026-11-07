/**
 * lib/baby-game/study.ts — Studying and the manifesto: every friend with books is slowly writing one
 *
 * Besides reading (`shelf.ts`), a friend with books sometimes **studies** at the bookshelf (`shelfActivity` picks which,
 * a little more rarely than reading). A study session (`study-llm.ts`) searches the shelf, and the friend keeps a note
 * in their **Study notebook** only when they judge it good, worthy and truthful and can pair it with a quote from the
 * pages. Each session ends with a summary. After `SESSIONS_FOR_TOPIC` sessions a **manifesto topic** is drawn out of
 * them (`adoptTopic`); the next morning it is announced (`announceManifestos`). From then on study notes go to the
 * **manifesto study workbook**, and after `WORKBOOK_SESSIONS_FOR_OUTLINE` sessions the friend can write the manifesto:
 * an outline, then each section fleshed out, one sitting at a time. With an outline they want to be read: when they
 * meet a friend (`pitchTarget`) they ask, and a friend who says yes gets a copy on their shelf (`giveCopy`), an
 * ordinary `Book` whose words are `inline`, so they read it like any other and it comes up in their talks.
 *
 * Everything here is pure and keeps its state in `GameState.study[friendId]`.
 */

import { RESIDENTS } from "./cast"
import { remember } from "./character"
import type { GameState } from "./engine"
import { nextBook, SHELF_MAX, SPINES, type Book } from "./shelf"

/** One thing a friend wrote down because it was good, worthy and truthful, with where it came from. */
export type StudyNote = {
  day: number
  /** The idea in their own words. */
  idea: string
  /** Copied word for word from the pages. */
  quote: string
  book: string
  bookId: string
  page: number
  theme: string
}

export type StudySession = {
  day: number
  minute: number
  theme: string
  /** How they capped it off. */
  summary: string
  searches: Array<{ tool: "shelf" | "book"; query: string; book?: string }>
  kept: number
  /** Notes they proposed that failed the check (no real quote, repeated, or not good, worthy and true). */
  refused: number
  by: "model" | "scripted"
  /** Part of the manifesto study workbook rather than the free notebook. */
  manifesto?: true
}

export type Section = { title: string; summary: string; body?: string }

export type Pitch = { day: number; yes: boolean }

export type Manifesto = {
  topic: string
  title: string
  decidedDay: number
  /** Said out loud the morning after they decided. Until then it is a quiet plan. */
  announced: boolean
  thesis?: string
  outline: Section[]
  /** Who has been asked to read it, by friend id. */
  pitched: Record<string, Pitch>
}

export type Study = {
  notebook: StudyNote[]
  /** Notes made after the topic was announced: the manifesto study workbook. */
  workbook: StudyNote[]
  sessions: StudySession[]
  manifesto?: Manifesto
}

export const SESSIONS_FOR_TOPIC = 10
export const WORKBOOK_SESSIONS_FOR_OUTLINE = 3
export const NOTEBOOK_MAX = 120
export const WORKBOOK_MAX = 160
export const SESSIONS_MAX = 60
export const SECTIONS_MAX = 8
/** Days before a friend who said no is asked again. */
export const PITCH_AGAIN = 5

const name = (id: string) => RESIDENTS.find((r) => r.id === id)?.name ?? id

export const blankStudy = (): Study => ({ notebook: [], workbook: [], sessions: [], manifesto: undefined })

export const studyOf = (s: GameState, id: string): Study => s.study?.[id] ?? blankStudy()

/** Update one friend's study on a copy of the state. */
function withStudy(s0: GameState, id: string, f: (st: Study, s: GameState) => void): GameState {
  const s = structuredClone(s0)
  const st = { ...blankStudy(), ...(s.study?.[id] ?? {}) }
  f(st, s)
  s.study = { ...(s.study ?? {}), [id]: st }
  return s
}

/** The manifesto once it has been announced (before that it does not change what they do). */
export const activeManifesto = (s: GameState, id: string): Manifesto | null => {
  const m = s.study?.[id]?.manifesto
  return m?.announced ? m : null
}

export const workbookSessions = (st: Study) => st.sessions.filter((x) => x.manifesto).length
const freeSessions = (st: Study) => st.sessions.filter((x) => !x.manifesto).length

export const nextSection = (m: Manifesto): number => m.outline.findIndex((x) => !x.body)
export const manifestoDone = (m: Manifesto) => m.outline.length > 0 && nextSection(m) < 0

/** They can work on the manifesto: studied enough for an outline, or have an outline with sections left. */
export function canWrite(s: GameState, id: string): boolean {
  const m = activeManifesto(s, id)
  if (!m || manifestoDone(m)) return false
  return m.outline.length > 0 || workbookSessions(studyOf(s, id)) >= WORKBOOK_SESSIONS_FOR_OUTLINE
}

/** Enough free sessions have happened and no topic has been drawn yet. */
export const topicDue = (s: GameState, id: string): boolean => {
  const st = studyOf(s, id)
  return !st.manifesto && freeSessions(st) >= SESSIONS_FOR_TOPIC
}

function hash(...parts: Array<string | number>): number {
  let h = 2166136261
  for (const c of parts.join("|")) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) % 6
}

export type ShelfActivity = "read" | "study" | "write"

/**
 * What a friend does with this hour of "reading from the bookshelf". Reading stays the main thing (four hours in six);
 * studying takes two in six; once the manifesto can be written, writing takes two of those six and reading two. Reading
 * with nothing unread left becomes studying. No books: reading (which then does nothing, as before).
 */
export function shelfActivity(s: GameState, id: string, hour: number): ShelfActivity {
  const books = s.shelves?.[id] ?? []
  if (!books.length) return "read"
  const roll = hash(id, s.day, hour)
  let act: ShelfActivity
  if (canWrite(s, id)) act = roll < 2 ? "study" : roll < 4 ? "write" : "read"
  else act = roll < 2 ? "study" : "read"
  if (act === "read" && !nextBook(s, id)) act = "study"
  return act
}

export type SessionResult = { session: StudySession; notes: StudyNote[] }

/** Write a finished session into the save: its notes (notebook or workbook), the log, and a memory. */
export function applyStudy(s0: GameState, id: string, res: SessionResult): GameState {
  const manifesto = !!activeManifesto(s0, id)
  const s = withStudy(s0, id, (st) => {
    const notes = res.notes
    if (manifesto) st.workbook = [...st.workbook, ...notes].slice(-WORKBOOK_MAX)
    else st.notebook = [...st.notebook, ...notes].slice(-NOTEBOOK_MAX)
    st.sessions = [...st.sessions, { ...res.session, ...(manifesto ? { manifesto: true as const } : {}) }].slice(-SESSIONS_MAX)
  })
  remember(s.characters, id, s.day, "study", `studied ${res.session.theme}: ${res.session.summary}`.slice(0, 260))
  return s
}

/** Start a manifesto on a topic drawn from the sessions. It is announced the next morning. */
export function adoptTopic(s0: GameState, id: string, pick: { topic: string; title: string }): GameState {
  if (studyOf(s0, id).manifesto) return s0
  return withStudy(s0, id, (st, s) => {
    st.manifesto = { topic: pick.topic.trim().slice(0, 80), title: pick.title.trim().slice(0, 100), decidedDay: s.day, announced: false, outline: [], pitched: {} }
  })
}

/** Morning: manifestos decided on an earlier day are said out loud. Returns the news lines. */
export function announceManifestos(s0: GameState): { s: GameState; news: string[] } {
  const due = Object.entries(s0.study ?? {}).filter(([, st]) => st.manifesto && !st.manifesto.announced && st.manifesto.decidedDay < s0.day)
  if (!due.length) return { s: s0, news: [] }
  const s = structuredClone(s0)
  const news: string[] = []
  for (const [id] of due) {
    const m = s.study![id]!.manifesto!
    m.announced = true
    news.push(`${name(id)} has decided to write a manifesto about ${m.topic}.`)
    remember(s.characters, id, s.day, "study", `decided to write a manifesto about ${m.topic}, called "${m.title}"`)
  }
  return { s, news }
}

export type OutlineDraft = { title?: string; thesis: string; sections: Section[] }

/** Save the outline (sections without bodies yet) and unlock sharing. */
export function applyOutline(s0: GameState, id: string, o: OutlineDraft): GameState {
  const m0 = studyOf(s0, id).manifesto
  if (!m0 || m0.outline.length || !o.sections.length) return s0
  const s = withStudy(s0, id, (st) => {
    const m = st.manifesto!
    if (o.title?.trim()) m.title = o.title.trim().slice(0, 100)
    m.thesis = o.thesis.trim().slice(0, 500)
    m.outline = o.sections.slice(0, SECTIONS_MAX).map((x) => ({ title: x.title.trim().slice(0, 80), summary: x.summary.trim().slice(0, 300) }))
  })
  remember(s.characters, id, s.day, "study", `outlined my manifesto "${s.study![id]!.manifesto!.title}" in ${s.study![id]!.manifesto!.outline.length} parts`)
  return syncCopies(s)
}

/** Save one section's body. */
export function applySection(s0: GameState, id: string, index: number, body: string): GameState {
  const m0 = studyOf(s0, id).manifesto
  if (!m0 || !m0.outline[index] || !body.trim()) return s0
  const s = withStudy(s0, id, (st) => {
    st.manifesto!.outline[index]!.body = body.trim().slice(0, 2400)
  })
  const m = s.study![id]!.manifesto!
  remember(s.characters, id, s.day, "study", manifestoDone(m) ? `finished writing my manifesto "${m.title}"` : `wrote the part called "${m.outline[index]!.title}" of my manifesto`)
  return syncCopies(s)
}

export const MANIFESTO_MAX = 40_000

/** A manifesto as a book's words: a cover page, one page per section, then its sources. */
export function manifestoText(s: GameState, id: string): { text: string; pageStarts: number[] } | null {
  const st = studyOf(s, id)
  const m = st.manifesto
  if (!m || !m.outline.length) return null
  const pages: string[] = [`${m.title}\nby ${name(id)}\nA manifesto on ${m.topic}.\n\n${m.thesis ?? ""}`]
  m.outline.forEach((sec, n) => pages.push(`${n + 1}. ${sec.title}\n${sec.summary}\n\n${sec.body ?? "(I have not written this part yet.)"}`))
  const sources = st.workbook.slice(-24).map((n) => `“${n.quote}” ${n.book}, p. ${n.page}.`)
  if (sources.length) pages.push(`Sources I studied\n\n${sources.join("\n")}`)
  const pageStarts: number[] = []
  let text = ""
  for (const p of pages) {
    pageStarts.push(text.length)
    text += (text ? "\n\n" : "") + p
  }
  return { text: text.slice(0, MANIFESTO_MAX), pageStarts }
}

export const manifestoBookId = (author: string) => `mf_${author}`
export const manifestoTitle = (s: GameState, author: string) => `${name(author)}: ${studyOf(s, author).manifesto?.title ?? "Manifesto"}`

/** Copies of a manifesto on shelves follow the author's draft as it grows; where a reader has got to is kept. */
export function syncCopies(s0: GameState): GameState {
  if (!Object.values(s0.shelves ?? {}).some((bs) => bs.some((b) => b.manifestoBy))) return s0
  const s = structuredClone(s0)
  for (const [owner, books] of Object.entries(s.shelves)) {
    s.shelves[owner] = books.map((b) => {
      if (!b.manifestoBy) return b
      const t = manifestoText(s, b.manifestoBy)
      return t ? { ...b, title: manifestoTitle(s, b.manifestoBy), inline: t.text, chars: t.text.length, pageStarts: t.pageStarts } : b
    })
  }
  return s
}

export const hasCopy = (s: GameState, reader: string, author: string) => (s.shelves?.[reader] ?? []).some((b) => b.manifestoBy === author)

/** Put a copy of the author's manifesto on the reader's shelf unless they have one or the shelf is full. */
export function giveCopy(s0: GameState, author: string, reader: string): GameState {
  const t = manifestoText(s0, author)
  const shelf = s0.shelves?.[reader] ?? []
  if (!t || hasCopy(s0, reader, author) || shelf.length >= SHELF_MAX) return s0
  const s = structuredClone(s0)
  s.shelves[reader] = [
    ...shelf,
    {
      id: manifestoBookId(author), title: manifestoTitle(s, author), fileUri: "", textUri: "", chars: t.text.length, pageStarts: t.pageStarts, inline: t.text, manifestoBy: author,
      at: 0, readings: [], addedDay: s.day, spine: (shelf.length * 3 + author.length) % SPINES,
    } satisfies Book,
  ]
  return s
}

/** The manifesto can be shared once it has an outline and has been announced. */
export const pitchable = (s: GameState, id: string): boolean => (activeManifesto(s, id)?.outline.length ?? 0) > 0

/**
 * Who asks whom when two friends meet: an author with something to share and a friend who has no copy and has not just
 * said no. The urge is strong but not constant (two meetings in three). Null when neither has one to offer.
 */
export function pitchTarget(s: GameState, a: string, b: string, pick: number): { author: string; reader: string } | null {
  if (pick % 3 === 0) return null
  const ok = (author: string, reader: string) => {
    if (!pitchable(s, author) || hasCopy(s, reader, author) || (s.shelves?.[reader] ?? []).length >= SHELF_MAX) return false
    const p = studyOf(s, author).manifesto!.pitched[reader]
    return !p || (!p.yes && s.day - p.day >= PITCH_AGAIN)
  }
  const first = pick % 2 === 0 ? [a, b] : [b, a]
  const author = ok(first[0]!, first[1]!) ? first[0]! : ok(first[1]!, first[0]!) ? first[1]! : null
  return author ? { author, reader: author === a ? b : a } : null
}

/** Record that the author asked and what the reader said; a yes puts the manifesto on the reader's shelf. */
export function applyPitch(s0: GameState, p: { author: string; reader: string; yes: boolean }): GameState {
  if (!studyOf(s0, p.author).manifesto) return s0
  let s = withStudy(s0, p.author, (st, st0) => {
    st.manifesto!.pitched[p.reader] = { day: st0.day, yes: p.yes }
  })
  const m = s.study![p.author]!.manifesto!
  if (p.yes) {
    s = giveCopy(s, p.author, p.reader)
    remember(s.characters, p.reader, s.day, "study", `agreed to read ${name(p.author)}'s manifesto "${m.title}"`)
    remember(s.characters, p.author, s.day, "study", `${name(p.reader)} agreed to read my manifesto`)
  } else remember(s.characters, p.author, s.day, "study", `asked ${name(p.reader)} to read my manifesto, but not now`)
  return s
}

/** Would a friend say yes, with no model: bond and a love of books decide, a little luck settles the rest. */
export function scriptedYes(s: GameState, reader: string, author: string, pick: number): boolean {
  const bond = s.minds?.[reader]?.bonds[author] ?? 0
  const bookish = (s.minds?.[reader]?.likes ?? []).some((l) => /book|stor/i.test(l)) || (s.shelves?.[reader]?.length ?? 0) > 0
  return bond > -3 && (bond >= 2 || bookish) && pick % 4 !== 1
}
