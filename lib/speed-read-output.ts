/**
 * lib/speed-read-output.ts — What Speed Read tells the house when a page is finished
 *
 * One finished page is one `ModuleOutput` (`lib/module-output.ts`): module `speed-read`, measure
 * `pages`, amount 1, the clock time it was finished, how long it took, and the book it was about.
 * The book is named by its library id when the PDF is in the Mac library (stable across renames),
 * else by its cleaned file name. Speed Read does not know which habit listens: that is the
 * habits' `moduleFeeds`, applied by `applyModuleOutput`.
 *
 * `reportPageRead` never throws and never blocks the reader. A failure is logged and reading goes on.
 */
import { cleanBookTitle, type RawModuleOutput, type RawModuleSession } from "@/lib/module-output"

export const SPEED_READ_MODULE_ID = "speed-read"

/** Longest a single page can have taken before the time is treated as a pause, not reading. */
export const MAX_PAGE_MS = 30 * 60_000

export function pageReadOutput(input: {
  /** The Mac library id, when the PDF is stored there. */
  libraryId?: string | null
  /** The name shown for the PDF. */
  fileName: string
  /** 1-based page that was finished. */
  page: number
  /** When this PDF was opened; one page counts once per opening. */
  openedAt: number
  /** When the page started playing, ms. */
  startedAt?: number
  /** When it finished, ms. */
  finishedAt: number
}): RawModuleOutput {
  const title = cleanBookTitle(input.fileName) || "Untitled PDF"
  const key = input.libraryId || title.toLowerCase()
  const took = input.startedAt != null ? input.finishedAt - input.startedAt : undefined
  return {
    id: `${SPEED_READ_MODULE_ID}:${key}:p${input.page}:${input.openedAt}`,
    moduleId: SPEED_READ_MODULE_ID,
    measure: "pages",
    amount: 1,
    at: new Date(input.finishedAt).toISOString(),
    ...(took != null && took > 0 && took <= MAX_PAGE_MS ? { durationMs: took } : {}),
    subject: { type: "book", title, key },
  }
}

export function reportPageRead(input: Parameters<typeof pageReadOutput>[0]): void {
  void import("@/lib/module-output-apply")
    .then(({ applyModuleOutput }) => {
      const done = applyModuleOutput(pageReadOutput(input))
      if (!done.ok) console.warn("Speed Read page not logged:", done.errors.join("; "))
    })
    .catch((error) => console.warn("Speed Read page not logged:", error))
}

/** One stretch of active reading, from play to pause: time, book, and how many pages were finished in it. */
export function sessionOutput(input: {
  libraryId?: string | null
  fileName: string
  startedAt: number
  endedAt: number
  pages: number
}): RawModuleSession {
  const title = cleanBookTitle(input.fileName) || "Untitled PDF"
  const key = input.libraryId || title.toLowerCase()
  return {
    id: `${SPEED_READ_MODULE_ID}:${key}:${input.startedAt}`,
    moduleId: SPEED_READ_MODULE_ID,
    startAt: new Date(input.startedAt).toISOString(),
    endAt: new Date(input.endedAt).toISOString(),
    subject: { type: "book", title, key },
    quantities: input.pages > 0 ? [{ measure: "pages", amount: input.pages }] : [],
  }
}

/** Same promise as `reportPageRead`: never throws into the reader. */
export function reportSession(input: Parameters<typeof sessionOutput>[0]): void {
  if (input.endedAt - input.startedAt < 60_000) return
  void import("@/lib/module-session-apply")
    .then(({ applyModuleSession }) => {
      const done = applyModuleSession(sessionOutput(input))
      if (!done.ok) console.warn("Speed Read session not tracked:", done.errors.join("; "))
    })
    .catch((error) => console.warn("Speed Read session not tracked:", error))
}
