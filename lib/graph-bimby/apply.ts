/**
 * lib/graph-bimby/apply.ts — Write one accepted Graph BIMBY change
 *
 * Each change reads its fields as they are at accept time and is one undo step (`runAsAction`). Nothing is
 * destroyed: a note is appended, a fact is a new line, an address that replaces another keeps the old one on
 * the Notes log, a link is only added. The item is found by id (`effect.ref` / `effect.about`), never by name,
 * so two items with one name are never mixed up.
 *
 * - `item-note` / `consider`: a dated `noteLog` row ("Considering: …" for a consideration).
 * - `fact`: a new line in a person's Notes attribute (standing notes), or the item's `notes`.
 * - `place`: a Location item (kind Home, the address) found or made, linked `lives-in` from the person, and
 *   `personProfile.address`.
 * - `kin`: a person link (`mother-of` …) to the other person, who is made in People I Know when new.
 * - `relation`: the Relation field, and a link to the self person when a seed was picked.
 * - `seen`: a `personProfile.interactions` row with `saw: true` (Last seen).
 * - `todo`: a To Do today or this week, linked `about` each item. `step`: a child item of the project.
 * - `contact`: phones, Instagram handles and emails added.
 * - `group`: a new list holding every item told about.
 */
"use client"

import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { runAsAction } from "@/lib/action-history"
import { toLocalCalendarDate } from "@/lib/date-utils"
import { addInstagramToPerson } from "@/lib/instagram-person-links"
import { withItemWriteSource } from "@/lib/item-write-source"
import { createListItem, itemTitle } from "@/lib/item-utils"
import { addLink } from "@/lib/links"
import { LOCATION_ATTR, LOCATION_TYPE_ID } from "@/lib/location-types"
import { createPerson, ensurePeopleIKnowList, personNamed } from "@/lib/people-i-know"
import { ensureSelfPerson } from "@/lib/people-self"
import { normalizeInstagram, presentPersonProfile, type AddressPrecision } from "@/lib/person-profile"
import { PERSON_ATTR } from "@/lib/person-types"
import { parseDateTime } from "@/lib/report-bimby/time"
import { fieldValue, type Effect } from "@/lib/report-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"

export interface GraphApplied {
  ok: boolean
  message: string
}

const SOURCE = { surface: "llm-suggestion" } as const
const fail = (message: string): GraphApplied => ({ ok: false, message })
const pad = (n: number) => String(n).padStart(2, "0")
const rowId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const live = (id: string | undefined): Task | undefined => (id ? useTaskStore.getState().tasks.find((t) => t.id === id) : undefined)
const update = (task: Task) => useTaskStore.getState().updateTask(task)
const name = (t: Task) => itemTitle(t) || "Untitled"

function write(label: string, fn: () => GraphApplied): GraphApplied {
  return runAsAction(`Graph BIMBY: ${label}`, () => withItemWriteSource(SOURCE, fn))
}

function noteRow(text: string, at: Date) {
  return { id: rowId("gn"), date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time: `${pad(at.getHours())}:${pad(at.getMinutes())}`, text }
}

function addNote(task: Task, text: string, at: Date): void {
  const now = live(task.id) ?? task
  update({ ...now, noteLog: [...(now.noteLog ?? []), noteRow(text, at)] })
}

function applyNote(effect: Effect, now: Date): GraphApplied {
  const item = live(effect.ref)
  if (!item) return fail("That item is gone.")
  const raw = fieldValue(effect, "text").trim()
  if (!raw) return fail("The note is empty.")
  const atRaw = fieldValue(effect, "at")
  const at = atRaw ? parseDateTime(atRaw) : now.getTime()
  if (Number.isNaN(at)) return fail("When must look like 2026-11-24T14:05.")
  const text = effect.kind === "consider" ? `Considering: ${raw}` : raw
  return write(`note on ${name(item)}`, () => {
    addNote(item, text, new Date(at))
    return { ok: true, message: `${effect.kind === "consider" ? "Consideration" : "Note"} kept on ${name(item)}'s Notes log.` }
  })
}

