/**
 * lib/draft-store.ts — Unsent text that survives a closed popup or a reload
 *
 * Quick Add and BIM Chat save the field on every keystroke and read it back on
 * the next open. A submit clears it. A dismissed dialog, a dropped keyboard, or
 * a web view that reloaded does not. Plain `localStorage`, one small JSON value
 * per key, every access in try/catch (private windows and full boxes throw).
 */

export const QUICK_ADD_DRAFT_KEY = "brain2-draft-quick-add"
export const BIM_CHAT_DRAFT_KEY = "brain2-draft-bim-chat"

export function readDraft<T extends object>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return value && typeof value === "object" ? (value as T) : null
  } catch {
    return null
  }
}

/** Save `value`, or drop the draft when `value` is null. */
export function writeDraft(key: string, value: object | null): void {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    /* storage unavailable or full: the draft just is not kept */
  }
}

/** Text drafts are empty when blank, so a cleared field removes the key. */
export function writeTextDraft(key: string, text: string, extra: object = {}): void {
  writeDraft(key, text.trim() ? { text, ...extra } : null)
}
