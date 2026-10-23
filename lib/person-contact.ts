/**
 * lib/person-contact.ts — Last called, last texted, and who owes a reply
 *
 * Calls and texts are contact, not company. They come from the iPhone Calls
 * and iPhone Texts pens linked to a person (`personId`, else the name-derived
 * pen id) and never count as time together or Last seen. Direction is read
 * from the row title phone sync writes (`lib/phone-sync/to-entries.ts`):
 * `→` out, `←` in, "missed call" is an incoming miss. Pure; structural types.
 */
import { phonePenId } from "@/lib/phone-sync/ids"
import { lastSawSentence } from "@/lib/person-profile"

const CALLS = "iphone-calls"
const TEXTS = "iphone-texts"

type ContactEntry = { date: string; scopeId: string; penId: string; startMin: number; title?: string }
type ContactScope = { id: string; pens: readonly { id: string; personId?: string }[] }
type ContactPerson = { id: string; title?: string; description?: string }

export type ContactLast = {
  date: string
  startMin: number
  direction: "in" | "out"
  /** A call nobody picked up (either way). */
  missed: boolean
}

export type PersonContact = {
  call: ContactLast | null
  text: ContactLast | null
  /** They called and you never rang back or answered. */
  callBack: boolean
  /** Their text is the last in the thread. */
  textBack: boolean
}

function penIdsFor(person: ContactPerson, scopes: readonly ContactScope[], scopeId: string, kind: "call" | "text"): Set<string> {
  const ids = new Set<string>([phonePenId(kind, person.title || person.description || person.id)])
  for (const pen of scopes.find((s) => s.id === scopeId)?.pens ?? []) {
    if (pen.personId === person.id) ids.add(pen.id)
  }
  return ids
}

function isLater(a: ContactEntry, b: ContactEntry): boolean {
  return a.date !== b.date ? a.date > b.date : a.startMin > b.startMin
}

function lastOf(entries: readonly ContactEntry[], scopeId: string, pens: Set<string>): ContactLast | null {
  let best: ContactEntry | null = null
  for (const entry of entries) {
    if (entry.scopeId !== scopeId || !pens.has(entry.penId)) continue
    if (!best || isLater(entry, best)) best = entry
  }
  if (!best) return null
  const title = best.title ?? ""
  const out = title.startsWith("→")
  return {
    date: best.date,
    startMin: best.startMin,
    direction: out ? "out" : "in",
    missed: /missed call|no answer/.test(title),
  }
}

export function personContact(
  entries: readonly ContactEntry[],
  scopes: readonly ContactScope[],
  person: ContactPerson,
): PersonContact {
  const call = lastOf(entries, CALLS, penIdsFor(person, scopes, CALLS, "call"))
  const text = lastOf(entries, TEXTS, penIdsFor(person, scopes, TEXTS, "text"))
  return {
    call,
    text,
    callBack: !!call && call.direction === "in" && call.missed,
    textBack: !!text && text.direction === "in",
  }
}

/** "2 days ago." / "Today." / "No call or text yet." for a Last called / Last texted readout. */
export function contactSentence(last: ContactLast | null, todayIso: string): string {
  if (!last) return "Never."
  const rel = lastSawSentence(last.date, todayIso)
  const how = last.missed ? (last.direction === "in" ? "missed" : "no answer") : last.direction === "in" ? "from them" : "from you"
  return `${rel.replace(/\.$/, "")} (${how}).`
}
