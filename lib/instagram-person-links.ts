/**
 * lib/instagram-person-links.ts — Attach an Instagram account to a Person
 *
 * The link is `personProfile.instagram` (a handle, no @). One account belongs
 * to one person, so attaching it takes it off anyone else. Used by the
 * Instagram report's account card (`InstagramView.tsx`).
 */
import { commitItemEdit } from "@/lib/commit-item-edit"
import { createPerson, ensurePeopleIKnowList, personRecords } from "@/lib/people-i-know"
import { normalizeInstagram, presentPersonProfile } from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const SOURCE = "instagram link"

const same = (a: string | undefined, b: string) => !!a && normalizeInstagram(a).toLowerCase() === b.toLowerCase()

/** The person who carries this handle, if any. */
export function personForInstagram(people: readonly Task[], handle: string): Task | null {
  const clean = normalizeInstagram(handle)
  return clean ? (people.find((p) => same(p.personProfile?.instagram, clean)) ?? null) : null
}

function write(person: Task, instagram: string | undefined): void {
  const profile = { ...(person.personProfile ?? {}), instagram }
  commitItemEdit(person.id, { personProfile: presentPersonProfile(profile) }, SOURCE)
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
  const person = createPerson((name ?? "").trim() || clean, ensurePeopleIKnowList())
  useTaskStore.getState().addTask(person)
  linkInstagramToPerson(person.id, clean)
  return person.id
}
