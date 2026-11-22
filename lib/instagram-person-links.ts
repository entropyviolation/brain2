/**
 * lib/instagram-person-links.ts — Attach an Instagram account to a Person
 *
 * The link is `personProfile.instagram` (a handle, no @), plus any second
 * accounts in `personProfile.otherInstagrams`. One account belongs to one
 * person, so attaching it takes it off anyone else. Used by the
 * Instagram report's account card (`InstagramView.tsx`).
 */
import { commitItemEdit } from "@/lib/commit-item-edit"
import { createPerson, ensurePeopleIKnowList, personNamed, personRecords } from "@/lib/people-i-know"
import { normalizeInstagram, presentPersonProfile } from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const INSTAGRAM_LINK: { surface: "unknown" } = { surface: "unknown" }

const same = (a: string | undefined, b: string) => !!a && normalizeInstagram(a).toLowerCase() === b.toLowerCase()

const carries = (p: Task, clean: string) => same(p.personProfile?.instagram, clean) || !!p.personProfile?.otherInstagrams?.some((h) => same(h, clean))

/** The person who carries this handle (main or second account), if any. */
export function personForInstagram(people: readonly Task[], handle: string): Task | null {
  const clean = normalizeInstagram(handle)
  return clean ? (people.find((p) => carries(p, clean)) ?? null) : null
}

/**
 * One more account for this person: the main one when they have none, else a second one. Taken off anyone
 * else first. Returns "main", "other", or "had" when they already carry it.
 */
export function addInstagramToPerson(personId: string, handle: string): "main" | "other" | "had" | null {
  const clean = normalizeInstagram(handle)
  if (!clean) return null
  const { tasks, lists } = useTaskStore.getState()
  const before = tasks.find((t) => t.id === personId)
  if (!before) return null
  if (carries(before, clean)) return "had"
  for (const other of personRecords(tasks, lists)) {
    if (other.id === personId || !carries(other, clean)) continue
    const prof = other.personProfile ?? {}
    const rest = (prof.otherInstagrams ?? []).filter((h) => !same(h, clean))
    const profile = same(prof.instagram, clean) ? { ...prof, instagram: rest[0], otherInstagrams: rest.slice(1) } : { ...prof, otherInstagrams: rest }
    commitItemEdit(other.id, { personProfile: presentPersonProfile(profile) }, INSTAGRAM_LINK)
  }
  const person = useTaskStore.getState().tasks.find((t) => t.id === personId)!
  const prof = person.personProfile ?? {}
  if (!prof.instagram) {
    write(person, clean)
    return "main"
  }
  commitItemEdit(person.id, { personProfile: presentPersonProfile({ ...prof, otherInstagrams: [...(prof.otherInstagrams ?? []), clean] }) }, INSTAGRAM_LINK)
  return "other"
}

function write(person: Task, instagram: string | undefined): void {
  const profile = { ...(person.personProfile ?? {}), instagram }
  commitItemEdit(person.id, { personProfile: presentPersonProfile(profile) }, INSTAGRAM_LINK)
}

export function linkInstagramToPerson(personId: string, handle: string): void {
  const clean = normalizeInstagram(handle)
  if (!clean) return
  const { tasks, lists } = useTaskStore.getState()
  for (const other of personRecords(tasks, lists)) {
    if (other.id !== personId && same(other.personProfile?.instagram, clean)) write(other, undefined)
  }
  const person = tasks.find((t) => t.id === personId)
  if (person && !same(person.personProfile?.instagram, clean)) write(person, clean)
}

export function unlinkInstagramFromPerson(personId: string, handle: string): void {
  const person = useTaskStore.getState().tasks.find((t) => t.id === personId)
  if (person && same(person.personProfile?.instagram, normalizeInstagram(handle))) write(person, undefined)
}

/** A new People I Know item for this account, named by the report's display name or the handle. */
export function createPersonFromInstagram(handle: string, name?: string): string | null {
  const clean = normalizeInstagram(handle)
  if (!clean) return null
  const label = (name ?? "").trim() || clean
  const known = personNamed(label)
  if (known) {
    linkInstagramToPerson(known.id, clean)
    return known.id
  }
  const person = createPerson(label, ensurePeopleIKnowList())
  useTaskStore.getState().addTask(person)
  linkInstagramToPerson(person.id, clean)
  return person.id
}
