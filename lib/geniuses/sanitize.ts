/**
 * lib/geniuses/sanitize.ts — Clamp anything read from disk into a valid genius, talk or meeting
 *
 * Unknown fields drop, lengths clamp, caps apply. `dropDangling` removes binding ids that no longer exist in the vault.
 */

import {
  GENIUS_ORIGINS,
  GENIUS_STANCES,
  GENIUS_STATUSES,
  NOTE_ABOUT_KINDS,
  type CouncilAsk,
  type CouncilMeeting,
  type CouncilReply,
  type Genius,
  type GeniusBindings,
  type GeniusNote,
  type GeniusNoteAbout,
  type GeniusTalk,
  type TalkLine,
} from "./types"

export const MAX_ACTIVE = 7
export const MAX_NOTES = 200
export const MAX_TALKS = 60
export const MAX_TALK_LINES = 12
export const MAX_MEETINGS = 60
export const CHARTER_MAX = 280
export const LINE_MAX = 280
export const NAME_MAX = 40
export const AREA_MAX = 80

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
export const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== ""))] : [])
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)
const iso = (v: unknown, fallback: string): string => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : fallback)

export const emptyBindings = (): GeniusBindings => ({ objectiveIds: [], goalIds: [], listIds: [], habitIds: [], rootItemIds: [] })

export function sanitizeBindings(raw: unknown): GeniusBindings {
  const b = obj(raw)
  return { objectiveIds: ids(b.objectiveIds), goalIds: ids(b.goalIds), listIds: ids(b.listIds), habitIds: ids(b.habitIds), rootItemIds: ids(b.rootItemIds) }
}

export function sanitizeAbout(raw: unknown): GeniusNoteAbout {
  const a = obj(raw)
  const id = clip(a.id, 200)
  return id && NOTE_ABOUT_KINDS.includes(a.kind as never) ? { kind: a.kind as NonNullable<GeniusNoteAbout>["kind"], id } : null
}

export function sanitizeNote(raw: unknown, now = new Date().toISOString()): GeniusNote | null {
  const n = obj(raw)
  const said = clip(n.said, LINE_MAX)
  if (!said) return null
  return { id: clip(n.id, 80) || `gn-${Math.random().toString(36).slice(2, 10)}`, at: iso(n.at, now), said, about: sanitizeAbout(n.about), source: n.source === "picked-up" ? "picked-up" : "you" }
}

export function sanitizeGenius(raw: unknown, now = new Date().toISOString()): Genius | null {
  const g = obj(raw)
  const id = clip(g.id, 80)
  const name = clip(g.name, NAME_MAX)
  if (!id || !name) return null
  const notes = (Array.isArray(g.notes) ? g.notes : []).map((n) => sanitizeNote(n, now)).filter((n): n is GeniusNote => n !== null).slice(-MAX_NOTES)
  return {
    id,
    name,
    animalId: clip(g.animalId, 80),
    area: clip(g.area, AREA_MAX),
    charter: clip(g.charter, CHARTER_MAX),
    bindings: sanitizeBindings(g.bindings),
    notes,
    origin: oneOf(g.origin, GENIUS_ORIGINS, "starter"),
    status: oneOf(g.status, GENIUS_STATUSES, "active"),
    createdAt: iso(g.createdAt, now),
  }
}

/** Unique ids; no more than `MAX_ACTIVE` active (later ones rest). */
export function sanitizeGeniuses(raw: unknown, now?: string): Genius[] {
  const seen = new Set<string>()
  let active = 0
  const out: Genius[] = []
  for (const row of Array.isArray(raw) ? raw : []) {
    const g = sanitizeGenius(row, now)
    if (!g || seen.has(g.id)) continue
    seen.add(g.id)
    if (g.status === "active" && ++active > MAX_ACTIVE) g.status = "resting"
    out.push(g)
  }
  return out
}

