/**
 * lib/social-bimby/apply.ts — Write one accepted social effect
 *
 * Each effect reads its fields as they are at accept time and is one undo step. Never destroys: a person
 * found by name keeps every field they had, and only blanks are filled. The one move is an Instagram handle,
 * which belongs to one person (`linkInstagramToPerson`), and the card says so before Accept.
 * A note, birthday or reminder finds the person by name (or makes them, so a lone Accept still works).
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { withItemWriteSource } from "@/lib/item-write-source"
import { getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterLabel } from "@/lib/seasons"
import { linkInstagramToPerson, personForInstagram } from "@/lib/instagram-person-links"
import { createPerson, ensurePeopleIKnowList, personNamed, personRecords } from "@/lib/people-i-know"
import { normalizeInstagram, presentPersonProfile } from "@/lib/person-profile"
import { PERSON_ATTR } from "@/lib/person-types"
import { appendPlanEntry } from "@/lib/plan-text"
import { addReminder } from "@/lib/reminders"
import { parseDateTime } from "@/lib/report-bimby/time"
import { fieldValue, type Effect } from "@/lib/report-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export interface SocialApplied {
  ok: boolean
  message: string
}

const fail = (message: string): SocialApplied => ({ ok: false, message })
const SOURCE = { surface: "llm-suggestion" } as const
const pad = (n: number) => String(n).padStart(2, "0")

function rowId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

const current = (id: string): Task | undefined => useTaskStore.getState().tasks.find((t) => t.id === id)

/** The person by name or handle, or a new one in People I Know. */
function findOrMake(name: string, handle?: string): { person: Task; made: boolean } {
  const known = personNamed(name)
  if (known) return { person: known, made: false }
  if (handle) {
    const { tasks, lists } = useTaskStore.getState()
    const byHandle = personForInstagram(personRecords(tasks, lists), handle)
    if (byHandle) return { person: byHandle, made: false }
  }
  const person = createPerson(name, ensurePeopleIKnowList())
  useTaskStore.getState().addTask(person)
  return { person, made: true }
}

function applyPerson(effect: Effect): SocialApplied {
  const name = fieldValue(effect, "name").trim()
  const handle = normalizeInstagram(fieldValue(effect, "instagram"))
  const relation = fieldValue(effect, "relation").trim()
  const phone = fieldValue(effect, "phone").trim()
  if (!name) return fail("Name is empty.")
  return runAsAction(`Social: ${name}`, () =>
    withItemWriteSource(SOURCE, () => {
      const { person, made } = findOrMake(name, handle || undefined)
      const said: string[] = [made ? `Made ${name} in People I Know.` : `${name} was already in People I Know.`]
      const kept = person.personProfile?.relation?.trim()
      if (relation && !kept) {
        const live = current(person.id)!
        useTaskStore.getState().updateTask({ ...live, personProfile: presentPersonProfile({ ...(live.personProfile ?? {}), relation }) })
        said.push(`Relation: ${relation}.`)
      } else if (relation && kept && kept.toLowerCase() !== relation.toLowerCase()) {
        said.push(`Kept their relation "${kept}".`)
      }
      if (phone) {
        const live = current(person.id)!
        const phones = live.personProfile?.phones ?? []
        const digits = (s: string) => s.replace(/\D/g, "").slice(-10)
        if (!phones.some((p) => digits(p) === digits(phone))) {
          useTaskStore.getState().updateTask({ ...live, personProfile: presentPersonProfile({ ...(live.personProfile ?? {}), phones: [...phones, phone] }) })
          said.push(`Phone ${phone} saved.`)
        }
      }
      if (handle) {
        linkInstagramToPerson(person.id, handle)
        said.push(`Instagram @${handle} attached.`)
      }
      return { ok: true, message: said.join(" ") }
    }),
  )
}

function applyNote(effect: Effect): SocialApplied {
  const name = fieldValue(effect, "person").trim()
  const note = fieldValue(effect, "text").trim()
  const at = parseDateTime(fieldValue(effect, "at"))
  if (!name) return fail("Person is empty.")
  if (!note) return fail("The note is empty.")
  if (Number.isNaN(at)) return fail("When must look like 2026-11-11T14:05.")
  const d = new Date(at)
  return runAsAction(`Social: note on ${name}`, () =>
    withItemWriteSource(SOURCE, () => {
      const { person, made } = findOrMake(name)
      const live = current(person.id)!
      const entry = { id: rowId("sn"), date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, text: note }
      useTaskStore.getState().updateTask({ ...live, noteLog: [...(live.noteLog ?? []), entry] })
      return { ok: true, message: `${made ? `Made ${name} and noted` : "Noted"} on ${name}'s Notes log.` }
    }),
  )
}

