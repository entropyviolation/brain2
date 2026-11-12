/**
 * lib/social-bimby/plan.ts — From a social reading to a plan card
 *
 * One effect per change, each with why and editable fields, drawn by the Report card. Nothing is written
 * here. The order is the order "Accept all" saves in: the person first (made or found), then the note, the
 * birthday, the reminder and the plan-log entries, which find that person by name at accept time.
 *
 * "As soon as I get back" is placed from your own Flight items: the flight home from the trip's city. With
 * no flight to read, the reminder goes on next Monday morning and says so.
 *
 * Pure: people and flights are passed in.
 */
import type { FlightDraft } from "@/lib/flight-bimby/types"
import type { Effect, EffectField, ReportPlan } from "@/lib/report-bimby/types"
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { HangWhen, SocialRead } from "./parse"

export interface SocialDeps {
  /** Upcoming flights, from the Flight items. */
  flights: readonly FlightDraft[]
  /** The city an airport code is in ("JFK" → "New York"). */
  cityOf?: (code: string) => string | undefined
  /** Who already carries a handle, when it is not this person. */
  instagramOwner?: (handle: string) => string | undefined
}

/** A reminder fires at this hour on the day it lands. */
export const REMINDER_HOUR = 11

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayAt = (d: Date, hour: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
const longDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

function nextMonday(now: Date): Date {
  const d = addDays(now, 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  return d
}

function nextWeekday(now: Date, day: number): Date {
  const d = addDays(now, 1)
  while (d.getDay() !== day) d.setDate(d.getDate() + 1)
  return d
}

/** The flight home from the trip: one that leaves the trip's city, else the last upcoming one in three weeks. */
export function returnFlight(trip: string | undefined, flights: readonly FlightDraft[], now: Date, cityOf?: SocialDeps["cityOf"]): FlightDraft | undefined {
  const today = ymd(now)
  const ahead = flights
    .filter((f) => f.departDate && f.departDate >= today)
    .sort((a, b) => `${a.departDate}${a.departTime ?? ""}`.localeCompare(`${b.departDate}${b.departTime ?? ""}`))
  if (!ahead.length) return undefined
  if (trip) {
    const want = norm(trip)
    const leaves = ahead.filter((f) => {
      const city = norm(f.fromCity ?? (f.from ? (cityOf?.(f.from) ?? "") : ""))
      return !!city && (city.includes(want) || want.includes(city))
    })
    if (leaves.length) return leaves[0]
  }
  const limit = ymd(addDays(now, 21))
  const soon = ahead.filter((f) => f.departDate! <= limit)
  return soon.length >= 2 ? soon[soon.length - 1] : undefined
}

/** When to hang out, as a day and the reasons for it. */
export function hangDay(when: HangWhen, read: SocialRead, now: Date, deps: SocialDeps): { day: Date; why: string[]; evidence: string[] } {
  if (when.kind === "after-trip") {
    const back = returnFlight(read.trip, deps.flights, now, deps.cityOf)
    if (back) {
      const home = new Date(`${back.arriveDate ?? back.departDate}T12:00:00`)
      const day = addDays(home, 1)
      const route = [back.from, back.to].filter(Boolean).join("→")
      return {
        day,
        why: [`You said "${when.phrase}".`, `Your flight home${read.trip ? ` from ${read.trip}` : ""} lands ${longDay(home)}, so the first day back is ${longDay(day)}.`],
        evidence: [`Flight ${back.flightNumber ?? ""} ${route} on ${back.departDate}${back.arriveTime ? `, lands ${back.arriveTime}` : ""}`.replace(/\s+/g, " ").trim()],
      }
    }
    const day = nextMonday(now)
    return {
      day,
      why: [`You said "${when.phrase}".`, `No flight home${read.trip ? ` from ${read.trip}` : ""} is in your Flight items, so this is next Monday. Change the day if you are back later.`],
      evidence: [],
    }
  }
  if (when.kind === "weekday") {
    const day = nextWeekday(now, when.day)
    return { day, why: [`You said "${when.phrase}".`], evidence: [] }
  }
  if (when.kind === "weekend") {
    const day = nextWeekday(now, 6)
    return { day, why: [`You said "${when.phrase}", so the reminder is Saturday.`], evidence: [] }
  }
  const day = nextMonday(now)
  return { day, why: [`You said "${when.phrase}"${when.kind === "next-week" ? "" : " with no day"}, so this is next Monday.`], evidence: [] }
}

let seq = 0
const effectId = (kind: string) => `soc-${kind}-${Date.now().toString(36)}-${++seq}`

function effect(kind: Effect["kind"], title: string, reasoning: string[], evidence: string[], fields: EffectField[]): Effect {
  return { id: effectId(kind), kind, title, reasoning, evidence, fields, status: "pending" }
}

const text = (key: string, label: string, value: string): EffectField => ({ key, label, type: "text", value })

function hangTitle(name: string): string {
  return `Hang out with ${name.split(/\s+/)[0]}`
}

/** The plan card for one social message. */
export function buildSocialPlan(read: SocialRead, message: string, now: Date, deps: SocialDeps): ReportPlan {
  const name = read.known?.name ?? read.name
  const first = name.split(/\s+/)[0]!
  const trace: string[] = [
    `Read this as social: ${read.cues.length ? read.cues.join(", ") : "handed to the Social BIMBY by name"}.`,
    read.known ? `${name} is already in People I Know, so nothing new is made.` : `${name} is not in People I Know yet.`,
  ]
  if (read.instagram) trace.push(`Instagram handle: @${read.instagram}.`)
  if (read.relation) trace.push(`Relation said: ${read.relation}.`)
  if (read.feelings.length) trace.push(`How it felt: ${read.feelings.join(", ")}.`)
  if (read.trip) trace.push(`Trip: ${read.trip}.`)
  for (const e of read.events) trace.push(`Invite: ${e.what}${e.day !== undefined ? ` (${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][e.day]})` : ""}, ${e.going ? "you're going" : "you can't go"}.`)

  const effects: Effect[] = []

  // The person: made, or found and topped up. Never renamed, and nothing on them is cleared.
  const personWhy = read.known
    ? [`${name} is already in People I Know.`, read.instagram && read.known.instagram !== read.instagram ? `Attach @${read.instagram} to them.` : "Their record stays as it is; only blanks are filled."]
    : [`You named ${name} and said ${read.cues[0] ?? "something"} about them.`, "Make them a person in People I Know."]
  if (read.instagram) {
    const owner = deps.instagramOwner?.(read.instagram)
    if (owner && owner.toLowerCase() !== name.toLowerCase()) personWhy.push(`@${read.instagram} is on ${owner} now. Accepting moves it to ${name}: one account is one person.`)
    else personWhy.push(`Attach the Instagram account @${read.instagram}.`)
  }
  if (read.relation) personWhy.push(`Relation: "${read.relation}". Kept as you said it.`)
  if (!read.known || read.instagram || read.relation) {
    effects.push(
      effect("person", read.known ? `Update ${name}` : `New person: ${name}`, personWhy, [], [
        text("name", "Name", name),
        text("instagram", "Instagram", read.instagram ?? read.known?.instagram ?? ""),
        text("relation", "Relation", read.relation ?? ""),
      ]),
    )
  }

  // The note: the message as said, dated today, on their Notes log.
  effects.push(
    effect("person-note", `Note on ${first}`, ["Keep what you said, word for word, on their Notes log, dated today."], [], [
      text("person", "Person", name),
      { key: "at", label: "When", type: "datetime", value: fmtDateTime(now.getTime(), true) },
      text("text", "Note", message.trim()),
    ]),
  )

  if (read.birthday) {
    const b = read.birthday
    const year = b.year ?? now.getFullYear()
    effects.push(
      effect(
        "birthday",
        `${first}'s birthday`,
        [`You said "${b.phrase}".`, b.year ? "Set their Birthday." : `Set their Birthday. No year was said, so ${year} stands in; change it if you know it.`],
        [],
        [text("person", "Person", name), text("date", "Birthday", `${year}-${pad(b.month)}-${pad(b.day)}`)],
      ),
    )
  }

  if (read.hangOut) {
    const when = hangDay(read.hangOut, read, now, deps)
    const title = hangTitle(name)
    const at = dayAt(when.day, REMINDER_HOUR)
    effects.push(
      effect("reminder", title, [...when.why, `A reminder at ${REMINDER_HOUR} am that day, texted and kept in the bell until you dismiss it.`], when.evidence, [
        text("text", "Reminder", title),
        { key: "when", label: "When", type: "datetime", value: fmtDateTime(at.getTime(), true) },
        text("person", "Person", name),
      ]),
    )
    effects.push(
      effect("plan-entry", `${title}, in that week's plan`, [`Add it to the Week Plan log for the week of ${longDay(when.day)}, so it is there when you plan that week.`], when.evidence, [
        { key: "period", label: "Plan log", type: "select", value: "week", options: ["week", "day"] },
        text("on", "Day in it", ymd(when.day)),
        text("text", "Entry", `${title}${read.relation ? ` (${read.relation})` : ""}${read.instagram ? ` · @${read.instagram}` : ""}`),
      ]),
    )
  }

  // An invite you are going to goes on that day's plan. One you can't make stays in the note.
  for (const e of read.events) {
    if (!e.going || e.day === undefined) continue
    const day = nextWeekday(now, e.day)
    effects.push(
      effect("plan-entry", `${first}'s ${e.what}`, [`You said "${e.phrase}" and did not say you can't go.`, `Add it to the Day Plan for ${longDay(day)}.`], [], [
        { key: "period", label: "Plan log", type: "select", value: "day", options: ["week", "day"] },
        text("on", "Day", ymd(day)),
        text("text", "Entry", `${e.what} with ${first}`),
      ]),
    )
  }

  return { id: `social-${Date.now().toString(36)}-${++seq}`, text: message, at: now.toISOString(), trace, effects }
}
