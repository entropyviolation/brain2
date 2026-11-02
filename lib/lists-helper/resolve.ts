/**
 * lib/lists-helper/resolve.ts — Turn words into ids: a type, a list, an item (pure)
 *
 * Exact id or exact name first, then a name that starts with the words, then one that contains them. More than
 * one hit at the same step is ambiguous and is never guessed: the caller says which names fit.
 */

import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { Task } from "@/lib/types"
import type { World } from "./types"

export type Resolved =
  | { ok: true; id: string; name: string }
  | {
      ok: false
      error: string
      /** Names that all fit, or the closest ones when none fit exactly. */
      options?: string[]
      /** The kind of thing that was being named ("list", "item type"), so "Other…" can search that kind. */
      noun?: string
      /** The same fits with their ids, so two things with one name can still be told apart and chosen. */
      choices?: { id: string; name: string; detail?: string }[]
    }

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/["“”'‘’]/g, "")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const singular = (s: string) => (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") ? s.slice(0, -1) : s)

const words = (s: string) => clean(s).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(Boolean)

/**
 * Closest names to some words when none fits exactly: the share of the typed words found in the name (a word
 * counts when one starts with the other), so "i follow no follow back" finds "I follow - no follow back (2024)".
 * Best first, at most `limit`. Pure; also the engine behind the "Other…" search.
 */
export function closest<T extends { id: string; name: string }>(rows: T[], typed: string, limit = 6): T[] {
  const q = words(typed)
  if (!q.length) return []
  const scored = rows.flatMap((r) => {
    const n = words(r.name)
    const hit = q.filter((x) => n.some((y) => y === x || (x.length >= 3 && (y.startsWith(x) || x.startsWith(y) && y.length >= 3)))).length
    const score = hit / q.length - Math.max(0, n.length - q.length) * 0.01
    return hit > 0 && (hit >= 2 || q.length === 1 || hit / q.length >= 0.5) ? [{ r, score }] : []
  })
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.r)
}

function pick<T extends { id: string; name: string }>(rows: T[], words: string, noun: string, detail?: (r: T) => string | undefined): Resolved {
  const choice = (r: T) => ({ id: r.id, name: r.name, detail: detail?.(r) })
  const q = clean(words)
  if (!q) return { ok: false, error: `Which ${noun}?` }
  const key = (r: T) => [clean(r.id), clean(r.name)]
  const steps: ((r: T) => boolean)[] = [
    (r) => key(r).includes(q) || key(r).map(singular).includes(singular(q)),
    (r) => key(r).some((k) => k.startsWith(q)),
    (r) => key(r).some((k) => q.length >= 3 && k.includes(q)),
  ]
  for (const step of steps) {
    const hits = rows.filter(step)
    if (hits.length === 1) return { ok: true, id: hits[0]!.id, name: hits[0]!.name }
    if (hits.length > 1) {
      const names = hits.slice(0, 6).map((h) => `"${h.name}"`).join(", ")
      return { ok: false, error: `"${words.trim()}" fits more than one ${noun}: ${names}. Say which.`, options: hits.slice(0, 6).map((h) => h.name), noun, choices: hits.slice(0, 6).map(choice) }
    }
  }
  const near = closest(rows, words)
  if (near.length) {
    return { ok: false, error: `I don't know a ${noun} called "${words.trim()}". Did you mean one of these?`, options: near.map((h) => h.name), noun, choices: near.map(choice) }
  }
  return { ok: false, error: `I don't know a ${noun} called "${words.trim()}".`, noun }
}

export function resolveType(world: World, words: string): Resolved {
  const r = pick(world.types.map((t) => ({ id: String(t.id), name: t.name })), words, "item type")
  if (r.ok) return r
  const known = world.types.slice(0, 14).map((t) => t.name).join(", ")
  return { ok: false, error: r.options ? r.error : `${r.error} Types I know: ${known}.`, options: r.options, noun: "item type" }
}

export function resolveList(world: World, words: string): Resolved {
  const byId = world.lists.find((l) => l.id === words.trim())
  if (byId) return { ok: true, id: byId.id, name: byId.name }
  return pick(world.lists.map((l) => ({ id: l.id, name: l.name })), words, "list", (l) => listDetail(world, l.id))
}

/** "Home · 42 items": where a list is filed and how full it is, so two with one name can be told apart. */
export function listDetail(world: World, id: string): string {
  const folder = world.folders?.find((f) => f.listIds.includes(id))?.name
  const on = world.tasks.filter((t) => (t.lists ?? []).includes(id))
  const first = on.slice(0, 2).map(titleOrBlank).join(", ")
  return [folder, `${on.length} ${on.length === 1 ? "item" : "items"}`, first && `${first}${on.length > 2 ? "…" : ""}`].filter(Boolean).join(" · ")
}

/** Every list whose name is exactly these words (ignoring case, quotes, "the"), for "merge all 3 X lists". */
export function listsNamed(world: World, words: string): { id: string; name: string }[] {
  const q = clean(words)
  return q ? world.lists.filter((l) => !/^__/.test(l.id) && clean(l.name) === q).map((l) => ({ id: l.id, name: l.name })) : []
}

export function resolveFolder(world: World, words: string): Resolved {
  return pick((world.folders ?? []).map((f) => ({ id: f.id, name: f.name })), words, "folder")
}

/** An item by exact id. Item names are never guessed here: a name can fit many. */
export function resolveItemId(world: World, id: string): Task | undefined {
  return world.tasks.find((t) => t.id === id.trim())
}

/** Ids in the text that match a stored item, in order. Falls back to long digit-led tokens so a miss can be reported. */
export function itemIdsIn(world: World, text: string): { known: string[]; unknown: string[] } {
  const ids = new Set(world.tasks.map((t) => t.id))
  const known: string[] = []
  const unknown: string[] = []
  for (const tok of text.match(/[A-Za-z0-9_-]{6,}/g) ?? []) {
    if (ids.has(tok)) known.push(tok)
    else if (/^\d{9,}[a-z0-9]*$/i.test(tok)) unknown.push(tok)
  }
  return { known: [...new Set(known)], unknown: [...new Set(unknown)] }
}

export const titleOf = (t: Task) => itemTitleOrUntitled(t)
const titleOrBlank = titleOf
