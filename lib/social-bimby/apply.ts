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

function applyPlanEntry(effect: Effect, now: Date): SocialApplied {
  const period = fieldValue(effect, "period") === "day" ? "day" : "week"
  const on = fieldValue(effect, "on").trim()
  const entry = fieldValue(effect, "text").trim()
  if (!entry) return fail("The entry is empty.")
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(on)
  if (!m) return fail("The day must look like 2026-11-16.")
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const key = period === "day" ? on : getWeekString(day)
  const done = appendPlanEntry(period, key, entry, now, { stampSuffix: "SOCIAL BIMBY" })
  if (!done) return fail("The plan log did not take the entry.")
  return { ok: true, message: period === "day" ? `Added to the Day Plan for ${on}.` : `Added to the Week Plan for ${key.replace("_", " to ")}.` }
}

const SOCIAL_KINDS = new Set<Effect["kind"]>(["person", "person-note", "birthday", "reminder", "plan-entry"])

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
      default:
        return fail("Not a social effect.")
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
