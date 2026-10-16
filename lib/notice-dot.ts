/**
 * lib/notice-dot.ts — The To Do notice dot (Phase 15 B, UI-8)
 *
 * A row pushed 3 or more times (day + week + month) gets a small dot. Its one
 * line is a question, not a verdict. The answer is a dated `noteLog` entry
 * tagged `notice`, stamped with the push total, so the dot stays quiet until
 * the next push. No count, no color.
 */
import type { Task } from "@/lib/types"
import { makeNoteEntry } from "@/lib/item-notes"

export const NOTICE_AFTER_PUSHES = 3
export const NOTICE_PROMPT = "I'd like to understand what's going on with this one…"

type Pushes = Pick<Task, "daysPushed" | "weeksPushed" | "monthsPushed">

/** Pushes across every period. */
export function totalPushes(task: Pushes): number {
  return (task.daysPushed ?? 0) + (task.weeksPushed ?? 0) + (task.monthsPushed ?? 0)
}

/** True when the dot shows: pushed 3+ times and not answered since the last push. */
export function needsNotice(task: Pushes & Pick<Task, "noteLog">): boolean {
  const total = totalPushes(task)
  if (total < NOTICE_AFTER_PUSHES) return false
  return !(task.noteLog ?? []).some((e) => e.tag === "notice" && (e.pushCount ?? 0) >= total)
}

/** The task with the answer added to its `noteLog`. Blank text returns the task as is. */
export function withNoticeAnswer<T extends Task>(task: T, text: string, now: Date = new Date()): T {
  const entry = makeNoteEntry(text, { now })
  if (!entry) return task
  entry.tag = "notice"
  entry.pushCount = totalPushes(task)
  return { ...task, noteLog: [...(task.noteLog ?? []), entry] }
}