function applyFact(effect: Effect): GraphApplied {
  const text = fieldValue(effect, "text").trim()
  if (!text) return fail("The fact is empty.")
  const items = (effect.about?.length ? effect.about : [effect.ref]).map(live).filter((t): t is Task => !!t)
  if (!items.length) return fail("That item is gone.")
  return write(`fact on ${items.map(name).join(", ")}`, () => {
    for (const item of items) {
      const person = !!item.personProfile || item.type === "person"
      if (person) {
        const had = typeof item.attributes?.[PERSON_ATTR.notes] === "string" ? String(item.attributes[PERSON_ATTR.notes]).trim() : ""
        if (had.split("\n").some((row) => row.trim().toLowerCase() === text.toLowerCase())) continue
        update({ ...item, attributes: { ...(item.attributes ?? {}), [PERSON_ATTR.notes]: had ? `${had}\n${text}` : text } })
      } else {
        const had = item.notes?.trim() ?? ""
        if (had.split("\n").some((row) => row.trim().toLowerCase() === text.toLowerCase())) continue
        update({ ...item, notes: had ? `${had}\n${text}` : text })
      }
    }
    return { ok: true, message: `Kept: ${text}` }
  })
}

const PRECISIONS: AddressPrecision[] = ["mailing", "neighborhood", "state", "country"]

function applyPlace(effect: Effect, now: Date): GraphApplied {
  const person = live(effect.ref)
  if (!person) return fail("That person is gone.")
  const address = fieldValue(effect, "address").replace(/\s+/g, " ").trim()
  if (!address) return fail("The address is empty.")
  const raw = fieldValue(effect, "precision") as AddressPrecision
  const precision = PRECISIONS.includes(raw) ? raw : "mailing"
  return write(`${name(person)} lives at ${address}`, () => {
    const store = useTaskStore.getState()
    const key = address.toLowerCase()
    let place = store.tasks.find((t) => t.type === LOCATION_TYPE_ID && (name(t).toLowerCase() === key || String(t.attributes?.[LOCATION_ATTR.address] ?? "").toLowerCase() === key))
    const made = !place
    if (!place) {
      place = { ...createListItem(address, []), type: LOCATION_TYPE_ID, attributes: { [LOCATION_ATTR.kind]: "Home", [LOCATION_ATTR.address]: address } } as Task
      store.addTask(place)
    }
    const now0 = live(person.id)!
    const old = now0.personProfile?.address?.text?.trim()
    update({
      ...now0,
      links: addLink(now0.links, "lives-in", place.id, now0.id),
      personProfile: presentPersonProfile({ ...(now0.personProfile ?? {}), address: { precision, text: address } }),
    })
    if (old && old.toLowerCase() !== key) addNote(now0, `Address was ${old}; now ${address}.`, now)
    return { ok: true, message: `${made ? "Made the Location" : "Linked the Location"} ${address}, “lives in” from ${name(person)}, and set it as their address.` }
  })
}

function findOrMakePerson(nameText: string): { person: Task; made: boolean } {
  const known = personNamed(nameText)
  if (known) return { person: known, made: false }
  const person = createPerson(nameText, ensurePeopleIKnowList())
  useTaskStore.getState().addTask(person)
  return { person, made: true }
}

function applyKin(effect: Effect): GraphApplied {
  const subject = live(effect.about?.[0])
  if (!subject) return fail("That person is gone.")
  const relation = fieldValue(effect, "relation").trim()
  const otherName = fieldValue(effect, "other").trim()
  if (!relation) return fail("Pick a relation.")
  if (!otherName && !effect.ref) return fail("Who is it linked to?")
  return write(`${name(subject)} ${relation} ${otherName}`, () => {
    const byId = live(effect.ref)
    const { person: other, made } = byId && (!otherName || name(byId).toLowerCase() === otherName.toLowerCase()) ? { person: byId, made: false } : findOrMakePerson(otherName)
    if (other.id === subject.id) return fail("A person cannot be linked to themself.")
    const now0 = live(subject.id)!
    update({ ...now0, links: addLink(now0.links, relation, other.id, now0.id) })
    return { ok: true, message: `${made ? `Made ${name(other)} in People I Know. ` : ""}Linked ${name(subject)} → ${relation.replace(/-/g, " ")} → ${name(other)}.` }
  })
}

