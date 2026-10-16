/**
 * lib/ingest/apply-link.ts — A message that starts with a link → Inbox → Links
 *
 * The first token is the link, the rest is the note (`lib/saved-links.ts`).
 * The row is a `stage: "inbox"` task with `savedLink` set; its name is the
 * URL and the note is `notes`. It is not a log line, not a revisit idea, and
 * smart-parse does not read the note. The same open link sent again is not a
 * second row: a new note is added under the old one.
 */
import { buildCapturedTask, ensureCaptureTarget } from "@/lib/capture-target"
import { parseLinkMessage, isOpenSavedLink, linkKindLabel } from "@/lib/saved-links"
import { useTaskStore } from "@/lib/task-store"
import type { CaptureOrigin } from "@/lib/types"
import { taskStoreMutators } from "./apply-capture"
import type { ApplyResult } from "./types"

export function applyLink(text: string, opts?: { now?: Date; origin?: CaptureOrigin }): ApplyResult | null {
  const parsed = parseLinkMessage(text)
  if (!parsed) return null
  const { link, note } = parsed
  const label = linkKindLabel(link)
  const store = useTaskStore.getState()

  const existing = store.tasks.find((task) => isOpenSavedLink(task) && task.savedLink!.url === link.url)
  if (existing) {
    const prev = existing.notes?.trim() ?? ""
    const added = note && !prev.split("\n").includes(note)
    if (added) store.updateTask({ ...existing, notes: prev ? `${prev}\n${note}` : note })
    return {
      status: "ok",
      kind: "link",
      reply: added ? `Already in Links (${label}). Added the note.` : `Already in Links (${label}).`,
      summary: `Link already saved: ${link.url}`,
      itemIds: [existing.id],
    }
  }

  const suggestion = { description: link.url, plain: true }
  // No path: the link makes no list or folder.
  const target = ensureCaptureTarget({}, taskStoreMutators)
  const task = buildCapturedTask({
    suggestion,
    fallbackText: link.url,
    sendToInbox: true,
    target,
    folders: store.folders,
    now: opts?.now,
    origin: opts?.origin,
  })
  store.addTask({ ...task, savedLink: link, ...(note ? { notes: note } : {}) })
  return {
    status: "ok",
    kind: "link",
    reply: note ? `Links: ${label} — ${note}` : `Links: ${label}`,
    summary: `Saved link ${link.url}${note ? ` (${note})` : ""}`,
    itemIds: [task.id],
  }
}
