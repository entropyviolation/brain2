/**
 * lib/texts-people-bimby.ts — Texts People BIMBY: people you text become People I Know items
 *
 * One job. The hub counts who you text back and forth with (`/api/phone-text-people`: one-to-one
 * chats, at least one text each way in the last six months, counts only). Each of those numbers
 * with a Mac Contacts name gets a Person item on People I Know, and the number is saved on it
 * (`linkHandlesToPerson`), so Last texted, the phone pens and View text analytics follow.
 *
 * - A number already on a person is left alone.
 * - Numbers with the same Contacts name are one person.
 * - A person who already has that name (title, full name or a nickname) gets the numbers instead of a twin.
 * - A number with no Contacts name is skipped: there is nothing to call the person.
 * - Each number is handled once (`brain2-texts-people-v1`), so a person you delete stays deleted.
 * - A new person's id comes from their number (`textPersonId`), so a second window or Mac makes the
 *   same item instead of a twin, and a deleted one (its id in `removedTaskIds`) is not made again.
 *
 * Runs after the task vault hydrates and every six hours, while **Add people I text** is on
 * (Settings → Phone sync, on by default). No hub (web build, phone): nothing happens.
 */
import { normalizeHandle } from "@/lib/phone-sync/handles"
import { linkHandlesToPerson } from "@/lib/phone-person-links"
import { createPerson, ensurePeopleIKnowList, personPhoneNumbers, personRecords } from "@/lib/people-i-know"
import { persistKey } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export const TEXT_PEOPLE_DAYS = 183
export const TEXT_PEOPLE_DONE_KEY = persistKey("texts-people-v1")
export const TEXT_PEOPLE_AUTO_KEY = persistKey("texts-people-auto")
const EVERY_MS = 6 * 3600_000

export type TextPeopleRow = { handle: string; inbound: number; outbound: number; last: number }
export type TextPeoplePerson = { id: string; names: string[]; handles: string[] }
export type TextPeopleStep =
  | { kind: "create"; id: string; name: string; handles: string[] }
  | { kind: "link"; personId: string; name: string; handles: string[] }

/** Stable id for a person made from texts: their first number, digits and letters only. */
export const textPersonId = (handle: string) => `person-text-${normalizeHandle(handle).replace(/[^a-z0-9]+/gi, "").toLowerCase()}`

const nameKey = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()

/** What to do with these rows. Pure. `done` holds numbers handled on an earlier run. */
export function planTextPeople(
  rows: readonly TextPeopleRow[],
  names: Readonly<Record<string, string>>,
  people: readonly TextPeoplePerson[],
  done: ReadonlySet<string>,
  removedIds: ReadonlySet<string> = new Set(),
): TextPeopleStep[] {
  const owned = new Set(people.flatMap((p) => p.handles.map((h) => normalizeHandle(h))).filter(Boolean))
  const byName = new Map<string, TextPeoplePerson>()
  for (const p of people) for (const n of p.names) if (nameKey(n) && !byName.has(nameKey(n))) byName.set(nameKey(n), p)

  const groups = new Map<string, { name: string; handles: string[] }>()
  for (const row of rows) {
    const handle = normalizeHandle(row.handle)
    const name = (names[row.handle] ?? names[handle] ?? "").trim()
    if (!handle || !name || owned.has(handle) || done.has(handle)) continue
    const g = groups.get(nameKey(name)) ?? { name, handles: [] }
    if (!g.handles.includes(handle)) g.handles.push(handle)
    groups.set(nameKey(name), g)
  }
  const ids = new Set(people.map((p) => p.id))
  return [...groups.entries()].flatMap(([key, g]): TextPeopleStep[] => {
    const known = byName.get(key)
    if (known) return [{ kind: "link", personId: known.id, name: g.name, handles: g.handles }]
    const id = textPersonId(g.handles[0]!)
    if (removedIds.has(id) || ids.has(id)) return []
    return [{ kind: "create", id, name: g.name, handles: g.handles }]
  })
}

function readDone(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(TEXT_PEOPLE_DONE_KEY) ?? "[]") as unknown
    return new Set(Array.isArray(v) ? v.filter((h): h is string => typeof h === "string") : [])
  } catch {
    return new Set()
  }
}

function writeDone(done: Set<string>): void {
  try {
    localStorage.setItem(TEXT_PEOPLE_DONE_KEY, JSON.stringify([...done]))
  } catch {
    // Storage blocked: the "already on a person" check still stops duplicates.
  }
}

export function textPeopleAutoOn(): boolean {
  try {
    return localStorage.getItem(TEXT_PEOPLE_AUTO_KEY) !== "0"
  } catch {
    return true
  }
}

export function setTextPeopleAuto(on: boolean): void {
  try {
    localStorage.setItem(TEXT_PEOPLE_AUTO_KEY, on ? "1" : "0")
  } catch {}
}

function currentPeople(): TextPeoplePerson[] {
  const { tasks, lists } = useTaskStore.getState()
  return personRecords(tasks, lists).map((t) => ({
    id: t.id,
    names: [t.title ?? "", t.personProfile?.fullName ?? "", ...(t.personProfile?.nicknames ?? [])].filter(Boolean),
    handles: [...personPhoneNumbers(t), ...(t.personProfile?.emails ?? [])],
  }))
}

/** Apply a plan to the vault. Returns how many people were created and linked. */
export function applyTextPeople(steps: readonly TextPeopleStep[]): { created: number; linked: number } {
  const done = readDone()
  let created = 0
  let linked = 0
  for (const step of steps) {
    let personId = step.kind === "link" ? step.personId : ""
    if (step.kind === "create") {
      const person = { ...createPerson(step.name, ensurePeopleIKnowList()), id: step.id }
      useTaskStore.getState().addTask(person)
      personId = person.id
      created += 1
    } else linked += 1
    linkHandlesToPerson(personId, step.handles)
    for (const h of step.handles) done.add(h)
  }
  writeDone(done)
  return { created, linked }
}

/** One pass: ask the hub, plan, apply. Quiet when the hub is not there. */
export async function runTextPeopleBimby(opts: { base?: string; force?: boolean } = {}) {
  if (!opts.force && !textPeopleAutoOn()) return null
  let body: { ok?: boolean; rows?: TextPeopleRow[]; names?: Record<string, string> }
  try {
    const res = await fetch(`${opts.base ?? ""}/api/phone-text-people?days=${TEXT_PEOPLE_DAYS}`)
    if (!res.ok) return null
    body = await res.json()
  } catch {
    return null
  }
  if (!body.ok || !Array.isArray(body.rows)) return null
  const removed = new Set(useTaskStore.getState().removedTaskIds ?? [])
  const steps = planTextPeople(body.rows, body.names ?? {}, currentPeople(), readDone(), removed)
  return steps.length ? applyTextPeople(steps) : { created: 0, linked: 0 }
}

/** Start after the task vault hydrates, then every six hours. Returns a stop. */
export function startTextPeopleBimby(): () => void {
  let timer: ReturnType<typeof setInterval> | undefined
  const stopHydrate = afterPersistHydrated(useTaskStore.persist, () => {
    void runTextPeopleBimby()
    timer = setInterval(() => void runTextPeopleBimby(), EVERY_MS)
  })
  return () => {
    stopHydrate()
    if (timer) clearInterval(timer)
  }
}