function applyRelation(effect: Effect): GraphApplied {
  const person = live(effect.ref)
  if (!person) return fail("That person is gone.")
  const relation = fieldValue(effect, "relation").trim()
  const link = fieldValue(effect, "link").trim()
  if (!relation && (!link || link === "none")) return fail("Nothing to set.")
  return write(`${name(person)}'s relation`, () => {
    const said: string[] = []
    let next = live(person.id)!
    if (relation) {
      next = { ...next, personProfile: presentPersonProfile({ ...(next.personProfile ?? {}), relation }) }
      said.push(`Relation: ${relation}.`)
    }
    if (link && link !== "none") {
      const self = ensureSelfPerson()
      if (self && self !== person.id) {
        next = { ...next, links: addLink(next.links, link, self, next.id) }
        said.push(`Linked to you as ${link.replace(/-/g, " ")}.`)
      }
    }
    update(next)
    return { ok: true, message: said.join(" ") }
  })
}

function applySeen(effect: Effect): GraphApplied {
  const person = live(effect.ref)
  if (!person) return fail("That person is gone.")
  const date = fieldValue(effect, "date").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Day must look like 2026-11-26.")
  const text = fieldValue(effect, "text").trim()
  return write(`saw ${name(person)}`, () => {
    const now0 = live(person.id)!
    const rows = now0.personProfile?.interactions ?? []
    if (rows.some((r) => r.date === date && r.saw && r.text === text)) return { ok: true, message: `Already kept: saw ${name(person)} ${date}.` }
    update({ ...now0, personProfile: presentPersonProfile({ ...(now0.personProfile ?? {}), interactions: [...rows, { id: rowId("gi"), date, text, saw: true }] }) })
    return { ok: true, message: `Saw ${name(person)} on ${date}: kept, so Last seen updates.` }
  })
}

function applyTodo(effect: Effect, now: Date): GraphApplied {
  const title = fieldValue(effect, "title").trim()
  if (!title) return fail("The To Do is empty.")
  const week = fieldValue(effect, "when") === "this week"
  const about = (effect.about ?? []).map(live).filter((t): t is Task => !!t)
  return write(`to do ${title}`, () => {
    let task = createScheduledTodoTask({ description: title, period: week ? "week" : "day", date: now })
    for (const a of about) task = { ...task, links: addLink(task.links, "about", a.id, task.id) }
    useTaskStore.getState().addTask(task)
    return { ok: true, message: `To Do ${week ? "this week" : "today"}: ${title}${about.length ? `, linked to ${about.map(name).join(", ")}` : ""}.` }
  })
}

function applyStep(effect: Effect, now: Date): GraphApplied {
  const project = live(effect.ref)
  if (!project) return fail("That project is gone.")
  const title = fieldValue(effect, "title").trim()
  if (!title) return fail("The part is empty.")
  const today = fieldValue(effect, "today") === "yes"
  return write(`part of ${name(project)}`, () => {
    const part: Task = { ...createListItem(title, project.lists ?? []), parentTaskId: project.id, ...(today ? { scheduledDate: toLocalCalendarDate(now) } : {}) } as Task
    useTaskStore.getState().addTask(part)
    return { ok: true, message: `Part of ${name(project)}: ${title}${today ? ", on today's To Do" : ""}.` }
  })
}

const splitList = (v: string) => v.split(/\s*[,;\n]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean)

