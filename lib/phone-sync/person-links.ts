/**
 * lib/phone-sync/person-links.ts — Phone numbers ↔ People I Know
 *
 * One source of truth: the numbers and emails saved on the Person
 * (`personProfile.phones` / `emails`). A pen on iPhone Texts or iPhone Calls
 * whose number is saved on a person carries `personId` and shows that
 * person's name. A pen with no known number (one Contacts named) can be
 * linked by hand; it keeps `personId` with no number.
 *
 * Pens are renamed, not merged: rows keep their pen, so nothing is re-written
 * and the hub's union by id has nothing to fight over. Pure.
 */
import { IPHONE_CALLS_SCOPE_ID, IPHONE_TEXTS_SCOPE_ID } from "@/lib/time-tracking-store"
import { formatHandle, isEmailHandle, normalizeHandle } from "./handles"
import type { PhonePerson } from "./people"

export const PHONE_PEN_SCOPE_IDS: readonly string[] = [IPHONE_TEXTS_SCOPE_ID, IPHONE_CALLS_SCOPE_ID]

type LinkPen = { id: string; name: string; personId?: string; handle?: string; editedAt?: number }
type LinkScope = { id: string; pens: LinkPen[] }

/** True for text that is only a phone number. */
function looksLikeNumber(text: string): boolean {
  return /^[+\d\s().\-]+$/.test(text) && text.replace(/\D/g, "").length >= 7
}

/** The number or email a pen stands for: its stamp, or a name that is one. "" when unknown. */
export function penHandle(pen: Pick<LinkPen, "name" | "handle">): string {
  if (pen.handle) return normalizeHandle(pen.handle)
  const name = pen.name.trim()
  return isEmailHandle(name) || looksLikeNumber(name) ? normalizeHandle(name) : ""
}

/** Every saved number and email on a person, normalized. */
export function personHandles(person: Pick<PhonePerson, "phones" | "emails">): string[] {
  return [...(person.phones ?? []), ...(person.emails ?? [])].map((h) => normalizeHandle(h)).filter(Boolean)
}

export function personForHandle(handle: string, people: readonly PhonePerson[]): PhonePerson | undefined {
  const want = normalizeHandle(handle)
  if (!want) return undefined
  return people.find((person) => personHandles(person).includes(want))
}

/** Split handles into the phones and emails lists a person keeps. */
export function splitHandles(handles: readonly string[]): { phones: string[]; emails: string[] } {
  const phones: string[] = []
  const emails: string[] = []
  for (const raw of handles) {
    const h = normalizeHandle(raw)
    if (!h) continue
    if (isEmailHandle(h)) emails.push(h)
    else phones.push(h)
  }
  return { phones, emails }
}

/** What one pen should look like, given the people. Same object when nothing changes. */
export function relinkPen<P extends LinkPen>(pen: P, people: readonly PhonePerson[], now: number): P {
  const handle = penHandle(pen)
  const owner = handle ? personForHandle(handle, people) : undefined
  if (owner) {
    if (pen.personId === owner.id && pen.name === owner.name && pen.handle === handle) return pen
    // Keep the number on the pen: once it wears the person's name, the name no longer says it.
    return { ...pen, personId: owner.id, name: owner.name, handle, editedAt: now }
  }
  if (!pen.personId) return pen
  const linked = people.find((person) => person.id === pen.personId)
  // Linked by hand with no number: the name follows the person while they exist.
  if (!handle && linked) return pen.name === linked.name ? pen : { ...pen, name: linked.name, editedAt: now }
  // The number was taken off the person, or the person is gone: unlink.
  const { personId: _gone, ...rest } = pen
  return { ...rest, name: handle ? formatHandle(handle) : pen.name, editedAt: now } as P
}

/**
 * Bring the iPhone Texts and iPhone Calls pens in line with the people.
 * Returns the same array when nothing changed.
 */
export function relinkPhonePens<S extends LinkScope>(scopes: S[], people: readonly PhonePerson[], now = Date.now()): S[] {
  let changed = false
  const next = scopes.map((scope) => {
    if (!PHONE_PEN_SCOPE_IDS.includes(scope.id)) return scope
    let scopeChanged = false
    const pens = scope.pens.map((pen) => {
      const out = relinkPen(pen, people, now)
      if (out !== pen) scopeChanged = true
      return out
    })
    if (!scopeChanged) return scope
    changed = true
    return { ...scope, pens }
  })
  return changed ? next : scopes
}

/** Numbers seen on phone pens that no person has yet, for suggestions. */
export function unlinkedPhoneHandles(scopes: readonly LinkScope[], people: readonly PhonePerson[]): string[] {
  const out = new Set<string>()
  for (const scope of scopes) {
    if (!PHONE_PEN_SCOPE_IDS.includes(scope.id)) continue
    for (const pen of scope.pens) {
      const handle = penHandle(pen)
      if (handle && !pen.personId && !personForHandle(handle, people)) out.add(handle)
    }
  }
  return [...out].sort()
}

/** The same person's pen on the other phone view (`iphone-text-x` ↔ `iphone-call-x`). */
export function twinPenId(penId: string): string | null {
  if (penId.startsWith("iphone-text-")) return `iphone-call-${penId.slice("iphone-text-".length)}`
  if (penId.startsWith("iphone-call-")) return `iphone-text-${penId.slice("iphone-call-".length)}`
  return null
}
