/**
 * lib/social-bimby/group.ts — A line about many people at once: who was there, who is new, what happened
 *
 * "while in the city i hung out with Mira, Jo (super briefly), Teo … and met new friends Kit (whose 21st birthday
 * it was the night of the concert) and this guy Bram who is very kind … he let me stay at his apartment" used to
 * become one note on one friend (`docs/BIM_CHAT_USAGE.md` §5, failure 1). It now reads as:
 *
 * - every person named, each matched to People I Know or proposed as new (one met there, or one not kept yet);
 * - for a new person, what was said about them (age, from, how it felt, a nickname), and where you stayed;
 * - a birthday said in passing ("whose 21st birthday it was the night of the concert"): the year from the age,
 *   the day from the event when it is known, else asked;
 * - one hang-out for the trip, dated from the Flight items that went to that city and back;
 * - questions back, at most three: which event and when, who was there when and what you did, more about a
 *   new person.
 *
 * Rules, no model, pure. `buildGroupPlan` turns the reading into the same Report card the Social BIMBY uses.
 */

import type { FlightDraft } from "@/lib/flight-bimby/types"
import type { Effect, EffectField, ReportPlan } from "@/lib/report-bimby/types"
import type { KnownPerson } from "./parse"
import type { SocialDeps } from "./plan"

export interface GroupPerson {
  /** As said ("Addy"). */
  name: string
  known?: KnownPerson
  /** Met for the first time ("met new friends …", "this girl …"). */
  met: boolean
  /** "super briefly", "short for addison": the words in brackets after the name. */
  aside?: string
  /** For a new person: the words said about them, as said. */
  about?: string
  age?: number
  /** "turned 21 the night of the concert". */
  birthdayOn?: { age: number; event: string; phrase: string }
  from?: string
  feelings: string[]
  /** "his apartment": where you stayed, at theirs. */
  stayedAt?: string
}

export interface GroupRead {
  people: GroupPerson[]
  /** "nyc", "the city", "Paris". */
  trip?: string
  /** "the show", "the concert". */
  event?: string
}