function applyContact(effect: Effect): GraphApplied {
  const person = live(effect.ref)
  if (!person) return fail("That person is gone.")
  const phones = splitList(fieldValue(effect, "phone"))
  const handles = splitList(fieldValue(effect, "instagram")).map(normalizeInstagram).filter(Boolean)
  const emails = splitList(fieldValue(effect, "email")).filter((e) => /@/.test(e))
  if (!phones.length && !handles.length && !emails.length) return fail("Nothing to add.")
  return write(`contact for ${name(person)}`, () => {
    const said: string[] = []
    const digits = (s: string) => s.replace(/\D/g, "").slice(-10)
    const now0 = live(person.id)!
    const hadPhones = now0.personProfile?.phones ?? []
    const newPhones = phones.filter((p) => digits(p).length >= 7 && !hadPhones.some((h) => digits(h) === digits(p)))
    const hadEmails = now0.personProfile?.emails ?? []
    const newEmails = emails.filter((e) => !hadEmails.some((h) => h.toLowerCase() === e.toLowerCase()))
    if (newPhones.length || newEmails.length) {
      const attr = now0.attributes?.[PERSON_ATTR.phone]
      const shown = Array.isArray(attr) ? attr.filter((v): v is string => typeof v === "string") : typeof attr === "string" && attr.trim() ? [attr.trim()] : null
      update({
        ...now0,
        ...(shown && newPhones.length ? { attributes: { ...(now0.attributes ?? {}), [PERSON_ATTR.phone]: [...shown, ...newPhones] } } : {}),
        personProfile: presentPersonProfile({ ...(now0.personProfile ?? {}), ...(newPhones.length ? { phones: [...hadPhones, ...newPhones] } : {}), ...(newEmails.length ? { emails: [...hadEmails, ...newEmails] } : {}) }),
      })
      if (newPhones.length) said.push(`Phone ${newPhones.join(", ")}.`)
      if (newEmails.length) said.push(`Email ${newEmails.join(", ")}.`)
    }
    for (const h of handles) {
      const how = addInstagramToPerson(person.id, h)
      if (how === "main" || how === "other") said.push(`Instagram @${h}.`)
    }
    return { ok: true, message: said.length ? `Added to ${name(person)}: ${said.join(" ")}` : `${name(person)} already had all of that.` }
  })
}

function applyGroup(effect: Effect): GraphApplied {
  const listName = fieldValue(effect, "name").trim()
  if (!listName) return fail("Name the list.")
  const items = (effect.about ?? []).map(live).filter((t): t is Task => !!t)
  if (items.length < 2) return fail("A group needs two items or more.")
  return write(`group ${listName}`, () => {
    const store = useTaskStore.getState()
    let list = store.lists.find((l) => l.name.trim().toLowerCase() === listName.toLowerCase())
    if (!list) {
      list = { id: `list-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: listName, color: "#5b7a99", createdAt: new Date(), description: "A group made from BIM's GRAPH tab." } as List
      store.addList(list)
    }
    for (const item of items) {
      const now0 = live(item.id)!
      if ((now0.lists ?? []).includes(list.id)) continue
      update({ ...now0, lists: [...(now0.lists ?? []), list.id] })
    }
    return { ok: true, message: `${items.length} items in the list ${listName}.` }
  })
}

/** Apply one Graph BIMBY change with its current fields. Never throws. */
export function applyGraphEffect(effect: Effect, now = new Date()): GraphApplied {
  try {
    switch (effect.kind) {
      case "item-note":
      case "consider":
        return applyNote(effect, now)
      case "fact":
        return applyFact(effect)
      case "place":
        return applyPlace(effect, now)
      case "kin":
        return applyKin(effect)
      case "relation":
        return applyRelation(effect)
      case "seen":
        return applySeen(effect)
      case "todo":
        return applyTodo(effect, now)
      case "step":
        return applyStep(effect, now)
      case "contact":
        return applyContact(effect)
      case "group":
        return applyGroup(effect)
      default:
        return fail(`Not a Graph BIMBY change: ${effect.kind}.`)
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
