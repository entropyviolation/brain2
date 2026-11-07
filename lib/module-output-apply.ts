/**
 * lib/module-output-apply.ts — The door a module's output walks through
 *
 * `applyModuleOutput` is the only place a `ModuleOutput` (`lib/module-output.ts`) turns into
 * writes. In order:
 *
 *   1. Check the report (`normalizeModuleOutput`). A bad one writes nothing and says why.
 *   2. Find the thing it was about. A Book is found by the module's key, then by a close title
 *      (`findBookMatch`, strict), and created in the Reading list when nothing fits.
 *   3. Fold it into the day's reading log Item (`lib/habit-contributions.ts`), once per output id.
 *   4. Add the new amount to every habit that listens (`lib/habit-feeds.ts`).
 *   5. Move the Book's own progress (`pagesRead`, status), with the Book type's implied-action
 *      rules held, because steps 3 and 4 already did what those rules would do.
 *
 * Every write goes through the repository and the habits store, so sync, history, and the
 * activity feed see it as they see any other change. A module's output is automatic, so it
 * is not an undo step; the entry form passes `undo: "step"` and is.
 */
import { runAsAction, withoutUndo } from "@/lib/action-history"
import { BOOK_ATTR, BOOK_TYPE_ID, DEFAULT_BOOK_STATUS } from "@/lib/book-types"
import { findBookMatch } from "@/lib/book-match"
import { taskRepository } from "@/lib/data/task-repository"
import { habitsForOutput } from "@/lib/habit-feeds"
import {
  CONTRIBUTION_ATTR,
  contributionItemId,
  contributionTitle,
  encodeRecord,
  foldOutput,
  recordOf,
} from "@/lib/habit-contributions"
import { useHabitsStore } from "@/lib/habits-store"
import { buildLoggedActionItem, incrementHabitProgress } from "@/lib/implied-actions"
import { withItemWriteSource } from "@/lib/item-write-source"
import { itemTitle, type TitledRecord } from "@/lib/item-utils"
import { cleanBookTitle, describeAmount, localDayKey, normalizeModuleOutput, type ModuleOutput, type ModuleOutputSubject, type RawModuleOutput } from "@/lib/module-output"
import { withoutImpliedActions } from "@/lib/services/item-mutation-service"
import type { ItemRecord, Task } from "@/lib/types"

export { cleanBookTitle }

/** A close title, not a loose one: this decides whether pages go onto a book you already have. */
export const BOOK_MATCH_THRESHOLD = 0.8

/** Attribute that remembers which module key a Book was made or matched for. */
export const MODULE_KEY_ATTR = "moduleKeys"

const moduleKey = (moduleId: string, key: string) => `${moduleId}:${key}`

function keysOf(item: ItemRecord): string[] {
  const raw = (item.attributes as Record<string, unknown> | undefined)?.[MODULE_KEY_ATTR]
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []
}

export interface SubjectResolution {
  item: ItemRecord
  created: boolean
}

