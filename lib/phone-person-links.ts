/**
 * lib/phone-person-links.ts — Link a phone number to a person, from any room
 *
 * The app side of `lib/phone-sync/person-links.ts`. A link is a number (or
 * email) saved on the Person item (`personProfile.phones` / `emails`); the
 * iPhone Texts and iPhone Calls pens then follow it. One number belongs to one
 * person, so linking it takes it off anyone else. Used by the pen settings
 * dialog, person detail, and Analytics → Texts.
 */
import { commitItemEdit } from "@/lib/commit-item-edit"
import { isEmailHandle, normalizeHandle } from "@/lib/phone-sync/handles"
import type { PhonePerson } from "@/lib/phone-sync/people"
import { penHandle, PHONE_PEN_SCOPE_IDS, relinkPhonePens, twinPenId } from "@/lib/phone-sync/person-links"
import { phonePeople } from "@/lib/phone-sync/write"
import { presentPersonProfile } from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const SOURCE = "phone link"

/**
 * Rename and link the phone pens to match the people. `draft` stands in for a
 * person whose edit has not saved yet (person detail).
 */
export function syncPhonePersonLinks(draft?: PhonePerson): void {
  const people = phonePeople().map((person) => (draft && person.id === draft.id ? draft : person))
  if (draft && !people.some((person) => person.id === draft.id)) people.push(draft)
  const { scopes } = useTimeTrackingStore.getState()
  const next = relinkPhonePens(scopes, people)
  if (next !== scopes) useTimeTrackingStore.setState({ scopes: next })
}

function sameHandle(a: string, b: string): boolean {
  return normalizeHandle(a) === normalizeHandle(b)
}

function writeHandles(personId: string, add: readonly string[], remove: readonly string[]): void {
  const person = useTaskStore.getState().tasks.find((task) => task.id === personId)
  if (!person) return
  const profile = person.personProfile ?? {}
  const keep = (list: readonly string[] | undefined) => (list ?? []).filter((h) => !remove.some((r) => sameHandle(h, r)))
  let phones = keep(profile.phones)
  let emails = keep(profile.emails)
  for (const raw of add) {
    const h = normalizeHandle(raw)
    if (!h || [...phones, ...emails].some((other) => sameHandle(other, h))) continue
    if (isEmailHandle(h)) emails = [...emails, h]
    else phones = [...phones, h]
  }
  const same = (a: readonly string[] | undefined, b: readonly string[]) => (a ?? []).join("\n") === b.join("\n")
  if (same(profile.phones, phones) && same(profile.emails, emails)) return
  commitItemEdit(personId, { personProfile: presentPersonProfile({ ...profile, phones, emails }) }, SOURCE)
}

/** Take these numbers / emails off everyone but `personId`. One number, one person. */
export function takeHandlesFromOthers(personId: string, handles: readonly string[]): void {
  const wanted = handles.map((h) => normalizeHandle(h)).filter(Boolean)
  if (!wanted.length) return
  for (const other of phonePeople()) {
    if (other.id === personId) continue
    const theirs = [...(other.phones ?? []), ...(other.emails ?? [])]
    const taken = theirs.filter((h) => wanted.some((w) => sameHandle(h, w)))
    if (taken.length) writeHandles(other.id, [], taken)
  }
}

/** Save these numbers / emails on a person and take them off everyone else. */
export function linkHandlesToPerson(personId: string, handles: readonly string[]): void {
  const wanted = handles.map((h) => normalizeHandle(h)).filter(Boolean)
  if (!wanted.length) return
  takeHandlesFromOthers(personId, wanted)
  writeHandles(personId, wanted, [])
  syncPhonePersonLinks()
}

/** Take these numbers / emails off a person. */
export function unlinkHandlesFromPerson(personId: string, handles: readonly string[]): void {
  writeHandles(personId, [], handles)
  syncPhonePersonLinks()
}

/**
 * Link a phone pen to a person, or unlink it (`personId` null). A pen that
 * stands for a number links through that number; a pen Contacts named, with
 * no number, links on the pen itself (and its twin on the other phone view).
 */
export function linkPhonePenToPerson(scopeId: string, penId: string, personId: string | null): void {
  if (!PHONE_PEN_SCOPE_IDS.includes(scopeId)) return
  const { scopes } = useTimeTrackingStore.getState()
  const pen = scopes.find((s) => s.id === scopeId)?.pens.find((p) => p.id === penId)
  if (!pen) return
  const handle = penHandle(pen)
  if (handle) {
    if (personId) linkHandlesToPerson(personId, [handle])
    else if (pen.personId) unlinkHandlesFromPerson(pen.personId, [handle])
    return
  }
  const twin = twinPenId(penId)
  const now = Date.now()
  const next = scopes.map((scope) => {
    if (!PHONE_PEN_SCOPE_IDS.includes(scope.id)) return scope
    return {
      ...scope,
      pens: scope.pens.map((p) => {
        if (p.id !== penId && p.id !== twin) return p
        if (personId) return { ...p, personId, editedAt: now }
        const { personId: _gone, ...rest } = p
        return { ...rest, editedAt: now }
      }),
    }
  })
  useTimeTrackingStore.setState({ scopes: next })
  syncPhonePersonLinks()
}
