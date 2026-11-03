/**
 * lib/baby-game/design-notes.ts — Redesign notes for each character, kept in this browser
 *
 * A development tool today and the seam for a fully generative game later: one short note and a status per
 * character (`keep`, `redo`, `done`). It lives under its own key (`brain2-baby-game-design`), not in the village save,
 * so Start over does not wipe it. `designBrief` turns a note into the paragraph a sprite maker (a person, ComfyUI, or a
 * BIMBY) is given.
 */

import { persistKey } from "@/lib/storage-keys"

export type DesignStatus = "keep" | "redo" | "done"
export type DesignNote = { text: string; status: DesignStatus; at: number }
export type DesignNotes = Record<string, DesignNote>

export const DESIGN_STATUS_LABEL: Record<DesignStatus, string> = { keep: "Fine as is", redo: "Needs redesign", done: "Redesigned" }

const key = () => persistKey("baby-game-design")

export function loadDesignNotes(): DesignNotes {
  try {
    const raw = localStorage.getItem(key())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DesignNotes
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function saveDesignNotes(notes: DesignNotes): void {
  try {
    localStorage.setItem(key(), JSON.stringify(notes))
  } catch {
    // a full or blocked store: the notes stay on screen, they just are not kept
  }
}

/** A new notes object with one character's note changed. */
export function withNote(notes: DesignNotes, id: string, patch: Partial<Pick<DesignNote, "text" | "status">>, now = Date.now()): DesignNotes {
  const old = notes[id] ?? { text: "", status: "keep" as DesignStatus, at: now }
  return { ...notes, [id]: { ...old, ...patch, at: now } }
}

/** How many characters are marked for a redo. */
export const redoCount = (notes: DesignNotes): number => Object.values(notes).filter((n) => n.status === "redo").length

/** The brief handed to whoever redraws a character. */
export function designBrief(id: string, name: string, note: DesignNote | undefined): string {
  const lines = [`Redesign brief: ${name} (${id})`, `Status: ${DESIGN_STATUS_LABEL[note?.status ?? "keep"]}`]
  lines.push(note?.text.trim() ? `Notes: ${note.text.trim()}` : "Notes: none yet")
  lines.push("Keep: the 32×32 grid, the sprite palette (no yellow), feet on row 29, a front, side and back view.")
  return lines.join("\n")
}

/** Every character that needs a redo, as one brief per line group. */
export function redoBriefs(notes: DesignNotes, names: Record<string, string>): string {
  return Object.entries(notes)
    .filter(([, n]) => n.status === "redo")
    .map(([id, n]) => designBrief(id, names[id] ?? id, n))
    .join("\n\n")
}
