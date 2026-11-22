/**
 * lib/known-instagrams.ts — Every Instagram handle the vault already knows, and a typeahead over them
 *
 * Sources: a person's `personProfile.instagram` and `otherInstagrams`, and rows from an Instagram
 * import (`ig-username` / `ig-profile`, read by `instagramUsernameOf`). A handle carried by a person
 * shows that person's name. A new handle typed into a card becomes known once it is saved on a person.
 * Used by the Instagram field on the BIM report card (`components/Bim/report-card.tsx`).
 */
import { instagramUsernameOf } from "@/lib/instagram-profile-link"
import { personRecords } from "@/lib/people-i-know"
import { normalizeInstagram } from "@/lib/person-profile"
import type { List, Task } from "@/lib/types"

export type KnownInstagram = { handle: string; who?: string; person: boolean }

export function knownInstagrams(tasks: readonly Task[], lists: readonly List[]): KnownInstagram[] {
  const byKey = new Map<string, KnownInstagram>()
  const add = (raw: string | undefined, who: string | undefined, person: boolean) => {
    const handle = normalizeInstagram(raw ?? "")
    if (!handle) return
    const key = handle.toLowerCase()
    const had = byKey.get(key)
    if (had && (had.person || !person)) return
    const name = who?.trim()
    byKey.set(key, { handle, who: name && name.toLowerCase() !== key ? name : undefined, person })
  }
  for (const p of personRecords(tasks as Task[], lists as List[])) {
    const name = p.title || p.description
    add(p.personProfile?.instagram, name, true)
    for (const h of p.personProfile?.otherInstagrams ?? []) add(h, name, true)
  }
  for (const t of tasks) add(instagramUsernameOf(t), t.title, false)
  return [...byKey.values()]
}

/** Best matches for what is typed: handle prefix, then handle contains, then the person's name. */
export function suggestInstagrams(known: readonly KnownInstagram[], typed: string, limit = 8): KnownInstagram[] {
  const q = normalizeInstagram(typed).toLowerCase()
  if (!q) return []
  const rank = (k: KnownInstagram) => {
    const h = k.handle.toLowerCase()
    const w = (k.who ?? "").toLowerCase()
    if (h === q) return -1
    if (h.startsWith(q)) return 0
    if (h.includes(q)) return 1
    if (w.split(/\s+/).some((part) => part.startsWith(q))) return 2
    if (w.includes(q)) return 3
    return 9
  }
  return known
    .map((k) => ({ k, r: rank(k) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || Number(b.k.person) - Number(a.k.person) || a.k.handle.length - b.k.handle.length)
    .slice(0, limit)
    .map((x) => x.k)
}