function applyBirthday(effect: Effect): SocialApplied {
  const name = fieldValue(effect, "person").trim()
  const date = fieldValue(effect, "date").trim()
  if (!name) return fail("Person is empty.")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Birthday must look like 1998-03-14.")
  return runAsAction(`Social: ${name}'s birthday`, () =>
    withItemWriteSource(SOURCE, () => {
      const { person } = findOrMake(name)
      const live = current(person.id)!
      const had = live.attributes?.[PERSON_ATTR.birthday]
      if (typeof had === "string" && had && had.slice(0, 10) !== date) return fail(`${name} already has a birthday (${had.slice(0, 10)}). Change it on their page if this one is right.`)
      useTaskStore.getState().updateTask({ ...live, attributes: { ...(live.attributes ?? {}), [PERSON_ATTR.birthday]: date } })
      return { ok: true, message: `${name}'s birthday set to ${date}.` }
    }),
  )
}

function applyReminder(effect: Effect, now: Date): SocialApplied {
  const what = fieldValue(effect, "text").trim()
  const at = parseDateTime(fieldValue(effect, "when"))
  const name = fieldValue(effect, "person").trim()
  if (!what) return fail("The reminder is empty.")
  if (Number.isNaN(at)) return fail("When must look like 2026-11-16T11:00.")
  if (at <= now.getTime()) return fail("That time has passed. Pick a later one.")
  return runAsAction(`Social: reminder ${what}`, () =>
    withItemWriteSource(SOURCE, () => {
      const id = addReminder(what, new Date(at), "once")
      // The reminder links to the person, so it shows on their page.
      const person = name ? personNamed(name) : undefined
      const made = current(id)
      if (person && made) useTaskStore.getState().updateTask({ ...made, links: [...(made.links ?? []), { id: rowId("ln"), relation: "about", targetId: person.id }] })
      const when = new Date(at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      return { ok: true, message: `Reminder set: ${what}, ${when}.` }
    }),
  )
}

const PERIODS = ["day", "week", "quarter", "year"] as const
type Period = (typeof PERIODS)[number]

/** The plan-log key for the period the day is in, and how the reply names it. */
function periodOf(period: Period, on: string, day: Date): { key: string; said: string } {
  switch (period) {
    case "day":
      return { key: on, said: `the Day Plan for ${on}` }
    case "week": {
      const key = getWeekString(day)
      return { key, said: `the Week Plan for ${key.replace("_", " to ")}` }
    }
    case "quarter": {
      const key = quarterKey(day)
      return { key, said: `the Season Plan, ${quarterLabel(key)}` }
    }
    case "year":
      return { key: String(day.getFullYear()), said: `the Year Plan for ${day.getFullYear()}` }
  }
}

function applyPlanEntry(effect: Effect, now: Date): SocialApplied {
  const raw = fieldValue(effect, "period")
  const period: Period = (PERIODS as readonly string[]).includes(raw) ? (raw as Period) : "week"
  const on = fieldValue(effect, "on").trim()
  const entry = fieldValue(effect, "text").trim()
  if (!entry) return fail("The entry is empty.")
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(on)
  if (!m) return fail("The day must look like 2026-11-16.")
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const { key, said } = periodOf(period, on, day)
  const done = appendPlanEntry(period, key, entry, now, { stampSuffix: "SOCIAL BIMBY" })
  if (!done) return fail("The plan log did not take the entry.")
  return { ok: true, message: `Added to ${said}.` }
}

/** An intention on the person's page: what you want to do with them, until it happens. */
function applyIntention(effect: Effect, now: Date): SocialApplied {
  const name = fieldValue(effect, "person").trim()
  const what = fieldValue(effect, "text").trim()
  const kind = fieldValue(effect, "kind") === "trip" ? "trip" : "hang"
  const h = fieldValue(effect, "horizon")
  const horizon = h === "season" || h === "year" ? h : "week"
  if (!name) return fail("Person is empty.")
  if (!what) return fail("The intention is empty.")
  return runAsAction(`Social: intention for ${name}`, () =>
    withItemWriteSource(SOURCE, () => {
      const { person, made } = findOrMake(name)
      const live = current(person.id)!
      const had = live.personProfile?.intentions ?? []
      if (had.some((i) => !i.done && i.text.toLowerCase() === what.toLowerCase())) return { ok: true, message: `${name} already has "${what}".` }
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const intentions = [...had, { id: rowId("si"), date, text: what, kind, horizon } as const]
      useTaskStore.getState().updateTask({ ...live, personProfile: presentPersonProfile({ ...(live.personProfile ?? {}), intentions }) })
      return { ok: true, message: `${made ? `Made ${name}. ` : ""}Kept on ${name}'s page: ${what}.` }
    }),
  )
}

const SOCIAL_KINDS = new Set<Effect["kind"]>(["person", "person-note", "birthday", "reminder", "plan-entry", "intention"])

export function isSocialEffect(effect: Effect): boolean {
  return SOCIAL_KINDS.has(effect.kind)
}

/** Apply one social effect with its current fields. Never throws. */
export function applySocialEffect(effect: Effect, now = new Date()): SocialApplied {
  try {
    switch (effect.kind) {
      case "person":
        return applyPerson(effect)
      case "person-note":
        return applyNote(effect)
      case "birthday":
        return applyBirthday(effect)
      case "reminder":
        return applyReminder(effect, now)
      case "plan-entry":
        return applyPlanEntry(effect, now)
      case "intention":
        return applyIntention(effect, now)
      default:
        return fail("Not a social effect.")
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
