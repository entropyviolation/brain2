/**
 * lib/phone-sync/contact-names.mjs — Names for texting numbers, from the Mac's Contacts
 *
 * The synced texts carry only a number or an email. A person item often has no number saved, so
 * BIM could not tell whose texts they were. The hub reads the Contacts databases on this Mac
 * (read only, `node:sqlite`) and names each handle it sends, so `/api/phone-texts` can say "Marilyn
 * Monroe" instead of a number. Nothing is written. No Contacts, or no access: an empty map.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/** Same spelling as `normalizeHandle` in `handles.ts` (US default country code). */
export function normalizeHandleMjs(handle) {
  const raw = String(handle ?? "").trim()
  if (!raw) return ""
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return raw.toLowerCase()
  if (!/^[+\d\s().\-]+$/.test(raw)) return raw.toLowerCase()
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw.toLowerCase()
  if (raw.startsWith("+")) return `+${digits}`
  if (digits.startsWith("00") && digits.length > 6) return `+${digits.slice(2)}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits
}

/** Every Contacts database on this Mac: the local one and one per account source. */
export function contactDbPaths(home = os.homedir()) {
  const root = path.join(home, "Library/Application Support/AddressBook")
  const out = []
  const main = path.join(root, "AddressBook-v22.abcddb")
  if (fs.existsSync(main)) out.push(main)
  const sources = path.join(root, "Sources")
  try {
    for (const d of fs.readdirSync(sources)) {
      const p = path.join(sources, d, "AddressBook-v22.abcddb")
      if (fs.existsSync(p)) out.push(p)
    }
  } catch {}
  return out
}

const TTL_MS = 10 * 60_000
let cached = null

/** Map of normalized handle → "First Last" (or the organization). Cached ten minutes. */
export async function contactNames(paths = contactDbPaths()) {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map
  const map = new Map()
  let DatabaseSync
  try {
    ;({ DatabaseSync } = await import("node:sqlite"))
  } catch {
    return map
  }
  for (const p of paths) {
    let db
    try {
      db = new DatabaseSync(p, { readOnly: true })
      const names = new Map()
      for (const r of db.prepare("SELECT Z_PK AS pk, ZFIRSTNAME AS f, ZLASTNAME AS l, ZORGANIZATION AS o FROM ZABCDRECORD").all()) {
        const n = [r.f, r.l].filter(Boolean).join(" ").trim() || String(r.o ?? "").trim()
        if (n) names.set(r.pk, n)
      }
      const add = (owner, handle) => {
        const n = names.get(owner)
        const h = normalizeHandleMjs(handle)
        if (n && h && !map.has(h)) map.set(h, n)
      }
      for (const r of db.prepare("SELECT ZOWNER AS o, ZFULLNUMBER AS h FROM ZABCDPHONENUMBER").all()) add(r.o, r.h)
      for (const r of db.prepare("SELECT ZOWNER AS o, ZADDRESS AS h FROM ZABCDEMAILADDRESS").all()) add(r.o, r.h)
    } catch {
      // No access (privacy settings) or an odd database: skip it.
    } finally {
      try {
        db?.close()
      } catch {}
    }
  }
  cached = { at: Date.now(), map }
  return map
}

/** Names for just these handles, keyed by the handle as given. */
export async function namesFor(handles) {
  const all = await contactNames()
  const out = {}
  for (const h of new Set(handles)) {
    const n = all.get(normalizeHandleMjs(h))
    if (n) out[h] = n
  }
  return out
}

const words = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)

/**
 * Contacts cards that could be this person, with every number and email on each. "Marilyn" finds a card saved as
 * just "Marilyn" and one saved as "Marilyn Monroe"; "Marilyn Monroe" finds both too (a card that holds only the first
 * name is often how a friend is saved). Cards with the same name are merged, numbers and all. Pure over
 * `cards`; `contactCards` reads them.
 * @param {string} name
 * @param {{ name: string, first: string, last: string, phones: string[], emails: string[] }[]} cards
 */
export function cardsNamed(name, cards) {
  const want = words(name)
  if (!want.length) return []
  // Two cards with the same name ("Marilyn Monroe" and "marilyn monroe") are one person with more numbers.
  const byName = new Map()
  for (const c of cards) {
    const have = words(c.name)
    if (!have.length || have[0] !== want[0]) continue
    if (!(want.every((w) => have.includes(w)) || have.every((w) => want.includes(w)))) continue
    const key = have.join(" ")
    const had = byName.get(key)
    if (!had) byName.set(key, { ...c, phones: [...c.phones], emails: [...c.emails] })
    else {
      for (const p of c.phones) if (!had.phones.some((x) => normalizeHandleMjs(x) === normalizeHandleMjs(p))) had.phones.push(p)
      for (const e of c.emails) if (!had.emails.includes(e)) had.emails.push(e)
      // Keep the capitalized spelling.
      if (had.name === had.name.toLowerCase() && c.name !== c.name.toLowerCase()) had.name = c.name
    }
  }
  return [...byName.values()]
}

/** Every person card in Contacts that has a number or an email. Cached with the names. */
let cardsCache = null
export async function contactCards(paths = contactDbPaths()) {
  if (cardsCache && Date.now() - cardsCache.at < TTL_MS) return cardsCache.cards
  const cards = []
  let DatabaseSync
  try {
    ;({ DatabaseSync } = await import("node:sqlite"))
  } catch {
    return cards
  }
  const seen = new Set()
  for (const p of paths) {
    let db
    try {
      db = new DatabaseSync(p, { readOnly: true })
      const byPk = new Map()
      for (const r of db.prepare("SELECT Z_PK AS pk, ZFIRSTNAME AS f, ZLASTNAME AS l FROM ZABCDRECORD").all()) {
        const first = String(r.f ?? "").trim()
        const last = String(r.l ?? "").trim()
        if (first || last) byPk.set(r.pk, { name: [first, last].filter(Boolean).join(" "), first, last, phones: [], emails: [] })
      }
      for (const r of db.prepare("SELECT ZOWNER AS o, ZFULLNUMBER AS h FROM ZABCDPHONENUMBER").all()) {
        const c = byPk.get(r.o)
        if (c && r.h && !c.phones.includes(String(r.h).trim())) c.phones.push(String(r.h).trim())
      }
      for (const r of db.prepare("SELECT ZOWNER AS o, ZADDRESS AS h FROM ZABCDEMAILADDRESS").all()) {
        const c = byPk.get(r.o)
        if (c && r.h && !c.emails.includes(String(r.h).trim())) c.emails.push(String(r.h).trim())
      }
      for (const c of byPk.values()) {
        if (!c.phones.length && !c.emails.length) continue
        // The same card synced from two accounts is one card.
        const key = `${c.name.toLowerCase()}|${c.phones.map(normalizeHandleMjs).sort().join(",")}`
        if (seen.has(key)) continue
        seen.add(key)
        cards.push(c)
      }
    } catch {
      // No access or an odd database: skip it.
    } finally {
      try {
        db?.close()
      } catch {}
    }
  }
  cardsCache = { at: Date.now(), cards }
  return cards
}