const NAME = "[A-Z][a-z'’]+"
const NOT_NAMES = new Set(["I", "Im", "I'm", "The", "And", "But", "So", "She", "He", "They", "We", "It", "My", "Also", "Then", "While", "In", "At", "With", "This", "That", "New", "York", "NYC", "LA", "SF", "Texas", "California", "Florida"])
const FEELINGS = /\b(very |so |really |super )?(cute|nice|kind|sweet|lovely|cool|fun|funny|warm|chill|smart|pretty|hot|weird|awkward|annoying|rude)\b|\b(a |an )?(bad|weird|good|great|strange|off) (feeling|vibe)\b|\bi (really )?(liked|loved|hated|didn'?t like) (her|him|them)\b/gi
const EVENT = /\bthe (show|concert|party|gig|wedding|game|festival|rave|opening|reading|premiere)\b/i
const TRIP = /\b(?:while |when i was |when we were )?in (nyc|new york|la|sf|the city|[A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/

/** Names in one list segment: "Tabby, Allyssa (super briefly), Lucas, and Dom" → each with its bracket aside. */
function namesIn(segment: string): { name: string; aside?: string }[] {
  const out: { name: string; aside?: string }[] = []
  const re = new RegExp(`(?:^|,|\\band\\b|&)\\s*(${NAME}(?:\\s+${NAME})?)\\s*(?:\\(([^)]{1,60})\\))?`, "g")
  for (const m of segment.matchAll(re)) {
    const name = m[1]!.trim()
    if (NOT_NAMES.has(name.split(/\s+/)[0]!)) continue
    out.push({ name, ...(m[2] ? { aside: m[2].trim() } : {}) })
  }
  return out
}

const first = (s: string) => s.trim().split(/\s+/)[0]!.toLowerCase()

function findKnown(name: string, people: readonly KnownPerson[]): KnownPerson | undefined {
  const want = name.toLowerCase()
  return (
    people.find((p) => p.name.toLowerCase() === want) ??
    people.find((p) => (p.nicknames ?? []).some((n) => n.toLowerCase() === want)) ??
    (people.filter((p) => first(p.name) === first(name)).length === 1 ? people.find((p) => first(p.name) === first(name)) : undefined)
  )
}

function detailsOf(about: string): Pick<GroupPerson, "age" | "birthdayOn" | "from" | "feelings" | "stayedAt"> {
  const turned = /\b(?:whose |his |her |their )?(\d{1,2})(?:st|nd|rd|th)\s+birthday(?: it)?(?: was)?\s+((?:the )?(?:night|day) of (?:the |her |his |their )?\w+|today|tonight|yesterday)?/i.exec(about)
  const age = /\b(?:only |just )?(\d{2}) ?(?:years? old|yo)\b|\bonly (\d{2})\b/i.exec(about)
  // One word, or two for a place that starts like "new york", "north carolina", "san diego".
  const from = /\bfrom ((?:new|north|south|east|west|san|los|las|st|saint|el|la)\s+[a-z]+|[a-z]+)\b/i.exec(about)
  const stayed = /\b(?:let me |i )?(?:stay|stayed|slept|crashed)\s+(?:at|in)\s+((?:her|his|their)\s+(?:apartment|place|house|flat|room|dorm|bed))/i.exec(about)
  const feelings = [...new Set([...about.matchAll(FEELINGS)].map((m) => m[0]!.toLowerCase().trim()))]
  const birthAge = turned ? Number(turned[1]) : undefined
  return {
    ...(birthAge ? { age: birthAge } : age ? { age: Number(age[1] ?? age[2]) } : {}),
    ...(turned && birthAge ? { birthdayOn: { age: birthAge, event: (turned[2] ?? "").trim() || "that day", phrase: turned[0]!.trim() } } : {}),
    ...(from && !/\b(the|a|an|my|work|school)\b/i.test(from[1]!) ? { from: from[1]!.trim() } : {}),
    feelings,
    ...(stayed ? { stayedAt: stayed[1]!.toLowerCase() } : {}),
  }
}

/**
 * The group reading, or null when the line does not list three people or more. `people` is People I Know.
 * Pure: the caller passes the people in.
 */
export function readGroup(text: string, people: readonly KnownPerson[] = []): GroupRead | null {
  const t = text.trim()
  if (!t || t.length > 3000) return null
  const listed = /\b(?:hung out with|hang out with|hanging out with|was with|were with|saw|spent time with|chilled with|partied with|met up with)\s+([^.!?]*?)(?=,?\s+and\s+(?:i\s+)?met\b|[.!?]|$)/i.exec(t)
  const metAt = /\b(?:and\s+)?(?:i\s+)?met\s+(?:new\s+friends?|(?:this|a|some)\s+(?:girl|guy|person|boy|woman|man))?\s*/i.exec(t.slice(listed ? listed.index + listed[0].length : 0))
  const metStart = metAt ? (listed ? listed.index + listed[0].length : 0) + metAt.index + metAt[0].length : -1
  const old = listed ? namesIn(listed[1]!) : []
  // New people: each capitalized name after "met …", with the words up to the next new name as what was said about them.
  const met: { name: string; aside?: string; about: string }[] = []
  if (metStart >= 0) {
    const tail = t.slice(metStart)
    const re = new RegExp(`(?:^|\\band\\s+(?:this\\s+(?:girl|guy|person)\\s+)?|,\\s*|this\\s+(?:girl|guy|person)\\s+)(${NAME})(?:\\s*\\(([^)]{1,80})\\))?`, "g")
    const hits = [...tail.matchAll(re)].filter((m) => !NOT_NAMES.has(m[1]!))
    hits.forEach((m, i) => {
      const end = i + 1 < hits.length ? hits[i + 1]!.index! : tail.length
      met.push({ name: m[1]!, ...(m[2] ? { aside: m[2].trim() } : {}), about: tail.slice(m.index!, end).trim() })
    })
  }
  if (old.length + met.length < 3) return null
  const seen = new Set<string>()
  const out: GroupPerson[] = []
  for (const p of old) {
    if (seen.has(p.name.toLowerCase())) continue
    seen.add(p.name.toLowerCase())
    const known = findKnown(p.name, people)
    out.push({ name: p.name, ...(known ? { known } : {}), met: false, ...(p.aside ? { aside: p.aside } : {}), feelings: [] })
  }
  for (const p of met) {
    if (seen.has(p.name.toLowerCase())) continue
    seen.add(p.name.toLowerCase())
    const known = findKnown(p.name, people)
    out.push({ name: p.name, ...(known ? { known } : {}), met: true, ...(p.aside ? { aside: p.aside } : {}), about: p.about, ...detailsOf(p.about) })
  }
  const trip = TRIP.exec(t)
  const event = EVENT.exec(t)
  return { people: out, ...(trip ? { trip: trip[1]! } : {}), ...(event ? { event: event[0]!.toLowerCase() } : {}) }
}

// ---------------------------------------------------------------- the plan

const CITY_ALIASES: Record<string, string[]> = { nyc: ["new york", "nyc", "jfk", "lga", "ewr"], la: ["los angeles", "lax"], sf: ["san francisco", "sfo"] }

/** The trip's days from the Flight items: the last flight into the city before now, and the next one out of it. */
export function tripWindow(trip: string | undefined, flights: readonly FlightDraft[], now: Date, cityOf?: SocialDeps["cityOf"]): { from: string; to: string; evidence: string[] } | null {
  if (!trip || /the city/i.test(trip)) return null
  const want = CITY_ALIASES[trip.toLowerCase()] ?? [trip.toLowerCase()]
  const cityHit = (code?: string, city?: string) => {
    const names = [code ?? "", city ?? "", code ? (cityOf?.(code) ?? "") : ""].map((s) => s.toLowerCase()).filter(Boolean)
    return names.some((n) => want.some((w) => n.includes(w) || w.includes(n)))
  }
  const today = now.toISOString().slice(0, 10)
  const sorted = [...flights].filter((f) => f.departDate).sort((a, b) => `${a.departDate}${a.departTime ?? ""}`.localeCompare(`${b.departDate}${b.departTime ?? ""}`))
  const inbound = sorted.filter((f) => cityHit(f.to, f.toCity) && (f.arriveDate ?? f.departDate)! <= today).at(-1)
  if (!inbound) return null
  const arrived = inbound.arriveDate ?? inbound.departDate!
  const out = sorted.find((f) => cityHit(f.from, f.fromCity) && f.departDate! >= arrived)
  const left = out?.departDate && out.departDate <= today ? out.departDate : today
  const show = (f: FlightDraft) => `${f.airline ?? "Flight"} ${f.flightNumber ?? ""} ${[f.from, f.to].filter(Boolean).join("→")} on ${f.departDate}`.replace(/\s+/g, " ").trim()
  return { from: arrived, to: left, evidence: [show(inbound), ...(out ? [show(out)] : [])] }
}

let seq = 0
const field = (key: string, label: string, value: string): EffectField => ({ key, label, type: "text", value })
const effect = (kind: Effect["kind"], title: string, reasoning: string[], evidence: string[], fields: EffectField[]): Effect => ({ id: `soc-${kind}-${Date.now().toString(36)}-${++seq}`, kind, title, reasoning, evidence, fields, status: "pending" })
const pad = (n: number) => String(n).padStart(2, "0")
const dateTime = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const where = (trip?: string) => (trip ? (/the city/i.test(trip) ? "in the city" : `in ${trip.length <= 3 ? trip.toUpperCase() : trip}`) : "")

export interface GroupPlan {
  plan: ReportPlan
  /** The questions back, at most three. */
  questions: string[]
}

/** One card for the whole line: a change per person, the birthday, the hang-out, and the questions back. */
export function buildGroupPlan(read: GroupRead, message: string, now: Date, deps: SocialDeps): GroupPlan {
  const effects: Effect[] = []
  const window = tripWindow(read.trip, deps.flights, now, deps.cityOf)
  const span = window ? (window.from === window.to ? window.from : `${window.from} to ${window.to}`) : ""
  const place = where(read.trip)
  const whenSaid = [place, span ? `(${span})` : ""].filter(Boolean).join(" ")
  const trace = [
    `Read this as a group line: ${read.people.length} people${read.trip ? `, ${place}` : ""}${read.event ? `, ${read.event}` : ""}.`,
    `${read.people.filter((p) => p.known).length} are in People I Know; ${read.people.filter((p) => !p.known).length} would be new.`,
    ...(window ? [`The trip's days come from your flights: ${span}.`] : read.trip ? ["No flights to that city were found, so the trip has no days yet."] : []),
  ]

  for (const p of read.people) {
    const name = p.known?.name ?? p.name
    const short = name.split(/\s+/)[0]!
    if (!p.known) {
      const relation = [p.met ? `met ${place}`.trim() : "", span && p.met ? span : "", p.from ? `from ${p.from}` : ""].filter(Boolean).join(", ")
      effects.push(
        effect("person", `New person: ${name}`, [p.met ? `You said you met ${short}${place ? ` ${place}` : ""}.` : `You named ${short}, who is not in People I Know yet.`, "Make them a person in People I Know."], window?.evidence ?? [], [
          field("name", "Name", name),
          field("instagram", "Instagram", ""),
          field("relation", "Relation", relation),
        ]),
      )
    }
    const said = [
      `Saw ${short} ${whenSaid}`.trim() + (p.aside ? ` (${p.aside})` : "") + ".",
      ...(p.age ? [`${p.birthdayOn ? `Turned ${p.age}` : `${p.age}`}${p.birthdayOn ? ` ${p.birthdayOn.event}` : " years old"}.`] : []),
      ...(p.from ? [`From ${p.from}.`] : []),
      ...(p.feelings.length ? [`How it felt: ${p.feelings.join(", ")}.`] : []),
      ...(p.stayedAt ? [`You stayed at ${p.stayedAt.replace(/^(her|his|their)\s+/, `${short}'s `)}${place ? ` ${place}` : ""}.`] : []),
    ].join(" ")
    effects.push(
      effect("person-note", `Note on ${short}`, [p.about ? "What you said about them, with the trip it was on." : "That you saw them, and when."], [], [
        field("person", "Person", name),
        { key: "at", label: "When", type: "datetime", value: dateTime(now) },
        field("text", "Note", p.about ? `${said}\nYou said: "${p.about}"` : said),
      ]),
    )
    if (p.birthdayOn) {
      // The year from the age; the day is the event's, which is only known when you say it.
      const year = new Date(`${window?.from ?? now.toISOString().slice(0, 10)}T12:00:00`).getFullYear() - p.birthdayOn.age
      effects.push(
        effect("birthday", `${short}'s birthday`, [`You said "${p.birthdayOn.phrase}".`, `That makes the year ${year}. The day is ${p.birthdayOn.event}: type it here (${year}-MM-DD), or answer the question below, then Accept.`], window?.evidence ?? [], [
          field("person", "Person", name),
          field("date", "Birthday", ""),
        ]),
      )
    }
  }

  // One hang-out for the trip, on the Week Plan log of the week it started, with everyone and where you stayed.
  const stays = read.people.filter((p) => p.stayedAt).map((p) => `stayed at ${(p.known?.name ?? p.name).split(/\s+/)[0]}'s ${p.stayedAt!.replace(/^(her|his|their)\s+/, "")}`)
  const day = window?.from ?? dateTime(now).slice(0, 10)
  const names = read.people.map((p) => (p.known?.name ?? p.name).split(/\s+/)[0])
  effects.push(
    effect("plan-entry", `Hang-out ${whenSaid || "with friends"}`.trim(), [`One entry for the time together, in the Week Plan log for the week of ${day}${window ? " (from your flights)" : ""}.`], window?.evidence ?? [], [
      { key: "period", label: "Plan log", type: "select", value: "week", options: ["week", "day"] },
      field("on", "Day in it", day),
      field("text", "Entry", `${place ? `${place[0]!.toUpperCase()}${place.slice(1)}` : "Hung out"}${span ? ` ${span}` : ""}: with ${names.join(", ")}${read.event ? `; ${read.event}` : ""}${stays.length ? `; ${stays.join("; ")}` : ""}.`),
    ]),
  )

  const questions: string[] = []
  const bday = read.people.find((p) => p.birthdayOn)
  if (read.event) questions.push(`Which ${read.event.replace(/^the /, "")} was it, and what day?${bday ? ` ${bday.name.split(/\s+/)[0]} turned ${bday.birthdayOn!.age} that night, so that is their birthday.` : ""}`)
  else if (bday) questions.push(`What day was ${bday.birthdayOn!.event}? That is ${bday.name.split(/\s+/)[0]}'s birthday.`)
  questions.push(`Who were you with when, and what did you do?${window ? "" : read.trip ? " And which days was the trip?" : ""}`)
  const fresh = read.people.find((p) => p.met && !p.known && p.about && !p.birthdayOn) ?? read.people.find((p) => p.met && !p.known)
  if (fresh) questions.push(`Anything to keep about ${fresh.name.split(/\s+/)[0]}: how you met, a last name, or their Instagram?`)

  return { plan: { id: `social-${Date.now().toString(36)}-${++seq}`, text: message, at: now.toISOString(), trace, effects }, questions: questions.slice(0, 3) }
}