/** Find the Book a subject names, or make it. Only the `book` type is handled; others return undefined. */
export function resolveSubjectItem(subject: ModuleOutputSubject, moduleId: string, now = new Date()): SubjectResolution | undefined {
  if (subject.type !== BOOK_TYPE_ID) return undefined
  const books = taskRepository.getAll().filter((t) => t.type === BOOK_TYPE_ID)
  const wanted = subject.key ? moduleKey(moduleId, subject.key) : undefined
  const direct = subject.itemId ? books.find((b) => b.id === subject.itemId) : undefined
  const byKey = wanted ? books.find((b) => keysOf(b).includes(wanted)) : undefined
  let found = direct ?? byKey
  if (!found) {
    const hit = findBookMatch(subject.title, books.map((b) => ({ id: b.id, title: itemTitle(b as unknown as TitledRecord), author: String((b.attributes as Record<string, unknown> | undefined)?.[BOOK_ATTR.author] ?? "") })), BOOK_MATCH_THRESHOLD)
    found = hit ? books.find((b) => b.id === hit.candidateId) : undefined
  }
  if (found) {
    if (wanted && !keysOf(found).includes(wanted)) {
      // Remember the key so a rename of either side cannot split the book later.
      taskRepository.update({ ...found, attributes: { ...(found.attributes ?? {}), [MODULE_KEY_ATTR]: [...keysOf(found), wanted] } } as ItemRecord)
      found = taskRepository.getById(found.id) ?? found
    }
    return { item: found, created: false }
  }
  const readingList = taskRepository.getLists().find((l) => l.itemTypeId === BOOK_TYPE_ID)
  const created = {
    id: `book-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    description: subject.title,
    title: subject.title,
    type: BOOK_TYPE_ID,
    stage: "list",
    lists: readingList ? [readingList.id] : [],
    createdAt: now,
    completed: false,
    rewardValue: 0,
    attributes: {
      [BOOK_ATTR.status]: DEFAULT_BOOK_STATUS,
      [BOOK_ATTR.pagesRead]: 0,
      ...(wanted ? { [MODULE_KEY_ATTR]: [wanted] } : {}),
    },
  } as unknown as Task
  withItemWriteSource({ surface: "module", name: moduleId }, () => taskRepository.add(created as unknown as ItemRecord))
  return { item: taskRepository.getById(created.id) ?? (created as unknown as ItemRecord), created: true }
}

export type ApplyResult =
  | {
      ok: true
      /** Counted for the first time. False when the same output id had already been applied. */
      counted: boolean
      added: number
      habits: { id: string; name: string }[]
      subject?: { itemId: string; title: string; created: boolean }
      line: string
    }
  | { ok: false; errors: string[] }

export function applyModuleOutput(raw: RawModuleOutput, opts: { undo?: "none" | "step" } = {}): ApplyResult {
  const checked = normalizeModuleOutput(raw)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  const run = opts.undo === "step" ? (fn: () => ApplyResult) => runAsAction("Log reading", fn) : (fn: () => ApplyResult) => withoutUndo(fn)
  return run(() =>
    withItemWriteSource({ surface: "module", name: checked.output.moduleId }, () => withoutImpliedActions(() => write(checked.output))),
  )
}

function write(output: ModuleOutput): ApplyResult {
  const at = new Date(output.at)
  let subject = output.subject
  let resolved: SubjectResolution | undefined
  if (subject) {
    resolved = resolveSubjectItem(subject, output.moduleId, at)
    if (resolved) subject = { ...subject, itemId: resolved.item.id }
  }
  const withSubject: ModuleOutput = { ...output, ...(subject ? { subject } : {}) }
  const habits = habitsForOutput(useHabitsStore.getState().tasks, withSubject)
  const day = localDayKey(withSubject.at)
  const rowId = contributionItemId(withSubject.measure, day, subject)
  const existing = taskRepository.getById(rowId)
  const { record, added } = foldOutput(existing ? recordOf(existing) : undefined, withSubject, habits.map((h) => h.id))
  const habitList = habits.map((h) => ({ id: h.id, name: h.name }))
  const subjectOut = resolved ? { itemId: resolved.item.id, title: itemTitle(resolved.item as unknown as TitledRecord), created: resolved.created } : undefined
  if (added === 0) {
    return { ok: true, counted: false, added: 0, habits: habitList, ...(subjectOut ? { subject: subjectOut } : {}), line: "Already counted." }
  }

  if (existing) {
    taskRepository.update({
      ...existing,
      attributes: { ...(existing.attributes ?? {}), [CONTRIBUTION_ATTR]: encodeRecord(record) },
    } as ItemRecord)
  } else {
    const source = (resolved?.item ?? {}) as unknown as Task
    const row = buildLoggedActionItem(source, contributionTitle(withSubject.measure, subject), false, at)
    taskRepository.add({
      ...row,
      id: rowId,
      links: resolved ? [{ id: `link-${rowId}`, relation: "about", targetId: resolved.item.id }, ...(row.links ?? [])] : row.links,
      attributes: { [CONTRIBUTION_ATTR]: encodeRecord(record) },
    } as unknown as ItemRecord)
  }

  for (const habit of habits) incrementHabitProgress(habit.id, added, at)

  if (resolved && withSubject.measure === "pages") {
    const book = taskRepository.getById(resolved.item.id)
    if (book) {
      const attrs = (book.attributes ?? {}) as Record<string, unknown>
      const read = Number(attrs[BOOK_ATTR.pagesRead]) || 0
      const status = attrs[BOOK_ATTR.status]
      taskRepository.update({
        ...book,
        attributes: {
          ...attrs,
          [BOOK_ATTR.pagesRead]: read + added,
          ...(status === undefined || status === "to-read" || status === "queued" ? { [BOOK_ATTR.status]: "reading" } : {}),
        },
      } as ItemRecord)
    }
  }

  const where = habits.length ? ` toward ${habits.map((h) => `“${h.name}”`).join(", ")}` : ""
  const of = subjectOut ? ` of ${subjectOut.title}` : ""
  return {
    ok: true,
    counted: true,
    added,
    habits: habitList,
    ...(subjectOut ? { subject: subjectOut } : {}),
    line: `Logged ${describeAmount(withSubject.measure, added)}${of}${where}.`,
  }
}