function sanitizeLine(raw: unknown, now: string): TalkLine | null {
  const l = obj(raw)
  const text = clip(l.text, LINE_MAX)
  if (!text) return null
  const line: TalkLine = { at: iso(l.at, now), who: l.who === "genius" ? "genius" : "you", text }
  if (GENIUS_STANCES.includes(l.stance as never)) line.stance = l.stance as TalkLine["stance"]
  if (l.by === "model" || l.by === "script") line.by = l.by
  return line
}

export function sanitizeTalk(raw: unknown, now = new Date().toISOString()): GeniusTalk | null {
  const t = obj(raw)
  const id = clip(t.id, 80)
  const geniusId = clip(t.geniusId, 80)
  const task = clip(t.task, LINE_MAX)
  if (!id || !geniusId || !task) return null
  const lines = (Array.isArray(t.lines) ? t.lines : []).map((l) => sanitizeLine(l, now)).filter((l): l is TalkLine => l !== null).slice(-MAX_TALK_LINES)
  const outcome = oneOf(t.outcome, ["open", "accepted", "declined", "conceded", "rescheduled"] as const, "open")
  return { id, geniusId, startedAt: iso(t.startedAt, now), task, taskId: clip(t.taskId, 200) || null, lines, outcome }
}

export const sanitizeTalks = (raw: unknown, now?: string): GeniusTalk[] =>
  (Array.isArray(raw) ? raw : []).map((t) => sanitizeTalk(t, now)).filter((t): t is GeniusTalk => t !== null).slice(-MAX_TALKS)

function sanitizeAsk(raw: unknown): CouncilAsk | null {
  const a = obj(raw)
  const geniusId = clip(a.geniusId, 80)
  const ask = clip(a.ask, LINE_MAX)
  if (!geniusId || !ask) return null
  return { geniusId, ask, why: clip(a.why, LINE_MAX), by: a.by === "model" ? "model" : "script" }
}

function sanitizeReply(raw: unknown): CouncilReply | null {
  const r = obj(raw)
  const geniusId = clip(r.geniusId, 80)
  const line = clip(r.line, LINE_MAX)
  if (!geniusId || !line) return null
  return { geniusId, line, yieldsTo: clip(r.yieldsTo, 80) || null, by: r.by === "model" ? "model" : "script" }
}

export function sanitizeMeeting(raw: unknown, now = new Date().toISOString()): CouncilMeeting | null {
  const m = obj(raw)
  const id = clip(m.id, 80)
  const topic = clip(m.topic, LINE_MAX)
  if (!id || !topic) return null
  const geniusIds = ids(m.geniusIds)
  const asks = (Array.isArray(m.asks) ? m.asks : []).map(sanitizeAsk).filter((a): a is CouncilAsk => a !== null)
  const replies = (Array.isArray(m.replies) ? m.replies : []).map(sanitizeReply).filter((r): r is CouncilReply => r !== null)
  const picked = clip(m.pickedId, 80)
  return { id, at: iso(m.at, now), topic, geniusIds, asks, replies, pickedId: picked && geniusIds.includes(picked) ? picked : null, pickNote: clip(m.pickNote, LINE_MAX) }
}

export const sanitizeMeetings = (raw: unknown, now?: string): CouncilMeeting[] =>
  (Array.isArray(raw) ? raw : []).map((m) => sanitizeMeeting(m, now)).filter((m): m is CouncilMeeting => m !== null).slice(-MAX_MEETINGS)

/** What still exists in the vault, by id. */
export type VaultIds = { objectiveIds: Set<string>; goalIds: Set<string>; listIds: Set<string>; habitIds: Set<string>; itemIds: Set<string> }

/** Binding ids the vault no longer has are dropped. The genius itself stays. */
export function dropDangling(g: Genius, vault: VaultIds): Genius {
  const b = g.bindings
  return {
    ...g,
    bindings: {
      objectiveIds: b.objectiveIds.filter((id) => vault.objectiveIds.has(id)),
      goalIds: b.goalIds.filter((id) => vault.goalIds.has(id)),
      listIds: b.listIds.filter((id) => vault.listIds.has(id)),
      habitIds: b.habitIds.filter((id) => vault.habitIds.has(id)),
      rootItemIds: b.rootItemIds.filter((id) => vault.itemIds.has(id)),
    },
  }
}
