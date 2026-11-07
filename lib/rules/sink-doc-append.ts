/**
 * lib/rules/sink-doc-append.ts — Sink `doc-append`: add an entry to a Docs note
 *
 * Writes the same two copies Docs does: the task-store preview and the full body in
 * IndexedDB (`lib/doc-persist.ts`). Appends run one after another so two events
 * delivered together cannot overwrite each other.
 */
import { getPersistedDoc, previewDocBody, putPersistedDoc, taskToPersistedDoc } from "@/lib/doc-persist"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { appendEntry } from "@/lib/text-mirror/text-mirror"
import type { RuleSink } from "./rule-types"

const BLANK = "<p><br></p>"
let chain: Promise<unknown> = Promise.resolve()

function docId(): string {
  try {
    return `doc_${crypto.randomUUID()}`
  } catch {
    return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

function findByTitle(title: string): Task | undefined {
  const want = title.trim().toLowerCase()
  return useTaskStore.getState().tasks.find((t) => t.type === NOTE_TYPE_ID && t.description.trim().toLowerCase() === want)
}

/** The Docs note called `title`: the existing one, or a new one in the Docs tab. */
export function ensureDoc(title: string): { task: Task; created: boolean } {
  const existing = findByTitle(title)
  if (existing) return { task: existing, created: false }
  const now = new Date()
  const task: Task = {
    id: docId(),
    description: title.trim() || "Untitled document",
    type: NOTE_TYPE_ID,
    stage: "list",
    createdAt: now,
    completed: false,
    lists: [],
    body: BLANK,
    attributes: {
      [NOTE_ATTR.status]: "draft",
      [NOTE_ATTR.folder]: "",
      [NOTE_ATTR.fontFamily]: "Merriweather",
      [NOTE_ATTR.updatedAt]: now.toISOString(),
    },
    links: [],
    tags: ["docs"],
  }
  useTaskStore.getState().addTask(task)
  void putPersistedDoc(taskToPersistedDoc(task, BLANK))
  return { task, created: true }
}

/**
 * Add `html` to the end of the sink's note. A deleted note is found again by title or
 * recreated. Returns the sink with the (possibly new) doc id, or null when the write failed.
 */
export function appendToDoc(sink: Extract<RuleSink, { kind: "doc-append" }>, html: string): Promise<Extract<RuleSink, { kind: "doc-append" }> | null> {
  const run = async () => {
    let task = useTaskStore.getState().tasks.find((t) => t.id === sink.docId)
    if (!task) task = ensureDoc(sink.title).task
    const stored = await getPersistedDoc(task.id)
    const body = appendEntry(stored?.body || task.body || "", html)
    const updated: Task = {
      ...task,
      body: previewDocBody(body),
      attributes: { ...(task.attributes ?? {}), [NOTE_ATTR.updatedAt]: new Date().toISOString() },
    }
    useTaskStore.getState().updateTask(updated)
    await putPersistedDoc({ ...taskToPersistedDoc(updated, body), updatedAt: new Date().toISOString() })
    return { ...sink, docId: task.id }
  }
  const next = chain.then(run, run)
  chain = next.catch(() => undefined)
  return next.catch(() => null)
}
