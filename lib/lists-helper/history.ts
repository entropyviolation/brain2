/**
 * lib/lists-helper/history.ts — Keep the Lists BIMBY's chat between openings (this device only)
 *
 * The chat is saved as what was said, what was answered, the working list, and the undo stack. A waiting plan is
 * not kept: it was approved against data that may have moved, and its buttons would be dead. Big plans are
 * stripped to counts and sample rows so the save stays small. Reads and writes never throw.
 */

import type { Reply, Session } from "./session"

export const HISTORY_KEY = "listshelper-chat"
const MAX_TURNS = 60
const MAX_UNDO_BYTES = 400_000

export type Turn = { id: number; who: "you" | "helper"; text?: string; replies?: Reply[]; at?: string }
export interface Saved {
  turns: Turn[]
  listId?: string
  undo: Session["undo"]
}

/** A reply without the heavy parts of a plan (the per-item edits). Counts and sample rows stay. */
function slim(reply: Reply): Reply {
  if (reply.kind !== "plan") return reply
  const { changes: _c, merge: _m, creates: _r, ...rest } = reply.plan
  return { ...reply, plan: { ...rest, changes: [] }, choices: [] }
}

export function saveHistory(turns: Turn[], session: Session, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  if (!storage) return
  try {
    const kept = turns.slice(-MAX_TURNS).map((t) => (t.replies ? { ...t, replies: t.replies.map(slim) } : t))
    // Merge undo holds whole rows (with dates) that do not survive JSON, so only edit undo is kept.
    const edits = session.undo.filter((u) => !u.rows.length)
    const undo = JSON.stringify(edits).length > MAX_UNDO_BYTES ? [] : edits
    const saved: Saved = { turns: kept, listId: session.listId, undo }
    storage.setItem(HISTORY_KEY, JSON.stringify(saved))
  } catch {
    // Quota or a private window: the chat still works, it just will not be remembered.
  }
}

export function loadHistory(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Saved | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(HISTORY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Saved>
    if (!Array.isArray(parsed.turns) || !parsed.turns.length) return null
    return { turns: parsed.turns, listId: parsed.listId, undo: Array.isArray(parsed.undo) ? parsed.undo : [] }
  } catch {
    return null
  }
}

export function clearHistory(storage: Pick<Storage, "removeItem"> | undefined = safeStorage()): void {
  try {
    storage?.removeItem(HISTORY_KEY)
  } catch {
    // Nothing to clear.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}
