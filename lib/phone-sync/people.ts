/**
 * lib/phone-sync/people.ts — Match a phone party to a person
 *
 * Order: a saved phone or email on People I Know, then the Contacts name the
 * source gave (fuzzy, through the BIM name resolver), then nothing. Pure: the
 * caller passes the people in.
 */
import { resolveName } from "@/lib/ingest/name-resolve"
import { formatHandle, normalizeHandle } from "./handles"
import type { PhoneParty } from "./types"

export interface PhonePerson {
  id: string
  name: string
  nicknames?: string[]
  phones?: string[]
  emails?: string[]
}

export type PersonMatch =
  | { status: "handle"; personId: string; name: string }
  | { status: "name"; personId: string; name: string }
  | { status: "unknown"; name: string }

export function matchPerson(party: PhoneParty, people: readonly PhonePerson[]): PersonMatch {
  const handle = normalizeHandle(party.handle)
  if (handle) {
    for (const person of people) {
      const saved = [...(person.phones ?? []), ...(person.emails ?? [])].map((h) => normalizeHandle(h))
      if (saved.includes(handle)) return { status: "handle", personId: person.id, name: person.name }
    }
  }
  const display = party.displayName?.trim()
  if (display) {
    const named = people.flatMap((p) => [p.name, ...(p.nicknames ?? [])].map((name) => ({ id: p.id, name })))
    const hit = resolveName(display, named)
    if (hit.status === "match") {
      const person = people.find((p) => p.id === hit.candidate.id)
      if (person) return { status: "name", personId: person.id, name: person.name }
    }
    return { status: "unknown", name: display }
  }
  return { status: "unknown", name: formatHandle(party.handle) }
}
